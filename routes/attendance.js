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

function normalizeDateOnlyInput(date) {
  if (!date) return null;
  const value = String(date).trim();
  if (!value) return null;
  if (value.includes('T')) return value.split('T')[0];
  if (value.includes(' ')) return value.split(' ')[0];
  return value;
}

function normalizeTimeForSql(time) {
  const normalized = normalizeTimeInput(time);
  if (!normalized) return null;
  return normalized.length === 5 ? `${normalized}:00` : normalized;
}

function formatEndTime(timeValue, durationValue) {
  const sqlTime = normalizeTimeForSql(timeValue);
  const duration = parseFloat(durationValue);
  if (!sqlTime || !Number.isFinite(duration)) return null;

  const [hours, minutes, seconds] = sqlTime.split(':').map(Number);
  const totalSeconds = (hours * 3600) + (minutes * 60) + (seconds || 0) + Math.round(duration * 3600);
  const wrapped = ((totalSeconds % 86400) + 86400) % 86400;
  const endHours = String(Math.floor(wrapped / 3600)).padStart(2, '0');
  const endMinutes = String(Math.floor((wrapped % 3600) / 60)).padStart(2, '0');
  const endSeconds = String(wrapped % 60).padStart(2, '0');
  return `${endHours}:${endMinutes}:${endSeconds}`;
}

async function getTrainingEnrollmentIdsMap(dbOrConnection, trainingId) {
  const [rows] = await dbOrConnection.query(
    'SELECT id FROM enrollments WHERE training_id = ?',
    [trainingId]
  );
  return new Set(rows.map(row => String(row.id)));
}

// View attendance for a training
router.get('/training/:trainingId', async (req, res) => {
  try {
    if (!requireStaff(req, res)) return;

    const [training] = await req.db.query('SELECT * FROM trainings WHERE id = ?', [req.params.trainingId]);
    
    if (training.length === 0) {
      return res.status(404).send('Training not found');
    }
    
    const [enrollments] = await req.db.query(`
      SELECT e.*, tr.first_name, tr.last_name, tr.email, tr.trainee_id, tr.profile_picture,
        COALESCE(att.present_count, 0) as present_count,
        COALESCE(att.absent_count, 0) as absent_count
      FROM enrollments e
      JOIN trainees tr ON e.trainee_id = tr.id
      LEFT JOIN (
        SELECT enrollment_id,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count
        FROM attendance
        GROUP BY enrollment_id
      ) att ON att.enrollment_id = e.id
      WHERE e.training_id = ?
      ORDER BY tr.last_name, tr.first_name
    `, [req.params.trainingId]);
    
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
    let attendanceByDate = [];
    if (dateGroups.length > 0) {
      const placeholders = dateGroups.map(() => '?').join(',');
      const [records] = await req.db.query(`
        SELECT a.*, tr.first_name, tr.last_name, tr.trainee_id,
          u.first_name as marked_by_first, u.last_name as marked_by_last
        FROM attendance a
        JOIN enrollments e ON a.enrollment_id = e.id
        JOIN trainees tr ON e.trainee_id = tr.id
        LEFT JOIN users u ON a.marked_by = u.id
        WHERE e.training_id = ?
          AND a.date IN (${placeholders})
        ORDER BY a.date DESC, tr.last_name, tr.first_name
      `, [req.params.trainingId, ...dateGroups.map(group => group.date)]);

      const recordsByDate = new Map();
      records.forEach(record => {
        const key = normalizeDateOnlyInput(record.date);
        if (!recordsByDate.has(key)) recordsByDate.set(key, []);
        recordsByDate.get(key).push(record);
      });

      attendanceByDate = dateGroups.map(dateGroup => ({
        date: dateGroup.date,
        present_count: dateGroup.present_count,
        absent_count: dateGroup.absent_count,
        records: recordsByDate.get(normalizeDateOnlyInput(dateGroup.date)) || []
      }));
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

    const dateOnly = normalizeDateOnlyInput(date);
    if (!dateOnly) {
      return res.status(400).json({ success: false, error: 'Valid attendance date is required' });
    }

    const [updateResult] = await req.db.query(
      `UPDATE attendance
       SET status = ?, marked_by = ?, notes = ?
       WHERE enrollment_id = ? AND date = ? AND time IS NULL`,
      [status, req.session.userId, notes || '', enrollmentId, dateOnly]
    );

    if (updateResult.affectedRows === 0) {
      await req.db.query(
        'INSERT INTO attendance (enrollment_id, date, time, status, marked_by, notes) VALUES (?, ?, NULL, ?, ?, ?)',
        [enrollmentId, dateOnly, status, req.session.userId, notes || '']
      );
    }
    
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
      const dateOnly = normalizeDateOnlyInput(date);
      if (!dateOnly) {
        throw new Error('Valid attendance date is required');
      }
      
      // Convert time format if needed (HH:mm to TIME format)
      const timeValue = normalizeTimeForSql(time);
      const validEnrollmentIds = await getTrainingEnrollmentIdsMap(connection, training_id);
      
      for (const record of records) {
        const { enrollment_id, status, notes } = record;
        if (!validEnrollmentIds.has(String(enrollment_id))) {
          throw new Error('Attendance payload contains an enrollment that does not belong to this training');
        }
        
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
        a.date,
        a.time,
        a.duration,
        CONCAT(a.date, '_', COALESCE(a.time, '')) as id
      FROM attendance a
      JOIN enrollments e ON a.enrollment_id = e.id
      WHERE e.training_id = ?
      ORDER BY a.date DESC, a.time DESC
    `, [req.params.trainingId]);
    
    // Format the sessions to ensure consistent date format
    const formattedSessions = sessions.map(session => ({
      ...session,
      date: session.date ? session.date.toString().split('T')[0] : null, // Ensure YYYY-MM-DD format
      time: session.time ? session.time.toString() : null,
      end_time: formatEndTime(session.time, session.duration),
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

    const normalizedTime = normalizeTimeForSql(time);
    if (!normalizedTime) {
      return res.status(400).json({ error: 'Valid time parameter is required' });
    }
    
    const [records] = await req.db.query(`
      SELECT a.*, e.id as enrollment_id,
        tr.first_name, tr.last_name, tr.trainee_id
      FROM attendance a
      JOIN enrollments e ON a.enrollment_id = e.id
      JOIN trainees tr ON e.trainee_id = tr.id
      WHERE e.training_id = ? AND a.date = ? AND a.time = ?
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
      const timeValue = normalizeTimeForSql(time);
      const originalTimeValue = normalizeTimeForSql(original_time);
      if (!originalTimeValue) {
        throw new Error('Original session time is required');
      }
      
      // Log for debugging
      console.log('Update attendance - Time received:', time, 'End time received:', endTime, 'Formatted:', timeValue);
      
      // Extract date only
      const dateOnly = normalizeDateOnlyInput(date);
      if (!dateOnly) {
        throw new Error('Valid attendance date is required');
      }

      const validEnrollmentIds = await getTrainingEnrollmentIdsMap(connection, training_id);
      const enrollmentIds = Array.from(validEnrollmentIds);
      
      // Delete only the original session being edited
      if (enrollmentIds.length > 0) {
        const placeholders = enrollmentIds.map(() => '?').join(',');
        await connection.query(`
          DELETE FROM attendance 
          WHERE enrollment_id IN (${placeholders}) AND date = ? AND time = ?
        `, [...enrollmentIds, dateOnly, originalTimeValue]);
      }
      
      // Insert updated records using INSERT ... ON DUPLICATE KEY UPDATE
      // This handles the case where records might already exist
      for (const record of records) {
        const { enrollment_id, status, notes } = record;
        if (!validEnrollmentIds.has(String(enrollment_id))) {
          throw new Error('Attendance payload contains an enrollment that does not belong to this training');
        }
        
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
