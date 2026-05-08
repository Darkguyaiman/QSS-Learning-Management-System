const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');

/** Labels shown in Excel test-type dropdown (order matches column A on Lists sheet). */
const TEST_TYPE_DROPDOWN_LABELS = ['Post Test', 'Pre Test', 'Certificate Enrolment'];
const CORRECT_ANSWERS = ['A', 'B', 'C', 'D'];
const TEMPLATE_DATA_LAST_ROW = 5000;
const DEFAULT_QUESTION_PAGE_SIZE = 10;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Accept dropdown labels, legacy underscores, or common variants; returns DB enum value or null. */
function normalizeBulkTestType(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g, ' ').trim();
  try {
    s = s.normalize('NFKC');
  } catch (e) { /* ignore */ }
  s = s.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (s === 'post test' || s === 'post-test') return 'post_test';
  if (s === 'pre test' || s === 'pre-test') return 'pre_test';
  if (s === 'certificate enrolment' || s === 'certificate enrollment') return 'certificate_enrolment';
  return null;
}

/**
 * Build .xlsx buffer: Questions sheet + hidden Lists sheet for validation dropdowns.
 */
async function buildQuestionsBulkTemplateBuffer(db) {
  const [modules] = await db.query('SELECT name FROM modules ORDER BY name ASC');
  const [objectives] = await db.query('SELECT name FROM objectives ORDER BY name ASC');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LMS';

  // Questions must be the first worksheet so "first sheet" parsers and Excel's default tab match.
  const ws = workbook.addWorksheet('Questions');
  ws.addRow([
    'Question',
    'Test Type',
    'Module',
    'Objective',
    'Option A',
    'Option B',
    'Option C',
    'Option D',
    'Correct Answer'
  ]);
  ws.getRow(1).font = { bold: true };
  ws.columns = [
    { width: 52 },
    { width: 28 },
    { width: 28 },
    { width: 40 },
    { width: 28 },
    { width: 28 },
    { width: 22 },
    { width: 22 },
    { width: 18 }
  ];

  const lists = workbook.addWorksheet('Lists');
  lists.state = 'veryHidden';

  TEST_TYPE_DROPDOWN_LABELS.forEach((label, i) => {
    lists.getCell(i + 1, 1).value = label;
  });
  CORRECT_ANSWERS.forEach((t, i) => {
    lists.getCell(i + 1, 2).value = t;
  });

  if (modules.length === 0) {
    lists.getCell(1, 3).value = '';
  } else {
    modules.forEach((m, i) => {
      lists.getCell(i + 1, 3).value = m.name;
    });
  }

  if (objectives.length === 0) {
    lists.getCell(1, 4).value = '';
  } else {
    objectives.forEach((o, i) => {
      lists.getCell(i + 1, 4).value = o.name;
    });
  }

  const nTest = TEST_TYPE_DROPDOWN_LABELS.length;
  const nCorrect = CORRECT_ANSWERS.length;
  const nMod = Math.max(modules.length, 1);
  const nObj = Math.max(objectives.length, 1);

  workbook.definedNames.add(`Lists!$A$1:$A$${nTest}`, 'QuestionTestTypes');
  workbook.definedNames.add(`Lists!$B$1:$B$${nCorrect}`, 'QuestionCorrectAnswers');
  workbook.definedNames.add(`Lists!$C$1:$C$${nMod}`, 'QuestionModules');
  workbook.definedNames.add(`Lists!$D$1:$D$${nObj}`, 'QuestionObjectives');

  const listError = {
    showErrorMessage: true,
    errorStyle: 'error',
    errorTitle: 'Invalid value',
    error: 'Pick a value from the dropdown list.'
  };

  ws.dataValidations.add(`B2:B${TEMPLATE_DATA_LAST_ROW}`, {
    type: 'list',
    allowBlank: true,
    ...listError,
    formulae: ['=QuestionTestTypes']
  });

  ws.dataValidations.add(`C2:C${TEMPLATE_DATA_LAST_ROW}`, {
    type: 'list',
    allowBlank: true,
    ...listError,
    formulae: ['=QuestionModules']
  });

  ws.dataValidations.add(`D2:D${TEMPLATE_DATA_LAST_ROW}`, {
    type: 'list',
    allowBlank: true,
    ...listError,
    formulae: ['=QuestionObjectives']
  });

  ws.dataValidations.add(`I2:I${TEMPLATE_DATA_LAST_ROW}`, {
    type: 'list',
    allowBlank: true,
    ...listError,
    formulae: ['=QuestionCorrectAnswers']
  });

  return workbook.xlsx.writeBuffer();
}

// List questions
router.get('/', async (req, res) => {
  try {
    const searchQuery = String(req.query.search || '').trim();
    const selectedObjective = String(req.query.objective || '').trim();
    const selectedModule = String(req.query.module || '').trim();
    const selectedTestType = String(req.query.testType || '').trim();
    const selectedCreator = String(req.query.creator || '').trim();
    const pageSize = DEFAULT_QUESTION_PAGE_SIZE;

    let whereSql = 'WHERE 1=1';
    const whereParams = [];

    if (searchQuery) {
      whereSql += ` AND (
        q.question_text LIKE ? OR
        q.option_a LIKE ? OR
        q.option_b LIKE ? OR
        q.option_c LIKE ? OR
        q.option_d LIKE ?
      )`;
      const searchTerm = `%${searchQuery}%`;
      whereParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (selectedObjective) {
      whereSql += ' AND q.objective_id = ?';
      whereParams.push(selectedObjective);
    }

    if (selectedModule) {
      whereSql += ' AND q.module_id = ?';
      whereParams.push(selectedModule);
    }

    if (selectedTestType) {
      whereSql += ' AND q.test_type = ?';
      whereParams.push(selectedTestType);
    }

    if (selectedCreator) {
      whereSql += ' AND q.created_by = ?';
      whereParams.push(selectedCreator);
    }

    const [countRows] = await req.db.query(`
      SELECT COUNT(*) AS total
      FROM questions q
      ${whereSql}
    `, whereParams);

    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(parsePositiveInteger(req.query.page, 1), totalPages);
    const offset = (currentPage - 1) * pageSize;

    const [questions] = await req.db.query(`
      SELECT q.*, o.name as objective_name, o.id as objective_id, u.first_name, u.last_name, q.created_by as creator_id,
             m.name as module_name
      FROM questions q
      LEFT JOIN objectives o ON q.objective_id = o.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN modules m ON q.module_id = m.id
      ${whereSql}
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `, [...whereParams, pageSize, offset]);
    
    // Get unique objectives and creators for filters
    const [objectives] = await req.db.query('SELECT DISTINCT id, name FROM objectives ORDER BY name ASC');
    const [modules] = await req.db.query('SELECT id, name FROM modules ORDER BY name ASC');
    const [creators] = await req.db.query(`
      SELECT DISTINCT u.id, u.first_name, u.last_name
      FROM users u
      INNER JOIN questions q ON u.id = q.created_by
      ORDER BY u.first_name, u.last_name
    `);
    
    res.render('questions/list', { 
      user: req.session, 
      questions,
      objectives,
      modules,
      creators,
      searchQuery,
      selectedObjective,
      selectedModule,
      selectedTestType,
      selectedCreator,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        pageSize
      }
    });
  } catch (error) {
    console.error('Question list error:', error);
    res.status(500).send('Error loading questions');
  }
});

// Create question page
router.get('/create', async (req, res) => {
  try {
    const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
    const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
    res.render('questions/create', { user: req.session, objectives, modules, error: null });
  } catch (error) {
    console.error('Question create page error:', error);
    res.status(500).send('Error loading page');
  }
});

// Create question POST
router.post('/create', async (req, res) => {
  const { questionText, optionA, optionB, optionC, optionD, correctAnswer, testType, objectiveId, moduleId } = req.body;
  
  try {
    if (!moduleId) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
      return res.render('questions/create', { user: req.session, objectives, modules, error: 'Module is required' });
    }

    // Validate required options
    if (!optionA || !optionB) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
      return res.render('questions/create', { user: req.session, objectives, modules, error: 'Options A and B are required' });
    }
    
    // Determine available options
    const hasOptionC = optionC && optionC.trim() !== '';
    const hasOptionD = optionD && optionD.trim() !== '';
    const availableOptions = ['A', 'B'];
    if (hasOptionC) availableOptions.push('C');
    if (hasOptionD) availableOptions.push('D');
    
    // Validate correct answer matches available options
    if (!availableOptions.includes(correctAnswer)) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
      return res.render('questions/create', { user: req.session, objectives, modules, error: `Correct answer must be one of: ${availableOptions.join(', ')}` });
    }
    
    // Check for duplicate options
    const options = [optionA.trim(), optionB.trim()];
    if (hasOptionC) options.push(optionC.trim());
    if (hasOptionD) options.push(optionD.trim());
    const uniqueOptions = [...new Set(options.map(o => o.toLowerCase()))];
    if (uniqueOptions.length !== options.length) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
      return res.render('questions/create', { user: req.session, objectives, modules, error: 'All options must be unique' });
    }
    
    await req.db.query(
      'INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_answer, test_type, module_id, objective_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [questionText, optionA, optionB, hasOptionC ? optionC : null, hasOptionD ? optionD : null, correctAnswer, testType, moduleId, objectiveId || null, req.session.userId]
    );
    
    res.redirect('/questions');
  } catch (error) {
    console.error('Question creation error:', error);
    const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
    const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
    res.render('questions/create', { user: req.session, objectives, modules, error: 'Error creating question' });
  }
});

// Edit question
router.get('/:id/edit', async (req, res) => {
  try {
    const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
    const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
    
    if (questions.length === 0) {
      return res.status(404).send('Question not found');
    }
    
    res.render('questions/edit', { user: req.session, question: questions[0], objectives, modules, error: null });
  } catch (error) {
    console.error('Question edit page error:', error);
    res.status(500).send('Error loading page');
  }
});

// Update question POST
router.post('/:id/edit', async (req, res) => {
  const { questionText, optionA, optionB, optionC, optionD, correctAnswer, testType, objectiveId, moduleId } = req.body;
  
  try {
    if (!moduleId) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
      const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
      if (questions.length > 0) {
        return res.render('questions/edit', { user: req.session, question: questions[0], objectives, modules, error: 'Module is required' });
      }
      return res.status(500).send('Error updating question');
    }

    // Validate required options
    if (!optionA || !optionB) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
      const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
      if (questions.length > 0) {
        return res.render('questions/edit', { user: req.session, question: questions[0], objectives, modules, error: 'Options A and B are required' });
      }
      return res.status(500).send('Error updating question');
    }
    
    // Determine available options
    const hasOptionC = optionC && optionC.trim() !== '';
    const hasOptionD = optionD && optionD.trim() !== '';
    const availableOptions = ['A', 'B'];
    if (hasOptionC) availableOptions.push('C');
    if (hasOptionD) availableOptions.push('D');
    
    // Validate correct answer matches available options
    if (!availableOptions.includes(correctAnswer)) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
      const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
      if (questions.length > 0) {
        return res.render('questions/edit', { user: req.session, question: questions[0], objectives, modules, error: `Correct answer must be one of: ${availableOptions.join(', ')}` });
      }
      return res.status(500).send('Error updating question');
    }
    
    // Check for duplicate options
    const options = [optionA.trim(), optionB.trim()];
    if (hasOptionC) options.push(optionC.trim());
    if (hasOptionD) options.push(optionD.trim());
    const uniqueOptions = [...new Set(options.map(o => o.toLowerCase()))];
    if (uniqueOptions.length !== options.length) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
      const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
      if (questions.length > 0) {
        return res.render('questions/edit', { user: req.session, question: questions[0], objectives, modules, error: 'All options must be unique' });
      }
      return res.status(500).send('Error updating question');
    }
    
    await req.db.query(
      'UPDATE questions SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ?, test_type = ?, module_id = ?, objective_id = ? WHERE id = ?',
      [questionText, optionA, optionB, hasOptionC ? optionC : null, hasOptionD ? optionD : null, correctAnswer, testType, moduleId, objectiveId || null, req.params.id]
    );
    
    res.redirect('/questions');
  } catch (error) {
    console.error('Question update error:', error);
    const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
    const [modules] = await req.db.query('SELECT id, name, description FROM modules ORDER BY name ASC');
    const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    if (questions.length > 0) {
      res.render('questions/edit', { user: req.session, question: questions[0], objectives, modules, error: 'Error updating question' });
    } else {
      res.status(500).send('Error updating question');
    }
  }
});

// Delete question
router.post('/:id/delete', async (req, res) => {
  try {
    await req.db.query('DELETE FROM questions WHERE id = ?', [req.params.id]);
    res.redirect('/questions');
  } catch (error) {
    console.error('Question delete error:', error);
    res.status(500).send('Error deleting question');
  }
});

// Download bulk upload template (generated: dropdowns for test type, module, objective, correct answer)
router.get('/bulk/template', async (req, res) => {
  try {
    const buffer = await buildQuestionsBulkTemplateBuffer(req.db);
    const filename = 'Questions Bulk Creation Template.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Template download error:', error);
    if (!res.headersSent) {
      res.status(500).send('Error downloading template');
    }
  }
});

// Bulk upload questions
router.post('/bulk/upload', async (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'No questions provided' });
    }
    
    const errors = [];
    const validQuestions = [];
    
    // Get all objectives for validation
    const [objectives] = await req.db.query('SELECT id, name FROM objectives');
    const objectiveMap = {};
    objectives.forEach(obj => {
      objectiveMap[obj.name.toLowerCase()] = obj.id;
    });

    // Get all modules for validation
    const [modules] = await req.db.query('SELECT id, name FROM modules');
    const moduleMap = {};
    modules.forEach(module => {
      moduleMap[module.name.toLowerCase()] = module.id;
    });
    
    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const rowNum = i + 2; // Excel row number (accounting for header)
      const testTypeNorm = normalizeBulkTestType(q.test_type);
      
      // Determine available options (C and D are optional) - MUST be defined before use
      const hasOptionC = q.option_c && q.option_c.trim() !== '';
      const hasOptionD = q.option_d && q.option_d.trim() !== '';
      
      const availableOptions = ['A', 'B'];
      if (hasOptionC) availableOptions.push('C');
      if (hasOptionD) availableOptions.push('D');
      
      // Check for duplicate options within the question
      const options = [q.option_a.trim(), q.option_b.trim()];
      if (hasOptionC) options.push(q.option_c.trim());
      if (hasOptionD) options.push(q.option_d.trim());
      const uniqueOptions = [...new Set(options.map(o => o.toLowerCase()))];
      if (uniqueOptions.length !== options.length) {
        errors.push(`Row ${rowNum}: Duplicate options found within the question`);
        continue;
      }
      
      // Validate module exists
      const moduleId = moduleMap[String(q.module_name || '').trim().toLowerCase()];
      if (!moduleId) {
        errors.push(`Row ${rowNum}: Module "${q.module_name}" not found in system`);
        continue;
      }

      // Validate objective exists
      const objectiveId = objectiveMap[String(q.objective_name || '').trim().toLowerCase()];
      if (!objectiveId) {
        errors.push(`Row ${rowNum}: Objective "${q.objective_name}" not found in system`);
        continue;
      }

      if (!testTypeNorm) {
        errors.push(`Row ${rowNum}: Invalid test type "${q.test_type}". Use Post Test, Pre Test, or Certificate Enrolment.`);
        continue;
      }

      // Check for duplicate question (same question, same options, same type, same correct answer, same module)
      // Handle NULL values properly in the query
      const [existing] = await req.db.query(`
        SELECT id FROM questions 
        WHERE question_text = ? 
        AND option_a = ? 
        AND option_b = ? 
        AND (option_c = ? OR (option_c IS NULL AND ? IS NULL))
        AND (option_d = ? OR (option_d IS NULL AND ? IS NULL))
        AND test_type = ? 
        AND correct_answer = ?
        AND module_id = ?
      `, [q.question_text, q.option_a, q.option_b, hasOptionC ? q.option_c : null, hasOptionC ? q.option_c : null, hasOptionD ? q.option_d : null, hasOptionD ? q.option_d : null, testTypeNorm, q.correct_answer, moduleId]);
      
      if (existing.length > 0) {
        errors.push(`Row ${rowNum}: Duplicate question found (same question, options, type, correct answer, and module already exists)`);
        continue;
      }
      
      // Validate correct answer matches available options
      if (!availableOptions.includes(q.correct_answer)) {
        errors.push(`Row ${rowNum}: Invalid correct answer "${q.correct_answer}". Must be one of: ${availableOptions.join(', ')}`);
        continue;
      }
      
      // All validations passed
      validQuestions.push({
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: hasOptionC ? q.option_c : null,
        option_d: hasOptionD ? q.option_d : null,
        correct_answer: q.correct_answer,
        test_type: testTypeNorm,
        module_id: moduleId,
        objective_id: objectiveId,
        created_by: req.session.userId
      });
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }
    
    if (validQuestions.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid questions to insert' });
    }
    
    // Insert in batches of 10
    let inserted = 0;
    const batchSize = 10;
    
    for (let i = 0; i < validQuestions.length; i += batchSize) {
      const batch = validQuestions.slice(i, i + batchSize);
      const values = batch.map(q => [
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_answer,
        q.test_type,
        q.module_id,
        q.objective_id,
        q.created_by
      ]);
      
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();
      
      await req.db.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_answer, test_type, module_id, objective_id, created_by) VALUES ${placeholders}`,
        flatValues
      );
      
      inserted += batch.length;
    }
    
    res.json({ success: true, inserted });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ success: false, error: 'Error uploading questions: ' + error.message });
  }
});

module.exports = router;
