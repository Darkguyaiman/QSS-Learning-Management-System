require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Seed password for default users (admin, trainer) - from .env or fallback
const SEED_PASSWORD = process.env.SEED_PASSWORD || '1234567890';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Function to generate unique trainee ID (T + 6 random digits)
function generateTraineeId() {
  const digits = Math.floor(100000 + Math.random() * 900000); // 6 random digits
  return `T${digits}`;
}

// Function to check if trainee ID exists
async function traineeIdExists(connection, traineeId) {
  const [rows] = await connection.query(
    'SELECT id FROM trainees WHERE trainee_id = ?',
    [traineeId]
  );
  return rows.length > 0;
}

// Function to generate unique trainee ID
async function generateUniqueTraineeId(connection) {
  let traineeId;
  let exists = true;

  while (exists) {
    traineeId = generateTraineeId();
    exists = await traineeIdExists(connection, traineeId);
  }

  return traineeId;
}

// Default users to seed (admin and trainer only). Password from SEED_PASSWORD (.env).
const DEFAULT_USERS = [
  { email: 'admin@lms.com', first_name: 'Admin', last_name: 'User', role: 'admin' },
  { email: 'trainer@lms.com', first_name: 'John', last_name: 'Trainer', role: 'trainer' }
];

// Seed default users (admin, trainer) if they don't exist. Password hashed from SEED_PASSWORD.
async function seedDefaultUsers(connection) {
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const u of DEFAULT_USERS) {
    try {
      await connection.query(
        `INSERT INTO users (email, password, first_name, last_name, position, role)
         VALUES (?, ?, ?, ?, '', ?)`,
        [u.email, hashedPassword, u.first_name, u.last_name, u.role]
      );
      console.log(`✓ Seeded user: ${u.email}`);
    } catch (err) {
      if (err.message.includes('Duplicate entry')) {
        // User already exists, skip
      } else {
        console.warn('Seed user warning:', err.message);
      }
    }
  }
}

// Initialize database: create DB, run schema only, seed default users
async function initializeDatabase() {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    await connection.query('CREATE DATABASE IF NOT EXISTS lms_db');
    await connection.query('USE lms_db');

    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    const statements = schema
      .split(';')
      .map(s => {
        return s.split('\n')
          .map(line => {
            const commentIndex = line.indexOf('--');
            if (commentIndex >= 0) {
              return line.substring(0, commentIndex);
            }
            return line;
          })
          .join('\n')
          .trim();
      })
      .filter(s => {
        return s.length > 0 &&
               !s.toLowerCase().startsWith('use') &&
               !s.toLowerCase().startsWith('create database');
      });

    console.log(`Executing ${statements.length} schema statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          await connection.query(statement);
          const tableMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
          if (tableMatch) {
            console.log(`✓ Created table: ${tableMatch[1]}`);
          }
        } catch (error) {
          if (error.message.includes('already exists') ||
              error.message.includes('Duplicate') ||
              error.code === 'ER_DUP_KEYNAME') {
            const tableMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
            if (tableMatch) {
              console.log(`- Table ${tableMatch[1]} already exists, skipping`);
            }
          } else if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes("doesn't exist")) {
            console.warn(`⚠ Warning executing statement ${i + 1}: ${error.message}`);
          } else {
            console.error(`✗ Error executing statement ${i + 1}:`, error.message);
          }
        }
      }
    }

    await seedDefaultUsers(connection);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Create connection pool with database
const pool = mysql.createPool({
  ...dbConfig,
  database: 'lms_db'
});

module.exports = {
  pool,
  initializeDatabase,
  generateUniqueTraineeId
};
