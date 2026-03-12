const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const XLSX = require('xlsx');

// List questions
router.get('/', async (req, res) => {
  try {
    const [questions] = await req.db.query(`
      SELECT q.*, o.name as objective_name, o.id as objective_id, u.first_name, u.last_name, q.created_by as creator_id,
             dm.model_name as device_model_name
      FROM questions q
      LEFT JOIN objectives o ON q.objective_id = o.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN device_models dm ON q.device_model_id = dm.id
      ORDER BY q.created_at DESC
    `);
    
    // Get unique objectives and creators for filters
    const [objectives] = await req.db.query('SELECT DISTINCT id, name FROM objectives ORDER BY name ASC');
    const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
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
      deviceModels,
      creators
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
    const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
    res.render('questions/create', { user: req.session, objectives, deviceModels, error: null });
  } catch (error) {
    console.error('Question create page error:', error);
    res.status(500).send('Error loading page');
  }
});

// Create question POST
router.post('/create', async (req, res) => {
  const { questionText, optionA, optionB, optionC, optionD, correctAnswer, testType, objectiveId, deviceModelId } = req.body;
  
  try {
    if (!deviceModelId) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
      return res.render('questions/create', { user: req.session, objectives, deviceModels, error: 'Device model is required' });
    }

    // Validate required options
    if (!optionA || !optionB) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
      return res.render('questions/create', { user: req.session, objectives, deviceModels, error: 'Options A and B are required' });
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
      const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
      return res.render('questions/create', { user: req.session, objectives, deviceModels, error: `Correct answer must be one of: ${availableOptions.join(', ')}` });
    }
    
    // Check for duplicate options
    const options = [optionA.trim(), optionB.trim()];
    if (hasOptionC) options.push(optionC.trim());
    if (hasOptionD) options.push(optionD.trim());
    const uniqueOptions = [...new Set(options.map(o => o.toLowerCase()))];
    if (uniqueOptions.length !== options.length) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
      return res.render('questions/create', { user: req.session, objectives, deviceModels, error: 'All options must be unique' });
    }
    
    await req.db.query(
      'INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_answer, test_type, device_model_id, objective_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [questionText, optionA, optionB, hasOptionC ? optionC : null, hasOptionD ? optionD : null, correctAnswer, testType, deviceModelId, objectiveId || null, req.session.userId]
    );
    
    res.redirect('/questions');
  } catch (error) {
    console.error('Question creation error:', error);
    const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
    const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
    res.render('questions/create', { user: req.session, objectives, deviceModels, error: 'Error creating question' });
  }
});

// Edit question
router.get('/:id/edit', async (req, res) => {
  try {
    const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
    const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
    
    if (questions.length === 0) {
      return res.status(404).send('Question not found');
    }
    
    res.render('questions/edit', { user: req.session, question: questions[0], objectives, deviceModels, error: null });
  } catch (error) {
    console.error('Question edit page error:', error);
    res.status(500).send('Error loading page');
  }
});

// Update question POST
router.post('/:id/edit', async (req, res) => {
  const { questionText, optionA, optionB, optionC, optionD, correctAnswer, testType, objectiveId, deviceModelId } = req.body;
  
  try {
    if (!deviceModelId) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
      const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
      if (questions.length > 0) {
        return res.render('questions/edit', { user: req.session, question: questions[0], objectives, deviceModels, error: 'Device model is required' });
      }
      return res.status(500).send('Error updating question');
    }

    // Validate required options
    if (!optionA || !optionB) {
      const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
      const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
      const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
      if (questions.length > 0) {
        return res.render('questions/edit', { user: req.session, question: questions[0], objectives, deviceModels, error: 'Options A and B are required' });
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
      const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
      const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
      if (questions.length > 0) {
        return res.render('questions/edit', { user: req.session, question: questions[0], objectives, deviceModels, error: `Correct answer must be one of: ${availableOptions.join(', ')}` });
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
      const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
      const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
      if (questions.length > 0) {
        return res.render('questions/edit', { user: req.session, question: questions[0], objectives, deviceModels, error: 'All options must be unique' });
      }
      return res.status(500).send('Error updating question');
    }
    
    await req.db.query(
      'UPDATE questions SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ?, test_type = ?, device_model_id = ?, objective_id = ? WHERE id = ?',
      [questionText, optionA, optionB, hasOptionC ? optionC : null, hasOptionD ? optionD : null, correctAnswer, testType, deviceModelId, objectiveId || null, req.params.id]
    );
    
    res.redirect('/questions');
  } catch (error) {
    console.error('Question update error:', error);
    const [objectives] = await req.db.query('SELECT id, name, description FROM objectives ORDER BY name ASC');
    const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models ORDER BY model_name ASC');
    const [questions] = await req.db.query('SELECT * FROM questions WHERE id = ?', [req.params.id]);
    if (questions.length > 0) {
      res.render('questions/edit', { user: req.session, question: questions[0], objectives, deviceModels, error: 'Error updating question' });
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

// Download bulk upload template
router.get('/bulk/template', async (req, res) => {
  try {
    // Try multiple possible locations for the template
    const possiblePaths = [
      path.join(__dirname, '..', 'Questions Bulk Creation Template.xlsx'),
      path.join(process.cwd(), 'Questions Bulk Creation Template.xlsx'),
      path.join(__dirname, '..', '..', 'Questions Bulk Creation Template.xlsx')
    ];
    
    let templatePath = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        templatePath = possiblePath;
        break;
      }
    }
    
    // If template doesn't exist, create it
    if (!templatePath) {
      templatePath = path.join(__dirname, '..', 'Questions Bulk Creation Template.xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheetData = [
        ['Question', 'Test Type', 'Device Model', 'Objective', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'],
        ['What is the capital of France?', 'pre_test', 'Model A', 'Geography', 'Paris', 'London', 'Berlin', 'Madrid', 'A'],
        ['What is 2 + 2?', 'post_test', 'Model A', 'Mathematics', '3', '4', '5', '6', 'B'],
        ['Sample certificate question?', 'certificate_enrolment', 'Model A', 'General', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'A']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');
      XLSX.writeFile(workbook, templatePath);
    }
    
    res.download(templatePath, 'Questions Bulk Creation Template.xlsx', (err) => {
      if (err) {
        console.error('Template download error:', err);
        if (!res.headersSent) {
          res.status(500).send('Error downloading template');
        }
      }
    });
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

    // Get all device models for validation
    const [deviceModels] = await req.db.query('SELECT id, model_name FROM device_models');
    const deviceModelMap = {};
    deviceModels.forEach(model => {
      deviceModelMap[model.model_name.toLowerCase()] = model.id;
    });
    
    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const rowNum = i + 2; // Excel row number (accounting for header)
      
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
      
      // Validate device model exists
      const deviceModelId = deviceModelMap[(q.device_model_name || '').toLowerCase()];
      if (!deviceModelId) {
        errors.push(`Row ${rowNum}: Device Model "${q.device_model_name}" not found in system`);
        continue;
      }

      // Validate objective exists
      const objectiveId = objectiveMap[q.objective_name.toLowerCase()];
      if (!objectiveId) {
        errors.push(`Row ${rowNum}: Objective "${q.objective_name}" not found in system`);
        continue;
      }

      // Check for duplicate question (same question, same options, same type, same correct answer, same device model)
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
        AND device_model_id = ?
      `, [q.question_text, q.option_a, q.option_b, hasOptionC ? q.option_c : null, hasOptionC ? q.option_c : null, hasOptionD ? q.option_d : null, hasOptionD ? q.option_d : null, q.test_type, q.correct_answer, deviceModelId]);
      
      if (existing.length > 0) {
        errors.push(`Row ${rowNum}: Duplicate question found (same question, options, type, correct answer, and device model already exists)`);
        continue;
      }
      
      // Validate test type
      if (!['pre_test', 'post_test', 'refresher_training', 'certificate_enrolment'].includes(q.test_type)) {
        errors.push(`Row ${rowNum}: Invalid test type "${q.test_type}"`);
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
        test_type: q.test_type,
        device_model_id: deviceModelId,
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
        q.device_model_id,
        q.objective_id,
        q.created_by
      ]);
      
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();
      
      await req.db.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_answer, test_type, device_model_id, objective_id, created_by) VALUES ${placeholders}`,
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
