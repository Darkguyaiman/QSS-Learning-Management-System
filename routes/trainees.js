const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// List all trainees
router.get('/', async (req, res) => {
  try {
    const statusFilter = req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : [];
    const healthcareFilter = req.query.healthcare || null;
    const searchQuery = req.query.search || '';
    
    let query = `
      SELECT 
        id,
        trainee_id,
        first_name,
        last_name,
        email,
        ic_passport,
        handphone_number,
        healthcare,
        designation,
        area_of_specialization,
        serial_number,
        first_training,
        latest_training,
        recertification_date,
        number_of_completed_trainings,
        trainee_status,
        created_at
      FROM trainees
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // Apply status filter
    if (statusFilter.length > 0) {
      const placeholders = statusFilter.map(() => '?').join(',');
      query += ` AND trainee_status IN (${placeholders})`;
      queryParams.push(...statusFilter);
    }
    
    // Apply healthcare filter
    if (healthcareFilter) {
      query += ` AND healthcare = ?`;
      queryParams.push(healthcareFilter);
    }
    
    // Add search filter if provided
    if (searchQuery) {
      query += ` AND (
        trainee_id LIKE ? OR
        first_name LIKE ? OR
        last_name LIKE ? OR
        CONCAT(first_name, ' ', last_name) LIKE ? OR
        email LIKE ? OR
        ic_passport LIKE ? OR
        handphone_number LIKE ? OR
        healthcare LIKE ? OR
        designation LIKE ?
      )`;
      const searchTerm = `%${searchQuery}%`;
      queryParams.push(
        searchTerm, searchTerm, searchTerm, searchTerm,
        searchTerm, searchTerm, searchTerm, searchTerm, searchTerm
      );
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [trainees] = await req.db.query(query, queryParams);
    
    // Fetch distinct healthcare centers from trainees
    const [healthcareList] = await req.db.query(`
      SELECT DISTINCT healthcare as name
      FROM trainees
      WHERE healthcare IS NOT NULL AND healthcare != ''
      ORDER BY healthcare ASC
    `);
    
    res.render('trainees/list', { 
      user: req.session, 
      trainees,
      searchQuery,
      selectedStatuses: statusFilter,
      selectedHealthcare: healthcareFilter,
      healthcare: healthcareList
    });
  } catch (error) {
    console.error('Trainees list error:', error);
    res.status(500).send('Error loading trainees');
  }
});

// Create trainee page
router.get('/create', (req, res) => {
  res.render('trainees/create', { 
    user: req.session, 
    error: null 
  });
});

// Create trainee POST
router.post('/create', async (req, res) => {
  const { 
    firstName, 
    lastName, 
    email, 
    password, 
    icPassport,
    handphoneNumber,
    healthcare,
    designation,
    areaOfSpecialization,
    traineeStatus
  } = req.body;
  
  try {
    // Validate required fields
    if (!firstName || !lastName || !email || !password || !icPassport) {
      return res.render('trainees/create', { 
        user: req.session, 
        error: 'Please fill in all required fields' 
      });
    }
    
    // Check if email already exists
    const [existingTrainee] = await req.db.query(
      'SELECT id FROM trainees WHERE email = ?',
      [email]
    );
    
    if (existingTrainee.length > 0) {
      return res.render('trainees/create', { 
        user: req.session, 
        error: 'Email already registered' 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate unique trainee ID
    const { generateUniqueTraineeId } = require('../config/database');
    const connection = await req.db.getConnection();
    const traineeId = await generateUniqueTraineeId(connection);
    connection.release();
    
    // Insert trainee
    await req.db.query(
      `INSERT INTO trainees (
        trainee_id, email, password, first_name, last_name, 
        ic_passport, handphone_number, healthcare, designation, 
        area_of_specialization, trainee_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        traineeId, 
        email, 
        hashedPassword, 
        firstName, 
        lastName,
        icPassport, 
        handphoneNumber || null, 
        healthcare || null, 
        designation || null,
        areaOfSpecialization || null, 
        traineeStatus || 'active'
      ]
    );
    
    res.redirect('/trainees');
  } catch (error) {
    console.error('Trainee creation error:', error);
    res.render('trainees/create', { 
      user: req.session, 
      error: 'An error occurred. Please try again.' 
    });
  }
});

// Edit trainee page
router.get('/:id/edit', async (req, res) => {
  try {
    const [trainees] = await req.db.query(
      'SELECT * FROM trainees WHERE id = ?',
      [req.params.id]
    );
    
    if (trainees.length === 0) {
      return res.status(404).send('Trainee not found');
    }
    
    res.render('trainees/edit', { 
      user: req.session, 
      trainee: trainees[0],
      error: null 
    });
  } catch (error) {
    console.error('Trainee edit error:', error);
    res.status(500).send('Error loading trainee');
  }
});

// Edit trainee POST
router.post('/:id/edit', async (req, res) => {
  const { 
    firstName, 
    lastName, 
    email, 
    password, 
    icPassport,
    handphoneNumber,
    healthcare,
    designation,
    areaOfSpecialization,
    traineeStatus
  } = req.body;
  
  try {
    // Validate required fields
    if (!firstName || !lastName || !email || !icPassport) {
      const [trainees] = await req.db.query(
        'SELECT * FROM trainees WHERE id = ?',
        [req.params.id]
      );
      return res.render('trainees/edit', { 
        user: req.session, 
        trainee: trainees[0],
        error: 'Please fill in all required fields' 
      });
    }
    
    // Check if email already exists (excluding current trainee)
    const [existingTrainee] = await req.db.query(
      'SELECT id FROM trainees WHERE email = ? AND id != ?',
      [email, req.params.id]
    );
    
    if (existingTrainee.length > 0) {
      const [trainees] = await req.db.query(
        'SELECT * FROM trainees WHERE id = ?',
        [req.params.id]
      );
      return res.render('trainees/edit', { 
        user: req.session, 
        trainee: trainees[0],
        error: 'Email already registered to another trainee' 
      });
    }
    
    // Build update query
    let updateQuery = `
      UPDATE trainees SET 
        first_name = ?, 
        last_name = ?, 
        email = ?, 
        ic_passport = ?,
        handphone_number = ?,
        healthcare = ?,
        designation = ?,
        area_of_specialization = ?,
        trainee_status = ?
    `;
    let updateValues = [
      firstName,
      lastName,
      email,
      icPassport,
      handphoneNumber || null,
      healthcare || null,
      designation || null,
      areaOfSpecialization || null,
      traineeStatus || 'active'
    ];
    
    // Update password only if provided
    if (password && password.length >= 6) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += ', password = ?';
      updateValues.push(hashedPassword);
    }
    
    updateQuery += ' WHERE id = ?';
    updateValues.push(req.params.id);
    
    await req.db.query(updateQuery, updateValues);
    
    res.redirect('/trainees');
  } catch (error) {
    console.error('Trainee update error:', error);
    const [trainees] = await req.db.query(
      'SELECT * FROM trainees WHERE id = ?',
      [req.params.id]
    );
    res.render('trainees/edit', { 
      user: req.session, 
      trainee: trainees[0] || {},
      error: 'An error occurred. Please try again.' 
    });
  }
});

module.exports = router;


