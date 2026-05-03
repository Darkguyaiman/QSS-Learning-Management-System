const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const fs = require('fs');
const sharp = require('sharp');
const packageGenerator = require('./package-generator');
const packageJobQueue = require('./package-job-queue');

const TEST_TYPE_LABELS = {
  pre_test: 'Pre-Test',
  post_test: 'Post-Test',
  refresher_training: 'Refresher Training Test',
  certificate_enrolment: 'Certificate Enrolment Test'
};

async function getNonActiveTrainees(db, traineeIds) {
  const normalizedIds = [...new Set(
    (Array.isArray(traineeIds) ? traineeIds : [traineeIds])
      .map(id => String(id || '').trim())
      .filter(Boolean)
  )];

  if (normalizedIds.length === 0) {
    return [];
  }

  const placeholders = normalizedIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, first_name, last_name, trainee_status
     FROM trainees
     WHERE id IN (${placeholders})`,
    normalizedIds
  );

  const byId = new Map(rows.map(row => [String(row.id), row]));
  const invalid = [];

  for (const id of normalizedIds) {
    const trainee = byId.get(id);
    const status = String(trainee?.trainee_status || '').toLowerCase().trim();
    if (!trainee || status !== 'active') {
      invalid.push(trainee || { id, first_name: 'Unknown', last_name: `ID ${id}`, trainee_status: 'unknown' });
    }
  }

  return invalid;
}

/**
 * Helper function to randomly select questions for a test
 * Ensures at least 2 questions from each objective
 * @param {Object} db - Database connection
 * @param {string} testType - Type of test (pre_test, post_test, refresher_training, certificate_enrolment)
 * @param {number} totalQuestions - Total number of questions needed
 * @param {number} moduleId - Module ID
 * @returns {Promise<Array>} Array of question IDs
 */
async function selectQuestionsForTest(db, testType, totalQuestions, moduleId) {
  // Get all objectives
  const [objectives] = await db.query('SELECT id FROM objectives ORDER BY id');
  
  if (objectives.length === 0) {
    throw new Error('No objectives found in the system');
  }
  
  const selectedQuestionIds = [];
  const questionsByObjective = {};
  const usedQuestionIds = new Set();
  
  // First, ensure at least 2 questions from each objective
  const minPerObjective = 2;
  const requiredQuestions = objectives.length * minPerObjective;
  
  if (totalQuestions < requiredQuestions) {
    throw new Error(`Not enough questions requested. Need at least ${requiredQuestions} questions (2 per objective for ${objectives.length} objectives)`);
  }
  
  // Get questions grouped by objective
  for (const objective of objectives) {
    const [questions] = await db.query(
      'SELECT id FROM questions WHERE test_type = ? AND objective_id = ? AND module_id = ? ORDER BY RAND()',
      [testType, objective.id, moduleId]
    );
    
    if (questions.length < minPerObjective) {
      throw new Error(`Not enough questions of type "${testType}" for objective ID ${objective.id}. Need at least ${minPerObjective}, found ${questions.length}`);
    }
    
    questionsByObjective[objective.id] = questions.map(q => q.id);
  }
  
  // Select at least 2 from each objective
  for (const objective of objectives) {
    const availableQuestions = questionsByObjective[objective.id].filter(id => !usedQuestionIds.has(id));
    
    if (availableQuestions.length < minPerObjective) {
      // If we don't have enough unused questions, use what we have
      const toSelect = Math.min(minPerObjective, availableQuestions.length);
      const selected = availableQuestions.slice(0, toSelect);
      selected.forEach(id => {
        selectedQuestionIds.push(id);
        usedQuestionIds.add(id);
      });
    } else {
      // Randomly select minPerObjective questions
      const shuffled = availableQuestions.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, minPerObjective);
      selected.forEach(id => {
        selectedQuestionIds.push(id);
        usedQuestionIds.add(id);
      });
    }
  }
  
  // Fill remaining slots with random questions from any objective
  const remainingSlots = totalQuestions - selectedQuestionIds.length;
  
  if (remainingSlots > 0) {
    // Get all available questions of this test type
    const [allQuestions] = await db.query(
      'SELECT id FROM questions WHERE test_type = ? AND module_id = ? ORDER BY RAND()',
      [testType, moduleId]
    );
    
    const availableQuestions = allQuestions
      .map(q => q.id)
      .filter(id => !usedQuestionIds.has(id));
    
    if (availableQuestions.length < remainingSlots) {
      throw new Error(`Not enough questions available. Need ${remainingSlots} more, but only ${availableQuestions.length} available`);
    }
    
    // Randomly select remaining questions
    const shuffled = availableQuestions.sort(() => Math.random() - 0.5);
    const additionalQuestions = shuffled.slice(0, remainingSlots);
    selectedQuestionIds.push(...additionalQuestions);
  }
  
  // Shuffle the final array to randomize order
  return selectedQuestionIds.sort(() => Math.random() - 0.5);
}

/**
 * Validate if there are enough questions available for test creation
 * @param {Object} db - Database connection
 * @param {string} trainingType - Type of training (main or refresher_training)
 * @param {number} moduleId - Module ID
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
async function validateTestQuestions(db, trainingType, moduleId) {
  const errors = [];
  
  if (!moduleId) {
    return { valid: false, errors: ['Module is required for test generation.'] };
  }
  
  // Get all objectives
  const [objectives] = await db.query('SELECT id FROM objectives ORDER BY id');
  
  if (objectives.length === 0) {
    return { valid: false, errors: ['No objectives found in the system. Please create objectives first.'] };
  }
  
  const minPerObjective = 2;
  const requiredPerObjective = objectives.length * minPerObjective;
  
  if (trainingType === 'main') {
    // Main training: pre_test (10), post_test (10), certificate_enrolment (40)
    const tests = [
      { type: 'pre_test', count: 10 },
      { type: 'post_test', count: 10 },
      { type: 'certificate_enrolment', count: 40 }
    ];
    
    for (const test of tests) {
      // Check if we have enough questions for this test type
      if (test.count < requiredPerObjective) {
        errors.push(`${test.type}: Need at least ${requiredPerObjective} questions (2 per objective for ${objectives.length} objectives), but only ${test.count} requested.`);
        continue;
      }
      
      // Check each objective has enough questions
      for (const objective of objectives) {
        const [questions] = await db.query(
          'SELECT COUNT(*) as count FROM questions WHERE test_type = ? AND objective_id = ? AND module_id = ?',
          [test.type, objective.id, moduleId]
        );
        
        const questionCount = questions[0].count;
        if (questionCount < minPerObjective) {
          errors.push(`${test.type}: Not enough questions for objective ID ${objective.id}. Need at least ${minPerObjective}, found ${questionCount}.`);
        }
      }
      
      // Check total available questions
      const [totalQuestions] = await db.query(
        'SELECT COUNT(*) as count FROM questions WHERE test_type = ? AND module_id = ?',
        [test.type, moduleId]
      );
      
      if (totalQuestions[0].count < test.count) {
        errors.push(`${test.type}: Not enough total questions available. Need ${test.count}, found ${totalQuestions[0].count}.`);
      }
    }
  } else if (trainingType === 'refresher_training') {
    // Refresher training: certificate enrolment only (40)
    const tests = [
      { type: 'certificate_enrolment', count: 40 }
    ];

    for (const test of tests) {
      if (test.count < requiredPerObjective) {
        errors.push(`${test.type}: Need at least ${requiredPerObjective} questions (2 per objective for ${objectives.length} objectives), but only ${test.count} requested.`);
        continue;
      }

      for (const objective of objectives) {
        const [questions] = await db.query(
          'SELECT COUNT(*) as count FROM questions WHERE test_type = ? AND objective_id = ? AND module_id = ?',
          [test.type, objective.id, moduleId]
        );

        const questionCount = questions[0].count;
        if (questionCount < minPerObjective) {
          errors.push(`${test.type}: Not enough questions for objective ID ${objective.id}. Need at least ${minPerObjective}, found ${questionCount}.`);
        }
      }

      const [totalQuestions] = await db.query(
        'SELECT COUNT(*) as count FROM questions WHERE test_type = ? AND module_id = ?',
        [test.type, moduleId]
      );

      if (totalQuestions[0].count < test.count) {
        errors.push(`${test.type}: Not enough total questions available. Need ${test.count}, found ${totalQuestions[0].count}.`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

async function buildQuestionValidationSummary(db, errors, moduleId) {
  const summary = {
    title: 'Cannot create training',
    message: 'Not enough questions in the question bank to generate the required tests.',
    sections: [],
    raw: errors
  };

  if (!Array.isArray(errors) || errors.length === 0) {
    return summary;
  }

  if (errors.some(error => String(error).includes('No objectives found'))) {
    summary.message = 'No objectives found. Please create objectives first, then add questions for each objective.';
    return summary;
  }

  const objectiveRe = /^(\w+): Not enough questions for objective ID (\d+)\. Need at least (\d+), found (\d+)\.$/;
  const totalRe = /^(\w+): Not enough total questions available\. Need (\d+), found (\d+)\.$/;
  const requestedRe = /^(\w+): Need at least (\d+) questions .* but only (\d+) requested\.$/;

  const perObjective = {};
  const totals = {};
  const requested = {};
  const objectiveIds = new Set();

  for (const error of errors) {
    const text = String(error);
    let match = text.match(objectiveRe);
    if (match) {
      const testType = match[1];
      const objectiveId = parseInt(match[2], 10);
      const need = parseInt(match[3], 10);
      const found = parseInt(match[4], 10);
      if (!perObjective[testType]) perObjective[testType] = [];
      perObjective[testType].push({ objectiveId, need, found });
      objectiveIds.add(objectiveId);
      continue;
    }

    match = text.match(totalRe);
    if (match) {
      const testType = match[1];
      totals[testType] = { need: parseInt(match[2], 10), found: parseInt(match[3], 10) };
      continue;
    }

    match = text.match(requestedRe);
    if (match) {
      const testType = match[1];
      requested[testType] = { need: parseInt(match[2], 10), requested: parseInt(match[3], 10) };
      continue;
    }
  }

  let objectiveNames = {};
  if (objectiveIds.size > 0) {
    const ids = Array.from(objectiveIds);
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(`SELECT id, name FROM objectives WHERE id IN (${placeholders})`, ids);
    objectiveNames = (rows || []).reduce((acc, row) => {
      acc[row.id] = row.name;
      return acc;
    }, {});
  }

  if (moduleId) {
    const [modules] = await db.query('SELECT name FROM modules WHERE id = ?', [moduleId]);
    const moduleName = modules?.[0]?.name;
    if (moduleName) {
      summary.message = `Not enough questions in the question bank for the selected module (${moduleName}).`;
    }
  }

  const testTypes = new Set([
    ...Object.keys(perObjective),
    ...Object.keys(totals),
    ...Object.keys(requested)
  ]);

  const orderedTestTypes = ['pre_test', 'post_test', 'certificate_enrolment', 'refresher_training']
    .filter(type => testTypes.has(type))
    .concat(Array.from(testTypes).filter(type => !['pre_test', 'post_test', 'certificate_enrolment', 'refresher_training'].includes(type)));

  summary.sections = orderedTestTypes.map(testType => {
    const objectives = (perObjective[testType] || []).map(entry => ({
      ...entry,
      objectiveName: objectiveNames[entry.objectiveId] || `Objective ${entry.objectiveId}`
    }));

    return {
      testType,
      label: TEST_TYPE_LABELS[testType] || testType,
      objectives,
      total: totals[testType] || null,
      requested: requested[testType] || null
    };
  }).filter(section => section.objectives.length || section.total || section.requested);

  return summary;
}

/**
 * Create tests for a training
 * @param {Object} db - Database connection
 * @param {number} trainingId - Training ID
 * @param {string} trainingType - Type of training (main or refresher_training)
 * @param {number} moduleId - Module ID
 */
async function createTrainingTests(db, trainingId, trainingType, moduleId) {
  try {
    if (trainingType === 'main') {
      // Main training: pre_test (10), post_test (10), certificate_enrolment (40)
      const tests = [
        { type: 'pre_test', count: 10 },
        { type: 'post_test', count: 10 },
        { type: 'certificate_enrolment', count: 40 }
      ];
      
      for (const test of tests) {
        // Select questions
        const questionIds = await selectQuestionsForTest(db, test.type, test.count, moduleId);
        
        // Create training_test record
        const [testResult] = await db.query(
          'INSERT INTO training_tests (training_id, test_type, total_questions) VALUES (?, ?, ?)',
          [trainingId, test.type, test.count]
        );
        
        const trainingTestId = testResult.insertId;
        
        // Insert selected questions
        for (let i = 0; i < questionIds.length; i++) {
          await db.query(
            'INSERT INTO training_test_questions (training_test_id, question_id, question_order) VALUES (?, ?, ?)',
            [trainingTestId, questionIds[i], i + 1]
          );
        }
      }
    } else if (trainingType === 'refresher_training') {
      // Refresher training: certificate enrolment only (40)
      const tests = [
        { type: 'certificate_enrolment', count: 40 }
      ];

      for (const test of tests) {
        const questionIds = await selectQuestionsForTest(db, test.type, test.count, moduleId);
        const [testResult] = await db.query(
          'INSERT INTO training_tests (training_id, test_type, total_questions) VALUES (?, ?, ?)',
          [trainingId, test.type, test.count]
        );

        const trainingTestId = testResult.insertId;
        for (let i = 0; i < questionIds.length; i++) {
          await db.query(
            'INSERT INTO training_test_questions (training_test_id, question_id, question_order) VALUES (?, ?, ?)',
            [trainingTestId, questionIds[i], i + 1]
          );
        }
      }
    }
  } catch (error) {
    console.error('Error creating training tests:', error);
    throw error;
  }
}

// File upload for training materials
const storage = multer.diskStorage({
  destination: './public/uploads/materials/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Chunk upload for training media (image-only, 750KB chunks)
const mediaChunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 800 * 1024 } // allow a bit of overhead; client chunks at 750KB
});

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeBaseName(name) {
  const base = String(name || 'image')
    .replace(/\.[^/.]+$/, '') // strip ext
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return base || 'image';
}

// Upload one chunk; server assembles + converts to WebP when all chunks arrive (directly attached to a training)
router.post('/:id/media/upload-chunk', mediaChunkUpload.single('chunk'), async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const trainingId = req.params.id;
    const [tRows] = await req.db.query('SELECT id, status, is_locked FROM trainings WHERE id = ?', [trainingId]);
    if (!tRows || tRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }
    if (isTrainingLocked(tRows[0])) {
      return res.status(400).json({ success: false, error: 'Training is locked' });
    }

    const {
      upload_key,
      file_id,
      file_name,
      chunk_index,
      total_chunks,
      total_size,
      mime_type
    } = req.body || {};

    if (!upload_key || !file_id || !file_name || chunk_index === undefined || !total_chunks || !total_size) {
      return res.status(400).json({ success: false, error: 'Missing upload fields' });
    }

    const totalSizeNum = parseInt(total_size, 10);
    const chunkIndexNum = parseInt(chunk_index, 10);
    const totalChunksNum = parseInt(total_chunks, 10);

    if (!Number.isFinite(totalSizeNum) || totalSizeNum <= 0 || totalSizeNum > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File size exceeds 5MB limit' });
    }
    if (!Number.isFinite(chunkIndexNum) || !Number.isFinite(totalChunksNum) || chunkIndexNum < 0 || chunkIndexNum >= totalChunksNum) {
      return res.status(400).json({ success: false, error: 'Invalid chunk index' });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'Missing chunk file' });
    }

    // basic type gate (sharp will also validate)
    if (mime_type && !String(mime_type).toLowerCase().startsWith('image/')) {
      return res.status(400).json({ success: false, error: 'Only images are allowed' });
    }

    // Enforce max 20 images per training (count existing + allow current upload)
    const [countRows] = await req.db.query('SELECT COUNT(*) as cnt FROM training_media WHERE training_id = ?', [trainingId]);
    const currentCount = countRows?.[0]?.cnt || 0;
    if (currentCount >= 20) {
      return res.status(400).json({ success: false, error: 'Maximum 20 images allowed' });
    }

    const tmpBase = path.join(__dirname, '..', 'public', 'uploads', 'training_media', 'tmp', String(trainingId), upload_key, file_id);
    ensureDir(tmpBase);

    const chunkPath = path.join(tmpBase, `${chunkIndexNum}.part`);
    fs.writeFileSync(chunkPath, req.file.buffer);

    // If not all chunks yet, return early
    const parts = fs.readdirSync(tmpBase).filter(f => f.endsWith('.part'));
    if (parts.length < totalChunksNum) {
      return res.json({ success: true, completed: false, received: parts.length, total_chunks: totalChunksNum });
    }

    // Assemble
    const assembledPath = path.join(tmpBase, `assembled-${Date.now()}.bin`);
    const outStream = fs.createWriteStream(assembledPath);
    for (let i = 0; i < totalChunksNum; i++) {
      const p = path.join(tmpBase, `${i}.part`);
      if (!fs.existsSync(p)) {
        outStream.close();
        return res.status(400).json({ success: false, error: 'Missing chunk part(s)' });
      }
      outStream.write(fs.readFileSync(p));
    }
    outStream.end();

    await new Promise((resolve, reject) => {
      outStream.on('finish', resolve);
      outStream.on('error', reject);
    });

    // Convert to WebP
    const baseName = safeBaseName(file_name);
    const webpName = `${baseName}-${Date.now()}.webp`;
    const webpAbsPath = path.join(tmpBase, webpName);

    try {
      await sharp(assembledPath)
        .rotate()
        .webp({ quality: 82 })
        .toFile(webpAbsPath);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid image file' });
    } finally {
      // Cleanup assembled file + parts
      try { fs.unlinkSync(assembledPath); } catch (e) {}
      try {
        fs.readdirSync(tmpBase).forEach(f => {
          if (f.endsWith('.part')) {
            try { fs.unlinkSync(path.join(tmpBase, f)); } catch (e) {}
          }
        });
      } catch (e) {}
    }

    // Move into final training folder + insert DB row
    const destDir = path.join(__dirname, '..', 'public', 'uploads', 'training_media', String(trainingId));
    ensureDir(destDir);
    const finalName = `media-${Date.now()}-${Math.random().toString(16).slice(2)}.webp`;
    const destAbs = path.join(destDir, finalName);
    moveFileSafe(webpAbsPath, destAbs);

    // Clean up tmp folder for this file_id
    try {
      const tmpKeyDir = path.join(__dirname, '..', 'public', 'uploads', 'training_media', 'tmp', String(trainingId), upload_key, file_id);
      if (fs.existsSync(tmpKeyDir)) fs.rmSync(tmpKeyDir, { recursive: true, force: true });
    } catch (e) {}

    const finalRel = `/uploads/training_media/${trainingId}/${finalName}`;
    const [orderRows] = await req.db.query('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM training_media WHERE training_id = ?', [trainingId]);
    const nextOrder = (orderRows?.[0]?.max_order ?? -1) + 1;
    const mediaVisibility = 'public';
    const mediaAccessExpiry = getDefaultExpiryDateTime();

    const [ins] = await req.db.query(
      'INSERT INTO training_media (training_id, file_path, original_name, uploaded_by, visibility, access_expires_at, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [trainingId, finalRel, String(file_name || ''), req.session.userId, mediaVisibility, mediaAccessExpiry, nextOrder]
    );

    return res.json({
      success: true,
      completed: true,
      media: {
        id: ins.insertId,
        file_path: finalRel,
        content_url: `/training/${trainingId}/media/${ins.insertId}/content`,
        original_name: String(file_name || '')
      }
    });
  } catch (error) {
    console.error('Media chunk upload error:', error);
    return res.status(500).json({ success: false, error: 'Upload failed' });
  }
});

// Delete a training media item
router.post('/:id/media/:mediaId/delete', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const trainingId = req.params.id;
    const mediaId = req.params.mediaId;

    const [tRows] = await req.db.query('SELECT id, status, is_locked FROM trainings WHERE id = ?', [trainingId]);
    if (!tRows || tRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }
    if (isTrainingLocked(tRows[0])) {
      return res.status(400).json({ success: false, error: 'Training is locked' });
    }

    const [rows] = await req.db.query(
      'SELECT id, file_path FROM training_media WHERE id = ? AND training_id = ?',
      [mediaId, trainingId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    const rel = rows[0].file_path;
    const abs = path.join(__dirname, '..', 'public', String(rel || '').replace(/^\//, ''));

    await req.db.query('DELETE FROM training_media WHERE id = ? AND training_id = ?', [mediaId, trainingId]);
    try {
      if (abs && fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch (e) {}

    return res.json({ success: true });
  } catch (error) {
    console.error('Training media delete error:', error);
    return res.status(500).json({ success: false, error: 'Delete failed' });
  }
});

function moveFileSafe(srcAbs, destAbs) {
  ensureDir(path.dirname(destAbs));
  try {
    fs.renameSync(srcAbs, destAbs);
  } catch (e) {
    // Cross-device fallback
    fs.copyFileSync(srcAbs, destAbs);
    fs.unlinkSync(srcAbs);
  }
}

async function getMaterialWithTraining(db, materialId, trainingId) {
  const [rows] = await db.query(`
    SELECT m.*, s.title as section_title, s.training_id, t.status AS training_status, t.is_locked AS training_is_locked,
           CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
    FROM training_materials m
    LEFT JOIN training_sections s ON m.section_id = s.id
    LEFT JOIN trainings t ON s.training_id = t.id
    LEFT JOIN users u ON m.uploaded_by = u.id
    WHERE m.id = ? AND s.training_id = ?
  `, [materialId, trainingId]);
  return rows[0] || null;
}

function normalizeAssetVisibility(value, defaultValue = 'private') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'public' || normalized === 'private') {
    return normalized;
  }
  return defaultValue;
}

function normalizeAccessExpiryInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  return `${match[1]} ${match[2]}:${match[3]}:${match[4] || '00'}`;
}

function normalizeAffiliatedCompany(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'PMS' ? 'PMS' : 'QSS';
}

async function getHealthcareById(db, rawHealthcareId) {
  const healthcareId = parseInt(String(rawHealthcareId || '').trim(), 10);
  if (!Number.isFinite(healthcareId) || healthcareId <= 0) {
    return null;
  }

  const [rows] = await db.query(
    'SELECT id, name FROM healthcare WHERE id = ? LIMIT 1',
    [healthcareId]
  );

  return rows?.[0] || null;
}

async function getHealthcareByIds(db, rawHealthcareIds) {
  const healthcareIds = [...new Set(
    (Array.isArray(rawHealthcareIds) ? rawHealthcareIds : [rawHealthcareIds])
      .map(id => parseInt(String(id || '').trim(), 10))
      .filter(id => Number.isFinite(id) && id > 0)
  )];

  if (healthcareIds.length === 0) {
    return [];
  }

  const placeholders = healthcareIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, name FROM healthcare WHERE id IN (${placeholders}) ORDER BY name ASC`,
    healthcareIds
  );

  return rows || [];
}

async function getTraineesOutsideHealthcare(db, traineeIds, healthcareIds) {
  const normalizedIds = [...new Set(
    (Array.isArray(traineeIds) ? traineeIds : [traineeIds])
      .map(id => String(id || '').trim())
      .filter(Boolean)
  )];

  if (normalizedIds.length === 0) {
    return [];
  }

  const placeholders = normalizedIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, first_name, last_name, healthcare_id
     FROM trainees
     WHERE id IN (${placeholders})`,
    normalizedIds
  );

  const byId = new Map(rows.map(row => [String(row.id), row]));
  const invalid = [];
  const allowedHealthcareIds = new Set(
    (Array.isArray(healthcareIds) ? healthcareIds : [healthcareIds])
      .map(id => String(id || '').trim())
      .filter(Boolean)
  );

  for (const id of normalizedIds) {
    const trainee = byId.get(id);
    const traineeHealthcareId = String(trainee?.healthcare_id || '').trim();
    if (!trainee || !allowedHealthcareIds.has(traineeHealthcareId)) {
      invalid.push(trainee || { id, first_name: 'Unknown', last_name: `ID ${id}`, healthcare_id: null });
    }
  }

  return invalid;
}

function formatSqlDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getDefaultExpiryDateTime() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return formatSqlDateTime(d);
}

async function getTrainingCreateFormData(db, currentUserId) {
  const [healthcare] = await db.query('SELECT * FROM healthcare ORDER BY name ASC');
  const [trainees] = await db.query(`
    SELECT t.id, t.first_name, t.last_name, t.email, h.name AS healthcare, t.ic_passport, t.trainee_id, h.id AS healthcare_id
    FROM trainees t
    LEFT JOIN healthcare h ON h.id = t.healthcare_id
    WHERE t.trainee_status = "active"
    ORDER BY t.first_name, t.last_name ASC
  `);
  const [devices] = await db.query(`
    SELECT d.*, k.model_name 
    FROM device_serial_numbers d
    LEFT JOIN device_models k ON d.device_model_id = k.id
    ORDER BY d.serial_number ASC
  `);
  const [deviceModels] = await db.query('SELECT * FROM device_models ORDER BY model_name ASC');
  const [modules] = await db.query('SELECT * FROM modules ORDER BY name ASC');
  const [trainingTitles] = await db.query('SELECT * FROM training_titles ORDER BY name ASC');
  const [trainers] = await db.query(`
    SELECT id, first_name, last_name, email 
    FROM users 
    WHERE role IN ('admin', 'trainer') AND id != ?
    ORDER BY last_name, first_name ASC
  `, [currentUserId]);

  return {
    healthcare,
    trainees,
    devices,
    deviceModels,
    modules,
    trainingTitles,
    trainers
  };
}

/**
 * Unique positive user ids for training_trainers. Always includes creatorUserId.
 * Accepts trainer_ids as array, a single scalar, or null (duplicate ids are ignored).
 */
function uniqueTrainerIdsForTraining(creatorUserId, trainer_ids) {
  const set = new Set();
  const add = (raw) => {
    if (raw === undefined || raw === null || raw === '') return;
    const n = parseInt(String(raw), 10);
    if (!Number.isNaN(n) && n > 0) set.add(n);
  };
  add(creatorUserId);
  if (trainer_ids == null || trainer_ids === '') {
    return [...set];
  }
  if (Array.isArray(trainer_ids)) {
    trainer_ids.forEach(add);
  } else {
    add(trainer_ids);
  }
  return [...set];
}

/** Dedupe trainer ids from multipart/json body (update flow; no implicit creator). */
function uniqueTrainerIdsFromForm(trainer_ids) {
  const set = new Set();
  const add = (raw) => {
    if (raw === undefined || raw === null || raw === '') return;
    const n = parseInt(String(raw), 10);
    if (!Number.isNaN(n) && n > 0) set.add(n);
  };
  if (trainer_ids == null || trainer_ids === '') {
    return [...set];
  }
  if (Array.isArray(trainer_ids)) {
    trainer_ids.forEach(add);
  } else {
    add(trainer_ids);
  }
  return [...set];
}

function isTrainingLocked(training) {
  return Boolean(Number(training?.is_locked ?? training?.training_is_locked ?? 0));
}

function isAssetAccessibleAfterLock(visibilityValue, accessExpiresAt, defaultVisibility = 'private') {
  const visibility = normalizeAssetVisibility(visibilityValue, defaultVisibility);
  if (visibility !== 'public') {
    return false;
  }
  if (!accessExpiresAt) {
    return true;
  }
  const expiry = new Date(accessExpiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return false;
  }
  return expiry.getTime() >= Date.now();
}

function shouldBypassLockedAssetVisibility(userRole) {
  return userRole === 'admin' || userRole === 'trainer';
}

async function authorizeTrainingAccess(req, trainingId) {
  if (req.session.userRole === 'admin') {
    return { allowed: true, enrollmentId: null };
  }

  if (req.session.userRole === 'trainer') {
    const [trainerAssignments] = await req.db.query(
      'SELECT id FROM training_trainers WHERE training_id = ? AND trainer_id = ?',
      [trainingId, req.session.userId]
    );
    return { allowed: trainerAssignments.length > 0, enrollmentId: null };
  }

  if (req.session.userRole === 'trainee') {
    const [enrollments] = await req.db.query(
      'SELECT id FROM enrollments WHERE training_id = ? AND trainee_id = ?',
      [trainingId, req.session.userId]
    );
    return { allowed: enrollments.length > 0, enrollmentId: enrollments[0]?.id || null };
  }

  return { allowed: false, enrollmentId: null };
}

async function trackMaterialAccess(db, materialId, enrollmentId) {
  if (!enrollmentId) return;

  await db.query(
    `INSERT INTO training_material_access (material_id, enrollment_id, first_accessed_at, last_accessed_at, access_count)
     VALUES (?, ?, NOW(), NOW(), 1)
     ON DUPLICATE KEY UPDATE
       last_accessed_at = NOW(),
       access_count = access_count + 1`,
    [materialId, enrollmentId]
  );
}

function resolveMaterialAbsolutePath(relativeFilePath) {
  const rel = String(relativeFilePath || '').replace(/^\//, '');
  const normalizedRel = path.normalize(rel);
  const requiredPrefix = path.join('uploads', 'materials') + path.sep;

  if (!normalizedRel.startsWith(requiredPrefix)) {
    return null;
  }

  return path.join(__dirname, '..', 'public', normalizedRel);
}

function resolveTrainingMediaAbsolutePath(relativeFilePath) {
  const rel = String(relativeFilePath || '').replace(/^\//, '');
  const normalizedRel = path.normalize(rel);
  const requiredPrefix = path.join('uploads', 'training_media') + path.sep;

  if (!normalizedRel.startsWith(requiredPrefix)) {
    return null;
  }

  return path.join(__dirname, '..', 'public', normalizedRel);
}

function getFileContentType(filePathValue) {
  const ext = path.extname(String(filePathValue || '')).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  if (ext === '.html' || ext === '.htm') return 'text/html; charset=utf-8';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function isInlinePreviewSupported(filePathValue) {
  const ext = path.extname(String(filePathValue || '')).toLowerCase();
  return ['.pdf', '.txt', '.html', '.htm', '.jpg', '.jpeg', '.png', '.webp'].includes(ext);
}

function isPdfFile(filePathValue) {
  return path.extname(String(filePathValue || '')).toLowerCase() === '.pdf';
}

// (Old create-time media attachment removed; media is uploaded during training via course tab.)

// List all trainings
router.get('/', async (req, res) => {
  try {
    const statusFilter = req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : [];
    const trainerFilter = req.query.trainer || null;
    const healthcareFilter = req.query.healthcare || null;
    const deviceFilter = req.query.device || null;
    const typeFilter = req.query.type || null;
    const searchQuery = req.query.search || null;

    let query = `
      SELECT DISTINCT t.*,
        (SELECT COUNT(*) FROM enrollments WHERE training_id = t.id) as enrolled_count,
        (SELECT GROUP_CONCAT(CONCAT(u.first_name, ' ', u.last_name) SEPARATOR ', ')
         FROM training_trainers tt
         JOIN users u ON tt.trainer_id = u.id
         WHERE tt.training_id = t.id) as trainer_names
      FROM trainings t
      LEFT JOIN training_healthcare th ON t.id = th.training_id
      LEFT JOIN training_devices td ON t.id = td.training_id
      WHERE 1=1
    `;

    const queryParams = [];

    // Add role-based access control
    if (req.session.userRole === 'trainee') {
      // Trainees can only see trainings they're enrolled in
      query += ` AND EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.training_id = t.id AND e.trainee_id = ?
      )`;
      queryParams.push(req.session.userId);
    } else if (req.session.userRole === 'trainer') {
      // Trainers can only see trainings they're assigned to teach
      query += ` AND EXISTS (
        SELECT 1 FROM training_trainers tt
        WHERE tt.training_id = t.id AND tt.trainer_id = ?
      )`;
      queryParams.push(req.session.userId);
    }
    // Admins can see all trainings (no additional WHERE clause)

    // Status visibility by role
    if (req.session.userRole === 'trainee') {
      // Trainees can see completed trainings unless they are explicitly locked
      query += ` AND t.status IN ('in_progress', 'completed', 'rescheduled') AND COALESCE(t.is_locked, 0) = 0`;
    } else if (req.session.userRole !== 'admin') {
      query += ` AND t.status IN ('in_progress', 'completed', 'rescheduled')`;
    }
    
    // Apply status filter
    if (statusFilter.length > 0) {
      const placeholders = statusFilter.map(() => '?').join(',');
      query += ` AND t.status IN (${placeholders})`;
      queryParams.push(...statusFilter);
    }
    
    // Apply trainer filter
    if (trainerFilter) {
      query += ` AND EXISTS (
        SELECT 1 FROM training_trainers tt 
        WHERE tt.training_id = t.id AND tt.trainer_id = ?
      )`;
      queryParams.push(trainerFilter);
    }
    
    // Apply healthcare filter
    if (healthcareFilter) {
      query += ` AND th.healthcare_id = ?`;
      queryParams.push(healthcareFilter);
    }
    
    // Apply device filter
    if (deviceFilter) {
      // Check if it's a numeric ID or a serial number string
      if (!isNaN(deviceFilter)) {
        query += ` AND td.device_serial_number_id = ?`;
        queryParams.push(deviceFilter);
      } else {
        query += ` AND td.custom_serial_number LIKE ?`;
        queryParams.push(`%${deviceFilter}%`);
      }
    }
    
    // Apply type filter
    if (typeFilter) {
      query += ` AND t.type = ?`;
      queryParams.push(typeFilter);
    }
    
    // Apply global search
    if (searchQuery) {
      query += ` AND (
        t.title LIKE ? OR 
        t.description LIKE ? OR 
        EXISTS (
          SELECT 1 FROM training_trainers tt
          JOIN users u ON tt.trainer_id = u.id
          WHERE tt.training_id = t.id 
          AND CONCAT(u.first_name, ' ', u.last_name) LIKE ?
        )
      )`;
      const searchTerm = `%${searchQuery}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY t.created_at DESC';
    
    const [trainings] = await req.db.query(query, queryParams);
    
    // Set default header for trainings without one and parse trainer names
    trainings.forEach(training => {
      if (!training.header_image) {
        training.header_image = '/images/Training Headers/Header 2.jpg';
      }
      // Parse trainer names into array
      training.trainers = training.trainer_names ? training.trainer_names.split(', ') : [];
    });
    
    // Fetch filter options
    const [trainers] = await req.db.query(`
      SELECT DISTINCT u.id, u.first_name, u.last_name
      FROM users u
      INNER JOIN training_trainers tt ON u.id = tt.trainer_id
      WHERE u.role IN ('admin', 'trainer')
      ORDER BY u.last_name, u.first_name
    `);
    
    const [healthcare] = await req.db.query('SELECT * FROM healthcare ORDER BY name ASC');
    
    const [devices] = await req.db.query(`
      SELECT DISTINCT d.id, d.serial_number, k.model_name
      FROM device_serial_numbers d
      LEFT JOIN device_models k ON d.device_model_id = k.id
      INNER JOIN training_devices td ON d.id = td.device_serial_number_id
      ORDER BY d.serial_number ASC
    `);
    
    // Also get custom serial numbers
    const [customDevices] = await req.db.query(`
      SELECT DISTINCT custom_serial_number as serial_number
      FROM training_devices
      WHERE custom_serial_number IS NOT NULL
      ORDER BY custom_serial_number ASC
    `);
    
    res.render('training/list', { 
      user: req.session, 
      trainings,
      selectedStatuses: statusFilter,
      selectedTrainer: trainerFilter,
      selectedHealthcare: healthcareFilter,
      selectedDevice: deviceFilter,
      selectedType: typeFilter,
      searchQuery: searchQuery,
      trainers,
      healthcare,
      devices: [...devices, ...customDevices.map(d => ({ id: d.serial_number, serial_number: d.serial_number, model_name: 'Custom' }))],
    });
  } catch (error) {
    console.error('Training list error:', error);
    res.status(500).send('Error loading trainings');
  }
});

// Create training page (admin/trainer only)
router.get('/create', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).send('Access denied');
  }
  
  try {
    const formData = await getTrainingCreateFormData(req.db, req.session.userId);
    res.render('training/create', { 
      user: req.session, 
      error: null,
      ...formData
    });
  } catch (error) {
    console.error('Training create page error:', error);
    res.status(500).send('Error loading training creation page');
  }
});

// Create training POST
router.post('/create', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).send('Access denied');
  }
  
  const {
    title,
    description,
    type,
    affiliated_company,
    module_id,
    device_model_id,
    start_datetime,
    end_datetime,
    healthcare_ids, // Array of healthcare IDs
    trainer_ids, // Array of trainer IDs
    trainee_ids, // Array of trainee IDs
    device_ids, // Array of device_serial_numbers IDs
    custom_devices, // Array of custom serial numbers
    save_custom_devices, // Array of booleans indicating if custom device should be saved
    custom_device_models // Array of device_model_id for custom devices
  } = req.body;
  
  let connection = null;
  
  try {
    // Randomly select a header image
    const fs = require('fs');
    const path = require('path');
    const headersPath = path.join(__dirname, '..', 'public', 'images', 'Training Headers');
    const headerFiles = ['Header 1.jpg', 'Header 2.jpg', 'Header 3.png', 'Header 4.png', 'Header 5.png'];
    const availableHeaders = headerFiles.filter(file => {
      const filePath = path.join(headersPath, file);
      return fs.existsSync(filePath);
    });
    
    let headerImage = null;
    if (availableHeaders.length > 0) {
      const randomHeader = availableHeaders[Math.floor(Math.random() * availableHeaders.length)];
      headerImage = `/images/Training Headers/${randomHeader}`;
    }
    
    // Convert datetime format from flatpickr (Y-m-d h:i K) to MySQL format (Y-m-d H:i:s)
    let startDatetime = null;
    let endDatetime = null;
    
    // Helper function to convert AM/PM format to MySQL datetime
    function convertToMySQLDatetime(dateTimeStr) {
      if (!dateTimeStr) return null;
      
      // Parse the date string (format: "Y-m-d h:i K" e.g., "2024-01-15 2:30 PM")
      const parts = dateTimeStr.trim().split(' ');
      if (parts.length < 3) return dateTimeStr + ':00'; // Fallback if format is unexpected
      
      const datePart = parts[0]; // "Y-m-d"
      const timePart = parts[1]; // "h:i"
      const ampm = parts[2].toUpperCase(); // "AM" or "PM"
      
      const [year, month, day] = datePart.split('-');
      const [hours12, minutes] = timePart.split(':');
      
      let hours24 = parseInt(hours12, 10);
      if (ampm === 'PM' && hours24 !== 12) {
        hours24 += 12;
      } else if (ampm === 'AM' && hours24 === 12) {
        hours24 = 0;
      }
      
      return `${year}-${month}-${day} ${String(hours24).padStart(2, '0')}:${minutes}:00`;
    }
    
    if (start_datetime) {
      startDatetime = convertToMySQLDatetime(start_datetime);
    }
    
    if (end_datetime) {
      endDatetime = convertToMySQLDatetime(end_datetime);
    }
    
    if (!module_id || !device_model_id) {
      const formData = await getTrainingCreateFormData(req.db, req.session.userId);
      return res.render('training/create', { 
        user: req.session, 
        error: !module_id ? 'Module is required.' : 'Device model is required.',
        ...formData
      });
    }

    // Validate test questions availability BEFORE creating training
    const validation = await validateTestQuestions(req.db, type, module_id);
    if (!validation.valid) {
      const formData = await getTrainingCreateFormData(req.db, req.session.userId);
      const errorSummary = await buildQuestionValidationSummary(req.db, validation.errors, module_id);
      return res.render('training/create', { 
        user: req.session, 
        error: errorSummary,
        ...formData
      });
    }
    
    const traineeIdsArray = trainee_ids ? (Array.isArray(trainee_ids) ? trainee_ids : [trainee_ids]) : [];
    const submittedHealthcareIds = req.body['healthcare_ids[]'] || healthcare_ids || [];
    const selectedHealthcareList = await getHealthcareByIds(req.db, submittedHealthcareIds);
    if (selectedHealthcareList.length === 0) {
      throw new Error('Please select at least one healthcare centre for this training.');
    }

    const nonActiveTrainees = await getNonActiveTrainees(req.db, traineeIdsArray);
    if (nonActiveTrainees.length > 0) {
      throw new Error('Only active trainees can be added to trainings. Registered, inactive, and suspended trainees are not allowed.');
    }
    const selectedHealthcareIds = selectedHealthcareList.map(item => item.id);
    const invalidHealthcareTrainees = await getTraineesOutsideHealthcare(req.db, traineeIdsArray, selectedHealthcareIds);
    if (invalidHealthcareTrainees.length > 0) {
      throw new Error(`All selected trainees must belong to the selected healthcare centre(s): ${selectedHealthcareList.map(item => item.name).join(', ')}.`);
    }

    // Get a connection from the pool for transaction
    const connection = await req.db.getConnection();
    const affiliatedCompany = normalizeAffiliatedCompany(affiliated_company);
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Insert training
      const [result] = await connection.query(
        'INSERT INTO trainings (title, description, type, module_id, affiliated_company, device_model_id, created_by, status, start_datetime, end_datetime, header_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [title, description, type, module_id, affiliatedCompany, device_model_id, req.session.userId, 'in_progress', startDatetime, endDatetime, headerImage]
      );
      
      const trainingId = result.insertId;
      
      const trainerIdsUnique = uniqueTrainerIdsForTraining(req.session.userId, trainer_ids);
      for (const trainerId of trainerIdsUnique) {
        await connection.query(
          'INSERT INTO training_trainers (training_id, trainer_id) VALUES (?, ?)',
          [trainingId, trainerId]
        );
      }
      
      // Insert healthcare relationships
      for (const healthcare of selectedHealthcareList) {
        await connection.query(
          'INSERT INTO training_healthcare (training_id, healthcare_id) VALUES (?, ?)',
          [trainingId, healthcare.id]
        );
      }
      
      // Insert device relationships (from settings)
      if (device_ids && Array.isArray(device_ids)) {
        for (const deviceId of device_ids) {
          await connection.query(
            'INSERT INTO training_devices (training_id, device_serial_number_id) VALUES (?, ?)',
            [trainingId, deviceId]
          );
        }
      }
      
      // Insert custom device serial numbers
      if (custom_devices && Array.isArray(custom_devices)) {
        for (let i = 0; i < custom_devices.length; i++) {
          const customSerial = custom_devices[i];
          if (customSerial && customSerial.trim()) {
            let deviceSerialNumberId = null;
            
            // If user wants to save to settings, create device_serial_number record
            if (save_custom_devices && save_custom_devices[i] === 'true' && custom_device_models && custom_device_models[i]) {
              try {
                const [deviceResult] = await connection.query(
                  'INSERT INTO device_serial_numbers (serial_number, device_model_id) VALUES (?, ?)',
                  [customSerial.trim(), custom_device_models[i]]
                );
                deviceSerialNumberId = deviceResult.insertId;
              } catch (error) {
                // If device already exists, get its ID
                if (error.code === 'ER_DUP_ENTRY') {
                  const [existing] = await connection.query(
                    'SELECT id FROM device_serial_numbers WHERE serial_number = ?',
                    [customSerial.trim()]
                  );
                  if (existing.length > 0) {
                    deviceSerialNumberId = existing[0].id;
                  }
                } else {
                  console.error('Error saving custom device to settings:', error);
                }
              }
            }
            
            // Insert into training_devices
            if (deviceSerialNumberId) {
              await connection.query(
                'INSERT INTO training_devices (training_id, device_serial_number_id) VALUES (?, ?)',
                [trainingId, deviceSerialNumberId]
              );
            } else {
              await connection.query(
                'INSERT INTO training_devices (training_id, custom_serial_number) VALUES (?, ?)',
                [trainingId, customSerial.trim()]
              );
            }
          }
        }
      }
      
      // Insert trainee relationships and create enrollments
      if (traineeIdsArray.length > 0) {
        for (const traineeId of traineeIdsArray) {
          // Insert into training_trainees
          await connection.query(
            'INSERT INTO training_trainees (training_id, trainee_id) VALUES (?, ?)',
            [trainingId, traineeId]
          );
          
          // Also create enrollment
          try {
            await connection.query(
              'INSERT INTO enrollments (trainee_id, training_id) VALUES (?, ?)',
              [traineeId, trainingId]
            );
          } catch (error) {
            // Enrollment might already exist, ignore
            if (error.code !== 'ER_DUP_ENTRY') {
              console.error('Error creating enrollment:', error);
            }
          }
        }
      }
      
      // If this is a main training, copy all hands-on aspects from settings
      if (type === 'main') {
        const [aspects] = await connection.query('SELECT * FROM practical_learning_outcomes_settings');
        
        for (const aspect of aspects) {
          await connection.query(
            'INSERT INTO practical_learning_outcomes (training_id, aspect_name, description, max_score) VALUES (?, ?, ?, ?)',
            [trainingId, aspect.aspect_name, aspect.description, aspect.max_score]
          );
        }
      }
      
      // Create tests for the training (must succeed or transaction will rollback)
      await createTrainingTests(connection, trainingId, type, module_id);
      
      // Commit transaction
      await connection.commit();
      
      res.redirect(`/training/${trainingId}`);
    } catch (error) {
      // Rollback transaction on any error
      await connection.rollback();
      
      console.error('Training creation error:', error);
      
      // Re-fetch data for form
      try {
        const formData = await getTrainingCreateFormData(req.db, req.session.userId);
        // Show specific error message
        const errorMessage = error.message || 'Error creating training';
        
        res.render('training/create', { 
          user: req.session, 
          error: errorMessage,
          ...formData
        });
      } catch (renderError) {
        console.error('Error rendering create page:', renderError);
        res.status(500).send('Error creating training: ' + error.message);
      }
    } finally {
      // Release the connection back to the pool
      if (connection) {
        connection.release();
      }
    }
  } catch (error) {
    // Catch any errors that occur outside the transaction (e.g., validation, header image selection, getting connection)
    console.error('Training creation error (outer):', error);
    
    // Re-fetch data for form
    try {
      const formData = await getTrainingCreateFormData(req.db, req.session.userId);
      res.render('training/create', { 
        user: req.session, 
        error: error.message || 'Error creating training',
        ...formData
      });
    } catch (renderError) {
      console.error('Error rendering create page:', renderError);
      res.status(500).send('Error creating training');
    }
  }
});

// View training details
router.get('/:id', async (req, res) => {
  try {
    const [trainings] = await req.db.query(
      'SELECT t.*, u.first_name, u.last_name FROM trainings t LEFT JOIN users u ON t.created_by = u.id WHERE t.id = ?',
      [req.params.id]
    );
    
    if (trainings.length === 0) {
      return res.status(404).send('Training not found');
    }

    const training = trainings[0];

    // Restrict visibility by role and status
    if (req.session.userRole === 'trainee') {
      const traineeAllowedStatuses = ['in_progress', 'completed', 'rescheduled'];
      if (!traineeAllowedStatuses.includes(training.status)) {
        return res.status(403).send('This training is locked. You can only view your certificate.');
      }
      if (isTrainingLocked(training)) {
        return res.status(403).send('This training is locked. You can only view your certificate.');
      }
    } else if (req.session.userRole !== 'admin') {
      const allowedStatuses = ['in_progress', 'completed', 'rescheduled'];
      if (!allowedStatuses.includes(training.status)) {
        return res.status(403).send('You are not authorized to access this training. Please contact your administrator.');
      }
    }

    // Check authorization based on user role
    if (req.session.userRole === 'trainee') {
      // Check if trainee is enrolled in this training
      const [enrollments] = await req.db.query(
        'SELECT id FROM enrollments WHERE training_id = ? AND trainee_id = ?',
        [req.params.id, req.session.userId]
      );
      if (enrollments.length === 0) {
        return res.status(403).send('You are not authorized to access this training. Please contact your administrator.');
      }
    } else if (req.session.userRole === 'trainer') {
      // Check if trainer is assigned to this training
      const [trainerAssignments] = await req.db.query(
        'SELECT id FROM training_trainers WHERE training_id = ? AND trainer_id = ?',
        [req.params.id, req.session.userId]
      );
      if (trainerAssignments.length === 0) {
        return res.status(403).send('You are not authorized to access this training. Please contact your administrator.');
      }
    }
    // Admins can access all trainings
    
    // Set default header if not set
    if (!training.header_image) {
      training.header_image = '/images/Training Headers/Header 2.jpg';
    }
    const locked = isTrainingLocked(training);
    const shouldRestrictLockedMaterials = locked && !shouldBypassLockedAssetVisibility(req.session.userRole);
    const materialVisibilityFilter = shouldRestrictLockedMaterials
      ? ` AND (COALESCE(m.visibility, 'private') = 'public' AND (m.access_expires_at IS NULL OR m.access_expires_at >= NOW()))`
      : '';
    
    // Get sections and materials
    const [sections] = await req.db.query(`
      SELECT s.*, 
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', m.id,
          'title', m.title,
          'type', m.type,
          'file_path', m.file_path,
          'url', m.url,
          'visibility', COALESCE(m.visibility, 'private'),
          'access_expires_at', m.access_expires_at,
          'uploaded_by', CONCAT(u.first_name, ' ', u.last_name)
        ))
        FROM training_materials m
        LEFT JOIN users u ON m.uploaded_by = u.id
        WHERE m.section_id = s.id
        ${materialVisibilityFilter}
        ORDER BY m.material_order) as materials
      FROM training_sections s
      WHERE s.training_id = ?
      ORDER BY s.section_order
    `, [req.params.id]);
    
    // Get all materials separately (for materials without sections)
    // Since section_id is NOT NULL, we'll get materials from all sections
    const [allMaterialsResult] = await req.db.query(`
      SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as uploaded_by, m.section_id
      FROM training_materials m
      LEFT JOIN users u ON m.uploaded_by = u.id
      WHERE m.section_id IN (
        SELECT id FROM training_sections WHERE training_id = ?
      )
      ${materialVisibilityFilter}
      ORDER BY m.material_order
    `, [req.params.id]);
    
    const allMaterials = allMaterialsResult || [];
    
    // Get hands-on aspects if main training
    let aspects = [];
    if (training.type === 'main') {
      [aspects] = await req.db.query(
        'SELECT * FROM practical_learning_outcomes WHERE training_id = ? ORDER BY id',
        [req.params.id]
      );
    }
    
    // Get training tests
    const [trainingTests] = await req.db.query(
      'SELECT * FROM training_tests WHERE training_id = ? ORDER BY test_type',
      [req.params.id]
    );
    
    // Get all trainers for this training
    const [trainersResult] = await req.db.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.profile_picture
      FROM training_trainers tt
      JOIN users u ON tt.trainer_id = u.id
      WHERE tt.training_id = ?
      ORDER BY u.last_name, u.first_name
    `, [req.params.id]);
    
    const trainers = trainersResult || [];
    
    // Keep trainer variable for backward compatibility (first trainer or creator)
    const trainer = trainers.length > 0 ? trainers[0] : {
      id: training.created_by,
      first_name: training.first_name || 'Unknown',
      last_name: training.last_name || 'Trainer',
      email: null,
      profile_picture: null
    };
    
    // Get all enrolled trainees (People tab)
    let enrolledTrainees = [];
    try {
      const [traineesResult] = await req.db.query(`
        SELECT tr.*, e.enrolled_at, e.status as enrollment_status
        FROM enrollments e
        JOIN trainees tr ON e.trainee_id = tr.id
        WHERE e.training_id = ?
        ORDER BY tr.last_name, tr.first_name
      `, [req.params.id]);
      enrolledTrainees = traineesResult || [];
    } catch (error) {
      console.error('Error fetching enrolled trainees:', error);
      enrolledTrainees = [];
    }
    
    // Get marks/grades for all trainees (Marks tab) - only for admin/trainer
    let marksData = [];
    if (['admin', 'trainer'].includes(req.session.userRole)) {
      // Get test results for all enrollments
      const [allEnrollments] = await req.db.query(
        'SELECT id, trainee_id, can_download_results FROM enrollments WHERE training_id = ?',
        [req.params.id]
      );
      
      for (const enrollment of allEnrollments) {
        const [tests] = await req.db.query(
          'SELECT * FROM test_attempts WHERE enrollment_id = ? AND status = "completed" ORDER BY test_type',
          [enrollment.id]
        );
        
        // Convert scores to numbers (MySQL DECIMAL returns as string)
        tests.forEach(test => {
          test.score = parseFloat(test.score) || 0;
        });
        
        let handsOnScores = [];
        if (training.type === 'main') {
          [handsOnScores] = await req.db.query(`
            SELECT hs.*, ha.aspect_name, ha.max_score
            FROM practical_learning_outcome_scores hs
            JOIN practical_learning_outcomes ha ON hs.aspect_id = ha.id
            WHERE hs.enrollment_id = ?
          `, [enrollment.id]);
        }
        
        const [traineeInfo] = await req.db.query(
          'SELECT first_name, last_name, trainee_id FROM trainees WHERE id = ?',
          [enrollment.trainee_id]
        );
        
        if (traineeInfo.length > 0) {
          marksData.push({
            trainee_id: traineeInfo[0].trainee_id,
            trainee_name: `${traineeInfo[0].first_name} ${traineeInfo[0].last_name}`,
            enrollment_id: enrollment.id,
            tests,
            handsOnScores,
            can_download_results: enrollment.can_download_results || false
          });
        }
      }
    }
    
    // Check if user is enrolled
    let enrollment = null;
    let traineeMarksData = null;
    if (req.session.userRole === 'trainee') {
      const [enrollments] = await req.db.query(`
        SELECT e.*,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'pre_test' AND status = 'completed') > 0 as pre_test_completed,
          (SELECT MAX(score) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'pre_test' AND status = 'completed') as pre_test_score,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'pre_test' AND status = 'completed' AND score < 80) as pre_test_failed_attempts,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'post_test' AND status = 'completed') > 0 as post_test_completed,
          (SELECT MAX(score) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'post_test' AND status = 'completed') as post_test_score,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'post_test' AND status = 'completed' AND score < 80) as post_test_failed_attempts,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'refresher_training' AND status = 'completed') > 0 as refresher_training_test_completed,
          (SELECT MAX(score) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'refresher_training' AND status = 'completed') as refresher_training_score,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'refresher_training' AND status = 'completed' AND score < 80) as refresher_training_failed_attempts,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'certificate_enrolment' AND status = 'completed') > 0 as certificate_enrolment_test_completed,
          (SELECT MAX(score) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'certificate_enrolment' AND status = 'completed') as certificate_enrolment_score,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'certificate_enrolment' AND status = 'completed' AND score < 80) as certificate_enrolment_failed_attempts
        FROM enrollments e
        WHERE e.trainee_id = ? AND e.training_id = ?
      `, [req.session.userId, req.params.id]);
      enrollment = enrollments[0] || null;
      
      // Get marks data for trainee if scores are released
      if (enrollment && enrollment.can_download_results) {
        const [tests] = await req.db.query(
          'SELECT * FROM test_attempts WHERE enrollment_id = ? AND status = "completed" ORDER BY test_type',
          [enrollment.id]
        );
        
        tests.forEach(test => {
          test.score = parseFloat(test.score) || 0;
        });
        
        let handsOnScores = [];
        if (training.type === 'main') {
          [handsOnScores] = await req.db.query(`
            SELECT hs.*, ha.aspect_name, ha.max_score, ha.description
            FROM practical_learning_outcome_scores hs
            JOIN practical_learning_outcomes ha ON hs.aspect_id = ha.id
            WHERE hs.enrollment_id = ?
          `, [enrollment.id]);
        }
        
        const [finalGrades] = await req.db.query(
          'SELECT * FROM final_grades WHERE enrollment_id = ?',
          [enrollment.id]
        );
        
        traineeMarksData = {
          tests,
          handsOnScores,
          finalGrade: finalGrades.length > 0 ? finalGrades[0] : null
        };
      }
    }
    
    // Get attendance data for Attendance tab (Admin/Trainer only)
    let attendanceData = [];
    if (['admin', 'trainer'].includes(req.session.userRole)) {
      const [attendanceResult] = await req.db.query(`
        SELECT e.*, tr.first_name, tr.last_name, tr.email, tr.trainee_id,
          (SELECT COUNT(*) FROM attendance WHERE enrollment_id = e.id AND status = 'present') as present_count,
          (SELECT COUNT(*) FROM attendance WHERE enrollment_id = e.id AND status = 'absent') as absent_count
        FROM enrollments e
        JOIN trainees tr ON e.trainee_id = tr.id
        WHERE e.training_id = ?
        ORDER BY tr.last_name, tr.first_name
      `, [req.params.id]);
      attendanceData = attendanceResult || [];
    }

    // Training Media (gallery)
    let trainingMedia = [];
    try {
      const mediaVisibilityFilter = locked
        ? ` AND (COALESCE(visibility, 'public') = 'public' AND (access_expires_at IS NULL OR access_expires_at >= NOW()))`
        : '';
      const [mediaRows] = await req.db.query(
        `SELECT id, file_path, original_name, visibility, access_expires_at
         FROM training_media
         WHERE training_id = ?
         ${mediaVisibilityFilter}
         ORDER BY sort_order ASC, id ASC`,
        [req.params.id]
      );
      trainingMedia = mediaRows || [];
    } catch (e) {
      trainingMedia = [];
    }
    
    // Get data for Settings tab (Admin/Trainer only)
      let allHealthcare = [];
      let allDevices = [];
      let allTrainingTitles = [];
      let allModules = [];
      let allDeviceModels = [];
      let allTrainers = [];
    let allTrainees = [];
    let trainingHealthcare = [];
    let trainingDevices = [];
    
    if (['admin', 'trainer'].includes(req.session.userRole)) {
      // Get all healthcare centres
      [allHealthcare] = await req.db.query('SELECT * FROM healthcare ORDER BY name ASC');
      
      // Get current training healthcare associations
      [trainingHealthcare] = await req.db.query(
        'SELECT healthcare_id FROM training_healthcare WHERE training_id = ?',
        [req.params.id]
      );
      
        // Get all devices
        [allDevices] = await req.db.query(`
          SELECT dsn.*, klm.model_name 
          FROM device_serial_numbers dsn
          LEFT JOIN device_models klm ON dsn.device_model_id = klm.id
          ORDER BY dsn.serial_number ASC
        `);
        
        [allTrainingTitles] = await req.db.query('SELECT * FROM training_titles ORDER BY name ASC');
        [allModules] = await req.db.query('SELECT * FROM modules ORDER BY name ASC');

        // Get all device models
        [allDeviceModels] = await req.db.query('SELECT * FROM device_models ORDER BY model_name ASC');
      
      // Get current training devices
      [trainingDevices] = await req.db.query(
        'SELECT * FROM training_devices WHERE training_id = ?',
        [req.params.id]
      );
      
      // Get all trainers
      [allTrainers] = await req.db.query(`
        SELECT id, first_name, last_name, email 
        FROM users 
        WHERE role IN ('admin', 'trainer')
        ORDER BY last_name, first_name
      `);
      
      // Get trainees for the selected healthcare only
      const selectedHealthcareId = trainingHealthcare[0]?.healthcare_id || null;
      [allTrainees] = await req.db.query(`
        SELECT t.id, t.trainee_id, t.first_name, t.last_name, t.email, h.name AS healthcare, t.ic_passport, h.id AS healthcare_id
        FROM trainees t
        LEFT JOIN healthcare h ON h.id = t.healthcare_id
        WHERE t.trainee_status = 'active'
          AND (? IS NULL OR h.id = ?)
        ORDER BY t.last_name, t.first_name
      `, [selectedHealthcareId, selectedHealthcareId]);
    }
    
    res.render('training/view', { 
      user: req.session, 
      training, 
      trainingMedia,
      enrollment,
      marksData: req.session.userRole === 'trainee' ? (traineeMarksData || null) : marksData,
      sections: sections.map(s => {
        let materials = [];
        try {
          if (s.materials === null || s.materials === undefined) {
            materials = [];
          } else if (typeof s.materials === 'string') {
            // Try to parse as JSON string
            const parsed = JSON.parse(s.materials);
            materials = Array.isArray(parsed) ? parsed : [];
          } else if (Array.isArray(s.materials)) {
            // Already an array
            materials = s.materials;
          } else {
            // If it's an object but not an array, wrap it
            materials = [];
          }
        } catch (e) {
          console.error('Error parsing materials:', e, 'Raw value:', s.materials, 'Type:', typeof s.materials);
          materials = [];
        }
        return {...s, materials};
      }),
      aspects,
      trainingTests: trainingTests || [],
      enrollment,
      trainer,
      trainers,
      enrolledTrainees,
      attendanceData,
      allHealthcare,
      allDevices,
      allTrainingTitles,
      allModules,
      allDeviceModels,
      allTrainers,
      allTrainees,
      trainingHealthcare,
      trainingDevices,
      allMaterials
    });
  } catch (error) {
    console.error('Training view error:', error);
    res.status(500).send('Error loading training');
  }
});

// List trainings available for import (admin/trainer only)
router.get('/:id/import-sections/trainings', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const [trainings] = await req.db.query(`
      SELECT 
        t.id,
        t.title,
        t.start_datetime,
        t.end_datetime,
        t.created_at,
        COUNT(DISTINCT s.id) AS section_count,
        COUNT(m.id) AS material_count
      FROM trainings t
      LEFT JOIN training_sections s ON s.training_id = t.id
      LEFT JOIN training_materials m ON m.section_id = s.id
      WHERE t.id != ?
      GROUP BY t.id
      ORDER BY t.start_datetime DESC, t.created_at DESC
      LIMIT 100
    `, [req.params.id]);

    res.json({ success: true, trainings: trainings || [] });
  } catch (error) {
    console.error('Import trainings list error:', error);
    res.status(500).json({ success: false, error: 'Error loading trainings' });
  }
});

// List sections for a source training (admin/trainer only)
router.get('/:id/import-sections/source/:sourceId', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const [sections] = await req.db.query(`
      SELECT 
        s.id,
        s.title,
        s.section_order,
        COUNT(m.id) AS material_count
      FROM training_sections s
      LEFT JOIN training_materials m ON m.section_id = s.id
      WHERE s.training_id = ?
      GROUP BY s.id
      ORDER BY s.section_order ASC
    `, [req.params.sourceId]);

    res.json({ success: true, sections: sections || [] });
  } catch (error) {
    console.error('Import sections list error:', error);
    res.status(500).json({ success: false, error: 'Error loading sections' });
  }
});

// Import sections + materials from a previous training (admin/trainer only)
router.post('/:id/import-sections', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  const trainingId = req.params.id;
  const sourceTrainingId = String(req.body?.sourceTrainingId || '').trim();
  const rawSectionIds = req.body?.sectionIds;
  const sectionIds = Array.isArray(rawSectionIds)
    ? rawSectionIds.map(id => String(id)).filter(Boolean)
    : (rawSectionIds ? [String(rawSectionIds)] : []);

  if (!sourceTrainingId || sectionIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Please select a source training and at least one section.' });
  }

  if (String(sourceTrainingId) === String(trainingId)) {
    return res.status(400).json({ success: false, error: 'Cannot import from the same training.' });
  }

  const connection = await req.db.getConnection();
  try {
    await connection.beginTransaction();

    const [targetRows] = await connection.query('SELECT id, status, is_locked FROM trainings WHERE id = ?', [trainingId]);
    if (!targetRows || targetRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Target training not found' });
    }
    if (isTrainingLocked(targetRows[0])) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Training is locked' });
    }

    const placeholders = sectionIds.map(() => '?').join(',');
    const [sourceSections] = await connection.query(`
      SELECT id, title, section_order
      FROM training_sections
      WHERE training_id = ? AND id IN (${placeholders})
      ORDER BY section_order ASC
    `, [sourceTrainingId, ...sectionIds]);

    if (!sourceSections || sourceSections.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'No matching sections found to import' });
    }

    const [maxSectionRows] = await connection.query(
      'SELECT COALESCE(MAX(section_order), 0) as max_order FROM training_sections WHERE training_id = ?',
      [trainingId]
    );
    let nextSectionOrder = maxSectionRows?.[0]?.max_order || 0;

    const [generalRows] = await connection.query(
      'SELECT id FROM training_sections WHERE training_id = ? AND title = ? LIMIT 1',
      [trainingId, 'General Materials']
    );
    let generalSectionId = generalRows?.[0]?.id || null;

    let sectionsImported = 0;
    let materialsImported = 0;

    for (const sourceSection of sourceSections) {
      let targetSectionId = null;
      const isGeneral = sourceSection.title === 'General Materials';

      if (isGeneral && generalSectionId) {
        targetSectionId = generalSectionId;
      } else {
        nextSectionOrder += 1;
        const [insertSection] = await connection.query(
          'INSERT INTO training_sections (training_id, title, section_order) VALUES (?, ?, ?)',
          [trainingId, sourceSection.title, nextSectionOrder]
        );
        targetSectionId = insertSection.insertId;
        if (isGeneral) {
          generalSectionId = targetSectionId;
        }
        sectionsImported += 1;
      }

      const [maxMatRows] = await connection.query(
        'SELECT COALESCE(MAX(material_order), 0) as max_order FROM training_materials WHERE section_id = ?',
        [targetSectionId]
      );
      const materialOffset = maxMatRows?.[0]?.max_order || 0;

      const [insertMaterials] = await connection.query(`
        INSERT INTO training_materials (section_id, title, type, file_path, url, material_order, uploaded_by, visibility, access_expires_at)
        SELECT ?, title, type, file_path, url, material_order + ?, uploaded_by, COALESCE(visibility, 'private'), access_expires_at
        FROM training_materials
        WHERE section_id = ?
        ORDER BY material_order ASC
      `, [targetSectionId, materialOffset, sourceSection.id]);

      materialsImported += insertMaterials?.affectedRows || 0;
    }

    await connection.commit();
    res.json({ success: true, sectionsImported, materialsImported });
  } catch (error) {
    try { await connection.rollback(); } catch (e) {}
    console.error('Import sections error:', error);
    res.status(500).json({ success: false, error: 'Error importing sections' });
  } finally {
    connection.release();
  }
});

// Create material (can be with or without section)
router.post('/:id/materials/create', upload.single('file'), async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const { title, type, section_id, url, document_url, visibility, access_expires_at } = req.body;
    const trainingId = req.params.id;
    
    // Determine file path and URL
    let filePath = null;
    let materialUrl = null;
    
    if (type === 'video' || type === 'link') {
      materialUrl = url;
    } else if (type === 'document') {
      if (req.file) {
        // Check file size (5MB max)
        if (req.file.size > 5 * 1024 * 1024) {
          return res.status(400).json({ success: false, error: 'File size exceeds 5MB limit' });
        }
        filePath = `/uploads/materials/${req.file.filename}`;
      } else if (document_url) {
        materialUrl = document_url;
      } else {
        return res.status(400).json({ success: false, error: 'Please provide either a file or a link for the document' });
      }
    }
    
    // Handle section - if no section provided, create or use "General Materials" section
    let finalSectionId = section_id;
    if (!finalSectionId || finalSectionId === '') {
      // Check if "General Materials" section exists
      const [existingGeneral] = await req.db.query(
        'SELECT id FROM training_sections WHERE training_id = ? AND title = ?',
        [trainingId, 'General Materials']
      );
      
      if (existingGeneral.length > 0) {
        finalSectionId = existingGeneral[0].id;
      } else {
        // Create "General Materials" section
        const [newSection] = await req.db.query(
          'INSERT INTO training_sections (training_id, title, section_order) VALUES (?, ?, 0)',
          [trainingId, 'General Materials']
        );
        finalSectionId = newSection.insertId;
      }
    }
    
    // Get max order for the section
    const [maxOrder] = await req.db.query(
      'SELECT COALESCE(MAX(material_order), 0) as max_order FROM training_materials WHERE section_id = ?',
      [finalSectionId]
    );
    const materialVisibility = normalizeAssetVisibility(visibility, 'private');
    const requestedExpiry = normalizeAccessExpiryInput(access_expires_at);
    const materialAccessExpiry = materialVisibility === 'public' ? (requestedExpiry || getDefaultExpiryDateTime()) : null;
    
    await req.db.query(
      `INSERT INTO training_materials
        (section_id, title, type, file_path, url, material_order, uploaded_by, visibility, access_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [finalSectionId, title, type, filePath, materialUrl, maxOrder[0].max_order + 1, req.session.userId, materialVisibility, materialAccessExpiry]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Material creation error:', error);
    res.status(500).json({ success: false, error: 'Error creating material' });
  }
});

// View material
router.get('/:id/materials/:materialId', async (req, res) => {
  try {
    const trainingId = Number(req.params.id);
    const materialId = Number(req.params.materialId);
    const material = await getMaterialWithTraining(req.db, materialId, trainingId);

    if (!material) {
      return res.status(404).send('Material not found');
    }

    // Get training info
    const [trainings] = await req.db.query('SELECT * FROM trainings WHERE id = ?', [material.training_id]);
    if (trainings.length === 0) {
      return res.status(404).send('Training not found');
    }
    const training = trainings[0];
    const access = await authorizeTrainingAccess(req, training.id);
    if (!access.allowed) {
      return res.status(403).send('You are not authorized to access this material. Please contact your administrator.');
    }

    if (
      isTrainingLocked(training) &&
      !shouldBypassLockedAssetVisibility(req.session.userRole) &&
      !isAssetAccessibleAfterLock(material.visibility, material.access_expires_at, 'private')
    ) {
      return res.status(403).send('This material is no longer accessible after training lock.');
    }

    if (req.session.userRole === 'trainee' && access.enrollmentId) {
      try {
        await trackMaterialAccess(req.db, material.id, access.enrollmentId);
      } catch (trackError) {
        console.warn('Material access tracking failed:', trackError.message);
      }
    }

    const canPreviewInline = Boolean(material.file_path) && isInlinePreviewSupported(material.file_path);

    res.render('training/material-view', {
      user: req.session,
      training,
      material,
      canPreviewInline
    });
  } catch (error) {
    console.error('Material view error:', error);
    res.status(500).send('Error loading material');
  }
});

// View training media (inline image only)
router.get('/:id/media/:mediaId/content', async (req, res) => {
  try {
    const trainingId = Number(req.params.id);
    const mediaId = Number(req.params.mediaId);

    const [rows] = await req.db.query(
      `SELECT tm.id, tm.file_path, tm.visibility, tm.access_expires_at, t.is_locked AS training_is_locked
       FROM training_media tm
       INNER JOIN trainings t ON t.id = tm.training_id
       WHERE tm.id = ? AND tm.training_id = ?`,
      [mediaId, trainingId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).send('Media not found');
    }

    const media = rows[0];
    const access = await authorizeTrainingAccess(req, trainingId);
    if (!access.allowed) {
      return res.status(403).send('You are not authorized to access this media. Please contact your administrator.');
    }

    if (isTrainingLocked(media) && !isAssetAccessibleAfterLock(media.visibility, media.access_expires_at, 'public')) {
      return res.status(403).send('This media is no longer accessible after training lock.');
    }

    const absolutePath = resolveTrainingMediaAbsolutePath(media.file_path);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).send('Media file not found');
    }

    res.setHeader('Content-Type', getFileContentType(media.file_path));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    return res.sendFile(absolutePath);
  } catch (error) {
    console.error('Training media content error:', error);
    return res.status(500).send('Error loading media content');
  }
});

// Material document/content view (inline only)
router.get('/:id/materials/:materialId/content', async (req, res) => {
  try {
    const trainingId = Number(req.params.id);
    const materialId = Number(req.params.materialId);
    const material = await getMaterialWithTraining(req.db, materialId, trainingId);

    if (!material) {
      return res.status(404).send('Material not found');
    }
    if (!material.file_path) {
      return res.status(404).send('No file available for this material');
    }
    const access = await authorizeTrainingAccess(req, trainingId);
    if (!access.allowed) {
      return res.status(403).send('You are not authorized to access this material. Please contact your administrator.');
    }

    if (
      isTrainingLocked(material) &&
      !shouldBypassLockedAssetVisibility(req.session.userRole) &&
      !isAssetAccessibleAfterLock(material.visibility, material.access_expires_at, 'private')
    ) {
      return res.status(403).send('This material is no longer accessible after training lock.');
    }

    const absolutePath = resolveMaterialAbsolutePath(material.file_path);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).send('Material file not found');
    }
    if (!isInlinePreviewSupported(material.file_path)) {
      return res.status(403).send('This file type cannot be previewed inline. Download is disabled for training materials.');
    }
    if (isPdfFile(material.file_path) && req.get('X-Material-Viewer') !== '1') {
      return res.status(403).send('Direct PDF access is disabled. Please use the in-app viewer.');
    }

    res.setHeader('Content-Type', getFileContentType(material.file_path));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');

    return res.sendFile(absolutePath);
  } catch (error) {
    console.error('Material content view error:', error);
    return res.status(500).send('Error loading material content');
  }
});

// Material access report (admin/trainer only)
router.get('/:id/materials/:materialId/access', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).send('Access denied');
  }

  try {
    const trainingId = Number(req.params.id);
    const materialId = Number(req.params.materialId);
    const material = await getMaterialWithTraining(req.db, materialId, trainingId);

    if (!material) {
      return res.status(404).send('Material not found');
    }

    if (req.session.userRole === 'trainer') {
      const [trainerAssignments] = await req.db.query(
        'SELECT id FROM training_trainers WHERE training_id = ? AND trainer_id = ?',
        [trainingId, req.session.userId]
      );
      if (trainerAssignments.length === 0) {
        return res.status(403).send('Access denied');
      }
    }

    const [trainings] = await req.db.query('SELECT id, title FROM trainings WHERE id = ?', [trainingId]);
    if (trainings.length === 0) {
      return res.status(404).send('Training not found');
    }
    const training = trainings[0];

    let accessRows = [];
    try {
      const [rows] = await req.db.query(
        `SELECT
           e.id AS enrollment_id,
           t.id AS trainee_id,
           t.trainee_id,
           t.first_name,
           t.last_name,
           t.email,
           a.first_accessed_at,
           a.last_accessed_at,
           a.access_count
         FROM enrollments e
         INNER JOIN trainees t ON t.id = e.trainee_id
         LEFT JOIN training_material_access a ON a.enrollment_id = e.id AND a.material_id = ?
         WHERE e.training_id = ?
         ORDER BY t.first_name ASC, t.last_name ASC`,
        [materialId, trainingId]
      );
      accessRows = rows;
    } catch (queryError) {
      if (queryError.code !== 'ER_NO_SUCH_TABLE') {
        throw queryError;
      }
      const [fallbackRows] = await req.db.query(
        `SELECT
           e.id AS enrollment_id,
           t.id AS trainee_id,
           t.trainee_id,
           t.first_name,
           t.last_name,
           t.email,
           NULL AS first_accessed_at,
           NULL AS last_accessed_at,
           0 AS access_count
         FROM enrollments e
         INNER JOIN trainees t ON t.id = e.trainee_id
         WHERE e.training_id = ?
         ORDER BY t.first_name ASC, t.last_name ASC`,
        [trainingId]
      );
      accessRows = fallbackRows;
    }

    const accessedCount = accessRows.filter(row => row.last_accessed_at).length;

    res.render('training/material-access', {
      user: req.session,
      training,
      material,
      accessRows,
      summary: {
        total: accessRows.length,
        accessed: accessedCount,
        notAccessed: accessRows.length - accessedCount
      }
    });
  } catch (error) {
    console.error('Material access report error:', error);
    res.status(500).send('Error loading material access report');
  }
});

// Edit material - GET
router.get('/:id/materials/:materialId/edit', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).send('Access denied');
  }
  
  try {
    const [materials] = await req.db.query(`
      SELECT m.*, s.title as section_title, s.training_id
      FROM training_materials m
      LEFT JOIN training_sections s ON m.section_id = s.id
      WHERE m.id = ?
    `, [req.params.materialId]);
    
    if (materials.length === 0) {
      return res.status(404).send('Material not found');
    }
    
    const material = materials[0];

    const [trainings] = await req.db.query(
      'SELECT status, is_locked FROM trainings WHERE id = ? LIMIT 1',
      [material.training_id]
    );
    if (trainings.length === 0) {
      return res.status(404).send('Training not found');
    }
    if (isTrainingLocked(trainings[0])) {
      return res.status(403).send('Training is locked. Material editing is disabled.');
    }
    
    // Get all sections for dropdown
    const [sections] = await req.db.query(
      'SELECT * FROM training_sections WHERE training_id = ? ORDER BY section_order',
      [material.training_id]
    );
    
    res.render('training/material-edit', {
      user: req.session,
      training: { id: material.training_id },
      material,
      sections
    });
  } catch (error) {
    console.error('Material edit error:', error);
    res.status(500).send('Error loading material');
  }
});

// Edit material - POST
router.post('/:id/materials/:materialId/edit', upload.single('file'), async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const { title, type, section_id, url, document_url, visibility, access_expires_at } = req.body;
    
    // Get current material
    const [materials] = await req.db.query('SELECT * FROM training_materials WHERE id = ?', [req.params.materialId]);
    if (materials.length === 0) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }
    
    const currentMaterial = materials[0];
    const [sectionRows] = await req.db.query(
      `SELECT t.status, t.is_locked
       FROM training_sections s
       INNER JOIN trainings t ON t.id = s.training_id
       WHERE s.id = ?
       LIMIT 1`,
      [currentMaterial.section_id]
    );
    if (sectionRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }
    if (isTrainingLocked(sectionRows[0])) {
      return res.status(400).json({ success: false, error: 'Training is locked' });
    }
    
    // Determine file path and URL
    let filePath = currentMaterial.file_path;
    let materialUrl = currentMaterial.url;
    
    if (type === 'video' || type === 'link') {
      materialUrl = url;
      filePath = null;
    } else if (type === 'document') {
      if (req.file) {
        // Check file size (5MB max)
        if (req.file.size > 5 * 1024 * 1024) {
          return res.status(400).json({ success: false, error: 'File size exceeds 5MB limit' });
        }
        filePath = `/uploads/materials/${req.file.filename}`;
        materialUrl = null;
      } else if (document_url) {
        materialUrl = document_url;
        filePath = null;
      } else {
        // Keep existing file_path if no new file or link provided
        materialUrl = null;
      }
    }
    
    // Handle section - if no section provided, use "General Materials"
    let finalSectionId = section_id;
    if (!finalSectionId || finalSectionId === '') {
      // Get training_id from current material's section
      const [section] = await req.db.query('SELECT training_id FROM training_sections WHERE id = ?', [currentMaterial.section_id]);
      const trainingId = section[0].training_id;
      
      // Check if "General Materials" section exists
      const [existingGeneral] = await req.db.query(
        'SELECT id FROM training_sections WHERE training_id = ? AND title = ?',
        [trainingId, 'General Materials']
      );
      
      if (existingGeneral.length > 0) {
        finalSectionId = existingGeneral[0].id;
      } else {
        // Create "General Materials" section
        const [newSection] = await req.db.query(
          'INSERT INTO training_sections (training_id, title, section_order) VALUES (?, ?, 0)',
          [trainingId, 'General Materials']
        );
        finalSectionId = newSection.insertId;
      }
    }
    const materialVisibility = normalizeAssetVisibility(visibility, 'private');
    const requestedExpiry = normalizeAccessExpiryInput(access_expires_at);
    const materialAccessExpiry = materialVisibility === 'public' ? (requestedExpiry || getDefaultExpiryDateTime()) : null;
    
    await req.db.query(
      `UPDATE training_materials
       SET section_id = ?, title = ?, type = ?, file_path = ?, url = ?, visibility = ?, access_expires_at = ?
       WHERE id = ?`,
      [finalSectionId, title, type, filePath, materialUrl, materialVisibility, materialAccessExpiry, req.params.materialId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Material update error:', error);
    res.status(500).json({ success: false, error: 'Error updating material' });
  }
});

// Delete material
router.post('/:id/materials/:materialId/delete', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    await req.db.query('DELETE FROM training_materials WHERE id = ?', [req.params.materialId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Material deletion error:', error);
    res.status(500).json({ success: false, error: 'Error deleting material' });
  }
});

// Edit section
router.get('/:id/sections/:sectionId/edit', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).send('Access denied');
  }
  
  try {
    const [sections] = await req.db.query('SELECT * FROM training_sections WHERE id = ?', [req.params.sectionId]);
    if (sections.length === 0) {
      return res.status(404).send('Section not found');
    }
    
    res.render('training/section-edit', {
      user: req.session,
      training: { id: req.params.id },
      section: sections[0]
    });
  } catch (error) {
    console.error('Section edit error:', error);
    res.status(500).send('Error loading section');
  }
});

router.post('/:id/sections/:sectionId/edit', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const { title } = req.body;
    await req.db.query('UPDATE training_sections SET title = ? WHERE id = ?', [title, req.params.sectionId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Section update error:', error);
    res.status(500).json({ success: false, error: 'Error updating section' });
  }
});

// Delete section
router.post('/:id/sections/:sectionId/delete', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    // Materials will be automatically deleted due to CASCADE, but we can move them to General Materials first
    // Check if "General Materials" section exists
    const [generalSection] = await req.db.query(
      'SELECT id FROM training_sections WHERE training_id = ? AND title = ?',
      [req.params.id, 'General Materials']
    );
    
    let generalSectionId = null;
    if (generalSection.length > 0) {
      generalSectionId = generalSection[0].id;
    } else {
      // Create "General Materials" section
      const [newSection] = await req.db.query(
        'INSERT INTO training_sections (training_id, title, section_order) VALUES (?, ?, 0)',
        [req.params.id, 'General Materials']
      );
      generalSectionId = newSection.insertId;
    }
    
    // Move materials to General Materials section
    if (generalSectionId) {
      await req.db.query(
        'UPDATE training_materials SET section_id = ? WHERE section_id = ?',
        [generalSectionId, req.params.sectionId]
      );
    }
    
    // Delete the section
    await req.db.query('DELETE FROM training_sections WHERE id = ?', [req.params.sectionId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Section deletion error:', error);
    res.status(500).json({ success: false, error: 'Error deleting section' });
  }
});

// Add material to section (must come before /:id routes to avoid conflicts)
router.post('/section/:sectionId/material', upload.single('file'), async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).send('Access denied');
  }
  
  const { title, type, url, visibility, access_expires_at } = req.body;
  const filePath = req.file ? `/uploads/materials/${req.file.filename}` : null;
  
  try {
    // Get training ID and max order
    const [section] = await req.db.query('SELECT training_id FROM training_sections WHERE id = ?', [req.params.sectionId]);
    const [maxOrder] = await req.db.query(
      'SELECT COALESCE(MAX(material_order), 0) as max_order FROM training_materials WHERE section_id = ?',
      [req.params.sectionId]
    );
    const materialVisibility = normalizeAssetVisibility(visibility, 'private');
    const requestedExpiry = normalizeAccessExpiryInput(access_expires_at);
    const materialAccessExpiry = materialVisibility === 'public' ? (requestedExpiry || getDefaultExpiryDateTime()) : null;
    
    await req.db.query(
      `INSERT INTO training_materials
        (section_id, title, type, file_path, url, material_order, uploaded_by, visibility, access_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.sectionId, title, type, filePath, url, maxOrder[0].max_order + 1, req.session.userId, materialVisibility, materialAccessExpiry]
    );
    
    res.redirect(`/training/${section[0].training_id}`);
  } catch (error) {
    console.error('Material upload error:', error);
    res.status(500).send('Error uploading material');
  }
});

// Enroll in training
router.post('/:id/enroll', async (req, res) => {
  if (req.session.userRole !== 'trainee') {
    return res.status(403).send('Only trainees can enroll');
  }
  
  try {
    const [trainees] = await req.db.query(
      'SELECT trainee_status FROM trainees WHERE id = ?',
      [req.session.userId]
    );
    const traineeStatus = String(trainees?.[0]?.trainee_status || '').toLowerCase().trim();
    if (trainees.length === 0 || traineeStatus !== 'active') {
      return res.status(403).send('Only active trainees can be enrolled in trainings.');
    }

    await req.db.query(
      'INSERT INTO enrollments (trainee_id, training_id) VALUES (?, ?)',
      [req.session.userId, req.params.id]
    );
    
    res.redirect(`/training/${req.params.id}`);
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).send('Error enrolling in training');
  }
});

// Update training settings
router.post('/:id/update', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  // Get a connection from the pool for transaction
  const connection = await req.db.getConnection();
  
  try {
    const trainingId = req.params.id;
    const { title, description, status, start_datetime, end_datetime, healthcare_ids, trainer_ids, trainee_ids, module_id, device_model_id, affiliated_company } = req.body;
    const traineeArray = trainee_ids ? (Array.isArray(trainee_ids) ? trainee_ids.map(String) : [String(trainee_ids)]) : [];
    
    if (!module_id || !device_model_id) {
      return res.json({ success: false, error: !module_id ? 'Module is required.' : 'Device model is required.' });
    }

    const nonActiveTrainees = await getNonActiveTrainees(req.db, traineeArray);
    if (nonActiveTrainees.length > 0) {
      return res.json({
        success: false,
        error: 'Only active trainees can be added to trainings. Registered, inactive, and suspended trainees are not allowed.'
      });
    }
    const submittedHealthcareIds = req.body['healthcare_ids[]'] || healthcare_ids || [];
    const selectedHealthcareList = await getHealthcareByIds(req.db, submittedHealthcareIds);
    if (selectedHealthcareList.length === 0) {
      return res.json({ success: false, error: 'Please select at least one healthcare centre for this training.' });
    }
    const selectedHealthcareIds = selectedHealthcareList.map(item => item.id);
    const invalidHealthcareTrainees = await getTraineesOutsideHealthcare(req.db, traineeArray, selectedHealthcareIds);
    if (invalidHealthcareTrainees.length > 0) {
      return res.json({ success: false, error: `All selected trainees must belong to the selected healthcare centre(s): ${selectedHealthcareList.map(item => item.name).join(', ')}.` });
    }
    
    // Helper function to convert AM/PM format to MySQL datetime
    function convertToMySQLDatetime(dateTimeStr) {
      if (!dateTimeStr) return null;
      
      // Parse the date string (format: "Y-m-d h:i K" e.g., "2024-01-15 2:30 PM")
      const parts = dateTimeStr.trim().split(' ');
      if (parts.length < 3) return dateTimeStr + ':00'; // Fallback if format is unexpected
      
      const datePart = parts[0]; // "Y-m-d"
      const timePart = parts[1]; // "h:i"
      const ampm = parts[2].toUpperCase(); // "AM" or "PM"
      
      const [year, month, day] = datePart.split('-');
      const [hours12, minutes] = timePart.split(':');
      
      let hours24 = parseInt(hours12, 10);
      if (ampm === 'PM' && hours24 !== 12) {
        hours24 += 12;
      } else if (ampm === 'AM' && hours24 === 12) {
        hours24 = 0;
      }
      
      return `${year}-${month}-${day} ${String(hours24).padStart(2, '0')}:${minutes}:00`;
    }
    
    let startDatetime = null;
    let endDatetime = null;
    
    if (start_datetime) {
      startDatetime = convertToMySQLDatetime(start_datetime);
    }
    
    if (end_datetime) {
      endDatetime = convertToMySQLDatetime(end_datetime);
    }
    
    // Start transaction
    await connection.beginTransaction();
    
    try {
      const [trainingRows] = await connection.query(
        'SELECT id, type, module_id, device_model_id FROM trainings WHERE id = ?',
        [trainingId]
      );
      if (!trainingRows.length) {
        await connection.rollback();
        return res.json({ success: false, error: 'Training not found.' });
      }
      
      const currentTraining = trainingRows[0];
      const moduleChanged = String(currentTraining.module_id || '') !== String(module_id || '');
      const deviceModelChanged = String(currentTraining.device_model_id || '') !== String(device_model_id || '');
      
      if (moduleChanged || deviceModelChanged) {
        const [attemptRows] = await connection.query(
          `SELECT COUNT(*) as count
           FROM test_attempts ta
           JOIN enrollments e ON ta.enrollment_id = e.id
           WHERE e.training_id = ?`,
          [trainingId]
        );
        
        if ((attemptRows[0]?.count || 0) > 0) {
          await connection.rollback();
          return res.json({ success: false, error: 'Cannot change module or device model after tests have started.' });
        }
        
        const validation = await validateTestQuestions(connection, currentTraining.type, module_id);
        if (!validation.valid) {
          await connection.rollback();
          return res.json({ success: false, error: validation.errors.join(' ') });
        }
      }

      // Update training basic info
      const affiliatedCompany = normalizeAffiliatedCompany(affiliated_company);
      await connection.query(
        'UPDATE trainings SET title = ?, description = ?, status = ?, start_datetime = ?, end_datetime = ?, module_id = ?, device_model_id = ?, affiliated_company = ? WHERE id = ?',
        [title, description || null, status, startDatetime, endDatetime, module_id, device_model_id, affiliatedCompany, trainingId]
      );
      
      // Update healthcare centres
      await connection.query('DELETE FROM training_healthcare WHERE training_id = ?', [trainingId]);
      for (const healthcare of selectedHealthcareList) {
        await connection.query(
          'INSERT INTO training_healthcare (training_id, healthcare_id) VALUES (?, ?)',
          [trainingId, healthcare.id]
        );
      }
      
      // Update devices
      await connection.query('DELETE FROM training_devices WHERE training_id = ?', [trainingId]);
      
      // Handle device arrays - express.urlencoded may parse bracket notation differently
      const deviceTypes = req.body['device_type[]'] || req.body.device_type || [];
      const deviceIds = req.body['device_ids[]'] || req.body.device_ids || [];
      const deviceCustoms = req.body['device_customs[]'] || req.body.device_customs || [];
      
      const deviceTypesArray = Array.isArray(deviceTypes) ? deviceTypes : [deviceTypes].filter(Boolean);
      const deviceIdsArray = (Array.isArray(deviceIds) ? deviceIds : [deviceIds])
        .map(value => String(value || '').trim())
        .filter(Boolean);
      const deviceCustomsArray = (Array.isArray(deviceCustoms) ? deviceCustoms : [deviceCustoms])
        .map(value => String(value || '').trim())
        .filter(Boolean);
      
      if (deviceTypesArray.length > 0) {
        for (let i = 0; i < deviceTypesArray.length; i++) {
          if (deviceTypesArray[i] === 'existing' && deviceIdsArray[i]) {
            await connection.query(
              'INSERT INTO training_devices (training_id, device_serial_number_id) VALUES (?, ?)',
              [trainingId, deviceIdsArray[i]]
            );
          } else if (deviceTypesArray[i] === 'custom' && deviceCustomsArray[i]) {
            await connection.query(
              'INSERT INTO training_devices (training_id, custom_serial_number) VALUES (?, ?)',
              [trainingId, deviceCustomsArray[i]]
            );
          }
        }
      } else {
        for (const deviceId of deviceIdsArray) {
          await connection.query(
            'INSERT INTO training_devices (training_id, device_serial_number_id) VALUES (?, ?)',
            [trainingId, deviceId]
          );
        }
        for (const customSerial of deviceCustomsArray) {
          await connection.query(
            'INSERT INTO training_devices (training_id, custom_serial_number) VALUES (?, ?)',
            [trainingId, customSerial]
          );
        }
      }
      
      // Update trainers
      await connection.query('DELETE FROM training_trainers WHERE training_id = ?', [trainingId]);
      if (trainer_ids) {
        const trainerDeduped = uniqueTrainerIdsFromForm(trainer_ids);
        for (const trainerId of trainerDeduped) {
          await connection.query(
            'INSERT INTO training_trainers (training_id, trainer_id) VALUES (?, ?)',
            [trainingId, trainerId]
          );
        }
      }
      
      // Update trainees (enrollments)
      // Get current enrollments
      const [currentEnrollments] = await connection.query(
        'SELECT trainee_id FROM enrollments WHERE training_id = ?',
        [trainingId]
      );
      const currentTraineeIds = currentEnrollments.map(e => e.trainee_id);
      
      const currentTraineeIdsStr = currentTraineeIds.map(String);
      
      // Remove trainees not in the new list
      for (const currentId of currentTraineeIds) {
        if (!traineeArray.includes(String(currentId))) {
          await connection.query(
            'DELETE FROM enrollments WHERE training_id = ? AND trainee_id = ?',
            [trainingId, currentId]
          );
        }
      }
      
      // Add new trainees
      for (const traineeId of traineeArray) {
        if (!currentTraineeIdsStr.includes(String(traineeId))) {
          await connection.query(
            'INSERT INTO enrollments (trainee_id, training_id) VALUES (?, ?)',
            [parseInt(traineeId), trainingId]
          );
        }
      }

      if (moduleChanged || deviceModelChanged) {
        const [existingTests] = await connection.query(
          'SELECT id FROM training_tests WHERE training_id = ?',
          [trainingId]
        );
        
        if (existingTests.length > 0) {
          const testIds = existingTests.map(t => t.id);
          const placeholders = testIds.map(() => '?').join(',');
          await connection.query(
            `DELETE FROM training_test_questions WHERE training_test_id IN (${placeholders})`,
            testIds
          );
        }
        
        await connection.query(
          'DELETE FROM training_tests WHERE training_id = ?',
          [trainingId]
        );
        
        await createTrainingTests(connection, trainingId, currentTraining.type, module_id);
      }
      
      await connection.commit();
      res.json({ success: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Training update error:', error);
    res.status(500).json({ success: false, error: 'Error updating training settings' });
  } finally {
    // Release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
});

// Add section to training
router.post('/:id/section', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  const { title } = req.body;
  
  try {
    // Get max order
    const [maxOrder] = await req.db.query(
      'SELECT COALESCE(MAX(section_order), 0) as max_order FROM training_sections WHERE training_id = ?',
      [req.params.id]
    );
    
    await req.db.query(
      'INSERT INTO training_sections (training_id, title, section_order) VALUES (?, ?, ?)',
      [req.params.id, title, maxOrder[0].max_order + 1]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Section creation error:', error);
    res.status(500).json({ success: false, error: 'Error creating section' });
  }
});

// Update training status (admin only)
router.post('/:id/status', async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied. Only admins can update training status.' });
  }
  
  const { status } = req.body;
  
  try {
    const validStatuses = ['in_progress', 'completed', 'canceled', 'rescheduled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    await req.db.query(
      'UPDATE trainings SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Training status update error:', error);
    res.status(500).json({ success: false, error: 'Error updating training status' });
  }
});

// Lock training (admin only)
router.post('/:id/lock', async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied. Only admins can lock trainings.' });
  }
  
  try {
    await req.db.query(
      'UPDATE trainings SET status = ?, is_locked = 1 WHERE id = ?',
      ['completed', req.params.id]
    );
    
    res.json({ success: true, message: 'Training locked successfully' });
  } catch (error) {
    console.error('Training lock error:', error);
    res.status(500).json({ success: false, error: 'Error locking training' });
  }
});

// Unlock training (admin only)
router.post('/:id/unlock', async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied. Only admins can unlock trainings.' });
  }
  
  try {
    await req.db.query(
      'UPDATE trainings SET is_locked = 0 WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ success: true, message: 'Training unlocked successfully' });
  } catch (error) {
    console.error('Training unlock error:', error);
    res.status(500).json({ success: false, error: 'Error unlocking training' });
  }
});

// Release scores for trainees
router.post('/:id/release-scores', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied. Only admins or trainers can release scores.' });
  }

  try {
    const { enrollment_ids } = req.body;

    // Verify training
    const [trainings] = await req.db.query('SELECT status, type, is_locked FROM trainings WHERE id = ?', [req.params.id]);
    if (trainings.length === 0) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }

    const training = trainings[0];

    if (training.type === 'main') {
      if (req.session.userRole !== 'admin') {
        return res.status(403).json({ success: false, error: 'Access denied. Only admins can release scores for main training.' });
      }
    }

    if (!enrollment_ids || !Array.isArray(enrollment_ids) || enrollment_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select at least one trainee' });
    }

    let eligibleEnrollmentIds = enrollment_ids;

    if (training.type !== 'main') {
      const placeholders = enrollment_ids.map(() => '?').join(',');
      const [scoreRows] = await req.db.query(
        `SELECT enrollment_id, test_type, MAX(score) as score
         FROM test_attempts
         WHERE enrollment_id IN (${placeholders})
           AND status = "completed"
           AND test_type = 'certificate_enrolment'
         GROUP BY enrollment_id, test_type`,
        enrollment_ids
      );

      const scoresByEnrollment = scoreRows.reduce((acc, row) => {
        if (!acc[row.enrollment_id]) acc[row.enrollment_id] = {};
        acc[row.enrollment_id][row.test_type] = parseFloat(row.score) || 0;
        return acc;
      }, {});

      eligibleEnrollmentIds = enrollment_ids.filter(id => {
        const entry = scoresByEnrollment[id] || {};
        return (entry.certificate_enrolment || 0) >= 80;
      });

      if (eligibleEnrollmentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Scores can be released only after the Certificate Enrolment Test is Outstanding (80%+).'
        });
      }

      if (eligibleEnrollmentIds.length !== enrollment_ids.length) {
        return res.status(400).json({
          success: false,
          error: 'Some trainees have not passed the Certificate Enrolment Test yet.'
        });
      }
    }

    // Update can_download_results for selected enrollments
    const placeholders = eligibleEnrollmentIds.map(() => '?').join(',');
    await req.db.query(
      `UPDATE enrollments SET can_download_results = TRUE WHERE id IN (${placeholders}) AND training_id = ?`,
      [...eligibleEnrollmentIds, req.params.id]
    );

    res.json({ success: true, message: `Scores released for ${eligibleEnrollmentIds.length} trainee(s)` });
  } catch (error) {
    console.error('Score release error:', error);
    res.status(500).json({ success: false, error: 'Error releasing scores' });
  }
});

// Get certificate for trainee
router.get('/:id/certificate/:enrollmentId', async (req, res) => {
  try {
    const { id: trainingId, enrollmentId } = req.params;
    
    // Verify enrollment and check if scores are released
    const [enrollments] = await req.db.query(`
      SELECT e.*,
        e.trainee_id as trainee_id_int,
        t.title as training_title,
        t.type as training_type,
        t.start_datetime,
        t.end_datetime,
        tr.first_name,
        tr.last_name,
        tr.trainee_id as trainee_public_id,
        h.name as healthcare
      FROM enrollments e
      JOIN trainings t ON e.training_id = t.id
      JOIN trainees tr ON e.trainee_id = tr.id
      LEFT JOIN healthcare h ON h.id = tr.healthcare_id
      WHERE e.id = ? AND e.training_id = ?
    `, [enrollmentId, trainingId]);
    
    if (enrollments.length === 0) {
      return res.status(404).send('Enrollment not found');
    }
    
    const enrollment = enrollments[0];
    
    // Check access - trainee can only access their own, admin/trainer can access any
    if (req.session.userRole === 'trainee') {
      if (String(enrollment.trainee_id) !== String(req.session.userId)) {
        return res.status(403).send('Access denied');
      }
    }
    
    // Get test results
    const [testAttempts] = await req.db.query(
      'SELECT * FROM test_attempts WHERE enrollment_id = ? AND status = "completed" ORDER BY test_type',
      [enrollmentId]
    );

    const attemptStatsByType = (testAttempts || []).reduce((acc, attempt) => {
      const testType = attempt.test_type;
      const score = parseFloat(attempt.score) || 0;
      if (!acc[testType]) {
        acc[testType] = { failed: 0, hasPass: false };
      }
      if (score >= 80) acc[testType].hasPass = true;
      else acc[testType].failed += 1;
      return acc;
    }, {});
    const hasLockedTestPart = Object.values(attemptStatsByType).some(stat => stat.failed >= 3 && !stat.hasPass);
    if (hasLockedTestPart) {
      return res.status(403).send('Certificate is not available because one or more test parts reached 3 failed attempts. This trainee has failed the training.');
    }

    // Check if scores are released (for trainees) or certificate enrolment completed
    if (req.session.userRole === 'trainee' && !enrollment.can_download_results) {
      const hasCertificateAttempt = (testAttempts || []).some(attempt => attempt.test_type === 'certificate_enrolment');
      if (!hasCertificateAttempt) {
        return res.status(403).send('Scores have not been released yet. Please contact your administrator.');
      }
    }
    
    // Get hands-on scores if main training
    let handsOnScores = [];
    if (enrollment.training_type === 'main') {
      [handsOnScores] = await req.db.query(`
        SELECT hs.*, ha.aspect_name, ha.max_score
        FROM practical_learning_outcome_scores hs
        JOIN practical_learning_outcomes ha ON hs.aspect_id = ha.id
        WHERE hs.enrollment_id = ?
      `, [enrollmentId]);
    }

    const certAttempts = (testAttempts || []).filter(attempt => attempt.test_type === 'certificate_enrolment');
    const certAttempt = certAttempts.reduce((best, attempt) => {
      if (!best) return attempt;
      const bestScore = parseFloat(best.score) || 0;
      const currScore = parseFloat(attempt.score) || 0;
      return currScore > bestScore ? attempt : best;
    }, null);
    const certOutstanding = certAttempt && parseFloat(certAttempt.score) >= 80;

    let practicalOutstanding = true;
    if (enrollment.training_type === 'main') {
      if (!handsOnScores || handsOnScores.length === 0) {
        practicalOutstanding = false;
      } else {
        const avg = handsOnScores.reduce((sum, s) => {
          const maxScore = parseFloat(s.max_score) || 0;
          const score = parseFloat(s.score) || 0;
          return sum + (maxScore > 0 ? (score / maxScore) * 100 : 0);
        }, 0) / handsOnScores.length;
        practicalOutstanding = avg >= 80;
      }
    }

    if (!certOutstanding || !practicalOutstanding) {
      return res.status(403).send('Certificate requires Outstanding results in Certificate Enrolment Test and Practical Learning Outcome.');
    }
    
    // Get final grades
    const [finalGrades] = await req.db.query(
      'SELECT * FROM final_grades WHERE enrollment_id = ?',
      [enrollmentId]
    );
    
    const finalGrade = finalGrades.length > 0 ? finalGrades[0] : null;
    
    const formatDate = (value) => {
      const d = value ? new Date(value) : null;
      if (d && !isNaN(d.valueOf())) {
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const [certificateRows] = await req.db.query(
      'SELECT * FROM certificate_issues WHERE enrollment_id = ?',
      [enrollmentId]
    );

    let participantName = `${enrollment.first_name} ${enrollment.last_name}`;
    let courseName = enrollment.training_title;
    let location = enrollment.healthcare || 'N/A';
    let date = formatDate(enrollment.end_datetime || enrollment.start_datetime || enrollment.enrolled_at);

    let certificateNumber = `1000-${trainingId}-${enrollmentId}`;
    let validityStart = certAttempt?.completed_at || enrollment.end_datetime || enrollment.start_datetime || enrollment.enrolled_at || new Date();
    let validityEnd = new Date(validityStart);
    if (!isNaN(validityEnd.valueOf())) {
      validityEnd.setFullYear(validityEnd.getFullYear() + 2);
    }

    if (certificateRows.length > 0) {
      const issued = certificateRows[0];
      certificateNumber = issued.certificate_number;
      validityStart = issued.validity_start || validityStart;
      validityEnd = issued.validity_end || validityEnd;
      participantName = issued.participant_name || participantName;
      courseName = issued.course_name || courseName;
      location = issued.location || location;
      date = issued.date_display || date;
    } else {
      await req.db.query(
        `INSERT INTO certificate_issues 
         (enrollment_id, training_id, trainee_id, certificate_number, validity_start, validity_end, participant_name, course_name, location, date_display)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          enrollmentId,
          trainingId,
          enrollment.trainee_id_int,
          certificateNumber,
          new Date(validityStart),
          new Date(validityEnd),
          participantName,
          courseName,
          location,
          date
        ]
      );
    }

    const validityPeriod = `${formatDate(validityStart)} to ${formatDate(validityEnd)}`;
    const signerName = 'Administrator';
    const signerTitle = 'Authorized Signatory';
    const signerCompany = 'Quick Stop Solution';
    const signatureName = signerName;
    const signatureImage = null;

    // Render certificate view
    res.render('training/certificate', {
      user: req.session,
      enrollment,
      testAttempts,
      handsOnScores,
      finalGrade,
      participantName,
      courseName,
      location,
      date,
      validityPeriod,
      certificateNumber,
      signerName,
      signerTitle,
      signerCompany,
      signatureName,
      signatureImage
    });
  } catch (error) {
    console.error('Certificate generation error:', error);
    res.status(500).send('Error generating certificate');
  }
});

// Update hands-on aspect max_score (admin only, main training only)
router.post('/:id/aspect/:aspectId/update', async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.status(403).send('Access denied. Only admins can edit aspect scores.');
  }
  
  const { max_score } = req.body;
  
  try {
    // Verify the training exists and is a main training
    const [trainings] = await req.db.query('SELECT type FROM trainings WHERE id = ?', [req.params.id]);
    if (trainings.length === 0 || trainings[0].type !== 'main') {
      return res.status(404).send('Training not found or not a main training');
    }
    
    // Verify the aspect belongs to this training
    const [aspects] = await req.db.query(
      'SELECT id FROM practical_learning_outcomes WHERE id = ? AND training_id = ?',
      [req.params.aspectId, req.params.id]
    );
    
    if (aspects.length === 0) {
      return res.status(404).send('Aspect not found');
    }
    
    await req.db.query(
      'UPDATE practical_learning_outcomes SET max_score = ? WHERE id = ?',
      [max_score || 100, req.params.aspectId]
    );
    
    res.redirect(`/training/${req.params.id}`);
  } catch (error) {
    console.error('Aspect update error:', error);
    res.status(500).send('Error updating aspect');
  }
});

// Get test responses for an enrollment (admin/trainer only)
router.get('/:id/enrollment/:enrollmentId/test-responses', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const { enrollmentId } = req.params;
    
    // Verify enrollment belongs to this training
    const [enrollments] = await req.db.query(
      'SELECT * FROM enrollments WHERE id = ? AND training_id = ?',
      [enrollmentId, req.params.id]
    );
    
    if (enrollments.length === 0) {
      return res.status(404).json({ success: false, error: 'Enrollment not found' });
    }
    
    // Get all completed test attempts
    const [testAttempts] = await req.db.query(
      'SELECT * FROM test_attempts WHERE enrollment_id = ? AND status = "completed" ORDER BY test_type',
      [enrollmentId]
    );
    
    const tests = [];
    
    for (const attempt of testAttempts) {
      // Get answers with questions
      const [answers] = await req.db.query(`
        SELECT ta.*, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer
        FROM test_answers ta
        JOIN questions q ON ta.question_id = q.id
        WHERE ta.attempt_id = ?
        ORDER BY ta.id
      `, [attempt.id]);
      
      tests.push({
        test_type: attempt.test_type,
        score: parseFloat(attempt.score) || 0,
        completed_at: attempt.completed_at,
        answers: answers.map(answer => ({
          question_text: answer.question_text,
          option_a: answer.option_a,
          option_b: answer.option_b,
          option_c: answer.option_c,
          option_d: answer.option_d,
          correct_answer: answer.correct_answer,
          selected_answer: answer.selected_answer,
          is_correct: answer.selected_answer === answer.correct_answer
        }))
      });
    }
    
    res.json({ success: true, tests });
  } catch (error) {
    console.error('Test responses error:', error);
    res.status(500).json({ success: false, error: 'Error loading test responses' });
  }
});

// Test answers page for an enrollment (admin/trainer only) - clean per-test view
router.get('/:id/enrollment/:enrollmentId/test-answers', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).send('Access denied');
  }

  try {
    const trainingId = req.params.id;
    const enrollmentId = req.params.enrollmentId;
    const requestedType = String(req.query.type || '').trim();

    // Verify training + enrollment
    const [trainings] = await req.db.query('SELECT * FROM trainings WHERE id = ?', [trainingId]);
    if (!trainings || trainings.length === 0) {
      return res.status(404).send('Training not found');
    }
    const training = trainings[0];

    const [enrollments] = await req.db.query(
      'SELECT * FROM enrollments WHERE id = ? AND training_id = ?',
      [enrollmentId, trainingId]
    );
    if (!enrollments || enrollments.length === 0) {
      return res.status(404).send('Enrollment not found');
    }
    const enrollment = enrollments[0];

    const [trainees] = await req.db.query(
      'SELECT first_name, last_name, trainee_id FROM trainees WHERE id = ?',
      [enrollment.trainee_id]
    );
    const traineeName = trainees.length > 0 ? `${trainees[0].first_name} ${trainees[0].last_name}` : 'Trainee';
    const traineePublicId = trainees.length > 0 ? (trainees[0].trainee_id || 'N/A') : 'N/A';

    // Available completed test types
    const [attempts] = await req.db.query(
      'SELECT id, test_type, score, completed_at FROM test_attempts WHERE enrollment_id = ? AND status = "completed" ORDER BY completed_at DESC',
      [enrollmentId]
    );

    const typeLabels = {
      pre_test: 'Pre-Test',
      post_test: 'Post-Test',
      certificate_enrolment: 'Certificate Enrolment',
      refresher_training: 'Refresher Training Test'
    };

    const availableTypes = Array.from(new Set((attempts || []).map(a => a.test_type))).filter(Boolean);
    const selectedType = availableTypes.includes(requestedType) ? requestedType : (availableTypes[0] || requestedType || 'pre_test');

    // Pick the latest completed attempt for selected type
    const attemptRow = (attempts || []).find(a => a.test_type === selectedType) || null;
    let attempt = null;
    let answers = [];
    let correctCount = 0;

    if (attemptRow) {
      const [attemptFull] = await req.db.query('SELECT * FROM test_attempts WHERE id = ?', [attemptRow.id]);
      attempt = attemptFull && attemptFull.length > 0 ? attemptFull[0] : null;
      if (attempt) attempt.score = parseFloat(attempt.score) || 0;

      const [rows] = await req.db.query(`
        SELECT ta.*, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer
        FROM test_answers ta
        JOIN questions q ON ta.question_id = q.id
        WHERE ta.attempt_id = ?
        ORDER BY ta.id
      `, [attemptRow.id]);

      answers = rows || [];
      correctCount = answers.reduce((sum, a) => sum + ((a.selected_answer === a.correct_answer) ? 1 : 0), 0);
    }

    res.render('training/test-answers', {
      user: req.session,
      training,
      enrollmentId,
      traineeName,
      traineePublicId,
      availableTypes: availableTypes.length > 0 ? availableTypes : ['pre_test', 'post_test', 'certificate_enrolment', 'refresher_training'],
      selectedType,
      typeLabels,
      attempt,
      answers,
      correctCount
    });
  } catch (error) {
    console.error('Test answers page error:', error);
    res.status(500).send('Error loading test answers');
  }
});

// Get hands-on aspects and scores for an enrollment (admin/trainer only)
router.get('/:id/enrollment/:enrollmentId/hands-on', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const { enrollmentId } = req.params;
    
    // Verify enrollment belongs to this training
    const [enrollments] = await req.db.query(
      'SELECT * FROM enrollments WHERE id = ? AND training_id = ?',
      [enrollmentId, req.params.id]
    );
    
    if (enrollments.length === 0) {
      return res.status(404).json({ success: false, error: 'Enrollment not found' });
    }
    
    // Verify training is main type
    const [trainings] = await req.db.query('SELECT type FROM trainings WHERE id = ?', [req.params.id]);
    if (trainings.length === 0 || trainings[0].type !== 'main') {
      return res.status(400).json({ success: false, error: 'Hands-on evaluation only available for main trainings' });
    }
    
    // Get hands-on aspects
    const [aspects] = await req.db.query(
      'SELECT * FROM practical_learning_outcomes WHERE training_id = ? ORDER BY id',
      [req.params.id]
    );
    
    // Get existing scores
    const [scores] = await req.db.query(
      'SELECT * FROM practical_learning_outcome_scores WHERE enrollment_id = ?',
      [enrollmentId]
    );
    
    res.json({ success: true, aspects, scores });
  } catch (error) {
    console.error('Hands-on data error:', error);
    res.status(500).json({ success: false, error: 'Error loading hands-on data' });
  }
});

// Save hands-on scores (admin/trainer only)
router.post('/:id/enrollment/:enrollmentId/hands-on/save', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    const { enrollmentId } = req.params;
    const { scores, comment } = req.body;
    
    // Verify enrollment belongs to this training
    const [enrollments] = await req.db.query(
      'SELECT * FROM enrollments WHERE id = ? AND training_id = ?',
      [enrollmentId, req.params.id]
    );
    
    if (enrollments.length === 0) {
      return res.status(404).json({ success: false, error: 'Enrollment not found' });
    }
    
    // Verify training is main type
    const [trainings] = await req.db.query('SELECT type FROM trainings WHERE id = ?', [req.params.id]);
    if (trainings.length === 0 || trainings[0].type !== 'main') {
      return res.status(400).json({ success: false, error: 'Hands-on evaluation only available for main trainings' });
    }

    if (!Array.isArray(scores)) {
      return res.status(400).json({ success: false, error: 'Invalid scores payload' });
    }

    const trainingId = req.params.id;
    const [aspectRows] = await req.db.query(
      'SELECT id, max_score FROM practical_learning_outcomes WHERE training_id = ?',
      [trainingId]
    );
    const maxScoreByAspectId = new Map(
      (aspectRows || []).map((a) => {
        const cap = a.max_score != null ? Math.max(0, Number(a.max_score)) : 100;
        return [Number(a.id), Number.isFinite(cap) ? cap : 100];
      })
    );
    
    // Save each score
    const sharedComment = typeof comment === 'string' ? comment : '';
    for (const scoreData of scores) {
      const aspectId = parseInt(scoreData.aspect_id, 10);
      const cap = maxScoreByAspectId.get(aspectId);
      if (!Number.isFinite(aspectId) || cap === undefined) {
        continue;
      }
      let score = Number(scoreData.score);
      if (!Number.isFinite(score)) {
        continue;
      }
      score = Math.min(Math.max(0, score), cap);

      const commentValue = (scoreData.comments && String(scoreData.comments).trim().length > 0)
        ? String(scoreData.comments)
        : sharedComment;
      await req.db.query(
        `INSERT INTO practical_learning_outcome_scores (enrollment_id, aspect_id, score, evaluated_by, comments) 
         VALUES (?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE score = ?, evaluated_by = ?, comments = ?, evaluated_at = NOW()`,
        [
          enrollmentId,
          aspectId,
          score,
          req.session.userId,
          commentValue || '',
          score,
          req.session.userId,
          commentValue || ''
        ]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Save hands-on scores error:', error);
    res.status(500).json({ success: false, error: 'Error saving hands-on scores' });
  }
});

// Queue package generation job (admin/trainer only)
router.post('/:id/package/jobs', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const trainingId = parseInt(req.params.id, 10);
    if (!Number.isFinite(trainingId) || trainingId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid training id' });
    }

    const job = await packageJobQueue.enqueuePackageJob({
      db: req.db,
      trainingId,
      formData: req.body?.formData || {},
      userId: req.session.userId,
      generatedByName: req.session.userName || '',
      generatedByPosition: req.session.userPosition || ''
    });

    return res.status(job.reused ? 200 : 202).json({
      success: true,
      jobId: job.jobId,
      status: job.status
    });
  } catch (error) {
    console.error('Package job enqueue error:', error);
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    const message = status === 500 ? 'Failed to queue package generation' : String(error.message || 'Package validation failed');
    return res.status(status).json({ success: false, error: message });
  }
});

// Package generation job status (admin/trainer only)
router.get('/:id/package/jobs/:jobId', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const trainingId = parseInt(req.params.id, 10);
    const jobId = parseInt(req.params.jobId, 10);
    if (!Number.isFinite(trainingId) || trainingId <= 0 || !Number.isFinite(jobId) || jobId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid job request' });
    }

    const job = await packageJobQueue.getPackageJob({
      db: req.db,
      jobId,
      trainingId,
      userId: req.session.userId
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Package job not found' });
    }

    return res.json({
      success: true,
      jobId: job.id,
      status: job.status,
      error: job.status === 'failed' ? job.error_message : null,
      downloadUrl: job.status === 'completed'
        ? `/training/${encodeURIComponent(trainingId)}/package/jobs/${encodeURIComponent(job.id)}/download`
        : null
    });
  } catch (error) {
    console.error('Package job status error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load package job status' });
  }
});

// Download completed package generation job (admin/trainer only)
router.get('/:id/package/jobs/:jobId/download', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const trainingId = parseInt(req.params.id, 10);
    const jobId = parseInt(req.params.jobId, 10);
    if (!Number.isFinite(trainingId) || trainingId <= 0 || !Number.isFinite(jobId) || jobId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid job request' });
    }

    const job = await packageJobQueue.getPackageJob({
      db: req.db,
      jobId,
      trainingId,
      userId: req.session.userId
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Package job not found' });
    }
    if (job.status !== 'completed') {
      return res.status(409).json({ success: false, error: 'Package job is not ready yet' });
    }
    if (!job.output_path || !fs.existsSync(job.output_path)) {
      return res.status(410).json({ success: false, error: 'Package file is no longer available' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${job.output_filename || 'training_package.zip'}"`);
    return res.sendFile(path.resolve(job.output_path), async (error) => {
      if (error) {
        if (!res.headersSent) {
          res.status(error.statusCode || 500).json({ success: false, error: 'Failed to download package zip' });
        }
        return;
      }

      try {
        await packageJobQueue.consumeCompletedJob({
          db: req.db,
          jobId,
          trainingId,
          userId: req.session.userId
        });
      } catch (cleanupError) {
        console.error(`Package job cleanup error for job ${jobId}:`, cleanupError);
      }
    });
  } catch (error) {
    console.error('Package job download error:', error);
    return res.status(500).json({ success: false, error: 'Failed to download package zip' });
  }
});

// Generate backend-rendered in-house training letter PDF (admin/trainer only)
router.post('/:id/package/letter-pdf', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const trainingId = parseInt(req.params.id, 10);
    if (!Number.isFinite(trainingId) || trainingId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid training id' });
    }

    const [trainings] = await req.db.query(
      `SELECT t.id, t.type, t.title, t.start_datetime, t.end_datetime, t.affiliated_company,
              m.name AS module_name
       FROM trainings t
       LEFT JOIN modules m ON t.module_id = m.id
       WHERE t.id = ? LIMIT 1`,
      [trainingId]
    );
    if (!trainings || trainings.length === 0) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }

    const training = trainings[0];
    const formDataRaw = req.body?.formData || {};
    const formData = {
      hospitalName: String(formDataRaw.hospitalName || '').trim(),
      deviceModel: String(formDataRaw.deviceModel || '').trim(),
      address: String(formDataRaw.address || '').trim(),
      recipientName: String(formDataRaw.recipientName || '').trim(),
      recipientPhone: String(formDataRaw.recipientPhone || '').trim()
    };
    if (!formData.hospitalName || !formData.deviceModel || !formData.address || !formData.recipientName || !formData.recipientPhone) {
      return res.status(400).json({ success: false, error: 'Missing required form fields' });
    }

    const buffer = await packageGenerator.generateLetterPdfBuffer({
      db: req.db,
      training,
      formData
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=\"In House Training Letter.pdf\"');
    return res.send(buffer);
  } catch (error) {
    console.error('Backend training letter generation error:', error);
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    const message = status === 500 ? 'Failed to generate letter PDF' : String(error.message || 'Letter validation failed');
    return res.status(status).json({ success: false, error: message });
  }
});

module.exports = router;
