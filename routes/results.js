const express = require('express');
const router = express.Router();

// View results for an enrollment
router.get('/enrollment/:enrollmentId', async (req, res) => {
  try {
    const [enrollment] = await req.db.query(`
      SELECT e.*, t.title, t.type, tr.first_name, tr.last_name, tr.trainee_id
      FROM enrollments e
      JOIN trainings t ON e.training_id = t.id
      JOIN trainees tr ON e.trainee_id = tr.id
      WHERE e.id = ?
    `, [req.params.enrollmentId]);
    
    if (enrollment.length === 0) {
      return res.status(404).send('Enrollment not found');
    }
    
    const enrollmentData = enrollment[0];
    
    // Check access
    if (req.session.userRole === 'trainee' && enrollmentData.trainee_id !== req.session.userId) {
      return res.status(403).send('Access denied');
    }
    
    // Get test results
    const [tests] = await req.db.query(
      'SELECT * FROM test_attempts WHERE enrollment_id = ? AND status = "completed" ORDER BY test_type',
      [req.params.enrollmentId]
    );
    
    // Convert scores to numbers (MySQL DECIMAL returns as string)
    tests.forEach(test => {
      test.score = parseFloat(test.score) || 0;
    });
    
    // Get Practical learning outcome scores if main training
    let handsOnScores = [];
    if (enrollmentData.type === 'main') {
      [handsOnScores] = await req.db.query(`
        SELECT hs.*, ha.aspect_name, ha.max_score, u.first_name, u.last_name
        FROM practical_learning_outcome_scores hs
        JOIN practical_learning_outcomes ha ON hs.aspect_id = ha.id
        LEFT JOIN users u ON hs.evaluated_by = u.id
        WHERE hs.enrollment_id = ?
      `, [req.params.enrollmentId]);
    }
    
    // Get attendance
    const [attendance] = await req.db.query(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days
      FROM attendance
      WHERE enrollment_id = ?
    `, [req.params.enrollmentId]);
    
    // Get final grades
    const [finalGrades] = await req.db.query(
      'SELECT * FROM final_grades WHERE enrollment_id = ?',
      [req.params.enrollmentId]
    );
    
    // Get objective understanding scores
    const [objectiveScores] = await req.db.query(`
      SELECT os.*, o.name as objective_name
      FROM objective_scores os
      JOIN objectives o ON os.objective_id = o.id
      WHERE os.enrollment_id = ?
      AND os.test_type IN ('post_test', 'refresher_training', 'certificate_enrolment')
      ORDER BY o.name
    `, [req.params.enrollmentId]);
    
    res.render('results/view', { 
      user: req.session, 
      enrollment: enrollmentData, 
      tests, 
      handsOnScores,
      attendance: attendance[0],
      finalGrades: finalGrades[0] || null,
      objectiveScores,
      gradesReleased: enrollmentData.grades_released || false
    });
  } catch (error) {
    console.error('Results view error:', error);
    res.status(500).send('Error loading results');
  }
});

// Allow download results
router.post('/allow-download/:enrollmentId', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).send('Access denied');
  }
  
  try {
    await req.db.query(
      'UPDATE enrollments SET can_download_results = TRUE WHERE id = ?',
      [req.params.enrollmentId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Allow download error:', error);
    res.status(500).json({ success: false });
  }
});

// Score Practical learning outcome aspect
router.post('/score-Practical learning outcome', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).send('Access denied');
  }
  
  const { enrollmentId, aspectId, score, comments } = req.body;
  
  try {
    await req.db.query(
      'INSERT INTO practical_learning_outcome_scores (enrollment_id, aspect_id, score, evaluated_by, comments) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE score = ?, evaluated_by = ?, comments = ?, evaluated_at = NOW()',
      [enrollmentId, aspectId, score, req.session.userId, comments, score, req.session.userId, comments]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Practical learning outcome scoring error:', error);
    res.status(500).json({ success: false });
  }
});

// Calculate and store final grades for an enrollment (exported for use in other routes)
async function calculateFinalGrades(db, enrollmentId) {
  try {
    // Get enrollment and training info
    const [enrollments] = await db.query(`
      SELECT e.*, t.type as training_type
      FROM enrollments e
      JOIN trainings t ON e.training_id = t.id
      WHERE e.id = ?
    `, [enrollmentId]);
    
    if (enrollments.length === 0) return;
    
    const enrollment = enrollments[0];
    
    // Get test scores
    const [testAttempts] = await db.query(
      'SELECT test_type, score FROM test_attempts WHERE enrollment_id = ? AND status = "completed"',
      [enrollmentId]
    );
    
    let trainingGrade = null; // Overall grade (60% hands-on + 40% certificate enrolment)
    let endorsementGrade = null; // From certificate_enrolment
    let certificateScore = null;
    let refresherScore = null;
    
    for (const attempt of testAttempts) {
      if (attempt.test_type === 'refresher_training') {
        refresherScore = attempt.score;
      } else if (attempt.test_type === 'certificate_enrolment') {
        certificateScore = attempt.score;
        endorsementGrade = attempt.score;
      }
    }
    
    // Calculate objective understanding percentage (average from all objectives)
    const [objectiveScores] = await db.query(`
      SELECT AVG(understanding_percentage) as avg_understanding
      FROM objective_scores
      WHERE enrollment_id = ? 
      AND test_type IN ('post_test', 'refresher_training', 'certificate_enrolment')
    `, [enrollmentId]);
    
    const objectiveUnderstanding = objectiveScores[0]?.avg_understanding || null;
    
    // Calculate Practical learning outcome grade (average of all Practical learning outcome scores)
    let handsOnGrade = null;
    if (enrollment.training_type === 'main') {
      const [handsOnScores] = await db.query(`
        SELECT AVG(hs.score / ha.max_score * 100) as avg_hands_on
        FROM practical_learning_outcome_scores hs
        JOIN practical_learning_outcomes ha ON hs.aspect_id = ha.id
        WHERE hs.enrollment_id = ?
      `, [enrollmentId]);
      
      handsOnGrade = handsOnScores[0]?.avg_hands_on || null;
    }

    if (enrollment.training_type === 'main') {
      if (handsOnGrade !== null && certificateScore !== null) {
        trainingGrade = (handsOnGrade * 0.6) + (certificateScore * 0.4);
      }
    } else if (refresherScore !== null) {
      trainingGrade = refresherScore;
    }
    
    // Insert or update final grades
    await db.query(
      `INSERT INTO final_grades 
       (enrollment_id, training_grade, endorsement_grade, objective_understanding_percentage, hands_on_grade) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       training_grade = VALUES(training_grade),
       endorsement_grade = VALUES(endorsement_grade),
       objective_understanding_percentage = VALUES(objective_understanding_percentage),
       hands_on_grade = VALUES(hands_on_grade),
       updated_at = NOW()`,
      [enrollmentId, trainingGrade, endorsementGrade, objectiveUnderstanding, handsOnGrade]
    );
  } catch (error) {
    console.error('Error calculating final grades:', error);
    throw error;
  }
}

// Calculate final grades for an enrollment (admin/trainer only)
router.post('/calculate-grades/:enrollmentId', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    await calculateFinalGrades(req.db, req.params.enrollmentId);
    res.json({ success: true });
  } catch (error) {
    console.error('Calculate grades error:', error);
    res.status(500).json({ success: false, error: 'Error calculating grades' });
  }
});

// Release grades for an enrollment (admin/trainer only)
router.post('/release-grades/:enrollmentId', async (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  try {
    // Calculate grades first
    await calculateFinalGrades(req.db, req.params.enrollmentId);
    
    // Release grades
    await req.db.query(
      'UPDATE enrollments SET grades_released = TRUE WHERE id = ?',
      [req.params.enrollmentId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Release grades error:', error);
    res.status(500).json({ success: false, error: 'Error releasing grades' });
  }
});

// Download results (PDF generation would go here)
router.get('/download/:enrollmentId', async (req, res) => {
  try {
    const [enrollment] = await req.db.query(
      'SELECT * FROM enrollments WHERE id = ? AND trainee_id = ?',
      [req.params.enrollmentId, req.session.userId]
    );
    
    if (enrollment.length === 0 || !enrollment[0].can_download_results) {
      return res.status(403).send('Download not allowed');
    }
    
    // TODO: Generate PDF with results
    res.send('PDF generation would happen here');
  } catch (error) {
    console.error('Download results error:', error);
    res.status(500).send('Error downloading results');
  }
});

// Export calculateFinalGrades for use in other routes
module.exports = router;
module.exports.calculateFinalGrades = calculateFinalGrades;


