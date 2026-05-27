const express = require('express');
const router = express.Router();
const { refreshHealthcareTrainingReminderCycles } = require('../utils/healthcareTrainingReminders');

router.get('/', async (req, res) => {
  try {
    const role = req.session.userRole;
    const userId = req.session.userId;
    
    if (role === 'trainee') {
      // Get enrolled trainings (limit to 6 most recent)
      const [enrollments] = await req.db.query(`
        SELECT e.*, t.title, t.type, t.description,
          COALESCE(ta.pre_test_completed, 0) as pre_test_completed,
          COALESCE(ta.post_test_completed, 0) as post_test_completed,
          COALESCE(ta.certificate_enrolment_test_completed, 0) as certificate_enrolment_test_completed,
          COALESCE(hs.hands_on_completed, 0) as hands_on_completed,
          COALESCE(ho.hands_on_total, 0) as hands_on_total
        FROM enrollments e
        JOIN trainings t ON e.training_id = t.id
        LEFT JOIN (
          SELECT enrollment_id,
            SUM(CASE WHEN test_type = 'pre_test' AND status = 'completed' THEN 1 ELSE 0 END) as pre_test_completed,
            SUM(CASE WHEN test_type = 'post_test' AND status = 'completed' THEN 1 ELSE 0 END) as post_test_completed,
            SUM(CASE WHEN test_type = 'certificate_enrolment' AND status = 'completed' THEN 1 ELSE 0 END) as certificate_enrolment_test_completed
          FROM test_attempts
          GROUP BY enrollment_id
        ) ta ON ta.enrollment_id = e.id
        LEFT JOIN (
          SELECT enrollment_id, COUNT(*) as hands_on_completed
          FROM practical_learning_outcome_scores
          GROUP BY enrollment_id
        ) hs ON hs.enrollment_id = e.id
        LEFT JOIN (
          SELECT training_id, COUNT(*) as hands_on_total
          FROM practical_learning_outcomes
          GROUP BY training_id
        ) ho ON ho.training_id = e.training_id
        WHERE e.trainee_id = ?
          AND e.status = 'active'
          AND t.status IN ('in_progress', 'completed', 'rescheduled')
          AND COALESCE(t.is_locked, 0) = 0
        ORDER BY e.enrolled_at DESC
        LIMIT 6
      `, [userId]);

      // Get trainee profile data for welcome section
      const [traineeData] = await req.db.query(`
        SELECT
          t.*,
          h.name as hospital_name
        FROM trainees t
        LEFT JOIN healthcare h ON h.id = t.healthcare_id
        WHERE t.id = ?
      `, [userId]);

      // Get analytics data (completed + in-progress courses only)
      const [analytics] = await req.db.query(`
        SELECT
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as trainings_completed,
          SUM(CASE WHEN t.status IN ('completed', 'in_progress') THEN 1 ELSE 0 END) as total_enrolled
        FROM enrollments e
        JOIN trainings t ON e.training_id = t.id
        WHERE e.trainee_id = ?
      `, [userId]);

      // Activities completed = unique passed tests + hands-on (all time)
      const [activityRows] = await req.db.query(`
        SELECT e.id as enrollment_id, t.type as training_type,
          ta.pre_max,
          ta.post_max,
          ta.cert_max,
          COALESCE(hs.hands_on_completed, 0) as hands_on_completed,
          COALESCE(ho.hands_on_total, 0) as hands_on_total
        FROM enrollments e
        JOIN trainings t ON e.training_id = t.id
        LEFT JOIN (
          SELECT enrollment_id,
            MAX(CASE WHEN test_type = 'pre_test' AND status = 'completed' THEN score END) as pre_max,
            MAX(CASE WHEN test_type = 'post_test' AND status = 'completed' THEN score END) as post_max,
            MAX(CASE WHEN test_type = 'certificate_enrolment' AND status = 'completed' THEN score END) as cert_max
          FROM test_attempts
          GROUP BY enrollment_id
        ) ta ON ta.enrollment_id = e.id
        LEFT JOIN (
          SELECT enrollment_id, COUNT(*) as hands_on_completed
          FROM practical_learning_outcome_scores
          GROUP BY enrollment_id
        ) hs ON hs.enrollment_id = e.id
        LEFT JOIN (
          SELECT training_id, COUNT(*) as hands_on_total
          FROM practical_learning_outcomes
          GROUP BY training_id
        ) ho ON ho.training_id = e.training_id
        WHERE e.trainee_id = ?
      `, [userId]);

      const activitiesCompleted = (activityRows || []).reduce((sum, row) => {
        let count = 0;
        if (parseFloat(row.pre_max) >= 80) count += 1;
        if (parseFloat(row.post_max) >= 80) count += 1;
        if (parseFloat(row.cert_max) >= 70) count += 1;
        if (row.training_type === 'main' && row.hands_on_total > 0 && row.hands_on_completed >= row.hands_on_total) {
          count += 1;
        }
        return sum + count;
      }, 0);

      const analyticsData = {
        trainings_completed: analytics[0]?.trainings_completed || 0,
        activities_completed: activitiesCompleted,
        total_enrolled: analytics[0]?.total_enrolled || 0
      };

      const traineeProfile = traineeData[0] || {};

      // Certificates for this trainee
      const [certificateRows] = await req.db.query(`
        SELECT ci.*, t.title as training_title, t.type as training_type,
          DATEDIFF(ci.validity_end, CURDATE()) as days_remaining
        FROM certificate_issues ci
        JOIN trainings t ON ci.training_id = t.id
        WHERE ci.trainee_id = ?
        ORDER BY ci.validity_end DESC, ci.issued_at DESC
      `, [userId]);

      const certificates = (certificateRows || []).map(row => ({
        ...row,
        days_remaining: Number.isFinite(row.days_remaining) ? row.days_remaining : null
      }));

      res.render('dashboard/trainee', {
        user: req.session,
        enrollments,
        analytics: analyticsData,
        traineeProfile,
        certificates
      });
    } else if (role === 'trainer' || role === 'admin') {
      await refreshHealthcareTrainingReminderCycles(req.db);

      // Get training statistics
      const [trainingStats] = await req.db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled,
          SUM(CASE WHEN status = 'rescheduled' THEN 1 ELSE 0 END) as rescheduled
        FROM trainings
      `);
      
      // Get top 10 trainings with healthcare centres and device serial numbers
      const [recentTrainings] = await req.db.query(`
        SELECT 
          t.id,
          t.title,
          t.type,
          t.start_datetime,
          t.end_datetime,
          t.status,
          GROUP_CONCAT(DISTINCT h.name ORDER BY h.name SEPARATOR ', ') as healthcare_centres,
          GROUP_CONCAT(
            DISTINCT COALESCE(dsn.serial_number, td.custom_serial_number) 
            ORDER BY COALESCE(dsn.serial_number, td.custom_serial_number) 
            SEPARATOR ', '
          ) as device_serial_numbers
        FROM trainings t
        LEFT JOIN training_healthcare th ON t.id = th.training_id
        LEFT JOIN healthcare h ON th.healthcare_id = h.id
        LEFT JOIN training_devices td ON t.id = td.training_id
        LEFT JOIN device_serial_numbers dsn ON td.device_serial_number_id = dsn.id
        GROUP BY t.id, t.title, t.type, t.start_datetime, t.end_datetime, t.status
        ORDER BY t.created_at DESC
        LIMIT 10
      `);
      
      // Get trainee statistics
      const [traineeStats] = await req.db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN trainee_status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN trainee_status = 'inactive' THEN 1 ELSE 0 END) as inactive,
          SUM(CASE WHEN trainee_status = 'suspended' THEN 1 ELSE 0 END) as suspended,
          SUM(CASE WHEN trainee_status = 'registered' THEN 1 ELSE 0 END) as registered
        FROM trainees
      `);
      
      // Get all trainers/admins with their training counts (both created and assigned)
      const [trainers] = await req.db.query(`
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.profile_picture,
          u.role,
          COALESCE(tt.completed_trainings, 0) as completed_trainings,
          COALESCE(tt.in_progress_trainings, 0) as in_progress_trainings
        FROM users u
        LEFT JOIN (
          SELECT trainer_id,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_trainings,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_trainings
          FROM (
            SELECT created_by as trainer_id, id, status
            FROM trainings
            WHERE created_by IS NOT NULL
            UNION DISTINCT
            SELECT tt.trainer_id, t.id, t.status
            FROM training_trainers tt
            JOIN trainings t ON t.id = tt.training_id
          ) trainer_trainings
          GROUP BY trainer_id
        ) tt ON tt.trainer_id = u.id
        WHERE u.role IN ('admin', 'trainer')
        ORDER BY u.last_name, u.first_name
      `);
      
      // Get recent registrations (trainees with status 'registered')
      const [recentRegistrations] = await req.db.query(`
        SELECT 
          t.id,
          t.trainee_id,
          t.first_name,
          t.last_name,
          t.ic_passport,
          h.name AS healthcare,
          t.email,
          t.handphone_number
        FROM trainees t
        LEFT JOIN healthcare h ON h.id = t.healthcare_id
        WHERE t.trainee_status = 'registered'
        ORDER BY t.created_at DESC
        LIMIT 10
      `);

      // Upcoming recertifications (next 60 days), grouped by hospital
      const [recertRows] = await req.db.query(`
        SELECT ci.training_id, ci.enrollment_id, ci.validity_end,
          DATEDIFF(ci.validity_end, CURDATE()) as days_remaining,
          tr.first_name, tr.last_name, tr.trainee_id as trainee_public_id,
          h.name as healthcare,
          t.title as training_title
        FROM certificate_issues ci
        JOIN trainees tr ON ci.trainee_id = tr.id
        JOIN trainings t ON ci.training_id = t.id
        LEFT JOIN healthcare h ON h.id = tr.healthcare_id
        WHERE ci.validity_end BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
        ORDER BY h.name, days_remaining ASC
      `);

      const recertMap = new Map();
      (recertRows || []).forEach(row => {
        const key = row.healthcare || 'Unknown Hospital';
        if (!recertMap.has(key)) recertMap.set(key, []);
        recertMap.get(key).push(row);
      });

      const recertificationsByHospital = Array.from(recertMap.entries()).map(([hospital, trainees]) => ({
        hospital,
        trainees
      }));

      const [healthcareReminderRows] = await req.db.query(`
        SELECT
          id,
          name,
          hospital_address,
          training_reminder_interval,
          training_reminder_due_date,
          DATEDIFF(training_reminder_due_date, CURDATE()) as days_remaining
        FROM healthcare
        WHERE training_reminder_due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
        ORDER BY days_remaining ASC, name ASC, id ASC
      `);
      
      res.render('dashboard/trainer', { 
        user: req.session,
        trainingStats: trainingStats[0] || { total: 0, in_progress: 0, completed: 0, canceled: 0, rescheduled: 0 },
        recentTrainings,
        traineeStats: traineeStats[0] || { total: 0, active: 0, inactive: 0, suspended: 0, registered: 0 },
        trainers,
        recentRegistrations,
        isAdmin: role === 'admin',
        recertificationsByHospital,
        healthcareTrainingReminders: healthcareReminderRows || []
      });
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

module.exports = router;
