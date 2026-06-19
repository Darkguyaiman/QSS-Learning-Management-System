require('dotenv').config();
const { pool } = require('../config/database');
const { normalizePersonName } = require('../utils/nameNormalizer');

const SHOULD_APPLY = process.argv.includes('--apply');
const SHOW_ALL = process.argv.includes('--show-all');

async function main() {
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.query(
      'SELECT id, trainee_id, first_name, last_name FROM trainees ORDER BY id ASC'
    );

    const normalizedRows = rows.map(row => {
      const nextFirstName = normalizePersonName(row.first_name);
      const nextLastName = normalizePersonName(row.last_name);

      return {
        ...row,
        nextFirstName,
        nextLastName,
        changed: nextFirstName !== row.first_name || nextLastName !== row.last_name
      };
    });

    const changes = normalizedRows.filter(row => row.changed);
    const rowsToPrint = SHOW_ALL ? normalizedRows : changes;

    console.log(`Checked ${normalizedRows.length} trainee name(s).`);
    console.log(`${changes.length} trainee name(s) need normalization.`);
    console.log('');

    for (const row of rowsToPrint) {
      const status = row.changed ? 'CHANGE' : 'OK';
      console.log(
        `[${status}] [${row.trainee_id}] ${row.first_name} ${row.last_name} -> ${row.nextFirstName} ${row.nextLastName}`
      );
    }

    if (!SHOULD_APPLY) {
      console.log('');
      console.log('Dry run only. Re-run with --apply to update the database.');
      console.log('Add --show-all to include trainees that already match the rules.');
      return;
    }

    await connection.beginTransaction();

    try {
      for (const row of normalizedRows) {
        await connection.query(
          'UPDATE trainees SET first_name = ?, last_name = ? WHERE id = ?',
          [row.nextFirstName, row.nextLastName, row.id]
        );
      }

      await connection.commit();
      console.log('');
      console.log(`Updated all ${normalizedRows.length} trainee name(s).`);
      console.log(`${changes.length} row(s) had values that needed changing.`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('Failed to normalize trainee names:', error.message || error);
  process.exit(1);
});
