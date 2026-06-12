const express = require('express');
const PDFDocument = require('pdfkit');
const router = express.Router();
const { refreshHealthcareTrainingReminderCycles } = require('../utils/healthcareTrainingReminders');
const { PASSING_SCORE, CERTIFICATE_ENROLMENT_PASSING_SCORE } = require('../utils/testScores');

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDashboardDateRange(query) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const validPresets = new Set([
    'all_time',
    'today',
    'yesterday',
    'last_7_days',
    'last_14_days',
    'last_28_days',
    'last_30_days',
    'this_week',
    'last_week',
    'this_month',
    'last_month',
    'custom'
  ]);
  let preset = String(query.preset || 'this_month');
  if (!validPresets.has(preset)) preset = 'this_month';

  if (preset === 'all_time') {
    return {
      preset,
      startDate: null,
      endDate: null,
      endDateExclusive: null,
      isAllTime: true
    };
  }

  let start = parseDateInput(query.startDate);
  let end = parseDateInput(query.endDate);

  if (!start || !end) {
    switch (preset) {
      case 'today':
        start = new Date(today);
        end = new Date(today);
        break;
      case 'yesterday':
        start = new Date(today);
        start.setDate(start.getDate() - 1);
        end = new Date(start);
        break;
      case 'last_7_days':
        end = new Date(today);
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        break;
      case 'last_14_days':
        end = new Date(today);
        start = new Date(today);
        start.setDate(start.getDate() - 13);
        break;
      case 'last_28_days':
        end = new Date(today);
        start = new Date(today);
        start.setDate(start.getDate() - 27);
        break;
      case 'last_30_days':
        end = new Date(today);
        start = new Date(today);
        start.setDate(start.getDate() - 29);
        break;
      case 'this_week': {
        const day = today.getDay() || 7;
        start = new Date(today);
        start.setDate(start.getDate() - day + 1);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        break;
      }
      case 'last_week': {
        const day = today.getDay() || 7;
        end = new Date(today);
        end.setDate(end.getDate() - day);
        start = new Date(end);
        start.setDate(start.getDate() - 6);
        break;
      }
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'this_month':
      default:
        start = startOfThisMonth;
        end = endOfThisMonth;
        break;
    }
  }

  if (start > end) {
    [start, end] = [end, start];
  }

  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);

  return {
    preset,
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
    endDateExclusive: formatDateInput(endExclusive),
    isAllTime: false
  };
}

function formatDashboardDateLabel(range) {
  if (!range || range.isAllTime) return 'All time';
  if (!range.startDate || !range.endDate) return 'This month';

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  return `${formatter.format(new Date(`${range.startDate}T00:00:00`))} - ${formatter.format(new Date(`${range.endDate}T00:00:00`))}`;
}

function formatDashboardDateTime(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function numberValue(value) {
  return Number(value || 0);
}

async function getTrainerDashboardReportData(db, query) {
  const dashboardDateRange = getDashboardDateRange(query);
  const trainingRangeParams = [dashboardDateRange.startDate, dashboardDateRange.endDateExclusive];
  const trainingDateWhere = dashboardDateRange.isAllTime
    ? ''
    : 'WHERE start_datetime >= ? AND start_datetime < ?';
  const trainingDateWhereWithAlias = dashboardDateRange.isAllTime
    ? ''
    : 'WHERE t.start_datetime >= ? AND t.start_datetime < ?';
  const createdTrainingDateClause = dashboardDateRange.isAllTime
    ? ''
    : 'AND start_datetime >= ? AND start_datetime < ?';
  const assignedTrainingDateWhere = dashboardDateRange.isAllTime
    ? ''
    : 'WHERE t.start_datetime >= ? AND t.start_datetime < ?';
  const trainerTrainingParams = dashboardDateRange.isAllTime
    ? []
    : [...trainingRangeParams, ...trainingRangeParams];

  const [trainingStats] = await db.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled,
      SUM(CASE WHEN status = 'rescheduled' THEN 1 ELSE 0 END) as rescheduled
    FROM trainings
    ${trainingDateWhere}
  `, dashboardDateRange.isAllTime ? [] : trainingRangeParams);

  const trainingStatsRow = trainingStats[0] || { total: 0, in_progress: 0, completed: 0, canceled: 0, rescheduled: 0 };
  const totalTrainings = numberValue(trainingStatsRow.total);
  const completedTrainings = numberValue(trainingStatsRow.completed);
  const courseCompletionRate = totalTrainings > 0
    ? Math.round((completedTrainings / totalTrainings) * 100)
    : 0;

  const [assessmentStatsRows] = await db.query(`
    SELECT
      COUNT(*) as total_attempts,
      SUM(
        CASE
          WHEN ta.score >= CASE
            WHEN ta.test_type = 'certificate_enrolment' THEN ?
            ELSE ?
          END
          THEN 1
          ELSE 0
        END
      ) as passed_attempts
    FROM test_attempts ta
    JOIN enrollments e ON e.id = ta.enrollment_id
    JOIN trainings t ON t.id = e.training_id
    WHERE ta.status = 'completed'
      ${dashboardDateRange.isAllTime ? '' : 'AND t.start_datetime >= ? AND t.start_datetime < ?'}
  `, dashboardDateRange.isAllTime
    ? [CERTIFICATE_ENROLMENT_PASSING_SCORE, PASSING_SCORE]
    : [CERTIFICATE_ENROLMENT_PASSING_SCORE, PASSING_SCORE, ...trainingRangeParams]);

  const assessmentStats = assessmentStatsRows[0] || { total_attempts: 0, passed_attempts: 0 };
  const totalAssessmentAttempts = numberValue(assessmentStats.total_attempts);
  const passedAssessmentAttempts = numberValue(assessmentStats.passed_attempts);
  const assessmentPassRate = totalAssessmentAttempts > 0
    ? Math.round((passedAssessmentAttempts / totalAssessmentAttempts) * 100)
    : 0;

  const [recentTrainings] = await db.query(`
    SELECT
      t.id,
      t.title,
      t.type,
      t.start_datetime,
      t.end_datetime,
      t.status,
      GROUP_CONCAT(DISTINCT h.name ORDER BY h.name SEPARATOR ', ') as healthcare_centres
    FROM trainings t
    LEFT JOIN training_healthcare th ON t.id = th.training_id
    LEFT JOIN healthcare h ON th.healthcare_id = h.id
    ${trainingDateWhereWithAlias}
    GROUP BY t.id, t.title, t.type, t.start_datetime, t.end_datetime, t.status
    ORDER BY t.created_at DESC
    LIMIT 10
  `, dashboardDateRange.isAllTime ? [] : trainingRangeParams);

  const [topClientTrainings] = await db.query(`
    SELECT
      h.name,
      COUNT(DISTINCT t.id) as training_count
    FROM healthcare h
    JOIN training_healthcare th ON th.healthcare_id = h.id
    JOIN trainings t ON t.id = th.training_id
    ${trainingDateWhereWithAlias}
    GROUP BY h.id, h.name
    HAVING training_count > 0
    ORDER BY training_count DESC, h.name ASC
    LIMIT 10
  `, dashboardDateRange.isAllTime ? [] : trainingRangeParams);

  const [traineeStatsRows] = await db.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN trainee_status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN trainee_status = 'inactive' THEN 1 ELSE 0 END) as inactive,
      SUM(CASE WHEN trainee_status = 'suspended' THEN 1 ELSE 0 END) as suspended,
      SUM(CASE WHEN trainee_status = 'registered' THEN 1 ELSE 0 END) as registered
    FROM trainees
  `);

  const [trainers] = await db.query(`
    SELECT
      u.first_name,
      u.last_name,
      u.role,
      COALESCE(tt.completed_trainings, 0) as completed_trainings,
      COALESCE(tt.in_progress_trainings, 0) as in_progress_trainings,
      COALESCE(tt.taught_hours, 0) as taught_hours
    FROM users u
    LEFT JOIN (
      SELECT trainer_id,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_trainings,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_trainings,
        SUM(
          CASE
            WHEN start_datetime IS NOT NULL
              AND end_datetime IS NOT NULL
              AND end_datetime > start_datetime
            THEN TIMESTAMPDIFF(MINUTE, start_datetime, end_datetime) / 60
            ELSE 0
          END
        ) as taught_hours
      FROM (
        SELECT created_by as trainer_id, id, status, start_datetime, end_datetime
        FROM trainings
        WHERE created_by IS NOT NULL
          ${createdTrainingDateClause}
        UNION DISTINCT
        SELECT tt.trainer_id, t.id, t.status, t.start_datetime, t.end_datetime
        FROM training_trainers tt
        JOIN trainings t ON t.id = tt.training_id
        ${assignedTrainingDateWhere}
      ) trainer_trainings
      GROUP BY trainer_id
    ) tt ON tt.trainer_id = u.id
    WHERE u.role IN ('admin', 'trainer')
    ORDER BY completed_trainings DESC, in_progress_trainings DESC, u.last_name, u.first_name
    LIMIT 10
  `, trainerTrainingParams);

  const [recentRegistrations] = await db.query(`
    SELECT
      t.first_name,
      t.last_name,
      t.trainee_id,
      h.name AS healthcare,
      t.email
    FROM trainees t
    LEFT JOIN healthcare h ON h.id = t.healthcare_id
    WHERE t.trainee_status = 'registered'
    ORDER BY t.created_at DESC
    LIMIT 10
  `);

  return {
    dashboardDateRange,
    dateRangeLabel: formatDashboardDateLabel(dashboardDateRange),
    trainingStats: {
      ...trainingStatsRow,
      course_completion_rate: courseCompletionRate,
      assessment_pass_rate: assessmentPassRate
    },
    assessmentStats,
    traineeStats: traineeStatsRows[0] || { total: 0, active: 0, inactive: 0, suspended: 0, registered: 0 },
    recentTrainings,
    topClientTrainings,
    trainers,
    recentRegistrations
  };
}

function drawDashboardPdf(doc, report, user) {
  const margin = 42;
  const pageWidth = doc.page.width;
  const usableWidth = pageWidth - margin * 2;
  const purple = '#573FD7';
  const navy = '#11358B';
  const text = '#202124';
  const muted = '#5F6368';
  const border = '#E1E6EF';

  const ensureSpace = height => {
    if (doc.y + height > doc.page.height - 48) {
      doc.addPage();
      doc.y = margin;
    }
  };

  const sectionTitle = title => {
    ensureSpace(36);
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(text).text(title, margin, doc.y);
    doc.moveTo(margin, doc.y + 5).lineTo(pageWidth - margin, doc.y + 5).strokeColor(border).lineWidth(1).stroke();
    doc.moveDown(0.9);
  };

  const truncate = (value, length = 42) => {
    const clean = String(value || '-').replace(/\s+/g, ' ').trim();
    return clean.length > length ? `${clean.slice(0, length - 3)}...` : clean;
  };

  const metricCard = (x, y, width, label, value) => {
    doc.roundedRect(x, y, width, 64, 8).fillAndStroke('#F8FAFC', border);
    doc.font('Helvetica-Bold').fontSize(18).fillColor(purple).text(String(value), x + 12, y + 13, {
      width: width - 24,
      align: 'left'
    });
    doc.font('Helvetica').fontSize(7.8).fillColor(muted).text(String(label).toUpperCase(), x + 12, y + 39, {
      width: width - 24,
      align: 'left'
    });
  };

  const drawRows = (columns, rows, options = {}) => {
    const rowHeight = options.rowHeight || 28;
    const headerHeight = 24;
    ensureSpace(headerHeight + Math.min(rows.length, 4) * rowHeight + 12);

    const startX = margin;
    let y = doc.y;
    doc.roundedRect(startX, y, usableWidth, headerHeight, 6).fill(navy);
    let x = startX;
    columns.forEach(column => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF').text(column.label, x + 8, y + 8, {
        width: column.width - 16,
        ellipsis: true
      });
      x += column.width;
    });
    y += headerHeight;
    doc.y = y;

    if (!rows.length) {
      doc.rect(startX, y, usableWidth, rowHeight).fillAndStroke('#FFFFFF', border);
      doc.font('Helvetica').fontSize(8.5).fillColor(muted).text('No records found.', startX + 8, y + 9, {
        width: usableWidth - 16
      });
      doc.y = y + rowHeight;
      return;
    }

    rows.forEach((row, index) => {
      ensureSpace(rowHeight + 6);
      y = doc.y;
      doc.rect(startX, y, usableWidth, rowHeight).fillAndStroke(index % 2 === 0 ? '#FFFFFF' : '#F8FAFC', border);
      x = startX;
      columns.forEach(column => {
        const raw = typeof column.value === 'function' ? column.value(row) : row[column.value];
        doc.font('Helvetica').fontSize(8.2).fillColor(text).text(truncate(raw, column.truncate || 42), x + 8, y + 9, {
          width: column.width - 16,
          ellipsis: true
        });
        x += column.width;
      });
      doc.y = y + rowHeight;
    });
  };

  doc.rect(0, 0, pageWidth, 118).fill(navy);
  doc.rect(0, 0, pageWidth, 118).fillOpacity(0.22).fill(purple).fillOpacity(1);
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#FFFFFF').text('Dashboard Report', margin, 34);
  doc.font('Helvetica').fontSize(10).fillColor('#E8EAFF').text(`Date range: ${report.dateRangeLabel}`, margin, 64);
  doc.text(`Prepared for: ${user.userName || 'User'}`, margin, 82);
  doc.fontSize(9).text(`Generated: ${formatDashboardDateTime(new Date())}`, pageWidth - margin - 190, 82, {
    width: 190,
    align: 'right'
  });
  doc.y = 142;

  sectionTitle('Executive Summary');
  const cardGap = 10;
  const cardWidth = (usableWidth - cardGap * 3) / 4;
  const stats = report.trainingStats;
  const traineeStats = report.traineeStats;
  const metrics = [
    ['Total Trainings', numberValue(stats.total)],
    ['Completed', numberValue(stats.completed)],
    ['Course Completion Rate', `${numberValue(stats.course_completion_rate)}%`],
    ['Assessment Pass Rate', `${numberValue(stats.assessment_pass_rate)}%`],
    ['In Progress', numberValue(stats.in_progress)],
    ['Rescheduled', numberValue(stats.rescheduled)],
    ['Registered Trainees', numberValue(traineeStats.registered)],
    ['Active Trainees', numberValue(traineeStats.active)]
  ];

  let x = margin;
  let y = doc.y;
  metrics.slice(0, 4).forEach(([label, value]) => {
    metricCard(x, y, cardWidth, label, value);
    x += cardWidth + cardGap;
  });
  x = margin;
  y += 76;
  metrics.slice(4).forEach(([label, value]) => {
    metricCard(x, y, cardWidth, label, value);
    x += cardWidth + cardGap;
  });
  doc.y = y + 78;

  sectionTitle('Training Status Breakdown');
  const total = Math.max(numberValue(stats.total), 1);
  [
    ['In Progress', numberValue(stats.in_progress), '#1976D2'],
    ['Completed', numberValue(stats.completed), '#388E3C'],
    ['Canceled', numberValue(stats.canceled), '#D32F2F'],
    ['Rescheduled', numberValue(stats.rescheduled), '#F57C00']
  ].forEach(([label, count, color]) => {
    ensureSpace(22);
    const pct = Math.round((count / total) * 100);
    const barX = margin + 112;
    const barY = doc.y + 3;
    doc.font('Helvetica').fontSize(9).fillColor(text).text(label, margin, doc.y, { width: 100 });
    doc.roundedRect(barX, barY, usableWidth - 178, 8, 4).fill('#EDF1F7');
    doc.roundedRect(barX, barY, Math.max(2, (usableWidth - 178) * pct / 100), 8, 4).fill(color);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(text).text(`${count} (${pct}%)`, pageWidth - margin - 58, doc.y - 1, {
      width: 58,
      align: 'right'
    });
    doc.moveDown(0.75);
  });

  sectionTitle('Top Clients by Trainings');
  const maxClientCount = Math.max(...(report.topClientTrainings || []).map(row => numberValue(row.training_count)), 1);
  if (!report.topClientTrainings.length) {
    doc.font('Helvetica').fontSize(9).fillColor(muted).text('No client training data found for this date range.', margin, doc.y);
  } else {
    report.topClientTrainings.forEach(client => {
      ensureSpace(24);
      const count = numberValue(client.training_count);
      const barX = margin + 172;
      const barY = doc.y + 3;
      doc.font('Helvetica').fontSize(8.5).fillColor(text).text(truncate(client.name, 28), margin, doc.y, { width: 160 });
      doc.roundedRect(barX, barY, usableWidth - 220, 8, 4).fill('#EDF1F7');
      doc.roundedRect(barX, barY, Math.max(3, (usableWidth - 220) * count / maxClientCount), 8, 4).fill(purple);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(text).text(String(count), pageWidth - margin - 36, doc.y - 1, {
        width: 36,
        align: 'right'
      });
      doc.moveDown(0.65);
    });
  }

  sectionTitle('Recent Trainings');
  drawRows([
    { label: 'Training', width: 176, value: row => row.title, truncate: 34 },
    { label: 'Client', width: 150, value: row => row.healthcare_centres || '-', truncate: 28 },
    { label: 'Start', width: 116, value: row => formatDashboardDateTime(row.start_datetime), truncate: 22 },
    { label: 'Status', width: usableWidth - 442, value: row => String(row.status || '-').replace(/_/g, ' ') }
  ], report.recentTrainings || []);

  doc.addPage();
  doc.y = margin;
  sectionTitle('Trainer Activity');
  drawRows([
    { label: 'Trainer', width: 188, value: row => `${row.first_name} ${row.last_name}`, truncate: 34 },
    { label: 'Role', width: 84, value: row => row.role },
    { label: 'Completed', width: 90, value: row => numberValue(row.completed_trainings) },
    { label: 'In Progress', width: 90, value: row => numberValue(row.in_progress_trainings) },
    { label: 'Hours', width: usableWidth - 452, value: row => numberValue(row.taught_hours).toFixed(1) }
  ], report.trainers || []);

  sectionTitle('Recent Registrations');
  drawRows([
    { label: 'Trainee', width: 158, value: row => `${row.first_name} ${row.last_name}`, truncate: 28 },
    { label: 'ID', width: 92, value: row => row.trainee_id || '-' },
    { label: 'Healthcare', width: 170, value: row => row.healthcare || '-', truncate: 30 },
    { label: 'Email', width: usableWidth - 420, value: row => row.email || '-', truncate: 34 }
  ], report.recentRegistrations || []);

  const pageRange = doc.bufferedPageRange();
  for (let i = pageRange.start; i < pageRange.start + pageRange.count; i += 1) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor('#7A8290').text(
      `Quick Stop Solution LMS - Page ${i + 1} of ${pageRange.count}`,
      margin,
      doc.page.height - 76,
      { width: usableWidth, align: 'center', lineBreak: false }
    );
  }
}

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
      const dashboardDateRange = getDashboardDateRange(req.query);
      const trainingRangeParams = [dashboardDateRange.startDate, dashboardDateRange.endDateExclusive];
      const trainingDateWhere = dashboardDateRange.isAllTime
        ? ''
        : 'WHERE start_datetime >= ? AND start_datetime < ?';
      const trainingDateWhereWithAlias = dashboardDateRange.isAllTime
        ? ''
        : 'WHERE t.start_datetime >= ? AND t.start_datetime < ?';
      const createdTrainingDateClause = dashboardDateRange.isAllTime
        ? ''
        : 'AND start_datetime >= ? AND start_datetime < ?';
      const assignedTrainingDateWhere = dashboardDateRange.isAllTime
        ? ''
        : 'WHERE t.start_datetime >= ? AND t.start_datetime < ?';
      const trainerTrainingParams = dashboardDateRange.isAllTime
        ? []
        : [...trainingRangeParams, ...trainingRangeParams];

      // Get training statistics
      const [trainingStats] = await req.db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled,
          SUM(CASE WHEN status = 'rescheduled' THEN 1 ELSE 0 END) as rescheduled
        FROM trainings
        ${trainingDateWhere}
      `, dashboardDateRange.isAllTime ? [] : trainingRangeParams);

      const trainingStatsRow = trainingStats[0] || { total: 0, in_progress: 0, completed: 0, canceled: 0, rescheduled: 0 };
      const totalTrainings = Number(trainingStatsRow.total || 0);
      const completedTrainings = Number(trainingStatsRow.completed || 0);
      const courseCompletionRate = totalTrainings > 0
        ? Math.round((completedTrainings / totalTrainings) * 100)
        : 0;

      const [assessmentStatsRows] = await req.db.query(`
        SELECT
          COUNT(*) as total_attempts,
          SUM(
            CASE
              WHEN ta.score >= CASE
                WHEN ta.test_type = 'certificate_enrolment' THEN ?
                ELSE ?
              END
              THEN 1
              ELSE 0
            END
          ) as passed_attempts
        FROM test_attempts ta
        JOIN enrollments e ON e.id = ta.enrollment_id
        JOIN trainings t ON t.id = e.training_id
        WHERE ta.status = 'completed'
          ${dashboardDateRange.isAllTime ? '' : 'AND t.start_datetime >= ? AND t.start_datetime < ?'}
      `, dashboardDateRange.isAllTime
        ? [CERTIFICATE_ENROLMENT_PASSING_SCORE, PASSING_SCORE]
        : [CERTIFICATE_ENROLMENT_PASSING_SCORE, PASSING_SCORE, ...trainingRangeParams]);

      const assessmentStats = assessmentStatsRows[0] || { total_attempts: 0, passed_attempts: 0 };
      const totalAssessmentAttempts = Number(assessmentStats.total_attempts || 0);
      const passedAssessmentAttempts = Number(assessmentStats.passed_attempts || 0);
      const assessmentPassRate = totalAssessmentAttempts > 0
        ? Math.round((passedAssessmentAttempts / totalAssessmentAttempts) * 100)
        : 0;
      
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
        ${trainingDateWhereWithAlias}
        GROUP BY t.id, t.title, t.type, t.start_datetime, t.end_datetime, t.status
        ORDER BY t.created_at DESC
        LIMIT 10
      `, dashboardDateRange.isAllTime ? [] : trainingRangeParams);

      // Top clients by distinct trainings in the selected dashboard range
      const [topClientTrainingRows] = await req.db.query(`
        SELECT
          h.id,
          h.name,
          COUNT(DISTINCT t.id) as training_count
        FROM healthcare h
        JOIN training_healthcare th ON th.healthcare_id = h.id
        JOIN trainings t ON t.id = th.training_id
        ${trainingDateWhereWithAlias}
        GROUP BY h.id, h.name
        HAVING training_count > 0
        ORDER BY training_count DESC, h.name ASC
        LIMIT 20
      `, dashboardDateRange.isAllTime ? [] : trainingRangeParams);
      
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
          COALESCE(tt.in_progress_trainings, 0) as in_progress_trainings,
          COALESCE(tt.taught_hours, 0) as taught_hours
        FROM users u
        LEFT JOIN (
          SELECT trainer_id,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_trainings,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_trainings,
            SUM(
              CASE
                WHEN start_datetime IS NOT NULL
                  AND end_datetime IS NOT NULL
                  AND end_datetime > start_datetime
                THEN TIMESTAMPDIFF(MINUTE, start_datetime, end_datetime) / 60
                ELSE 0
              END
            ) as taught_hours
          FROM (
            SELECT created_by as trainer_id, id, status, start_datetime, end_datetime
            FROM trainings
            WHERE created_by IS NOT NULL
              ${createdTrainingDateClause}
            UNION DISTINCT
            SELECT tt.trainer_id, t.id, t.status, t.start_datetime, t.end_datetime
            FROM training_trainers tt
            JOIN trainings t ON t.id = tt.training_id
            ${assignedTrainingDateWhere}
          ) trainer_trainings
          GROUP BY trainer_id
        ) tt ON tt.trainer_id = u.id
        WHERE u.role IN ('admin', 'trainer')
        ORDER BY u.last_name, u.first_name
      `, trainerTrainingParams);
      
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
        trainingStats: {
          ...trainingStatsRow,
          course_completion_rate: courseCompletionRate,
          assessment_pass_rate: assessmentPassRate
        },
        recentTrainings,
        traineeStats: traineeStats[0] || { total: 0, active: 0, inactive: 0, suspended: 0, registered: 0 },
        trainers,
        recentRegistrations,
        isAdmin: role === 'admin',
        recertificationsByHospital,
        healthcareTrainingReminders: healthcareReminderRows || [],
        topClientTrainings: topClientTrainingRows || [],
        dashboardDateRange
      });
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

router.get('/pdf', async (req, res) => {
  try {
    const role = req.session.userRole;
    if (!['admin', 'trainer'].includes(role)) {
      return res.status(403).send('Access denied');
    }

    const report = await getTrainerDashboardReportData(req.db, req.query);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 42,
      bufferPages: true,
      info: {
        Title: 'Dashboard Report',
        Author: 'Quick Stop Solution LMS'
      }
    });

    const filenameDate = report.dashboardDateRange.isAllTime
      ? 'all-time'
      : `${report.dashboardDateRange.startDate}_to_${report.dashboardDateRange.endDate}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Dashboard Report ${filenameDate}.pdf"`);

    doc.pipe(res);
    drawDashboardPdf(doc, report, req.session);
    doc.end();
  } catch (error) {
    console.error('Dashboard PDF error:', error);
    if (!res.headersSent) {
      res.status(500).send('Error generating dashboard PDF');
    } else {
      res.end();
    }
  }
});

module.exports = router;
