const express = require('express');
const router = express.Router();

const PASSING_SCORE = 80;
const MAX_FAILED_ATTEMPTS = 4;

// Start test
router.get('/start/:enrollmentId/:testType', async (req, res) => {
  try {
    const { enrollmentId, testType } = req.params;
    
    // Verify enrollment belongs to user
    const [enrollments] = await req.db.query(
      'SELECT e.*, t.id as training_id, t.title, t.type as training_type FROM enrollments e JOIN trainings t ON e.training_id = t.id WHERE e.id = ? AND e.trainee_id = ?',
      [enrollmentId, req.session.userId]
    );
    
    if (enrollments.length === 0) {
      return res.status(403).send('Access denied');
    }
    
    const enrollment = enrollments[0];
    
    // Check if test already passed (score >= 80%) - if passed, show results
    const [passed] = await req.db.query(
      'SELECT id, score FROM test_attempts WHERE enrollment_id = ? AND test_type = ? AND status = "completed" AND score >= ?',
      [enrollmentId, testType, PASSING_SCORE]
    );
    
    if (passed.length > 0) {
      return res.redirect(`/tests/results/${passed[0].id}`);
    }

    if (testType === 'certificate_enrolment' && enrollment.training_type === 'main') {
      const [preTestCompleted] = await req.db.query(
        'SELECT id FROM test_attempts WHERE enrollment_id = ? AND test_type = "pre_test" AND status = "completed"',
        [enrollmentId]
      );
      if (preTestCompleted.length === 0) {
        return res.status(403).send('Complete the pre-test before starting the certificate enrolment test.');
      }
    }
    
    // Enforce max failed attempts per test type
    const [failedAttemptsRows] = await req.db.query(
      'SELECT COUNT(*) as failed_count FROM test_attempts WHERE enrollment_id = ? AND test_type = ? AND status = "completed" AND score < ?',
      [enrollmentId, testType, PASSING_SCORE]
    );
    const failedAttempts = Number(failedAttemptsRows?.[0]?.failed_count || 0);
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      return res.status(403).send('Maximum attempts reached for this test (4 failed attempts). You cannot retake this part and have failed this training.');
    }
    
    // Check if there's an in-progress attempt
    const [inProgress] = await req.db.query(
      'SELECT id FROM test_attempts WHERE enrollment_id = ? AND test_type = ? AND status = "in_progress"',
      [enrollmentId, testType]
    );
    
    let attemptId;
    if (inProgress.length > 0) {
      attemptId = inProgress[0].id;
    } else {
      // Get questions from training_tests
      const [trainingTests] = await req.db.query(
        'SELECT id FROM training_tests WHERE training_id = ? AND test_type = ?',
        [enrollment.training_id, testType]
      );
      
      if (trainingTests.length === 0) {
        return res.send('No test available for this training');
      }
      
      const trainingTestId = trainingTests[0].id;
      
      // Get questions for this test
      const [testQuestions] = await req.db.query(
        `SELECT q.*, ttq.question_order 
         FROM training_test_questions ttq
         JOIN questions q ON ttq.question_id = q.id
         WHERE ttq.training_test_id = ?
         ORDER BY ttq.question_order`,
        [trainingTestId]
      );
      
      if (testQuestions.length === 0) {
        return res.send('No questions available for this test');
      }
      
      // Create test attempt
      const [attempt] = await req.db.query(
        'INSERT INTO test_attempts (enrollment_id, test_type, total_questions) VALUES (?, ?, ?)',
        [enrollmentId, testType, testQuestions.length]
      );
      
      attemptId = attempt.insertId;
    }
    
    // Get questions for display
    const [trainingTests] = await req.db.query(
      'SELECT id FROM training_tests WHERE training_id = ? AND test_type = ?',
      [enrollment.training_id, testType]
    );
    
    const trainingTestId = trainingTests[0].id;
    
    const [questions] = await req.db.query(
      `SELECT q.*, ttq.question_order 
       FROM training_test_questions ttq
       JOIN questions q ON ttq.question_id = q.id
       WHERE ttq.training_test_id = ?
       ORDER BY ttq.question_order`,
      [trainingTestId]
    );
    
    res.render('test/take', { 
      user: req.session, 
      enrollment,
      testType,
      attemptId,
      questions
    });
  } catch (error) {
    console.error('Test start error:', error);
    res.status(500).send('Error starting test');
  }
});

// Submit test
router.post('/submit/:attemptId', async (req, res) => {
  try {
    const { attemptId } = req.params;
    const answers = req.body; // { questionId: answer }
    
    // Verify attempt belongs to user
    const [attempts] = await req.db.query(
      'SELECT ta.*, e.trainee_id, e.training_id FROM test_attempts ta JOIN enrollments e ON ta.enrollment_id = e.id WHERE ta.id = ?',
      [attemptId]
    );
    
    if (attempts.length === 0) {
      return res.status(403).send('Access denied');
    }
    if (req.session.userRole === 'trainee') {
      const attemptTraineeId = Number(attempts[0].trainee_id);
      const sessionTraineeId = Number(req.session.userId);
      if (!Number.isFinite(attemptTraineeId) || !Number.isFinite(sessionTraineeId) || attemptTraineeId !== sessionTraineeId) {
        return res.status(403).send('Access denied');
      }
    }
    
    if (attempts[0].status === 'completed') {
      return res.redirect(`/tests/results/${attemptId}`);
    }
    
    const attempt = attempts[0];
    let correctCount = 0;
    const objectiveStats = {}; // Track correct/incorrect per objective
    
    // Process each answer
    for (const [questionId, selectedAnswer] of Object.entries(answers)) {
      if (!selectedAnswer) continue; // Skip unanswered questions
      
      const [questions] = await req.db.query(
        'SELECT correct_answer, objective_id FROM questions WHERE id = ?', 
        [questionId]
      );
      
      if (questions.length > 0) {
        const question = questions[0];
        const isCorrect = question.correct_answer === selectedAnswer;
        if (isCorrect) correctCount++;
        
        // Track objective statistics
        if (question.objective_id) {
          if (!objectiveStats[question.objective_id]) {
            objectiveStats[question.objective_id] = { correct: 0, total: 0 };
          }
          objectiveStats[question.objective_id].total++;
          if (isCorrect) {
            objectiveStats[question.objective_id].correct++;
          }
        }
        
        await req.db.query(
          'INSERT INTO test_answers (attempt_id, question_id, selected_answer, is_correct) VALUES (?, ?, ?, ?)',
          [attemptId, questionId, selectedAnswer, isCorrect]
        );
      }
    }
    
    // Calculate score
    const totalQuestions = attempt.total_questions;
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    
    // Update attempt
    await req.db.query(
      'UPDATE test_attempts SET score = ?, completed_at = NOW(), status = "completed" WHERE id = ?',
      [score, attemptId]
    );
    
    // Calculate and store objective understanding scores
    await calculateObjectiveScores(req.db, attempt.enrollment_id, attempt.test_type, objectiveStats);
    
    // Auto-calculate final grades (will update when all tests are done)
    try {
      const resultsRoute = require('./results');
      if (resultsRoute.calculateFinalGrades) {
        await resultsRoute.calculateFinalGrades(req.db, attempt.enrollment_id);
      }
    } catch (error) {
      // Silently fail - grades can be calculated manually later
      console.error('Error auto-calculating final grades:', error);
    }
    
    res.redirect(`/tests/results/${attemptId}`);
  } catch (error) {
    console.error('Test submission error:', error);
    res.status(500).send('Error submitting test');
  }
});

/**
 * Calculate objective understanding scores after test completion
 */
async function calculateObjectiveScores(db, enrollmentId, testType, objectiveStats) {
  // Only calculate for post_test and certificate_enrolment
  if (!['post_test', 'certificate_enrolment'].includes(testType)) {
    return;
  }
  
  for (const [objectiveId, stats] of Object.entries(objectiveStats)) {
    const understandingPercentage = stats.total > 0 
      ? (stats.correct / stats.total) * 100 
      : 0;
    
    // Insert or update objective score
    await db.query(
      `INSERT INTO objective_scores 
       (enrollment_id, objective_id, test_type, questions_answered, questions_correct, understanding_percentage) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       questions_answered = VALUES(questions_answered),
       questions_correct = VALUES(questions_correct),
       understanding_percentage = VALUES(understanding_percentage),
       calculated_at = NOW()`,
      [enrollmentId, objectiveId, testType, stats.total, stats.correct, understandingPercentage]
    );
  }
}

// View test results
router.get('/results/:attemptId', async (req, res) => {
  try {
    const [attempts] = await req.db.query(`
      SELECT ta.*, e.trainee_id, e.training_id, t.title as training_title, t.type as training_type
      FROM test_attempts ta
      JOIN enrollments e ON ta.enrollment_id = e.id
      JOIN trainings t ON e.training_id = t.id
      WHERE ta.id = ?
    `, [req.params.attemptId]);
    
    if (attempts.length === 0) {
      return res.status(404).send('Test attempt not found');
    }
    
    const attempt = attempts[0];
    
    // Convert score to number (MySQL DECIMAL returns as string)
    attempt.score = parseFloat(attempt.score) || 0;
    
    // Check access
    if (req.session.userRole === 'trainee') {
      const attemptTraineeId = Number(attempt.trainee_id);
      const sessionTraineeId = Number(req.session.userId);
      if (!Number.isFinite(attemptTraineeId) || !Number.isFinite(sessionTraineeId) || attemptTraineeId !== sessionTraineeId) {
        return res.status(403).send('Access denied');
      }
    }
    
    // Get answers with questions
    const [answers] = await req.db.query(`
      SELECT ta.*, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.objective_id, o.name as objective_name
      FROM test_answers ta
      JOIN questions q ON ta.question_id = q.id
      LEFT JOIN objectives o ON q.objective_id = o.id
      WHERE ta.attempt_id = ?
      ORDER BY ta.id
    `, [req.params.attemptId]);
    
    // Get objective understanding scores for this test
    const [objectiveScores] = await req.db.query(`
      SELECT os.*, o.name as objective_name
      FROM objective_scores os
      JOIN objectives o ON os.objective_id = o.id
      WHERE os.enrollment_id = ? AND os.test_type = ?
    `, [attempt.enrollment_id, attempt.test_type]);
    
    // Check if test passed (score >= 80%)
    const passed = attempt.score >= PASSING_SCORE;

    const [failedAttemptsRows] = await req.db.query(
      'SELECT COUNT(*) as failed_count FROM test_attempts WHERE enrollment_id = ? AND test_type = ? AND status = "completed" AND score < ?',
      [attempt.enrollment_id, attempt.test_type, PASSING_SCORE]
    );
    const failedAttempts = Number(failedAttemptsRows?.[0]?.failed_count || 0);
    const maxAttemptsReached = !passed && failedAttempts >= MAX_FAILED_ATTEMPTS;
    
    // Get enrollment to check if can retake
    const [enrollments] = await req.db.query(
      'SELECT e.*, t.status as training_status FROM enrollments e JOIN trainings t ON e.training_id = t.id WHERE e.id = ?',
      [attempt.enrollment_id]
    );
    const enrollment = enrollments.length > 0 ? enrollments[0] : null;
    const trainingLocked = enrollment && enrollment.training_status === 'completed';
    
    res.render('test/results', { 
      user: req.session, 
      attempt, 
      answers,
      objectiveScores,
      passed,
      canRetake: !passed && !trainingLocked && !maxAttemptsReached,
      failedAttempts,
      maxFailedAttempts: MAX_FAILED_ATTEMPTS,
      maxAttemptsReached,
      enrollmentId: attempt.enrollment_id,
      testType: attempt.test_type
    });
  } catch (error) {
    console.error('Test results error:', error);
    res.status(500).send('Error loading results');
  }
});

module.exports = router;
