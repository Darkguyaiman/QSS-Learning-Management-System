const express = require('express');
const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');
const router = express.Router();
const {
  normalizeAreaValue,
  normalizeTraineeRecord,
  normalizeTraineeRecords
} = require('../utils/area-of-specialization');

const TRAINEE_IMPORT_ADMIN_EMAIL = 'admin@lms.com';
const TRAINEE_IMPORT_DEFAULT_PASSWORD =
  process.env.TRAINEE_IMPORT_DEFAULT_PASSWORD || 'LmsTraineeImport#1';
const DEFAULT_TRAINEE_PAGE_SIZE = 10;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function isTraineeExcelImportAdmin(db, session) {
  if (!session.userId || session.userRole !== 'admin') return false;
  const [rows] = await db.query('SELECT email FROM users WHERE id = ?', [session.userId]);
  const u = rows[0];
  return u && String(u.email).toLowerCase().trim() === TRAINEE_IMPORT_ADMIN_EMAIL;
}

function normalizeTraineeImportHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
}

const TRAINEE_IMPORT_HEADER_FIELDS = {
  timestamp: 'timestamp',
  name: 'full_name',
  'ic/passport': 'ic_passport',
  email: 'email',
  'handphone number': 'handphone_number',
  healthcare: 'healthcare',
  designation: 'designation',
  'trainee id': 'trainee_id',
  'area of specialization': 'area_of_specialization',
  'serial number': 'serial_number',
  'first training': 'first_training',
  'latest training': 'latest_training',
  're-certification date': 'recertification_date',
  'number of completed trainings': 'number_of_completed_trainings',
  'trainee status': 'trainee_status'
};

function splitFullName(full) {
  const t = String(full || '').trim();
  if (!t) return { first_name: '', last_name: '' };
  const idx = t.indexOf(' ');
  if (idx === -1) return { first_name: t, last_name: '-' };
  const first = t.slice(0, idx).trim();
  const last = t.slice(idx + 1).trim();
  return { first_name: first || '-', last_name: last || '-' };
}

function parseTraineeImportDate(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) {
    const whole = Math.floor(val);
    if (whole >= 20000 && whole < 80000) {
      const utc = new Date((val - 25569) * 86400 * 1000);
      if (!Number.isNaN(utc.getTime())) {
        return utc.toISOString().slice(0, 10);
      }
    }
  }
  const s = String(val).trim();
  if (!s) return null;
  const isoTry = new Date(s);
  if (!Number.isNaN(isoTry.getTime())) return isoTry.toISOString().slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let d = parseInt(m[1], 10);
    let mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  return null;
}

function parseCompletedTrainingsCount(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseInt(String(val).replace(/,/g, '').trim(), 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

function normalizeTraineeStatusForImport(val) {
  const s = String(val || '').trim().toLowerCase();
  if (!s) return 'registered';
  const allowed = new Set(['active', 'inactive', 'suspended', 'registered']);
  if (allowed.has(s)) return s;
  return null;
}

function normalizeTraineeRowPayload(raw) {
  const email = String(raw.email || '').trim().toLowerCase();
  const { first_name, last_name } = splitFullName(raw.full_name);
  const ic = String(raw.ic_passport || '').trim();
  const tidIn = raw.trainee_id != null && String(raw.trainee_id).trim() !== ''
    ? String(raw.trainee_id).trim()
    : '';
  const traineeId = tidIn.slice(0, 10);
  const status = normalizeTraineeStatusForImport(raw.trainee_status);
  return {
    first_name,
    last_name,
    email,
    ic_passport: ic,
    handphone_number: raw.handphone_number != null ? String(raw.handphone_number).trim() : '',
    healthcare: raw.healthcare != null ? String(raw.healthcare).trim() : '',
    designation: raw.designation != null ? String(raw.designation).trim() : '',
    trainee_id_input: tidIn,
    trainee_id: traineeId,
    area_of_specialization: normalizeAreaValue(raw.area_of_specialization),
    serial_number: raw.serial_number != null ? String(raw.serial_number).trim() : '',
    first_training: parseTraineeImportDate(raw.first_training),
    latest_training: parseTraineeImportDate(raw.latest_training),
    recertification_date: parseTraineeImportDate(raw.recertification_date),
    number_of_completed_trainings: parseCompletedTrainingsCount(raw.number_of_completed_trainings),
    trainee_status: status
  };
}

async function getAreasOfSpecialization(db) {
  const [rows] = await db.query('SELECT id, name FROM areas_of_specialization ORDER BY name');
  return rows;
}

const TRAINEE_SELECT_SQL = `
  SELECT
    t.id,
    t.trainee_id,
    t.first_name,
    t.last_name,
    t.email,
    t.ic_passport,
    t.handphone_number,
    h.name AS healthcare,
    d.name AS designation,
    GROUP_CONCAT(DISTINCT aos.name ORDER BY aos.name SEPARATOR ', ') AS area_of_specialization,
    dsn.serial_number AS serial_number,
    t.first_training,
    t.latest_training,
    t.recertification_date,
    t.number_of_completed_trainings,
    t.trainee_status,
    t.profile_picture,
    t.password,
    t.created_at,
    t.updated_at
  FROM trainees t
  LEFT JOIN healthcare h ON h.id = t.healthcare_id
  LEFT JOIN designations d ON d.id = t.designation_id
  LEFT JOIN device_serial_numbers dsn ON dsn.id = t.device_serial_number_id
  LEFT JOIN trainee_area_of_specializations taos ON taos.trainee_id = t.id
  LEFT JOIN areas_of_specialization aos ON aos.id = taos.area_of_specialization_id
`;

const TRAINEE_GROUP_BY_SQL = `
  GROUP BY
    t.id,
    t.trainee_id,
    t.first_name,
    t.last_name,
    t.email,
    t.ic_passport,
    t.handphone_number,
    h.name,
    d.name,
    dsn.serial_number,
    t.first_training,
    t.latest_training,
    t.recertification_date,
    t.number_of_completed_trainings,
    t.trainee_status,
    t.profile_picture,
    t.password,
    t.created_at,
    t.updated_at
`;

async function getTraineeById(db, traineeId) {
  const [rows] = await db.query(
    `${TRAINEE_SELECT_SQL}
     WHERE t.id = ?
     ${TRAINEE_GROUP_BY_SQL}`,
    [traineeId]
  );

  return rows.length > 0 ? normalizeTraineeRecord(rows[0]) : null;
}

async function resolveHealthcareId(db, healthcareName) {
  const name = String(healthcareName || '').trim();
  if (!name) return null;

  const [rows] = await db.query('SELECT id FROM healthcare WHERE name = ? LIMIT 1', [name]);
  return rows[0]?.id || null;
}

async function ensureDesignationId(dbOrConnection, designationName) {
  const name = String(designationName || '').trim();
  if (!name) return null;

  await dbOrConnection.query(
    'INSERT INTO designations (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), name = VALUES(name)',
    [name]
  );
  const [rows] = await dbOrConnection.query('SELECT LAST_INSERT_ID() AS id');
  return rows[0]?.id || null;
}

async function resolveDeviceSerialNumberId(db, serialNumber) {
  const value = String(serialNumber || '').trim();
  if (!value) return null;

  const [rows] = await db.query('SELECT id FROM device_serial_numbers WHERE serial_number = ? LIMIT 1', [value]);
  return rows[0]?.id || null;
}

async function loadAreaLowerNameLookup(db) {
  const [rows] = await db.query('SELECT id, name FROM areas_of_specialization');
  const byLowerName = new Map();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    if (!byLowerName.has(key)) {
      byLowerName.set(key, row.id);
    }
  }
  return byLowerName;
}

function resolveAreaIdsWithLookup(byLowerName, values) {
  const names = normalizeAreaValue(values);
  if (names.length === 0) {
    return { ids: [], missing: [] };
  }

  const ids = [];
  const missing = [];
  for (const name of names) {
    const id = byLowerName.get(name.toLowerCase());
    if (id !== undefined) {
      ids.push(id);
    } else {
      missing.push(name);
    }
  }

  return { ids: [...new Set(ids)], missing };
}

async function resolveAreaIds(db, values) {
  const lookup = await loadAreaLowerNameLookup(db);
  return resolveAreaIdsWithLookup(lookup, values);
}

// List all trainees
router.get('/', async (req, res) => {
  try {
    const statusFilter = req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : [];
    const healthcareFilter = req.query.healthcare || null;
    const searchQuery = req.query.search || '';
    const pageSize = DEFAULT_TRAINEE_PAGE_SIZE;
    
    let whereSql = `
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // Apply status filter
    if (statusFilter.length > 0) {
      const placeholders = statusFilter.map(() => '?').join(',');
      whereSql += ` AND t.trainee_status IN (${placeholders})`;
      queryParams.push(...statusFilter);
    }
    
    // Apply healthcare filter
    if (healthcareFilter) {
      whereSql += ` AND h.name = ?`;
      queryParams.push(healthcareFilter);
    }
    
    // Add search filter if provided
    if (searchQuery) {
      whereSql += ` AND (
        t.trainee_id LIKE ? OR
        t.first_name LIKE ? OR
        t.last_name LIKE ? OR
        CONCAT(t.first_name, ' ', t.last_name) LIKE ? OR
        t.email LIKE ? OR
        t.ic_passport LIKE ? OR
        t.handphone_number LIKE ? OR
        h.name LIKE ? OR
        d.name LIKE ? OR
        aos.name LIKE ? OR
        dsn.serial_number LIKE ?
      )`;
      const searchTerm = `%${searchQuery}%`;
      queryParams.push(
        searchTerm, searchTerm, searchTerm, searchTerm,
        searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
        searchTerm
      );
    }

    const [countRows] = await req.db.query(`
      SELECT COUNT(DISTINCT t.id) AS total
      FROM trainees t
      LEFT JOIN healthcare h ON h.id = t.healthcare_id
      LEFT JOIN designations d ON d.id = t.designation_id
      LEFT JOIN device_serial_numbers dsn ON dsn.id = t.device_serial_number_id
      LEFT JOIN trainee_area_of_specializations taos ON taos.trainee_id = t.id
      LEFT JOIN areas_of_specialization aos ON aos.id = taos.area_of_specialization_id
      ${whereSql}
    `, queryParams);

    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(parsePositiveInteger(req.query.page, 1), totalPages);
    const offset = (currentPage - 1) * pageSize;
    
    let query = `
      ${TRAINEE_SELECT_SQL}
      ${whereSql}
      ${TRAINEE_GROUP_BY_SQL}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const [trainees] = await req.db.query(query, [...queryParams, pageSize, offset]);
    const normalizedTrainees = normalizeTraineeRecords(trainees);
    
    // Fetch distinct healthcare centers from trainees
    const [healthcareList] = await req.db.query(`
      SELECT DISTINCT h.name
      FROM trainees t
      INNER JOIN healthcare h ON h.id = t.healthcare_id
      ORDER BY h.name ASC
    `);
    
    const traineeImportEnabled = await isTraineeExcelImportAdmin(req.db, req.session);
    
    res.render('trainees/list', { 
      user: req.session, 
      trainees: normalizedTrainees,
      searchQuery,
      selectedStatuses: statusFilter,
      selectedHealthcare: healthcareFilter,
      healthcare: healthcareList,
      traineeImportEnabled,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        pageSize
      }
    });
  } catch (error) {
    console.error('Trainees list error:', error);
    res.status(500).send('Error loading trainees');
  }
});

// Create trainee page
router.get('/create', async (req, res) => {
  try {
    const areasOfSpecialization = await getAreasOfSpecialization(req.db);
    res.render('trainees/create', { 
      user: req.session, 
      error: null,
      areasOfSpecialization
    });
  } catch (error) {
    console.error('Trainee create load error:', error);
    res.status(500).send('Error loading trainee form');
  }
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
      const areasOfSpecialization = await getAreasOfSpecialization(req.db);
      return res.render('trainees/create', { 
        user: req.session, 
        error: 'Please fill in all required fields',
        areasOfSpecialization
      });
    }
    
    // Check if email already exists
    const [existingTrainee] = await req.db.query(
      'SELECT id FROM trainees WHERE email = ?',
      [email]
    );
    
    if (existingTrainee.length > 0) {
      const areasOfSpecialization = await getAreasOfSpecialization(req.db);
      return res.render('trainees/create', { 
        user: req.session, 
        error: 'Email already registered',
        areasOfSpecialization
      });
    }
    
    const [healthcareId, deviceSerialNumberId, areaResolution] = await Promise.all([
      resolveHealthcareId(req.db, healthcare),
      resolveDeviceSerialNumberId(req.db, req.body.serialNumber),
      resolveAreaIds(req.db, areaOfSpecialization)
    ]);

    if (String(healthcare || '').trim() && !healthcareId) {
      const areasOfSpecialization = await getAreasOfSpecialization(req.db);
      return res.render('trainees/create', {
        user: req.session,
        error: 'Selected healthcare was not found in settings.',
        areasOfSpecialization
      });
    }

    if (areaResolution.missing.length > 0) {
      const areasOfSpecialization = await getAreasOfSpecialization(req.db);
      return res.render('trainees/create', {
        user: req.session,
        error: `Unknown area(s) of specialization: ${areaResolution.missing.join(', ')}`,
        areasOfSpecialization
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate unique trainee ID
    const { generateUniqueTraineeId } = require('../config/database');
    const connection = await req.db.getConnection();

    try {
      await connection.beginTransaction();
      const traineeId = await generateUniqueTraineeId(connection);
      const designationId = await ensureDesignationId(connection, designation);

      const [insertResult] = await connection.query(
        `INSERT INTO trainees (
          trainee_id, email, password, first_name, last_name, 
          ic_passport, handphone_number, healthcare_id, designation_id,
          device_serial_number_id, trainee_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          traineeId,
          email,
          hashedPassword,
          firstName,
          lastName,
          icPassport,
          handphoneNumber || null,
          healthcareId,
          designationId,
          deviceSerialNumberId,
          traineeStatus || 'active'
        ]
      );

      for (const areaId of areaResolution.ids) {
        await connection.query(
          'INSERT INTO trainee_area_of_specializations (trainee_id, area_of_specialization_id) VALUES (?, ?)',
          [insertResult.insertId, areaId]
        );
      }

      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }
    
    res.redirect('/trainees');
  } catch (error) {
    console.error('Trainee creation error:', error);
    res.render('trainees/create', { 
      user: req.session, 
      error: 'An error occurred. Please try again.',
      areasOfSpecialization: await getAreasOfSpecialization(req.db)
    });
  }
});

// Excel import — only admin@lms.com (admin role)
router.get('/import/template', async (req, res) => {
  try {
    if (!(await isTraineeExcelImportAdmin(req.db, req.session))) {
      return res.status(403).send('Access denied');
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LMS';
    const ws = workbook.addWorksheet('Trainees');
    const headers = [
      'Timestamp',
      'Name',
      'IC/Passport',
      'Email',
      'Handphone Number',
      'Healthcare',
      'Designation',
      'Trainee ID',
      'Area of Specialization',
      'Serial Number',
      'First Training',
      'Latest Training',
      'Re-certification Date',
      'Number of completed Trainings',
      'Trainee Status'
    ];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    const widths = [20, 26, 14, 28, 16, 22, 18, 12, 22, 14, 14, 14, 18, 14, 16];
    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    const buf = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Trainee Import Template.xlsx"');
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Trainee import template error:', err);
    res.status(500).send('Error generating template');
  }
});

router.post('/import/bulk', async (req, res) => {
  try {
    if (!(await isTraineeExcelImportAdmin(req.db, req.session))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const bodyRows = req.body.trainees;
    if (!Array.isArray(bodyRows) || bodyRows.length === 0) {
      return res.status(400).json({ success: false, error: 'No trainees to import' });
    }

    const errors = [];
    const normalized = [];
    const seenEmails = new Set();
    const seenTid = new Set();

    for (let i = 0; i < bodyRows.length; i++) {
      const rowNum = i + 2;
      const r = normalizeTraineeRowPayload(bodyRows[i]);
      if (!r.first_name || !r.last_name) {
        errors.push(`Row ${rowNum}: Name is required`);
        continue;
      }
      if (!r.ic_passport) {
        errors.push(`Row ${rowNum}: IC/Passport is required`);
        continue;
      }
      if (!r.email) {
        errors.push(`Row ${rowNum}: Email is required`);
        continue;
      }
      if (!r.trainee_status) {
        errors.push(`Row ${rowNum}: Trainee Status must be active, inactive, suspended, or registered`);
        continue;
      }
      if (r.trainee_id_input && r.trainee_id_input.length > 10) {
        errors.push(`Row ${rowNum}: Trainee ID must be at most 10 characters`);
        continue;
      }
      if (seenEmails.has(r.email)) {
        errors.push(`Row ${rowNum}: Duplicate email in file (${r.email})`);
        continue;
      }
      seenEmails.add(r.email);
      if (r.trainee_id) {
        if (seenTid.has(r.trainee_id)) {
          errors.push(`Row ${rowNum}: Duplicate Trainee ID in file (${r.trainee_id})`);
          continue;
        }
        seenTid.add(r.trainee_id);
      }
      normalized.push(r);
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const areaLookup = await loadAreaLowerNameLookup(req.db);

    for (let i = 0; i < normalized.length; i++) {
      const r = normalized[i];
      const rowNum = i + 2;
      const [existsE] = await req.db.query('SELECT id FROM trainees WHERE email = ?', [r.email]);
      if (existsE.length > 0) {
        errors.push(`Row ${rowNum}: Email "${r.email}" already registered`);
      }
      if (r.trainee_id) {
        const [existsT] = await req.db.query(
          'SELECT id FROM trainees WHERE trainee_id = ?',
          [r.trainee_id]
        );
        if (existsT.length > 0) {
          errors.push(`Row ${rowNum}: Trainee ID "${r.trainee_id}" already exists`);
        }
      }
      if (r.healthcare) {
        const healthcareId = await resolveHealthcareId(req.db, r.healthcare);
        if (!healthcareId) {
          errors.push(`Row ${rowNum}: Healthcare "${r.healthcare}" was not found in settings`);
        }
      }
      if (r.serial_number) {
        const deviceSerialNumberId = await resolveDeviceSerialNumberId(req.db, r.serial_number);
        if (!deviceSerialNumberId) {
          errors.push(`Row ${rowNum}: Serial Number "${r.serial_number}" was not found in device serial numbers`);
        }
      }
      const areaResolution = resolveAreaIdsWithLookup(areaLookup, r.area_of_specialization);
      if (areaResolution.missing.length > 0) {
        errors.push(`Row ${rowNum}: Unknown area(s) of specialization: ${areaResolution.missing.join(', ')}`);
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const { generateUniqueTraineeId } = require('../config/database');
    const passwordHash = await bcrypt.hash(TRAINEE_IMPORT_DEFAULT_PASSWORD, 10);
    const connection = await req.db.getConnection();

    try {
      await connection.beginTransaction();

      for (const r of normalized) {
        let finalTid = r.trainee_id;
        if (!finalTid) {
          finalTid = await generateUniqueTraineeId(connection);
        }
        const healthcareId = await resolveHealthcareId(connection, r.healthcare);
        const designationId = await ensureDesignationId(connection, r.designation);
        const deviceSerialNumberId = await resolveDeviceSerialNumberId(connection, r.serial_number);
        const areaResolution = resolveAreaIdsWithLookup(areaLookup, r.area_of_specialization);

        const [insertResult] = await connection.query(
          `INSERT INTO trainees (
            trainee_id, email, password, first_name, last_name,
            ic_passport, handphone_number, healthcare_id, designation_id,
            device_serial_number_id,
            first_training, latest_training, recertification_date,
            number_of_completed_trainings, trainee_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            finalTid,
            r.email,
            passwordHash,
            r.first_name,
            r.last_name,
            r.ic_passport,
            r.handphone_number || null,
            healthcareId,
            designationId,
            deviceSerialNumberId,
            r.first_training,
            r.latest_training,
            r.recertification_date,
            r.number_of_completed_trainings,
            r.trainee_status
          ]
        );

        for (const areaId of areaResolution.ids) {
          await connection.query(
            'INSERT INTO trainee_area_of_specializations (trainee_id, area_of_specialization_id) VALUES (?, ?)',
            [insertResult.insertId, areaId]
          );
        }
      }

      await connection.commit();
      res.json({ success: true, inserted: normalized.length });
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Trainee bulk import error:', error);
    res.status(500).json({ success: false, error: error.message || 'Import failed' });
  }
});

// Edit trainee page
router.get('/:id/edit', async (req, res) => {
  try {
    const trainee = await getTraineeById(req.db, req.params.id);
    
    if (!trainee) {
      return res.status(404).send('Trainee not found');
    }
    const areasOfSpecialization = await getAreasOfSpecialization(req.db);
    res.render('trainees/edit', { 
      user: req.session, 
      trainee,
      error: null,
      areasOfSpecialization
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
      const trainee = await getTraineeById(req.db, req.params.id);
      const areasOfSpecialization = await getAreasOfSpecialization(req.db);
      return res.render('trainees/edit', { 
        user: req.session, 
        trainee,
        error: 'Please fill in all required fields',
        areasOfSpecialization
      });
    }
    
    // Check if email already exists (excluding current trainee)
    const [existingTrainee] = await req.db.query(
      'SELECT id FROM trainees WHERE email = ? AND id != ?',
      [email, req.params.id]
    );
    
    if (existingTrainee.length > 0) {
      const trainee = await getTraineeById(req.db, req.params.id);
      const areasOfSpecialization = await getAreasOfSpecialization(req.db);
      return res.render('trainees/edit', { 
        user: req.session, 
        trainee,
        error: 'Email already registered to another trainee',
        areasOfSpecialization
      });
    }
    
    const [healthcareId, deviceSerialNumberId, areaResolution] = await Promise.all([
      resolveHealthcareId(req.db, healthcare),
      resolveDeviceSerialNumberId(req.db, req.body.serialNumber),
      resolveAreaIds(req.db, areaOfSpecialization)
    ]);

    if (String(healthcare || '').trim() && !healthcareId) {
      const trainee = await getTraineeById(req.db, req.params.id);
      const areasOfSpecialization = await getAreasOfSpecialization(req.db);
      return res.render('trainees/edit', {
        user: req.session,
        trainee,
        error: 'Selected healthcare was not found in settings.',
        areasOfSpecialization
      });
    }

    if (areaResolution.missing.length > 0) {
      const trainee = await getTraineeById(req.db, req.params.id);
      const areasOfSpecialization = await getAreasOfSpecialization(req.db);
      return res.render('trainees/edit', {
        user: req.session,
        trainee,
        error: `Unknown area(s) of specialization: ${areaResolution.missing.join(', ')}`,
        areasOfSpecialization
      });
    }

    const connection = await req.db.getConnection();

    try {
      await connection.beginTransaction();
      const designationId = await ensureDesignationId(connection, designation);

      let updateQuery = `
        UPDATE trainees SET 
          first_name = ?, 
          last_name = ?, 
          email = ?, 
          ic_passport = ?,
          handphone_number = ?,
          healthcare_id = ?,
          designation_id = ?,
          device_serial_number_id = ?,
          trainee_status = ?
      `;
      const updateValues = [
        firstName,
        lastName,
        email,
        icPassport,
        handphoneNumber || null,
        healthcareId,
        designationId,
        deviceSerialNumberId,
        traineeStatus || 'active'
      ];

      if (password && password.length >= 6) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateQuery += ', password = ?';
        updateValues.push(hashedPassword);
      }

      updateQuery += ' WHERE id = ?';
      updateValues.push(req.params.id);

      await connection.query(updateQuery, updateValues);
      await connection.query(
        'DELETE FROM trainee_area_of_specializations WHERE trainee_id = ?',
        [req.params.id]
      );

      for (const areaId of areaResolution.ids) {
        await connection.query(
          'INSERT INTO trainee_area_of_specializations (trainee_id, area_of_specialization_id) VALUES (?, ?)',
          [req.params.id, areaId]
        );
      }

      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }
    
    res.redirect('/trainees');
  } catch (error) {
    console.error('Trainee update error:', error);
    const trainee = await getTraineeById(req.db, req.params.id);
    const areasOfSpecialization = await getAreasOfSpecialization(req.db);
    res.render('trainees/edit', { 
      user: req.session, 
      trainee: trainee || {},
      error: 'An error occurred. Please try again.',
      areasOfSpecialization
    });
  }
});

// Bulk update trainee status
router.post('/bulk-status', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.traineeIds) ? req.body.traineeIds : (req.body.traineeIds ? [req.body.traineeIds] : []);
    const status = (req.body.status || '').toLowerCase().trim();
    const allowed = new Set(['active', 'inactive', 'suspended', 'registered']);

    if (ids.length === 0) {
      return res.redirect('/trainees');
    }
    if (!allowed.has(status)) {
      return res.redirect('/trainees');
    }

    const placeholders = ids.map(() => '?').join(',');
    await req.db.query(
      `UPDATE trainees SET trainee_status = ? WHERE id IN (${placeholders})`,
      [status, ...ids]
    );

    res.redirect('/trainees');
  } catch (error) {
    console.error('Bulk status update error:', error);
    res.status(500).send('Error updating trainee statuses');
  }
});

// Bulk delete trainees
router.post('/bulk-delete', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.traineeIds) ? req.body.traineeIds : (req.body.traineeIds ? [req.body.traineeIds] : []);
    if (ids.length === 0) {
      return res.redirect('/trainees');
    }

    const placeholders = ids.map(() => '?').join(',');
    await req.db.query(
      `DELETE FROM trainees WHERE id IN (${placeholders})`,
      ids
    );

    res.redirect('/trainees');
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).send('Error deleting trainees');
  }
});

module.exports = router;


