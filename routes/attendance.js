const express = require('express');
const router = express.Router();

const requireStaff = (req, res) => {
  if (!['admin', 'trainer'].includes(req.session.userRole)) {
    res.status(403).send('Access denied');
    return false;
  }
  return true;
};

function normalizeTimeInput(time) {
  if (!time) return null;
  const value = String(time).trim();
  if (!value || value === 'null' || value === 'undefined') return null;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(value)) return value.substring(0, 5);
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  return null;
}

function calculateDurationHours(startTime, endTime) {
  const start = normalizeTimeInput(startTime);
  const end = normalizeTimeInput(endTime);
  if (!start || !end) return null;

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null;

  let startMinutes = (sh * 60) + sm;
  let endMinutes = (eh * 60) + em;
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // allow overnight sessions
  }

  const durationHours = (endMinutes - startMinutes) / 60;
  return Math.round(durationHours * 100) / 100;
}

// View attendance for a training
router.get('/training/:trainingId', async (req, res) => {
  try {
    if (!requireStaff(req, res)) return;

    const [training] = await req.db.query('SELECT * FROM trainings WHERE id = ?', [req.params.trainingId]);
    
    if (training.length === 0) {
      return res.status(404).send('Training not found');
    }
    
    // Get enrolled trainees
    // Check if profile_picture column exists before including it in query
    let includeProfilePicture = false;
    try {
      const [columns] = await req.db.query("SHOW COLUMNS FROM trainees LIKE 'profile_picture'");
      includeProfilePicture = columns.length > 0;
    } catch (e) {
      // Column doesn't exist - that's fine
    }
    
    const profilePictureSelect = includeProfilePicture ? ', tr.profile_picture' : '';
    const [enrollments] = await req.db.query(`
      SELECT e.*, tr.first_name, tr.last_name, tr.email, tr.trainee_id${profilePictureSelect},
        (SELECT COUNT(*) FROM attendance WHERE enrollment_id = e.id AND status = 'present') as present_count,
        (SELECT COUNT(*) FROM attendance WHERE enrollment_id = e.id AND status = 'absent') as absent_count
      FROM enrollments e
      JOIN trainees tr ON e.trainee_id = tr.id
      WHERE e.training_id = ?
      ORDER BY tr.last_name, tr.first_name
    `, [req.params.trainingId]);
    
    // Ensure profile_picture is set to null if column doesn't exist
    if (!includeProfilePicture) {
      enrollments.forEach(enrollment => {
        enrollment.profile_picture = null;
      });
    }
    
    // Get attendance grouped by date with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // 10 dates per page
    const offset = (page - 1) * limit;
    
    // Get unique dates with attendance records
    const [dateGroups] = await req.db.query(`
      SELECT date, 
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count
      FROM attendance
      WHERE enrollment_id IN (SELECT id FROM enrollments WHERE training_id = ?)
      GROUP BY date
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `, [req.params.trainingId, limit, offset]);
    
    // Get total number of unique dates for pagination
    const [totalDates] = await req.db.query(`
      SELECT COUNT(DISTINCT date) as total
      FROM attendance
      WHERE enrollment_id IN (SELECT id FROM enrollments WHERE training_id = ?)
    `, [req.params.trainingId]);
    
    const totalPages = Math.ceil((totalDates[0]?.total || 0) / limit);
    
    // Get attendance records for each date
    const attendanceByDate = [];
    for (const dateGroup of dateGroups) {
      const [records] = await req.db.query(`
        SELECT a.*, tr.first_name, tr.last_name, tr.trainee_id,
          u.first_name as marked_by_first, u.last_name as marked_by_last
        FROM attendance a
        JOIN enrollments e ON a.enrollment_id = e.id
        JOIN trainees tr ON e.trainee_id = tr.id
        LEFT JOIN users u ON a.marked_by = u.id
        WHERE a.date = ?
        AND e.training_id = ?
        ORDER BY tr.last_name, tr.first_name
      `, [dateGroup.date, req.params.trainingId]);
      
      attendanceByDate.push({
        date: dateGroup.date,
        present_count: dateGroup.present_count,
        absent_count: dateGroup.absent_count,
        records: records
      });
    }
    
    res.render('attendance/training', { 
      user: req.session, 
      training: training[0], 
      enrollments,
      attendanceByDate,
      currentPage: page,
      totalPages: totalPages
    });
  } catch (error) {
    console.error('Attendance view error:', error);
    res.status(500).send('Error loading attendance');
  }
});

// Mark attendance (single - kept for backward compatibility)
router.post('/mark', async (req, res) => {
  const { enrollmentId, date, status, notes } = req.body;
  
  try {
    if (!requireStaff(req, res)) return;

    await req.db.query(
      'INSERT INTO attendance (enrollment_id, date, status, marked_by, notes) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = ?, marked_by = ?, notes = ?',
      [enrollmentId, date, status, req.session.userId, notes, status, req.session.userId, notes]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Attendance marking error:', error);
    res.status(500).json({ success: false, error: 'Error marking attendance' });
  }
});

// Mark bulk attendance
router.post('/mark-bulk', async (req, res) => {
  const { records, training_id } = req.body;
  
  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, error: 'No attendance data provided' });
  }
  
  try {
    if (!requireStaff(req, res)) return;

    // Use transaction to ensure all records are saved or none
    const connection = await req.db.getConnection();
    await connection.beginTransaction();
    
    try {
      // Get the date, start time, and end time from the first record (all should be the same)
      const firstRecord = records[0];
      const date = firstRecord.date;
      const time = normalizeTimeInput(firstRecord.time);
      const endTime = normalizeTimeInput(firstRecord.end_time);
      const duration = calculateDurationHours(time, endTime);
      if (!time || !endTime || duration === null || duration <= 0) {
        throw new Error('Valid start time and end time are required, and end time must be after start time');
      }
      
      // Extract date only (YYYY-MM-DD format)
      let dateOnly = date;
      if (dateOnly.includes(' ')) {
        dateOnly = dateOnly.split(' ')[0];
      }
      
      // Convert time format if needed (HH:mm to TIME format)
      const timeValue = time;
      
      for (const record of records) {
        const { enrollment_id, status, notes } = record;
        
        await connection.query(
          `INSERT INTO attendance (enrollment_id, date, time, duration, status, marked_by, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
             time = VALUES(time), 
             duration = VALUES(duration), 
             status = VALUES(status), 
             marked_by = VALUES(marked_by), 
             notes = VALUES(notes)`,
          [enrollment_id, dateOnly, timeValue, duration, status, req.session.userId, notes || '']
        );
      }
      
      await connection.commit();
      res.json({ success: true, message: `Attendance marked for ${records.length} trainee(s)` });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Bulk attendance marking error:', error);
    res.status(500).json({ success: false, error: 'Error marking attendance: ' + error.message });
  }
});

// Get list of sessions for a training (for update tab)
router.get('/sessions/:trainingId', async (req, res) => {
  try {
    if (!requireStaff(req, res)) return;

    const [sessions] = await req.db.query(`
      SELECT DISTINCT 
        DATE_FORMAT(a.date, '%Y-%m-%d') as date,
        TIME_FORMAT(a.time, '%H:%i:%s') as time,
        TIME_FORMAT(ADDTIME(a.time, SEC_TO_TIME(ROUND(a.duration * 3600))), '%H:%i:%s') as end_time,
        a.duration,
        CONCAT(DATE_FORMAT(a.date, '%Y-%m-%d'), '_', COALESCE(TIME_FORMAT(a.time, '%H:%i:%s'), '')) as id
      FROM attendance a
      JOIN enrollments e ON a.enrollment_id = e.id
      WHERE e.training_id = ?
      ORDER BY DATE_FORMAT(a.date, '%Y-%m-%d') DESC, TIME_FORMAT(a.time, '%H:%i:%s') DESC
    `, [req.params.trainingId]);
    
    // Format the sessions to ensure consistent date format
    const formattedSessions = sessions.map(session => ({
      ...session,
      date: session.date ? session.date.toString().split('T')[0] : null, // Ensure YYYY-MM-DD format
      time: session.time ? session.time.toString() : null,
      end_time: session.end_time ? session.end_time.toString() : null,
      duration: session.duration ? parseFloat(session.duration) : null
    }));
    
    res.json(formattedSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Error fetching sessions' });
  }
});

// Get session details for a specific date + time
router.get('/session-details/:trainingId', async (req, res) => {
  try {
    if (!requireStaff(req, res)) return;

    const { date, time } = req.query;
    
    if (!date || !time) {
      return res.status(400).json({ error: 'Date and time parameters are required' });
    }

    const normalizedTime = normalizeTimeInput(time);
    if (!normalizedTime) {
      return res.status(400).json({ error: 'Valid time parameter is required' });
    }
    
    const [records] = await req.db.query(`
      SELECT a.*, e.id as enrollment_id,
        tr.first_name, tr.last_name, tr.trainee_id
      FROM attendance a
      JOIN enrollments e ON a.enrollment_id = e.id
      JOIN trainees tr ON e.trainee_id = tr.id
      WHERE e.training_id = ? AND a.date = ? AND TIME_FORMAT(a.time, '%H:%i') = ?
      ORDER BY tr.last_name, tr.first_name
    `, [req.params.trainingId, date, normalizedTime]);
    
    res.json({ records });
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({ error: 'Error fetching session details' });
  }
});

// Update bulk attendance
router.post('/update-bulk', async (req, res) => {
  const { records, training_id, date, original_time } = req.body;
  
  if (!records || !Array.isArray(records) || records.length === 0 || !date || !original_time) {
    return res.status(400).json({ success: false, error: 'Invalid data provided' });
  }
  
  try {
    if (!requireStaff(req, res)) return;

    // Use transaction to ensure all records are updated or none
    const connection = await req.db.getConnection();
    await connection.beginTransaction();
    
    try {
      // Get start/end time from the first record (all should be the same for a session)
      const firstRecord = records[0];
      const time = normalizeTimeInput(firstRecord.time);
      const endTime = normalizeTimeInput(firstRecord.end_time);
      const duration = calculateDurationHours(time, endTime);
      if (!time || !endTime || duration === null || duration <= 0) {
        throw new Error('Valid start time and end time are required, and end time must be after start time');
      }
      
      // Convert time format if needed
      const timeValue = time;
      const originalTimeValue = normalizeTimeInput(original_time);
      if (!originalTimeValue) {
        throw new Error('Original session time is required');
      }
      
      // Log for debugging
      console.log('Update attendance - Time received:', time, 'End time received:', endTime, 'Formatted:', timeValue);
      
      // Extract date only
      let dateOnly = date;
      if (dateOnly.includes('T')) {
        dateOnly = dateOnly.split('T')[0];
      } else if (dateOnly.includes(' ')) {
        dateOnly = dateOnly.split(' ')[0];
      }
      
      // Get all enrollment IDs for this training
      const [enrollments] = await connection.query(
        'SELECT id FROM enrollments WHERE training_id = ?',
        [training_id]
      );
      const enrollmentIds = enrollments.map(e => e.id);
      
      // Delete only the original session being edited
      if (enrollmentIds.length > 0) {
        const placeholders = enrollmentIds.map(() => '?').join(',');
        await connection.query(`
          DELETE FROM attendance 
          WHERE enrollment_id IN (${placeholders}) AND date = ? AND TIME_FORMAT(time, '%H:%i') = ?
        `, [...enrollmentIds, dateOnly, originalTimeValue]);
      }
      
      // Insert updated records using INSERT ... ON DUPLICATE KEY UPDATE
      // This handles the case where records might already exist
      for (const record of records) {
        const { enrollment_id, status, notes } = record;
        
        await connection.query(
          `INSERT INTO attendance (enrollment_id, date, time, duration, status, marked_by, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             time = VALUES(time),
             duration = VALUES(duration),
             status = VALUES(status),
             marked_by = VALUES(marked_by),
             notes = VALUES(notes)`,
          [enrollment_id, dateOnly, timeValue, duration, status, req.session.userId, notes || '']
        );
      }
      
      await connection.commit();
      res.json({ success: true, message: `Attendance updated for ${records.length} trainee(s)` });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Bulk attendance update error:', error);
    res.status(500).json({ success: false, error: 'Error updating attendance: ' + error.message });
  }
});

// View trainee attendance
router.get('/trainee/:enrollmentId', async (req, res) => {
  try {
    const [enrollment] = await req.db.query(`
      SELECT e.*, t.title, tr.first_name, tr.last_name, tr.trainee_id
      FROM enrollments e
      JOIN trainings t ON e.training_id = t.id
      JOIN trainees tr ON e.trainee_id = tr.id
      WHERE e.id = ?
    `, [req.params.enrollmentId]);
    
    if (enrollment.length === 0) {
      return res.status(404).send('Enrollment not found');
    }

    if (req.session.userRole === 'trainee') {
      if (String(enrollment[0].trainee_id) !== String(req.session.userId)) {
        return res.status(403).send('Access denied');
      }
    } else if (!['admin', 'trainer'].includes(req.session.userRole)) {
      return res.status(403).send('Access denied');
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // 10 records per page
    const offset = (page - 1) * limit;
    
    // Get attendance records per session
    const [attendanceRecords] = await req.db.query(`
      SELECT date,
        TIME_FORMAT(time, '%H:%i:%s') as time,
        TIME_FORMAT(ADDTIME(time, SEC_TO_TIME(ROUND(duration * 3600))), '%H:%i:%s') as end_time,
        duration,
        status,
        notes,
        marked_by,
        u.first_name as marked_by_first, u.last_name as marked_by_last
      FROM attendance
      LEFT JOIN users u ON marked_by = u.id
      WHERE enrollment_id = ?
      ORDER BY date DESC, time DESC
      LIMIT ? OFFSET ?
    `, [req.params.enrollmentId, limit, offset]);
    
    // Get total count for pagination
    const [totalCount] = await req.db.query(`
      SELECT COUNT(*) as total
      FROM attendance
      WHERE enrollment_id = ?
    `, [req.params.enrollmentId]);
    
    const totalPages = Math.ceil((totalCount[0]?.total || 0) / limit);
    
    // Format attendance by session
    const attendanceByDate = attendanceRecords.map(record => {
      return {
        date: record.date,
        status: record.status,
        notes: record.notes || '',
        marked_by_first: record.marked_by_first,
        marked_by_last: record.marked_by_last,
        time: record.time,
        end_time: record.end_time,
        duration: record.duration
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

module.exports = router;
