const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const role = req.session.userRole;
    const userId = req.session.userId;
    
    if (role === 'trainee') {
      // Get enrolled trainings (limit to 4 most recent)
      const [enrollments] = await req.db.query(`
        SELECT e.*, t.title, t.type, t.description,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'pre_test' AND status = 'completed') as pre_test_completed,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'post_test' AND status = 'completed') as post_test_completed,
          (SELECT COUNT(*) FROM test_attempts WHERE enrollment_id = e.id AND test_type = 'refresher_training' AND status = 'completed') as refresher_training_test_completed
        FROM enrollments e
        JOIN trainings t ON e.training_id = t.id
        WHERE e.trainee_id = ? AND e.status = 'active'
        ORDER BY e.enrolled_at DESC
        LIMIT 4
      `, [userId]);

      // Get trainee profile data for welcome section
      const [traineeData] = await req.db.query(`
        SELECT
          t.*,
          t.healthcare as hospital_name
        FROM trainees t
        WHERE t.id = ?
      `, [userId]);

      // Get analytics data
      const [analytics] = await req.db.query(`
        SELECT
          -- Total trainings completed
          (SELECT COUNT(*) FROM enrollments WHERE trainee_id = ? AND status = 'completed') as trainings_completed,

          -- Total activities completed (all test types)
          (SELECT COUNT(*) FROM test_attempts ta
           JOIN enrollments e ON ta.enrollment_id = e.id
           WHERE e.trainee_id = ? AND ta.status = 'completed') as activities_completed,

          -- Total enrolled trainings
          (SELECT COUNT(*) FROM enrollments WHERE trainee_id = ? AND status = 'active') as total_enrolled
      `, [userId, userId, userId]);

      const analyticsData = analytics[0] || {
        trainings_completed: 0,
        activities_completed: 0,
        total_enrolled: 0
      };

      const traineeProfile = traineeData[0] || {};

      res.render('dashboard/trainee', {
        user: req.session,
        enrollments,
        analytics: analyticsData,
        traineeProfile
      });
    } else if (role === 'trainer' || role === 'admin') {
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
          (
            SELECT COUNT(DISTINCT t.id)
            FROM trainings t
            WHERE (t.created_by = u.id OR EXISTS (
              SELECT 1 FROM training_trainers tt WHERE tt.training_id = t.id AND tt.trainer_id = u.id
            ))
            AND t.status = 'completed'
          ) as completed_trainings,
          (
            SELECT COUNT(DISTINCT t.id)
            FROM trainings t
            WHERE (t.created_by = u.id OR EXISTS (
              SELECT 1 FROM training_trainers tt WHERE tt.training_id = t.id AND tt.trainer_id = u.id
            ))
            AND t.status = 'in_progress'
          ) as in_progress_trainings
        FROM users u
        WHERE u.role IN ('admin', 'trainer')
        ORDER BY u.last_name, u.first_name
      `);
      
      // Get recent registrations (trainees with status 'registered')
      const [recentRegistrations] = await req.db.query(`
        SELECT 
          id,
          trainee_id,
          first_name,
          last_name,
          ic_passport,
          healthcare,
          email,
          handphone_number
        FROM trainees
        WHERE trainee_status = 'registered'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      res.render('dashboard/trainer', { 
        user: req.session,
        trainingStats: trainingStats[0] || { total: 0, in_progress: 0, completed: 0, canceled: 0, rescheduled: 0 },
        recentTrainings,
        traineeStats: traineeStats[0] || { total: 0, active: 0, inactive: 0, suspended: 0, registered: 0 },
        trainers,
        recentRegistrations,
        isAdmin: role === 'admin'
      });
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

module.exports = router;
