const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Login page
router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { error: null });
});

// Login POST
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Try to find in users table (admin/trainer)
    const [users] = await req.db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length > 0) {
      const user = users[0];
      const validPassword = await bcrypt.compare(password, user.password);
      
      if (!validPassword) {
        return res.render('auth/login', { error: 'Invalid email or password' });
      }
      
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = `${user.first_name} ${user.last_name}`;
      req.session.userProfile = user.profile_picture;
      req.session.userPosition = user.position || '';
      
      return res.redirect('/dashboard');
    }
    
    // Try to find in trainees table
    const [trainees] = await req.db.query(
      'SELECT * FROM trainees WHERE email = ?',
      [email]
    );
    
    if (trainees.length > 0) {
      const trainee = trainees[0];
      const validPassword = await bcrypt.compare(password, trainee.password);
      
      if (!validPassword) {
        return res.render('auth/login', { error: 'Invalid email or password' });
      }
      
      req.session.userId = trainee.id;
      req.session.userRole = 'trainee';
      req.session.userName = `${trainee.first_name} ${trainee.last_name}`;
      req.session.userProfile = trainee.profile_picture;
      req.session.traineeId = trainee.trainee_id;
      
      return res.redirect('/dashboard');
    }
    
    return res.render('auth/login', { error: 'Invalid email or password' });
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', { error: 'An error occurred. Please try again.' });
  }
});

// Register page
router.get('/register', async (req, res) => {
  try {
    // Load all areas of specialization (small list, safe to load fully)
    const [areasOfSpecialization] = await req.db.query(
      'SELECT id, name FROM areas_of_specialization ORDER BY name ASC'
    );

    res.render('auth/register', { 
      error: null,
      areasOfSpecialization 
    });
  } catch (error) {
    console.error('Register page load error:', error);
    res.render('auth/register', { error: 'Unable to load registration form. Please try again.' });
  }
});

// Register POST
router.post('/register', async (req, res) => {
  const { 
    email, 
    password, 
    firstName, 
    lastName, 
    role,
    // Trainee-specific fields
    icPassport,
    handphoneNumber,
    healthcare,
    designation,
    areaOfSpecialization,
    serialNumber
  } = req.body;
  
  // Check if request is AJAX
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || 
                 req.headers['content-type']?.includes('application/json') ||
                 req.headers['accept']?.includes('application/json');
  
  // Debug: Log request details if body is undefined
  if (!req.body || Object.keys(req.body).length === 0) {
    console.error('Request body is empty or undefined');
    console.error('Content-Type:', req.headers['content-type']);
    console.error('Method:', req.method);
    console.error('Headers:', JSON.stringify(req.headers, null, 2));
    
    if (isAjax) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. Please ensure all fields are filled correctly.',
        validationErrors: ['Request body is empty. Please try again.'],
        fieldErrors: {}
      });
    } else {
      return await sendHtmlResponse('Invalid request. Please try again.');
    }
  }
  
  // Helper function to send JSON response
  const sendJsonResponse = (success, message, validationErrors = [], fieldErrors = {}) => {
    return res.json({
      success,
      message,
      validationErrors,
      fieldErrors
    });
  };
  
  // Helper function to send HTML response (for non-AJAX requests)
  const sendHtmlResponse = async (error = null) => {
    try {
      const [areasOfSpecialization] = await req.db.query(
        'SELECT id, name FROM areas_of_specialization ORDER BY name ASC'
      );
      return res.render('auth/register', { 
        error,
        areasOfSpecialization
      });
    } catch (err) {
      console.error('Error loading areas of specialization:', err);
      return res.render('auth/register', { 
        error: error || 'An error occurred. Please try again.'
      });
    }
  };
  
  // Validation
  const validationErrors = [];
  const fieldErrors = {};
  
  if (!firstName || !firstName.trim()) {
    validationErrors.push('First Name is required');
    fieldErrors.firstName = 'First Name is required';
  }
  
  if (!lastName || !lastName.trim()) {
    validationErrors.push('Last Name is required');
    fieldErrors.lastName = 'Last Name is required';
  }
  
  if (!email || !email.trim()) {
    validationErrors.push('Email is required');
    fieldErrors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    validationErrors.push('Please enter a valid email address');
    fieldErrors.email = 'Please enter a valid email address';
  }
  
  if (!password || !password.trim()) {
    validationErrors.push('Password is required');
    fieldErrors.password = 'Password is required';
  } else if (password.length < 6) {
    validationErrors.push('Password must be at least 6 characters long');
    fieldErrors.password = 'Password must be at least 6 characters long';
  }
  
  if (role === 'trainee') {
    if (!icPassport || !icPassport.trim()) {
      validationErrors.push('IC/Passport is required');
      fieldErrors.icPassport = 'IC/Passport is required';
    }
    
    if (!handphoneNumber || !handphoneNumber.trim()) {
      validationErrors.push('Handphone Number is required');
      fieldErrors.handphoneNumber = 'Handphone Number is required';
    }
    
    if (!healthcare || !healthcare.trim()) {
      validationErrors.push('Healthcare is required');
      fieldErrors.healthcare = 'Healthcare is required';
    }
    
    if (!designation || !designation.trim()) {
      validationErrors.push('Designation is required');
      fieldErrors.designation = 'Designation is required';
    }
    
    // Validate Area of Specialization - must have at least one selected
    if (!areaOfSpecialization || 
        (Array.isArray(areaOfSpecialization) && areaOfSpecialization.length === 0) ||
        (typeof areaOfSpecialization === 'string' && !areaOfSpecialization.trim())) {
      validationErrors.push('At least one Area of Specialization must be selected');
      fieldErrors.areaOfSpecialization = 'At least one Area of Specialization must be selected';
    }
  }
  
  if (validationErrors.length > 0) {
    if (isAjax) {
      return sendJsonResponse(false, 'Please fill in all required fields correctly.', validationErrors, fieldErrors);
    } else {
      return await sendHtmlResponse('Please fill in all required fields correctly.');
    }
  }
  
  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    if (role === 'trainee') {
      // Register as trainee
      // Check if email exists in trainees table
      const [existingTrainee] = await req.db.query(
        'SELECT id FROM trainees WHERE email = ?',
        [email]
      );
      
      if (existingTrainee.length > 0) {
        if (isAjax) {
          return sendJsonResponse(false, 'Email already registered. Please use a different email address.');
        } else {
          return await sendHtmlResponse('Email already registered');
        }
      }
      
      // Generate unique trainee ID
      const { generateUniqueTraineeId } = require('../config/database');
      const connection = await req.db.getConnection();
      const traineeId = await generateUniqueTraineeId(connection);
      connection.release();

      // Normalize areaOfSpecialization: support multi-select (array) or single value
      let normalizedAreaOfSpecialization = null;
      if (Array.isArray(areaOfSpecialization)) {
        normalizedAreaOfSpecialization = areaOfSpecialization.join(', ');
      } else if (areaOfSpecialization) {
        normalizedAreaOfSpecialization = areaOfSpecialization;
      }
      
      // Insert trainee with all required fields
      await req.db.query(
        `INSERT INTO trainees (
          trainee_id, email, password, first_name, last_name, 
          ic_passport, handphone_number, healthcare, designation, 
          area_of_specialization, serial_number, trainee_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered')`,
        [
          traineeId, email, hashedPassword, firstName, lastName,
          icPassport, handphoneNumber, healthcare, designation,
          normalizedAreaOfSpecialization, serialNumber || null
        ]
      );
    } else {
      // Register as admin or trainer
      // Check if user exists
      const [existing] = await req.db.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      
      if (existing.length > 0) {
        if (isAjax) {
          return sendJsonResponse(false, 'Email already registered. Please use a different email address.');
        } else {
          return await sendHtmlResponse('Email already registered');
        }
      }
      
      // Insert user
      await req.db.query(
        'INSERT INTO users (email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
        [email, hashedPassword, firstName, lastName, role]
      );
    }
    
    if (isAjax) {
      return sendJsonResponse(true, 'Registration successful!');
    } else {
      res.redirect('/login');
    }
  } catch (error) {
    console.error('Registration error:', error);
    const errorMessage = error.code === 'ER_DUP_ENTRY' 
      ? 'Email already registered. Please use a different email address.'
      : 'An error occurred during registration. Please try again.';
    
    if (isAjax) {
      return sendJsonResponse(false, errorMessage);
    } else {
      return await sendHtmlResponse(errorMessage);
    }
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Public healthcare search endpoint for registration form
router.get('/healthcare/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  
  try {
    let sql = 'SELECT id, name FROM healthcare';
    const params = [];
    
    if (query) {
      sql += ' WHERE name LIKE ?';
      params.push(`%${query}%`);
    }
    
    sql += ' ORDER BY name ASC LIMIT 20';
    
    const [rows] = await req.db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Healthcare search error:', error);
    res.status(500).json([]);
  }
});

module.exports = router;
