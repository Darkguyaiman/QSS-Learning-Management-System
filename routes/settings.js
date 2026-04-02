const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

const certificateStorage = multer.diskStorage({
  destination: './public/uploads/certificates/',
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname || '');
    cb(null, `certificate-${Date.now()}${safeExt}`);
  }
});
const certificateUpload = multer({
  storage: certificateStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

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

function renderSettingsForm(req, res, config) {
  const error = req.session.error || null;
  delete req.session.error;

  res.render('settings/form', {
    user: req.session,
    ...config,
    error
  });
}

async function getAreasOfSpecialization(db) {
  const [rows] = await db.query('SELECT id, name FROM areas_of_specialization ORDER BY name ASC');
  return rows;
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
      createPage: '/settings/objectives/new',
      editBase: '/settings/objectives',
      tableHeaders: ['Name', 'Description'],
      hasModelDropdown: false,
      hasModelColumn: false
    });
  } catch (error) {
    console.error('Objectives page error:', error);
    res.status(500).send('Error loading objectives');
  }
});

router.get('/objectives/new', (req, res) => {
  renderSettingsForm(req, res, {
    pageTitle: 'Objectives',
    description: 'Add a new training objective',
    icon: 'fas fa-bullseye',
    singularName: 'Objective',
    pluralName: 'Objectives',
    formMode: 'create',
    formAction: '/settings/objectives/create',
    backUrl: '/settings/objectives',
    nameField: 'name',
    nameLabel: 'Name',
    namePlaceholder: 'Enter objective name',
    descriptionPlaceholder: 'Enter objective description (optional)',
    hasModelDropdown: false,
    hasMaxScore: false
  });
});

router.get('/objectives/:id/edit', async (req, res) => {
  try {
    const [rows] = await req.db.query('SELECT * FROM objectives WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      req.session.error = 'Objective not found.';
      return res.redirect('/settings/objectives');
    }

    renderSettingsForm(req, res, {
      pageTitle: 'Objectives',
      description: 'Edit training objective details',
      icon: 'fas fa-bullseye',
      singularName: 'Objective',
      pluralName: 'Objectives',
      formMode: 'edit',
      formAction: `/settings/objectives/${req.params.id}/update`,
      backUrl: '/settings/objectives',
      nameField: 'name',
      nameLabel: 'Name',
      namePlaceholder: 'Enter objective name',
      descriptionPlaceholder: 'Enter objective description (optional)',
      hasModelDropdown: false,
      hasMaxScore: false,
      item: rows[0]
    });
  } catch (error) {
    console.error('Objective edit page error:', error);
    res.status(500).send('Error loading objective');
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
      createPage: '/settings/healthcare/new',
      editBase: '/settings/healthcare',
      tableHeaders: ['Name', 'Hospital Address'],
      hasModelDropdown: false,
      hasModelColumn: false,
      hasAddressField: true,
      addressLabel: 'Hospital Address',
      addressPlaceholder: 'Enter hospital address',
      hasDescriptionField: false
    });
  } catch (error) {
    console.error('Healthcare page error:', error);
    res.status(500).send('Error loading healthcare');
  }
});

router.get('/healthcare/new', (req, res) => {
  renderSettingsForm(req, res, {
    pageTitle: 'Healthcare',
    description: 'Add a new healthcare institution',
    icon: 'fas fa-hospital',
    singularName: 'Healthcare',
    pluralName: 'Healthcare',
    formMode: 'create',
    formAction: '/settings/healthcare/create',
    backUrl: '/settings/healthcare',
    nameField: 'name',
    nameLabel: 'Name',
    namePlaceholder: 'Enter healthcare name',
    descriptionPlaceholder: 'Enter healthcare description (optional)',
    hasModelDropdown: false,
    hasMaxScore: false,
    hasAddressField: true,
    addressLabel: 'Hospital Address',
    addressPlaceholder: 'Enter hospital address',
    hasDescriptionField: false
  });
});

router.get('/healthcare/:id/edit', async (req, res) => {
  try {
    const [rows] = await req.db.query('SELECT * FROM healthcare WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      req.session.error = 'Healthcare not found.';
      return res.redirect('/settings/healthcare');
    }

    renderSettingsForm(req, res, {
      pageTitle: 'Healthcare',
      description: 'Edit healthcare institution details',
      icon: 'fas fa-hospital',
      singularName: 'Healthcare',
      pluralName: 'Healthcare',
      formMode: 'edit',
      formAction: `/settings/healthcare/${req.params.id}/update`,
      backUrl: '/settings/healthcare',
      nameField: 'name',
      nameLabel: 'Name',
      namePlaceholder: 'Enter healthcare name',
      descriptionPlaceholder: 'Enter healthcare description (optional)',
      hasModelDropdown: false,
      hasMaxScore: false,
      hasAddressField: true,
      addressLabel: 'Hospital Address',
      addressPlaceholder: 'Enter hospital address',
      hasDescriptionField: false,
      item: rows[0]
    });
  } catch (error) {
    console.error('Healthcare edit page error:', error);
    res.status(500).send('Error loading healthcare');
  }
});

router.post('/healthcare/create', async (req, res) => {
  const { name, hospital_address } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO healthcare (name, hospital_address, description) VALUES (?, ?, ?)',
      [name, hospital_address || null, null]
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
  const { name, hospital_address } = req.body;
  
  try {
    await req.db.query(
      'UPDATE healthcare SET name = ?, hospital_address = ?, description = ? WHERE id = ?',
      [name, hospital_address || null, null, req.params.id]
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
      createPage: '/settings/areas/new',
      editBase: '/settings/areas',
      tableHeaders: ['Name', 'Description'],
      hasModelDropdown: false,
      hasModelColumn: false
    });
  } catch (error) {
    console.error('Areas page error:', error);
    res.status(500).send('Error loading areas of specialization');
  }
});

router.get('/areas/new', (req, res) => {
  renderSettingsForm(req, res, {
    pageTitle: 'Areas of Specialization',
    description: 'Add a new area of specialization',
    icon: 'fas fa-user-md',
    singularName: 'Area of Specialization',
    pluralName: 'Areas of Specialization',
    formMode: 'create',
    formAction: '/settings/areas-of-specialization/create',
    backUrl: '/settings/areas',
    nameField: 'name',
    nameLabel: 'Name',
    namePlaceholder: 'Enter area of specialization',
    descriptionPlaceholder: 'Enter description (optional)',
    hasModelDropdown: false,
    hasMaxScore: false
  });
});

router.get('/areas/:id/edit', async (req, res) => {
  try {
    const [rows] = await req.db.query('SELECT * FROM areas_of_specialization WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      req.session.error = 'Area of specialization not found.';
      return res.redirect('/settings/areas');
    }

    renderSettingsForm(req, res, {
      pageTitle: 'Areas of Specialization',
      description: 'Edit area of specialization details',
      icon: 'fas fa-user-md',
      singularName: 'Area of Specialization',
      pluralName: 'Areas of Specialization',
      formMode: 'edit',
      formAction: `/settings/areas-of-specialization/${req.params.id}/update`,
      backUrl: '/settings/areas',
      nameField: 'name',
      nameLabel: 'Name',
      namePlaceholder: 'Enter area of specialization',
      descriptionPlaceholder: 'Enter description (optional)',
      hasModelDropdown: false,
      hasMaxScore: false,
      item: rows[0]
    });
  } catch (error) {
    console.error('Areas of specialization edit page error:', error);
    res.status(500).send('Error loading area of specialization');
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

// ========== DEVICE MODELS ==========
router.get('/models', async (req, res) => {
  try {
    const [deviceModels] = await req.db.query('SELECT * FROM device_models ORDER BY model_name ASC');
    
    renderSettingsTemplate(req, res, {
      pageTitle: 'Device Models',
      description: 'Manage device models',
      icon: 'fas fa-microchip',
      singularName: 'Device Model',
      pluralName: 'Device Models',
      items: deviceModels,
      primaryField: 'model_name',
      nameField: 'model_name',
      nameLabel: 'Model Name',
      namePlaceholder: 'Enter model name',
      descriptionPlaceholder: 'Enter model description (optional)',
      createAction: '/settings/device-models/create',
      updateAction: '/settings/device-models',
      deleteAction: '/settings/device-models',
      createPage: '/settings/models/new',
      editBase: '/settings/models',
      tableHeaders: ['Model Name', 'Description'],
      hasModelDropdown: false,
      hasModelColumn: false
    });
  } catch (error) {
    console.error('Device models page error:', error);
    res.status(500).send('Error loading device models');
  }
});

router.get('/models/new', (req, res) => {
  renderSettingsForm(req, res, {
    pageTitle: 'Device Models',
    description: 'Add a new device model',
    icon: 'fas fa-microchip',
    singularName: 'Device Model',
    pluralName: 'Device Models',
    formMode: 'create',
    formAction: '/settings/device-models/create',
    backUrl: '/settings/models',
    nameField: 'model_name',
    nameLabel: 'Model Name',
    namePlaceholder: 'Enter model name',
    descriptionPlaceholder: 'Enter model description (optional)',
    hasModelDropdown: false,
    hasMaxScore: false
  });
});

router.get('/models/:id/edit', async (req, res) => {
  try {
    const [rows] = await req.db.query('SELECT * FROM device_models WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      req.session.error = 'Device model not found.';
      return res.redirect('/settings/models');
    }

    renderSettingsForm(req, res, {
      pageTitle: 'Device Models',
      description: 'Edit device model details',
      icon: 'fas fa-microchip',
      singularName: 'Device Model',
      pluralName: 'Device Models',
      formMode: 'edit',
      formAction: `/settings/device-models/${req.params.id}/update`,
      backUrl: '/settings/models',
      nameField: 'model_name',
      nameLabel: 'Model Name',
      namePlaceholder: 'Enter model name',
      descriptionPlaceholder: 'Enter model description (optional)',
      hasModelDropdown: false,
      hasMaxScore: false,
      item: rows[0]
    });
  } catch (error) {
    console.error('Device model edit page error:', error);
    res.status(500).send('Error loading device model');
  }
});

router.post('/device-models/create', async (req, res) => {
  const { model_name, description } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO device_models (model_name, description) VALUES (?, ?)',
      [model_name, description || null]
    );
    res.redirect('/settings/models');
  } catch (error) {
    console.error('Device model creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Device model with this name already exists';
    } else {
      req.session.error = 'Error creating device model';
    }
    res.redirect('/settings/models');
  }
});

router.post('/device-models/:id/update', async (req, res) => {
  const { model_name, description } = req.body;
  
  try {
    await req.db.query(
      'UPDATE device_models SET model_name = ?, description = ? WHERE id = ?',
      [model_name, description || null, req.params.id]
    );
    res.redirect('/settings/models');
  } catch (error) {
    console.error('Device model update error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Device model with this name already exists';
    } else {
      req.session.error = 'Error updating device model';
    }
    res.redirect('/settings/models');
  }
});

router.post('/device-models/:id/delete', async (req, res) => {
  try {
    // Check if any devices are using this model
    const [devices] = await req.db.query(
      'SELECT COUNT(*) as count FROM device_serial_numbers WHERE device_model_id = ?',
      [req.params.id]
    );
    
    if (devices[0].count > 0) {
      req.session.error = 'Cannot delete device model. There are devices using this model.';
      return res.redirect('/settings/models');
    }
    
    await req.db.query('DELETE FROM device_models WHERE id = ?', [req.params.id]);
    res.redirect('/settings/models');
  } catch (error) {
    console.error('Device model delete error:', error);
    req.session.error = 'Error deleting device model';
    res.redirect('/settings/models');
  }
});

// ========== DEVICE SERIAL NUMBERS ==========
router.get('/devices', async (req, res) => {
  try {
    const [deviceModels] = await req.db.query('SELECT * FROM device_models ORDER BY model_name ASC');
    const [deviceSerialNumbers] = await req.db.query(`
      SELECT d.*, k.model_name 
      FROM device_serial_numbers d
      LEFT JOIN device_models k ON d.device_model_id = k.id
      ORDER BY d.serial_number ASC
    `);
    
    renderSettingsTemplate(req, res, {
      pageTitle: 'Device Serial Numbers',
      description: 'Manage device serial numbers and their associated device models',
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
      createPage: '/settings/devices/new',
      editBase: '/settings/devices',
      tableHeaders: ['Serial Number', 'Device Model', 'Notes'],
      hasModelDropdown: true,
      hasModelColumn: true,
      deviceModels
    });
  } catch (error) {
    console.error('Device serial numbers page error:', error);
    res.status(500).send('Error loading device serial numbers');
  }
});

router.get('/devices/new', async (req, res) => {
  try {
    const [deviceModels] = await req.db.query('SELECT * FROM device_models ORDER BY model_name ASC');

    renderSettingsForm(req, res, {
      pageTitle: 'Device Serial Numbers',
      description: 'Add a new device serial number',
      icon: 'fas fa-server',
      singularName: 'Device Serial Number',
      pluralName: 'Device Serial Numbers',
      formMode: 'create',
      formAction: '/settings/device-serial-numbers/create',
      backUrl: '/settings/devices',
      nameField: 'serial_number',
      nameLabel: 'Serial Number',
      namePlaceholder: 'Enter serial number',
      descriptionPlaceholder: 'Enter notes (optional)',
      hasModelDropdown: true,
      hasMaxScore: false,
      deviceModels
    });
  } catch (error) {
    console.error('Device serial number create page error:', error);
    res.status(500).send('Error loading device serial numbers');
  }
});

router.get('/devices/:id/edit', async (req, res) => {
  try {
    const [deviceModels] = await req.db.query('SELECT * FROM device_models ORDER BY model_name ASC');
    const [rows] = await req.db.query('SELECT * FROM device_serial_numbers WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      req.session.error = 'Device serial number not found.';
      return res.redirect('/settings/devices');
    }

    renderSettingsForm(req, res, {
      pageTitle: 'Device Serial Numbers',
      description: 'Edit device serial number details',
      icon: 'fas fa-server',
      singularName: 'Device Serial Number',
      pluralName: 'Device Serial Numbers',
      formMode: 'edit',
      formAction: `/settings/device-serial-numbers/${req.params.id}/update`,
      backUrl: '/settings/devices',
      nameField: 'serial_number',
      nameLabel: 'Serial Number',
      namePlaceholder: 'Enter serial number',
      descriptionPlaceholder: 'Enter notes (optional)',
      hasModelDropdown: true,
      hasMaxScore: false,
      deviceModels,
      item: rows[0]
    });
  } catch (error) {
    console.error('Device serial number edit page error:', error);
    res.status(500).send('Error loading device serial number');
  }
});

router.post('/device-serial-numbers/create', async (req, res) => {
  const { serial_number, device_model_id, notes } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO device_serial_numbers (serial_number, device_model_id, notes) VALUES (?, ?, ?)',
      [serial_number, device_model_id, notes || null]
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
  const { serial_number, device_model_id, notes } = req.body;
  
  try {
    await req.db.query(
      'UPDATE device_serial_numbers SET serial_number = ?, device_model_id = ?, notes = ? WHERE id = ?',
      [serial_number, device_model_id, notes || null, req.params.id]
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

// ========== Practical Learning Outcomes ==========
router.get('/hands-on-aspects', async (req, res) => {
  try {
    const [handsOnAspects] = await req.db.query('SELECT * FROM practical_learning_outcomes_settings ORDER BY aspect_name ASC');
    
    renderSettingsTemplate(req, res, {
      pageTitle: 'Practical Learning Outcomes',
      description: 'Manage hands-on assessment aspects and their maximum scores',
      icon: 'fas fa-hand-paper',
      singularName: 'Practical Learning Outcome',
      pluralName: 'Practical Learning Outcomes',
      items: handsOnAspects,
      primaryField: 'aspect_name',
      nameField: 'aspect_name',
      nameLabel: 'Aspect Name',
      namePlaceholder: 'Enter aspect name',
      descriptionPlaceholder: 'Enter aspect description (optional)',
      createAction: '/settings/hands-on-aspects/create',
      updateAction: '/settings/hands-on-aspects',
      deleteAction: '/settings/hands-on-aspects',
      createPage: '/settings/hands-on-aspects/new',
      editBase: '/settings/hands-on-aspects',
      tableHeaders: ['Aspect Name', 'Description', 'Max Score'],
      hasModelDropdown: false,
      hasModelColumn: false,
      hasMaxScore: true
    });
  } catch (error) {
    console.error('Practical Learning Outcomes page error:', error);
    res.status(500).send('Error loading Practical Learning Outcomes');
  }
});

router.get('/hands-on-aspects/new', (req, res) => {
  renderSettingsForm(req, res, {
    pageTitle: 'Practical Learning Outcomes',
    description: 'Add a new hands-on assessment aspect',
    icon: 'fas fa-hand-paper',
    singularName: 'Practical Learning Outcome',
    pluralName: 'Practical Learning Outcomes',
    formMode: 'create',
    formAction: '/settings/hands-on-aspects/create',
    backUrl: '/settings/hands-on-aspects',
    nameField: 'aspect_name',
    nameLabel: 'Aspect Name',
    namePlaceholder: 'Enter aspect name',
    descriptionPlaceholder: 'Enter aspect description (optional)',
    hasModelDropdown: false,
    hasMaxScore: true
  });
});

router.get('/hands-on-aspects/:id/edit', async (req, res) => {
  try {
    const [rows] = await req.db.query('SELECT * FROM practical_learning_outcomes_settings WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      req.session.error = 'Practical Learning Outcome not found.';
      return res.redirect('/settings/hands-on-aspects');
    }

    renderSettingsForm(req, res, {
      pageTitle: 'Practical Learning Outcomes',
      description: 'Edit hands-on assessment aspect',
      icon: 'fas fa-hand-paper',
      singularName: 'Practical Learning Outcome',
      pluralName: 'Practical Learning Outcomes',
      formMode: 'edit',
      formAction: `/settings/hands-on-aspects/${req.params.id}/update`,
      backUrl: '/settings/hands-on-aspects',
      nameField: 'aspect_name',
      nameLabel: 'Aspect Name',
      namePlaceholder: 'Enter aspect name',
      descriptionPlaceholder: 'Enter aspect description (optional)',
      hasModelDropdown: false,
      hasMaxScore: true,
      item: rows[0]
    });
  } catch (error) {
    console.error('Practical Learning Outcome edit page error:', error);
    res.status(500).send('Error loading Practical Learning Outcome');
  }
});

router.post('/hands-on-aspects/create', async (req, res) => {
  const { aspect_name, description, max_score } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO practical_learning_outcomes_settings (aspect_name, description, max_score) VALUES (?, ?, ?)',
      [aspect_name, description || null, max_score || 100]
    );
    res.redirect('/settings/hands-on-aspects');
  } catch (error) {
    console.error('Practical Learning Outcome creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Practical Learning Outcome with this name already exists';
    } else {
      req.session.error = 'Error creating Practical Learning Outcome';
    }
    res.redirect('/settings/hands-on-aspects');
  }
});

router.post('/hands-on-aspects/:id/update', async (req, res) => {
  const { aspect_name, description, max_score } = req.body;
  
  try {
    await req.db.query(
      'UPDATE practical_learning_outcomes_settings SET aspect_name = ?, description = ?, max_score = ? WHERE id = ?',
      [aspect_name, description || null, max_score || 100, req.params.id]
    );
    res.redirect('/settings/hands-on-aspects');
  } catch (error) {
    console.error('Practical Learning Outcome update error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.session.error = 'Practical Learning Outcome with this name already exists';
    } else {
      req.session.error = 'Error updating Practical Learning Outcome';
    }
    res.redirect('/settings/hands-on-aspects');
  }
});

router.post('/hands-on-aspects/:id/delete', async (req, res) => {
  try {
    // Note: We don't check for existing trainings using this aspect
    // because aspects are copied to trainings at creation time
    await req.db.query('DELETE FROM practical_learning_outcomes_settings WHERE id = ?', [req.params.id]);
    res.redirect('/settings/hands-on-aspects');
  } catch (error) {
    console.error('Practical Learning Outcome delete error:', error);
    req.session.error = 'Error deleting Practical Learning Outcome';
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
      SELECT id, email, first_name, last_name, role, position, phone_number, area_of_specialization, certificate_file, profile_picture
      FROM users
      WHERE role IN ('admin', 'trainer')
      ORDER BY role ASC, last_name ASC, first_name ASC
    `);

    renderSettingsTemplate(req, res, {
      pageType: 'users',
      pageTitle: 'Users',
      description: 'Manage Admin/Trainer users. Position is required (used in reports).',
      icon: 'fas fa-users-cog',
      singularName: 'User',
      pluralName: 'Users',
      createPage: '/settings/users/new',
      editBase: '/settings/users',
      users
    });
  } catch (error) {
    console.error('User positions page error:', error);
    res.status(500).send('Error loading user positions');
  }
});

router.get('/users/new', async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.status(403).send('Forbidden');
  }

  const areasOfSpecialization = await getAreasOfSpecialization(req.db);
  renderSettingsForm(req, res, {
    pageType: 'users',
    pageTitle: 'Users',
    description: 'Create a new admin or trainer user',
    icon: 'fas fa-users-cog',
    singularName: 'User',
    pluralName: 'Users',
    formMode: 'create',
    formAction: '/settings/users/create',
    backUrl: '/settings/users',
    areasOfSpecialization
  });
});

router.get('/users/:id/edit', async (req, res) => {
  try {
    if (req.session.userRole !== 'admin') {
      return res.status(403).send('Forbidden');
    }

    const areasOfSpecialization = await getAreasOfSpecialization(req.db);
    const [rows] = await req.db.query(
      'SELECT id, email, first_name, last_name, role, position, phone_number, area_of_specialization, certificate_file FROM users WHERE id = ? AND role IN (\'admin\', \'trainer\')',
      [req.params.id]
    );
    if (!rows[0]) {
      req.session.error = 'User not found.';
      return res.redirect('/settings/users');
    }

    renderSettingsForm(req, res, {
      pageType: 'users',
      pageTitle: 'Users',
      description: 'Edit admin or trainer user details',
      icon: 'fas fa-users-cog',
      singularName: 'User',
      pluralName: 'Users',
      formMode: 'edit',
      formAction: `/settings/users/${req.params.id}/update`,
      backUrl: '/settings/users',
      item: rows[0],
      areasOfSpecialization
    });
  } catch (error) {
    console.error('User edit page error:', error);
    res.status(500).send('Error loading user');
  }
});

router.post('/users/create', certificateUpload.single('certificate_file'), async (req, res) => {
  try {
    if (req.session.userRole !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    
    const { first_name, last_name, email, password, role, position, phone_number, area_of_specialization } = req.body;
    
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
    const certificatePath = req.file ? `/uploads/certificates/${req.file.filename}` : null;
    
    await req.db.query(
      'INSERT INTO users (email, password, first_name, last_name, role, position, phone_number, area_of_specialization, certificate_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        email.trim(),
        hashedPassword,
        first_name.trim(),
        last_name.trim(),
        cleanRole,
        position.trim(),
        phone_number && phone_number.trim() ? phone_number.trim() : null,
        area_of_specialization && area_of_specialization.trim() ? area_of_specialization.trim() : null,
        certificatePath
      ]
    );
    
    res.redirect('/settings/users');
  } catch (error) {
    console.error('Create admin/trainer error:', error);
    req.session.error = 'Error creating user';
    res.redirect('/settings/users');
  }
});

router.post('/users/:id/update', certificateUpload.single('certificate_file'), async (req, res) => {
  try {
    if (req.session.userRole !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    
    const { first_name, last_name, email, role, position, phone_number, area_of_specialization } = req.body;
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
    
    const certificatePath = req.file ? `/uploads/certificates/${req.file.filename}` : null;
    const updateValues = [
      first_name && first_name.trim() ? first_name.trim() : '',
      last_name && last_name.trim() ? last_name.trim() : '',
      email && email.trim() ? email.trim() : '',
      cleanRole,
      position.trim(),
      phone_number && phone_number.trim() ? phone_number.trim() : null,
      area_of_specialization && area_of_specialization.trim() ? area_of_specialization.trim() : null
    ];
    let updateSql = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ?, position = ?, phone_number = ?, area_of_specialization = ?';
    if (certificatePath) {
      updateSql += ', certificate_file = ?';
      updateValues.push(certificatePath);
    }
    updateSql += ' WHERE id = ? AND role IN (\'admin\', \'trainer\')';
    updateValues.push(userId);

    await req.db.query(updateSql, updateValues);
    
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




