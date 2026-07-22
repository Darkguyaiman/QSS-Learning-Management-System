const express = require('express');
const { getPassingScore, MAX_FAILED_ATTEMPTS } = require('../utils/testScores');
const { getBestCertAttempt, canDownloadCertificate } = require('../utils/certificateEligibility');
const { columnExists } = require('../utils/certificateIssueLocations');
const router = express.Router();

// Trainee-only: Results for an enrollment
router.get('/results/enrollment/:enrollmentId', async (req, res, next) => {
  try {
    if (req.session.userRole !== 'trainee') return next();

    const [enrollment] = await req.db.query(`
      SELECT e.*, t.title, t.type, tr.first_name, tr.last_name, tr.trainee_id
      FROM enrollments e
      JOIN trainings t ON e.training_id = t.id
      JOIN trainees tr ON e.trainee_id = tr.id
      WHERE e.id = ? AND e.trainee_id = ?
        AND t.status IN ('completed', 'in_progress')
    `, [req.params.enrollmentId, req.session.userId]);

    if (enrollment.length === 0) {
      return res.status(403).send('Access denied');
    }

    const enrollmentData = enrollment[0];

    const [tests] = await req.db.query(
      'SELECT * FROM test_attempts WHERE enrollment_id = ? AND status = "completed" ORDER BY test_type',
      [req.params.enrollmentId]
    );

    tests.forEach(test => {
      test.score = parseFloat(test.score) || 0;
    });

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

    const [attendance] = await req.db.query(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days
      FROM attendance
      WHERE enrollment_id = ?
    `, [req.params.enrollmentId]);

    const [finalGrades] = await req.db.query(
      'SELECT * FROM final_grades WHERE enrollment_id = ?',
      [req.params.enrollmentId]
    );

    const [objectiveScores] = await req.db.query(`
      SELECT os.*, o.name as objective_name
      FROM objective_scores os
      JOIN objectives o ON os.objective_id = o.id
      WHERE os.enrollment_id = ?
      AND os.test_type IN ('post_test', 'certificate_enrolment')
      ORDER BY o.name
    `, [req.params.enrollmentId]);

    const [overrideRows] = await req.db.query(
      `SELECT *
       FROM certificate_release_overrides
       WHERE enrollment_id = ?`,
      [req.params.enrollmentId]
    );
    const certificateReleaseOverride = overrideRows[0] || null;

    const certificateActions = {
      canShowCertificate: canDownloadCertificate({
        testAttempts: tests,
        handsOnScores,
        trainingType: enrollmentData.type,
        releaseOverride: certificateReleaseOverride
      }),
      canReleaseCertificateOverride: false,
      certAttempt: getBestCertAttempt(tests)
    };

    res.render('results/view', { 
      user: req.session, 
      enrollment: enrollmentData, 
      tests, 
      handsOnScores,
      attendance: attendance[0],
      finalGrades: finalGrades[0] || null,
      objectiveScores,
      gradesReleased: enrollmentData.can_download_results || false,
      certificateReleaseOverride,
      certificateActions
    });
  } catch (error) {
    console.error('Trainee results view error:', error);
    res.status(500).send('Error loading results');
  }
});

// Trainee-only: Attendance view
router.get('/attendance/trainee/:enrollmentId', async (req, res, next) => {
  try {
    if (req.session.userRole !== 'trainee') return next();

    const [enrollment] = await req.db.query(`
      SELECT e.*, t.title, tr.first_name, tr.last_name, tr.trainee_id
      FROM enrollments e
      JOIN trainings t ON e.training_id = t.id
      JOIN trainees tr ON e.trainee_id = tr.id
      WHERE e.id = ? AND e.trainee_id = ?
        AND t.status IN ('completed', 'in_progress')
    `, [req.params.enrollmentId, req.session.userId]);
    
    if (enrollment.length === 0) {
      return res.status(403).send('Access denied');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const [attendanceRecords] = await req.db.query(`
      SELECT date, 
        status,
        notes,
        marked_by,
        u.first_name as marked_by_first, u.last_name as marked_by_last
      FROM attendance
      LEFT JOIN users u ON marked_by = u.id
      WHERE enrollment_id = ?
      GROUP BY date, status, notes, marked_by, u.first_name, u.last_name
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `, [req.params.enrollmentId, limit, offset]);

    const [totalCount] = await req.db.query(`
      SELECT COUNT(DISTINCT date) as total
      FROM attendance
      WHERE enrollment_id = ?
    `, [req.params.enrollmentId]);

    const totalPages = Math.ceil((totalCount[0]?.total || 0) / limit);

    const attendanceByDate = attendanceRecords.map(record => {
      let timeDisplay = '';
      let notesWithoutTime = record.notes || '';
      
      if (record.notes && record.notes.includes('Time:')) {
        const lines = record.notes.split('\n');
        const timeLine = lines.find(line => line.trim().startsWith('Time:'));
        if (timeLine) {
          timeDisplay = timeLine.replace('Time:', '').trim();
          notesWithoutTime = lines.filter(line => !line.trim().startsWith('Time:')).join('\n').trim();
        }
      }
      
      return {
        date: record.date,
        status: record.status,
        notes: notesWithoutTime,
        marked_by_first: record.marked_by_first,
        marked_by_last: record.marked_by_last,
        time: timeDisplay
      };
    });

    res.render('attendance/trainee', { 
      user: req.session, 
      enrollment: enrollment[0], 
      attendanceByDate,
      currentPage: page,
      totalPages: totalPages
    });
  } catch (error) {
    console.error('Trainee attendance error:', error);
    res.status(500).send('Error loading attendance');
  }
});

// Trainee-only: Certificate
router.get('/training/:id/certificate/:enrollmentId', async (req, res, next) => {
  try {
    if (req.session.userRole !== 'trainee') return next();

    const { id: trainingId, enrollmentId } = req.params;

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
        snapshot_h.name as healthcare_at_enrollment,
        h.name as healthcare
      FROM enrollments e
      JOIN trainings t ON e.training_id = t.id
      JOIN trainees tr ON e.trainee_id = tr.id
      LEFT JOIN healthcare snapshot_h ON snapshot_h.id = e.healthcare_id_at_enrollment
      LEFT JOIN healthcare h ON h.id = tr.healthcare_id
      WHERE e.id = ? AND e.training_id = ? AND e.trainee_id = ?
        AND t.status IN ('completed', 'in_progress')
    `, [enrollmentId, trainingId, req.session.userId]);
    
    if (enrollments.length === 0) {
      return res.status(403).send('Access denied');
    }
    
    const enrollment = enrollments[0];
    
    const [testAttempts] = await req.db.query(
      'SELECT * FROM test_attempts WHERE enrollment_id = ? AND status = "completed" ORDER BY test_type',
      [enrollmentId]
    );

    const [releaseOverrideRows] = await req.db.query(
      'SELECT * FROM certificate_release_overrides WHERE enrollment_id = ?',
      [enrollmentId]
    );
    const releaseOverride = releaseOverrideRows[0] || null;

    const attemptStatsByType = (testAttempts || []).reduce((acc, attempt) => {
      const testType = attempt.test_type;
      const score = parseFloat(attempt.score) || 0;
      if (!acc[testType]) {
        acc[testType] = { failed: 0, hasPass: false };
      }
      if (score >= getPassingScore(testType)) acc[testType].hasPass = true;
      else acc[testType].failed += 1;
      return acc;
    }, {});
    const hasLockedTestPart = Object.values(attemptStatsByType).some(stat => stat.failed >= MAX_FAILED_ATTEMPTS && !stat.hasPass);
    if (hasLockedTestPart) {
      return res.status(403).send(`Certificate is not available because one or more test parts reached ${MAX_FAILED_ATTEMPTS} failed attempts. You have failed this training.`);
    }

    const certAttempt = getBestCertAttempt(testAttempts);
    if (!enrollment.can_download_results && !certAttempt && !releaseOverride) {
      return res.status(403).send('Scores have not been released yet. Please contact your administrator.');
    }

    let handsOnScores = [];
    if (enrollment.training_type === 'main') {
      [handsOnScores] = await req.db.query(`
        SELECT hs.*, ha.aspect_name, ha.max_score
        FROM practical_learning_outcome_scores hs
        JOIN practical_learning_outcomes ha ON hs.aspect_id = ha.id
        WHERE hs.enrollment_id = ?
      `, [enrollmentId]);
    }

    if (!canDownloadCertificate({
      testAttempts,
      handsOnScores,
      trainingType: enrollment.training_type,
      releaseOverride
    })) {
      return res.status(403).send('Certificate requires Outstanding results in Certificate Enrolment Test and Practical Learning Outcome.');
    }
    
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
    const hasCertificateHealthcareSnapshot = await columnExists(req.db, 'certificate_issues', 'healthcare_id_at_issue');

    let participantName = `${enrollment.first_name} ${enrollment.last_name}`;
    let courseName = enrollment.training_title;
    let location = enrollment.healthcare_at_enrollment || enrollment.healthcare || 'N/A';
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
      date = issued.date_display || date;
      if (hasCertificateHealthcareSnapshot) {
        await req.db.query(
          `UPDATE certificate_issues
           SET healthcare_id_at_issue = COALESCE(healthcare_id_at_issue, ?),
               location = ?
           WHERE id = ?`,
          [enrollment.healthcare_id_at_enrollment || null, location, issued.id]
        );
      } else {
        await req.db.query(
          'UPDATE certificate_issues SET location = ? WHERE id = ?',
          [location, issued.id]
        );
      }
    } else {
      const insertColumns = [
        'enrollment_id',
        'training_id',
        'trainee_id',
        'certificate_number',
        'validity_start',
        'validity_end',
        'participant_name',
        'course_name',
        'location',
        'date_display'
      ];
      const insertValues = [
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
      ];

      if (hasCertificateHealthcareSnapshot) {
        insertColumns.splice(3, 0, 'healthcare_id_at_issue');
        insertValues.splice(3, 0, enrollment.healthcare_id_at_enrollment || null);
      }

      await req.db.query(
        `INSERT INTO certificate_issues
         (${insertColumns.join(', ')})
         VALUES (${insertColumns.map(() => '?').join(', ')})`,
        insertValues
      );
    }

    const validityPeriod = `${formatDate(validityStart)} to ${formatDate(validityEnd)}`;
    const signerName = 'Administrator';
    const signerTitle = 'Authorized Signatory';
    const signerCompany = 'Quick Stop Solution';
    const signatureName = signerName;
    const signatureImage = null;

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
    console.error('Certificate generation error (trainee):', error);
    res.status(500).send('Error generating certificate');
  }
});

module.exports = router;
