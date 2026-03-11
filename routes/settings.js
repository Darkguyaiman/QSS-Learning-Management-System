const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Redirect root settings to objectives
router.get('/', (req, res) => {
  res.redirect('/settings/objectives');
});

// Helper function to render settings template
function renderSettingsTemplate(req, res, config) {
  const error = req.session.error || null;
  delete req.session.error;
  
  res.render('settings/template', {
    user: req.session,
    ...config,
    error
  });
}

// ========== OBJECTIVES ==========
router.get('/objectives', async (req, res) => {
  try {
    const [objectives] = await req.db.query('SELECT * FROM objectives ORDER BY name ASC');
    
    renderSettingsTemplate(req, res, {
      pageTitle: 'Objectives',
      description: 'Manage training objectives and goals',
      icon: 'fas fa-bullseye',
      singularName: 'Objective',
      pluralName: 'Objectives',
      items: objectives,
      primaryField: 'name',
      nameField: 'name',
      nameLabel: 'Name',
      namePlaceholder: 'Enter objective name',
      descriptionPlaceholder: 'Enter objective description (optional)',
      createAction: '/settings/objectives/create',
      updateAction: '/settings/objectives',
      deleteAction: '/settings/objectives',
      tableHeaders: ['Name', 'Description'],
      hasModelDropdown: false,
      hasModelColumn: false
    });
  } catch (error) {
    console.error('Objectives page error:', error);
    res.status(500).send('Error loading objectives');
  }
});

router.post('/objectives/create', async (req, res) => {
  const { name, description } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO objectives (name, description) VALUES (?, ?)',
      [name, description || null]
    );
    res.redirect('/settings/objectives');
  } catch (error) {
    console.error('Objective creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Objective with this name already exists';
    } else {
      req.session.error = 'Error creating objective';
    }
    res.redirect('/settings/objectives');
  }
});

router.post('/objectives/:id/update', async (req, res) => {
  const { name, description } = req.body;
  
  try {
    await req.db.query(
      'UPDATE objectives SET name = ?, description = ? WHERE id = ?',
      [name, description || null, req.params.id]
    );
    res.redirect('/settings/objectives');
  } catch (error) {
    console.error('Objective update error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Objective with this name already exists';
    } else {
      req.session.error = 'Error updating objective';
    }
    res.redirect('/settings/objectives');
  }
});

router.post('/objectives/:id/delete', async (req, res) => {
  try {
    await req.db.query('DELETE FROM objectives WHERE id = ?', [req.params.id]);
    res.redirect('/settings/objectives');
  } catch (error) {
    console.error('Objective delete error:', error);
    req.session.error = 'Error deleting objective';
    res.redirect('/settings/objectives');
  }
});

// ========== HEALTHCARE ==========
router.get('/healthcare', async (req, res) => {
  try {
    const [healthcare] = await req.db.query('SELECT * FROM healthcare ORDER BY name ASC');
    
    renderSettingsTemplate(req, res, {
      pageTitle: 'Healthcare',
      description: 'Manage healthcare institutions and facilities',
      icon: 'fas fa-hospital',
      singularName: 'Healthcare',
      pluralName: 'Healthcare',
      items: healthcare,
      primaryField: 'name',
      nameField: 'name',
      nameLabel: 'Name',
      namePlaceholder: 'Enter healthcare name',
      descriptionPlaceholder: 'Enter healthcare description (optional)',
      createAction: '/settings/healthcare/create',
      updateAction: '/settings/healthcare',
      deleteAction: '/settings/healthcare',
      tableHeaders: ['Name', 'Description'],
      hasModelDropdown: false,
      hasModelColumn: false
    });
  } catch (error) {
    console.error('Healthcare page error:', error);
    res.status(500).send('Error loading healthcare');
  }
});

router.post('/healthcare/create', async (req, res) => {
  const { name, description } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO healthcare (name, description) VALUES (?, ?)',
      [name, description || null]
    );
    res.redirect('/settings/healthcare');
  } catch (error) {
    console.error('Healthcare creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Healthcare with this name already exists';
    } else {
      req.session.error = 'Error creating healthcare';
    }
    res.redirect('/settings/healthcare');
  }
});

router.post('/healthcare/:id/update', async (req, res) => {
  const { name, description } = req.body;
  
  try {
    await req.db.query(
      'UPDATE healthcare SET name = ?, description = ? WHERE id = ?',
      [name, description || null, req.params.id]
    );
    res.redirect('/settings/healthcare');
  } catch (error) {
    console.error('Healthcare update error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Healthcare with this name already exists';
    } else {
      req.session.error = 'Error updating healthcare';
    }
    res.redirect('/settings/healthcare');
  }
});

router.post('/healthcare/:id/delete', async (req, res) => {
  try {
    await req.db.query('DELETE FROM healthcare WHERE id = ?', [req.params.id]);
    res.redirect('/settings/healthcare');
  } catch (error) {
    console.error('Healthcare delete error:', error);
    req.session.error = 'Error deleting healthcare';
    res.redirect('/settings/healthcare');
  }
});

// ========== AREAS OF SPECIALIZATION ==========
router.get('/areas', async (req, res) => {
  try {
    const [areasOfSpecialization] = await req.db.query('SELECT * FROM areas_of_specialization ORDER BY name ASC');
    
    renderSettingsTemplate(req, res, {
      pageTitle: 'Areas of Specialization',
      description: 'Manage areas of specialization for trainees',
      icon: 'fas fa-user-md',
      singularName: 'Area of Specialization',
      pluralName: 'Areas of Specialization',
      items: areasOfSpecialization,
      primaryField: 'name',
      nameField: 'name',
      nameLabel: 'Name',
      namePlaceholder: 'Enter area of specialization',
      descriptionPlaceholder: 'Enter description (optional)',
      createAction: '/settings/areas-of-specialization/create',
      updateAction: '/settings/areas-of-specialization',
      deleteAction: '/settings/areas-of-specialization',
      tableHeaders: ['Name', 'Description'],
      hasModelDropdown: false,
      hasModelColumn: false
    });
  } catch (error) {
    console.error('Areas page error:', error);
    res.status(500).send('Error loading areas of specialization');
  }
});

router.post('/areas-of-specialization/create', async (req, res) => {
  const { name, description } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO areas_of_specialization (name, description) VALUES (?, ?)',
      [name, description || null]
    );
    res.redirect('/settings/areas');
  } catch (error) {
    console.error('Area of specialization creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Area of specialization with this name already exists';
    } else {
      req.session.error = 'Error creating area of specialization';
    }
    res.redirect('/settings/areas');
  }
});

router.post('/areas-of-specialization/:id/update', async (req, res) => {
  const { name, description } = req.body;
  
  try {
    await req.db.query(
      'UPDATE areas_of_specialization SET name = ?, description = ? WHERE id = ?',
      [name, description || null, req.params.id]
    );
    res.redirect('/settings/areas');
  } catch (error) {
    console.error('Area of specialization update error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Area of specialization with this name already exists';
    } else {
      req.session.error = 'Error updating area of specialization';
    }
    res.redirect('/settings/areas');
  }
});

router.post('/areas-of-specialization/:id/delete', async (req, res) => {
  try {
    await req.db.query('DELETE FROM areas_of_specialization WHERE id = ?', [req.params.id]);
    res.redirect('/settings/areas');
  } catch (error) {
    console.error('Area of specialization delete error:', error);
    req.session.error = 'Error deleting area of specialization';
    res.redirect('/settings/areas');
  }
});

// ========== K-LASER MODELS ==========
router.get('/models', async (req, res) => {
  try {
    const [kLaserModels] = await req.db.query('SELECT * FROM k_laser_models ORDER BY model_name ASC');
    
    renderSettingsTemplate(req, res, {
      pageTitle: 'K-Laser Models',
      description: 'Manage K-Laser device models',
      icon: 'fas fa-microchip',
      singularName: 'K-Laser Model',
      pluralName: 'K-Laser Models',
      items: kLaserModels,
      primaryField: 'model_name',
      nameField: 'model_name',
      nameLabel: 'Model Name',
      namePlaceholder: 'Enter model name',
      descriptionPlaceholder: 'Enter model description (optional)',
      createAction: '/settings/k-laser-models/create',
      updateAction: '/settings/k-laser-models',
      deleteAction: '/settings/k-laser-models',
      tableHeaders: ['Model Name', 'Description'],
      hasModelDropdown: false,
      hasModelColumn: false
    });
  } catch (error) {
    console.error('K-Laser models page error:', error);
    res.status(500).send('Error loading K-Laser models');
  }
});

router.post('/k-laser-models/create', async (req, res) => {
  const { model_name, description } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO k_laser_models (model_name, description) VALUES (?, ?)',
      [model_name, description || null]
    );
    res.redirect('/settings/models');
  } catch (error) {
    console.error('K-Laser model creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'K-Laser model with this name already exists';
    } else {
      req.session.error = 'Error creating K-Laser model';
    }
    res.redirect('/settings/models');
  }
});

router.post('/k-laser-models/:id/update', async (req, res) => {
  const { model_name, description } = req.body;
  
  try {
    await req.db.query(
      'UPDATE k_laser_models SET model_name = ?, description = ? WHERE id = ?',
      [model_name, description || null, req.params.id]
    );
    res.redirect('/settings/models');
  } catch (error) {
    console.error('K-Laser model update error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'K-Laser model with this name already exists';
    } else {
      req.session.error = 'Error updating K-Laser model';
    }
    res.redirect('/settings/models');
  }
});

router.post('/k-laser-models/:id/delete', async (req, res) => {
  try {
    // Check if any devices are using this model
    const [devices] = await req.db.query(
      'SELECT COUNT(*) as count FROM device_serial_numbers WHERE k_laser_model_id = ?',
      [req.params.id]
    );
    
    if (devices[0].count > 0) {
      req.session.error = 'Cannot delete K-Laser model. There are devices using this model.';
      return res.redirect('/settings/models');
    }
    
    await req.db.query('DELETE FROM k_laser_models WHERE id = ?', [req.params.id]);
    res.redirect('/settings/models');
  } catch (error) {
    console.error('K-Laser model delete error:', error);
    req.session.error = 'Error deleting K-Laser model';
    res.redirect('/settings/models');
  }
});

// ========== DEVICE SERIAL NUMBERS ==========
router.get('/devices', async (req, res) => {
  try {
    const [kLaserModels] = await req.db.query('SELECT * FROM k_laser_models ORDER BY model_name ASC');
    const [deviceSerialNumbers] = await req.db.query(`
      SELECT d.*, k.model_name 
      FROM device_serial_numbers d
      LEFT JOIN k_laser_models k ON d.k_laser_model_id = k.id
      ORDER BY d.serial_number ASC
    `);
    
    renderSettingsTemplate(req, res, {
      pageTitle: 'Device Serial Numbers',
      description: 'Manage device serial numbers and their associated K-Laser models',
      icon: 'fas fa-server',
      singularName: 'Device Serial Number',
      pluralName: 'Device Serial Numbers',
      items: deviceSerialNumbers,
      primaryField: 'serial_number',
      nameField: 'serial_number',
      nameLabel: 'Serial Number',
      namePlaceholder: 'Enter serial number',
      descriptionPlaceholder: 'Enter notes (optional)',
      createAction: '/settings/device-serial-numbers/create',
      updateAction: '/settings/device-serial-numbers',
      deleteAction: '/settings/device-serial-numbers',
      tableHeaders: ['Serial Number', 'K-Laser Model', 'Notes'],
      hasModelDropdown: true,
      hasModelColumn: true,
      kLaserModels
    });
  } catch (error) {
    console.error('Device serial numbers page error:', error);
    res.status(500).send('Error loading device serial numbers');
  }
});

router.post('/device-serial-numbers/create', async (req, res) => {
  const { serial_number, k_laser_model_id, notes } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO device_serial_numbers (serial_number, k_laser_model_id, notes) VALUES (?, ?, ?)',
      [serial_number, k_laser_model_id, notes || null]
    );
    res.redirect('/settings/devices');
  } catch (error) {
    console.error('Device serial number creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Device serial number already exists';
    } else {
      req.session.error = 'Error creating device serial number';
    }
    res.redirect('/settings/devices');
  }
});

router.post('/device-serial-numbers/:id/update', async (req, res) => {
  const { serial_number, k_laser_model_id, notes } = req.body;
  
  try {
    await req.db.query(
      'UPDATE device_serial_numbers SET serial_number = ?, k_laser_model_id = ?, notes = ? WHERE id = ?',
      [serial_number, k_laser_model_id, notes || null, req.params.id]
    );
    res.redirect('/settings/devices');
  } catch (error) {
    console.error('Device serial number update error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Device serial number already exists';
    } else {
      req.session.error = 'Error updating device serial number';
    }
    res.redirect('/settings/devices');
  }
});

router.post('/device-serial-numbers/:id/delete', async (req, res) => {
  try {
    await req.db.query('DELETE FROM device_serial_numbers WHERE id = ?', [req.params.id]);
    res.redirect('/settings/devices');
  } catch (error) {
    console.error('Device serial number delete error:', error);
    req.session.error = 'Error deleting device serial number';
    res.redirect('/settings/devices');
  }
});

// ========== HANDS-ON ASPECTS ==========
router.get('/hands-on-aspects', async (req, res) => {
  try {
    const [handsOnAspects] = await req.db.query('SELECT * FROM hands_on_aspects_settings ORDER BY aspect_name ASC');
    
    renderSettingsTemplate(req, res, {
      pageTitle: 'Hands-On Aspects',
      description: 'Manage hands-on assessment aspects and their maximum scores',
      icon: 'fas fa-hand-paper',
      singularName: 'Hands-On Aspect',
      pluralName: 'Hands-On Aspects',
      items: handsOnAspects,
      primaryField: 'aspect_name',
      nameField: 'aspect_name',
      nameLabel: 'Aspect Name',
      namePlaceholder: 'Enter aspect name',
      descriptionPlaceholder: 'Enter aspect description (optional)',
      createAction: '/settings/hands-on-aspects/create',
      updateAction: '/settings/hands-on-aspects',
      deleteAction: '/settings/hands-on-aspects',
      tableHeaders: ['Aspect Name', 'Description', 'Max Score'],
      hasModelDropdown: false,
      hasModelColumn: false,
      hasMaxScore: true
    });
  } catch (error) {
    console.error('Hands-on aspects page error:', error);
    res.status(500).send('Error loading hands-on aspects');
  }
});

router.post('/hands-on-aspects/create', async (req, res) => {
  const { aspect_name, description, max_score } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO hands_on_aspects_settings (aspect_name, description, max_score) VALUES (?, ?, ?)',
      [aspect_name, description || null, max_score || 100]
    );
    res.redirect('/settings/hands-on-aspects');
  } catch (error) {
    console.error('Hands-on aspect creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Hands-on aspect with this name already exists';
    } else {
      req.session.error = 'Error creating hands-on aspect';
    }
    res.redirect('/settings/hands-on-aspects');
  }
});

router.post('/hands-on-aspects/:id/update', async (req, res) => {
  const { aspect_name, description, max_score } = req.body;
  
  try {
    await req.db.query(
      'UPDATE hands_on_aspects_settings SET aspect_name = ?, description = ?, max_score = ? WHERE id = ?',
      [aspect_name, description || null, max_score || 100, req.params.id]
    );
    res.redirect('/settings/hands-on-aspects');
  } catch (error) {
    console.error('Hands-on aspect update error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Hands-on aspect with this name already exists';
    } else {
      req.session.error = 'Error updating hands-on aspect';
    }
    res.redirect('/settings/hands-on-aspects');
  }
});

router.post('/hands-on-aspects/:id/delete', async (req, res) => {
  try {
    // Note: We don't check for existing trainings using this aspect
    // because aspects are copied to trainings at creation time
    await req.db.query('DELETE FROM hands_on_aspects_settings WHERE id = ?', [req.params.id]);
    res.redirect('/settings/hands-on-aspects');
  } catch (error) {
    console.error('Hands-on aspect delete error:', error);
    req.session.error = 'Error deleting hands-on aspect';
    res.redirect('/settings/hands-on-aspects');
  }
});

// ========== USER POSITIONS (Admin Only) ==========
router.get('/users', async (req, res) => {
  try {
    if (req.session.userRole !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    
    const [users] = await req.db.query(`
      SELECT id, email, first_name, last_name, role, position, profile_picture
      FROM users
      WHERE role IN ('admin', 'trainer')
      ORDER BY role ASC, last_name ASC, first_name ASC
    `);

    renderSettingsTemplate(req, res, {
      pageType: 'users',
      pageTitle: 'Users',
      description: 'Manage Admin/Trainer users. Position is required (used in reports).',
      icon: 'fas fa-users-cog',
      users
    });
  } catch (error) {
    console.error('User positions page error:', error);
    res.status(500).send('Error loading user positions');
  }
});

router.post('/users/create', async (req, res) => {
  try {
    if (req.session.userRole !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    
    const { first_name, last_name, email, password, role, position } = req.body;
    
    const cleanRole = (role || '').trim().toLowerCase();
    if (!['admin', 'trainer'].includes(cleanRole)) {
      req.session.error = 'Invalid role. Only admin or trainer is allowed.';
      return res.redirect('/settings/users');
    }
    
    if (!first_name || !last_name || !email || !password || !position) {
      req.session.error = 'Please fill First Name, Last Name, Email, Password, and Position.';
      return res.redirect('/settings/users');
    }
    
    if (String(password).length < 6) {
      req.session.error = 'Password must be at least 6 characters.';
      return res.redirect('/settings/users');
    }
    
    const [existing] = await req.db.query('SELECT id FROM users WHERE email = ?', [email.trim()]);
    if (existing.length > 0) {
      req.session.error = 'Email already exists in users.';
      return res.redirect('/settings/users');
    }
    
    if (!position || position.trim() === '') {
      req.session.error = 'Position is required.';
      return res.redirect('/settings/users');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await req.db.query(
      'INSERT INTO users (email, password, first_name, last_name, role, position) VALUES (?, ?, ?, ?, ?, ?)',
      [
        email.trim(),
        hashedPassword,
        first_name.trim(),
        last_name.trim(),
        cleanRole,
        position.trim()
      ]
    );
    
    res.redirect('/settings/users');
  } catch (error) {
    console.error('Create admin/trainer error:', error);
    req.session.error = 'Error creating user';
    res.redirect('/settings/users');
  }
});

router.post('/users/:id/update', async (req, res) => {
  try {
    if (req.session.userRole !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    
    const { first_name, last_name, email, role, position } = req.body;
    const userId = parseInt(req.params.id);
    
    if (!position || position.trim() === '') {
      req.session.error = 'Position is required.';
      return res.redirect('/settings/users');
    }
    
    const cleanRole = (role || '').trim().toLowerCase();
    if (!['admin', 'trainer'].includes(cleanRole)) {
      req.session.error = 'Invalid role. Only admin or trainer is allowed.';
      return res.redirect('/settings/users');
    }
    
    // If email is changing, ensure uniqueness
    if (email && email.trim()) {
      const [existing] = await req.db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email.trim(), userId]);
      if (existing.length > 0) {
        req.session.error = 'Email already exists in users.';
        return res.redirect('/settings/users');
      }
    }
    
    await req.db.query(
      'UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, position = ? WHERE id = ? AND role IN (\'admin\', \'trainer\')',
      [
        first_name && first_name.trim() ? first_name.trim() : '',
        last_name && last_name.trim() ? last_name.trim() : '',
        email && email.trim() ? email.trim() : '',
        cleanRole,
        position.trim(),
        userId
      ]
    );
    
    // If admin updated their own position, keep session in sync
    if (req.session.userId === userId) {
      req.session.userPosition = position.trim();
      req.session.userName = `${(first_name || '').trim()} ${(last_name || '').trim()}`.trim() || req.session.userName;
      req.session.userRole = cleanRole;
    }
    
    res.redirect('/settings/users');
  } catch (error) {
    console.error('User position update error:', error);
    req.session.error = 'Error updating position';
    res.redirect('/settings/users');
  }
});

router.post('/users/:id/delete', async (req, res) => {
  try {
    if (req.session.userRole !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    
    const userId = parseInt(req.params.id);
    if (req.session.userId === userId) {
      req.session.error = 'You cannot delete your own account while logged in.';
      return res.redirect('/settings/users');
    }
    
    await req.db.query('DELETE FROM users WHERE id = ? AND role IN (\'admin\', \'trainer\')', [userId]);
    res.redirect('/settings/users');
  } catch (error) {
    console.error('User delete error:', error);
    req.session.error = 'Error deleting user';
    res.redirect('/settings/users');
  }
});

module.exports = router;
