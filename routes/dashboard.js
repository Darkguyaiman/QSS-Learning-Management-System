const express = require('express');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
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

function formatDashboardLabel(value) {
  return String(value || '-')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase());
}

function formatTrainerList(value) {
  const names = String(value || '')
    .split('||')
    .map(name => name.trim())
    .filter(Boolean);

  if (!names.length) return '-';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function getTrainingDurationValues(training) {
  if (!training.start_datetime || !training.end_datetime) {
    return { totalHours: '', durationLabel: '' };
  }

  const start = new Date(training.start_datetime);
  const end = new Date(training.end_datetime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { totalHours: '', durationLabel: '' };
  }

  const durationMs = end.getTime() - start.getTime();
  const totalHours = Math.round((durationMs / (60 * 60 * 1000)) * 100) / 100;
  const isSameDay = start.getFullYear() === end.getFullYear()
    && start.getMonth() === end.getMonth()
    && start.getDate() === end.getDate();

  if (isSameDay) {
    return { totalHours, durationLabel: '1 day 0 hours 0 minutes' };
  }

  const totalDays = durationMs / (24 * 60 * 60 * 1000);
  const days = Math.floor(totalDays);
  const hours = Math.floor((totalDays % 1) * 24);
  const minutes = Math.round((((totalDays * 24) % 1) * 60));
  return {
    totalHours,
    durationLabel: `${days} day ${hours} hours ${minutes} minutes`
  };
}

function getTrainingTotalHoursCell(training, worksheetRow) {
  const values = getTrainingDurationValues(training);
  return {
    formula: `IF(OR(D${worksheetRow}="",E${worksheetRow}=""),"",ROUND((E${worksheetRow}-D${worksheetRow})*24,2))`,
    result: values.totalHours
  };
}

function getTrainingDurationCell(training, worksheetRow) {
  const values = getTrainingDurationValues(training);
  return {
    formula: `IF(OR(D${worksheetRow}="",E${worksheetRow}=""),"",IF(INT(D${worksheetRow})=INT(E${worksheetRow}),"1 day 0 hours 0 minutes",INT(E${worksheetRow}-D${worksheetRow})&" day "&INT(MOD(E${worksheetRow}-D${worksheetRow},1)*24)&" hours "&ROUND(MOD((E${worksheetRow}-D${worksheetRow})*24,1)*60,0)&" minutes"))`,
    result: values.durationLabel
  };
}

function parseDashboardEntityFilter(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getDashboardEntityFilters(query) {
  return {
    healthcareId: parseDashboardEntityFilter(query.healthcare),
    moduleId: parseDashboardEntityFilter(query.module)
  };
}

function buildTrainingFilterClause({ dashboardDateRange, filters, alias = '', leadingKeyword = 'WHERE' }) {
  const prefix = alias ? `${alias}.` : '';
  const trainingIdExpression = alias ? `${alias}.id` : 'id';
  const clauses = [];
  const params = [];

  if (!dashboardDateRange.isAllTime) {
    clauses.push(`${prefix}start_datetime >= ?`, `${prefix}start_datetime < ?`);
    params.push(dashboardDateRange.startDate, dashboardDateRange.endDateExclusive);
  }

  if (filters.moduleId) {
    clauses.push(`${prefix}module_id = ?`);
    params.push(filters.moduleId);
  }

  if (filters.healthcareId) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM training_healthcare th_filter
        WHERE th_filter.training_id = ${trainingIdExpression}
          AND th_filter.healthcare_id = ?
      )`
    );
    params.push(filters.healthcareId);
  }

  return {
    clause: clauses.length ? `${leadingKeyword} ${clauses.join(' AND ')}` : '',
    params
  };
}

async function getTrainerDashboardReportData(db, query) {
  const dashboardDateRange = getDashboardDateRange(query);
  const activeFilters = getDashboardEntityFilters(query);
  const trainingDateWhere = buildTrainingFilterClause({ dashboardDateRange, filters: activeFilters });
  const trainingDateWhereWithAlias = buildTrainingFilterClause({ dashboardDateRange, filters: activeFilters, alias: 't' });
  const createdTrainingDateClause = buildTrainingFilterClause({ dashboardDateRange, filters: activeFilters, leadingKeyword: 'AND' });
  const assignedTrainingDateWhere = buildTrainingFilterClause({ dashboardDateRange, filters: activeFilters, alias: 't' });
  const trainerTrainingParams = [...createdTrainingDateClause.params, ...assignedTrainingDateWhere.params];

  const [trainingStats] = await db.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled,
      SUM(CASE WHEN status = 'rescheduled' THEN 1 ELSE 0 END) as rescheduled
    FROM trainings
    ${trainingDateWhere.clause}
  `, trainingDateWhere.params);

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
      ${trainingDateWhereWithAlias.clause ? trainingDateWhereWithAlias.clause.replace(/^WHERE\s+/i, 'AND ') : ''}
  `, [CERTIFICATE_ENROLMENT_PASSING_SCORE, PASSING_SCORE, ...trainingDateWhereWithAlias.params]);

  const assessmentStats = assessmentStatsRows[0] || { total_attempts: 0, passed_attempts: 0 };
  const totalAssessmentAttempts = numberValue(assessmentStats.total_attempts);
  const passedAssessmentAttempts = numberValue(assessmentStats.passed_attempts);
  const assessmentPassRate = totalAssessmentAttempts > 0
    ? Math.round((passedAssessmentAttempts / totalAssessmentAttempts) * 100)
    : 0;

  const [allTrainings] = await db.query(`
    SELECT
      t.id,
      t.title,
      t.type,
      t.start_datetime,
      t.end_datetime,
      t.status,
      GROUP_CONCAT(DISTINCT h.name ORDER BY h.name SEPARATOR ', ') as healthcare_centres,
      (
        SELECT GROUP_CONCAT(
          DISTINCT TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))
          ORDER BY u.last_name, u.first_name
          SEPARATOR '||'
        )
        FROM training_trainers tt
        JOIN users u ON u.id = tt.trainer_id
        WHERE tt.training_id = t.id
      ) as trainer_names,
      (
        SELECT COUNT(DISTINCT e.trainee_id)
        FROM enrollments e
        WHERE e.training_id = t.id
      ) as participant_count
    FROM trainings t
    LEFT JOIN training_healthcare th ON t.id = th.training_id
    LEFT JOIN healthcare h ON th.healthcare_id = h.id
    ${trainingDateWhereWithAlias.clause}
    GROUP BY t.id, t.title, t.type, t.start_datetime, t.end_datetime, t.status
    ORDER BY t.start_datetime DESC, t.id DESC
  `, trainingDateWhereWithAlias.params);

  const [topClientTrainings] = await db.query(`
    SELECT
      h.name,
      COUNT(DISTINCT t.id) as training_count
    FROM healthcare h
    JOIN training_healthcare th ON th.healthcare_id = h.id
    JOIN trainings t ON t.id = th.training_id
    ${trainingDateWhereWithAlias.clause}
    GROUP BY h.id, h.name
    HAVING training_count > 0
    ORDER BY training_count DESC, h.name ASC
    LIMIT 10
  `, trainingDateWhereWithAlias.params);

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
          ${createdTrainingDateClause.clause}
        UNION DISTINCT
        SELECT tt.trainer_id, t.id, t.status, t.start_datetime, t.end_datetime
        FROM training_trainers tt
        JOIN trainings t ON t.id = tt.training_id
        ${assignedTrainingDateWhere.clause}
      ) trainer_trainings
      GROUP BY trainer_id
    ) tt ON tt.trainer_id = u.id
    WHERE u.role IN ('admin', 'trainer')
    ORDER BY completed_trainings DESC, in_progress_trainings DESC, u.last_name, u.first_name
    LIMIT 10
  `, trainerTrainingParams);

  return {
    dashboardDateRange,
    activeFilters,
    dateRangeLabel: formatDashboardDateLabel(dashboardDateRange),
    trainingStats: {
      ...trainingStatsRow,
      course_completion_rate: courseCompletionRate,
      assessment_pass_rate: assessmentPassRate
    },
    assessmentStats,
    traineeStats: traineeStatsRows[0] || { total: 0, active: 0, inactive: 0, suspended: 0, registered: 0 },
    allTrainings,
    topClientTrainings,
    trainers
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
    const drawHeader = () => {
      const headerY = doc.y;
      doc.roundedRect(startX, headerY, usableWidth, headerHeight, 6).fill(navy);
      let headerX = startX;
      columns.forEach(column => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF').text(column.label, headerX + 8, headerY + 8, {
          width: column.width - 16,
          ellipsis: true
        });
        headerX += column.width;
      });
      doc.y = headerY + headerHeight;
    };

    drawHeader();

    if (!rows.length) {
      const y = doc.y;
      doc.rect(startX, y, usableWidth, rowHeight).fillAndStroke('#FFFFFF', border);
      doc.font('Helvetica').fontSize(8.5).fillColor(muted).text('No records found.', startX + 8, y + 9, {
        width: usableWidth - 16
      });
      doc.y = y + rowHeight;
      return;
    }

    rows.forEach((row, index) => {
      if (doc.y + rowHeight > doc.page.height - 48) {
        doc.addPage();
        doc.y = margin;
        drawHeader();
      }
      const y = doc.y;
      doc.rect(startX, y, usableWidth, rowHeight).fillAndStroke(index % 2 === 0 ? '#FFFFFF' : '#F8FAFC', border);
      let x = startX;
      columns.forEach(column => {
        const raw = typeof column.value === 'function' ? column.value(row) : row[column.value];
        doc.font('Helvetica').fontSize(8.2).fillColor(text).text(truncate(raw, column.truncate || 42), x + 8, y + 9, {
          width: column.width - 16,
          height: rowHeight - 10,
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

  sectionTitle('Trainings During Period');
  drawRows([
    { label: 'Training', width: 105, value: row => row.title, truncate: 32 },
    { label: 'Client', width: 80, value: row => row.healthcare_centres || '-', truncate: 24 },
    { label: 'Trainers', width: 100, value: row => formatTrainerList(row.trainer_names), truncate: 55 },
    { label: 'Start', width: 86, value: row => formatDashboardDateTime(row.start_datetime), truncate: 16 },
    { label: 'Participants', width: 72, value: row => numberValue(row.participant_count) },
    { label: 'Status', width: usableWidth - 443, value: row => formatDashboardLabel(row.status) }
  ], report.allTrainings || [], { rowHeight: 38 });

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

function styleDashboardWorksheet(worksheet, columnWidths) {
  worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
  };
  columnWidths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width || 18;
  });
}

function addDashboardDataSheet(workbook, name, columns, rows) {
  const worksheet = workbook.addWorksheet(name, {
    properties: { defaultRowHeight: 20 }
  });
  styleDashboardWorksheet(worksheet, columns.map(column => column.width));

  const headerRow = worksheet.addRow(columns.map(column => column.header));
  headerRow.height = 28;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF11358B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF8EA3D4' } } };
  });

  rows.forEach((sourceRow, rowIndex) => {
    const worksheetRow = rowIndex + 2;
    const row = worksheet.addRow(columns.map(column => {
      const value = typeof column.value === 'function'
        ? column.value(sourceRow, worksheetRow)
        : sourceRow[column.value];
      return value ?? '';
    }));
    row.height = 23;
    row.eachCell((cell, columnIndex) => {
      cell.font = { name: 'Arial', size: 9, color: { argb: 'FF202124' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: columns[columnIndex - 1].align || 'left',
        wrapText: true
      };
      if (rowIndex % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FB' } };
      }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE2EC' } } };
    });
  });

  columns.forEach((column, index) => {
    if (column.numFmt) worksheet.getColumn(index + 1).numFmt = column.numFmt;
  });

  if (!rows.length) {
    const emptyRow = worksheet.addRow(['No records found for the selected period.']);
    emptyRow.height = 28;
    emptyRow.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF5F6368' } };
    emptyRow.getCell(1).alignment = { vertical: 'middle' };
  } else {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: columns.length }
    };
  }

  worksheet.headerFooter.oddFooter = 'Quick Stop Solution LMS  |  Page &P of &N';
  worksheet.pageSetup.printTitlesRow = '1:1';
  return worksheet;
}

function buildDashboardExcelWorkbook(report, user) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Quick Stop Solution LMS';
  workbook.lastModifiedBy = user.userName || 'Quick Stop Solution LMS';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = `Dashboard report for ${report.dateRangeLabel}`;
  workbook.title = 'Dashboard Report';
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.calcProperties.forceFullCalc = true;
  workbook.calcProperties.calcMode = 'auto';

  const summary = workbook.addWorksheet('Summary', {
    properties: { defaultRowHeight: 21 },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  summary.views = [{ showGridLines: false }];
  summary.columns = [
    { width: 30 },
    { width: 22 },
    { width: 5 },
    { width: 30 },
    { width: 22 }
  ];
  summary.mergeCells('A1:E2');
  summary.getCell('A1').value = 'Dashboard Report';
  summary.getCell('A1').font = { name: 'Arial', bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
  summary.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF11358B' } };
  summary.getRow(1).height = 28;
  summary.getRow(2).height = 18;

  const metadata = [
    ['Date range', report.dateRangeLabel],
    ['Prepared for', user.userName || 'User'],
    ['Generated', new Date()]
  ];
  summary.mergeCells('B4:E4');
  summary.mergeCells('B5:E5');
  summary.mergeCells('B6:E6');
  metadata.forEach((entry, index) => {
    const row = 4 + index;
    summary.getCell(row, 1).value = entry[0];
    summary.getCell(row, 1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF5F6368' } };
    summary.getCell(row, 2).value = entry[1];
    summary.getCell(row, 2).font = { name: 'Arial', size: 10, color: { argb: 'FF202124' } };
    summary.getCell(row, 2).alignment = { vertical: 'middle', horizontal: 'left' };
  });
  summary.getCell('B6').numFmt = 'mmm d, yyyy h:mm AM/PM';

  const stats = report.trainingStats;
  const traineeStats = report.traineeStats;
  const metrics = [
    ['Total Trainings', numberValue(stats.total)],
    ['Completed', numberValue(stats.completed)],
    ['Course Completion Rate', numberValue(stats.course_completion_rate) / 100],
    ['Assessment Pass Rate', numberValue(stats.assessment_pass_rate) / 100],
    ['In Progress', numberValue(stats.in_progress)],
    ['Canceled', numberValue(stats.canceled)],
    ['Rescheduled', numberValue(stats.rescheduled)],
    ['Registered Trainees', numberValue(traineeStats.registered)],
    ['Active Trainees', numberValue(traineeStats.active)],
    ['Inactive Trainees', numberValue(traineeStats.inactive)]
  ];

  summary.mergeCells('A8:E8');
  summary.getCell('A8').value = 'Executive Summary';
  summary.getCell('A8').font = { name: 'Arial', bold: true, size: 13, color: { argb: 'FF202124' } };
  metrics.forEach((metric, index) => {
    const row = 9 + Math.floor(index / 2);
    const column = index % 2 === 0 ? 1 : 4;
    summary.getCell(row, column).value = metric[0];
    summary.getCell(row, column).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF5F6368' } };
    summary.getCell(row, column + 1).value = metric[1];
    summary.getCell(row, column + 1).font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF573FD7' } };
    if (metric[0].includes('Rate')) summary.getCell(row, column + 1).numFmt = '0%';
  });

  const statusStartRow = 16;
  summary.getCell(statusStartRow, 1).value = 'Training Status Breakdown';
  summary.getCell(statusStartRow, 1).font = { name: 'Arial', bold: true, size: 13 };
  const statusRows = [
    ['Status', 'Count', 'Share'],
    ['In Progress', numberValue(stats.in_progress), numberValue(stats.total) ? numberValue(stats.in_progress) / numberValue(stats.total) : 0],
    ['Completed', numberValue(stats.completed), numberValue(stats.total) ? numberValue(stats.completed) / numberValue(stats.total) : 0],
    ['Canceled', numberValue(stats.canceled), numberValue(stats.total) ? numberValue(stats.canceled) / numberValue(stats.total) : 0],
    ['Rescheduled', numberValue(stats.rescheduled), numberValue(stats.total) ? numberValue(stats.rescheduled) / numberValue(stats.total) : 0]
  ];
  statusRows.forEach((values, index) => {
    const row = statusStartRow + 1 + index;
    values.forEach((value, column) => {
      const cell = summary.getCell(row, column + 1);
      cell.value = value;
      cell.font = { name: 'Arial', size: 10, bold: index === 0, color: { argb: index === 0 ? 'FFFFFFFF' : 'FF202124' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index === 0 ? 'FF11358B' : index % 2 === 0 ? 'FFF7F8FB' : 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: column === 0 ? 'left' : 'right' };
    });
  });
  for (let row = statusStartRow + 2; row <= statusStartRow + 5; row += 1) {
    summary.getCell(row, 3).numFmt = '0%';
  }

  addDashboardDataSheet(workbook, 'Trainings', [
    { header: 'Training', width: 32, value: 'title' },
    { header: 'Type', width: 16, value: row => formatDashboardLabel(row.type) },
    { header: 'Healthcare Centres', width: 38, value: row => row.healthcare_centres || '' },
    { header: 'Start', width: 22, value: row => row.start_datetime ? new Date(row.start_datetime) : '', numFmt: 'mmm d, yyyy h:mm AM/PM' },
    { header: 'End', width: 22, value: row => row.end_datetime ? new Date(row.end_datetime) : '', numFmt: 'mmm d, yyyy h:mm AM/PM' },
    { header: 'Trainers', width: 30, value: row => formatTrainerList(row.trainer_names) },
    { header: 'Participants', width: 16, value: row => numberValue(row.participant_count), numFmt: '#,##0', align: 'right' },
    { header: 'Total Hours', width: 16, value: (row, worksheetRow) => getTrainingTotalHoursCell(row, worksheetRow), numFmt: '#,##0.00', align: 'right' },
    { header: 'Total Duration', width: 30, value: (row, worksheetRow) => getTrainingDurationCell(row, worksheetRow) },
    { header: 'Status', width: 18, value: row => formatDashboardLabel(row.status) }
  ], report.allTrainings || []);

  addDashboardDataSheet(workbook, 'Top Clients', [
    { header: 'Healthcare Centre', width: 42, value: 'name' },
    { header: 'Training Count', width: 18, value: row => numberValue(row.training_count), numFmt: '#,##0', align: 'right' }
  ], report.topClientTrainings || []);

  addDashboardDataSheet(workbook, 'Trainer Activity', [
    { header: 'Trainer', width: 30, value: row => `${row.first_name || ''} ${row.last_name || ''}`.trim() },
    { header: 'Role', width: 16, value: 'role' },
    { header: 'Completed', width: 16, value: row => numberValue(row.completed_trainings), numFmt: '#,##0', align: 'right' },
    { header: 'In Progress', width: 16, value: row => numberValue(row.in_progress_trainings), numFmt: '#,##0', align: 'right' },
    { header: 'Taught Hours', width: 16, value: row => numberValue(row.taught_hours), numFmt: '#,##0.0', align: 'right' }
  ], report.trainers || []);

  return workbook;
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
      const activeFilters = getDashboardEntityFilters(req.query);
      const trainingDateWhere = buildTrainingFilterClause({ dashboardDateRange, filters: activeFilters });
      const trainingDateWhereWithAlias = buildTrainingFilterClause({ dashboardDateRange, filters: activeFilters, alias: 't' });
      const createdTrainingDateClause = buildTrainingFilterClause({ dashboardDateRange, filters: activeFilters, leadingKeyword: 'AND' });
      const assignedTrainingDateWhere = buildTrainingFilterClause({ dashboardDateRange, filters: activeFilters, alias: 't' });
      const trainerTrainingParams = [...createdTrainingDateClause.params, ...assignedTrainingDateWhere.params];
      const [[allHealthcare], [allModules]] = await Promise.all([
        req.db.query('SELECT id, name FROM healthcare ORDER BY name ASC'),
        req.db.query('SELECT id, name FROM modules ORDER BY name ASC')
      ]);

      // Get training statistics
      const [trainingStats] = await req.db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled,
          SUM(CASE WHEN status = 'rescheduled' THEN 1 ELSE 0 END) as rescheduled
        FROM trainings
        ${trainingDateWhere.clause}
      `, trainingDateWhere.params);

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
          ${trainingDateWhereWithAlias.clause ? trainingDateWhereWithAlias.clause.replace(/^WHERE\s+/i, 'AND ') : ''}
      `, [CERTIFICATE_ENROLMENT_PASSING_SCORE, PASSING_SCORE, ...trainingDateWhereWithAlias.params]);

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
        ${trainingDateWhereWithAlias.clause}
        GROUP BY t.id, t.title, t.type, t.start_datetime, t.end_datetime, t.status
        ORDER BY t.created_at DESC
        LIMIT 10
      `, trainingDateWhereWithAlias.params);

      // Top clients by distinct trainings in the selected dashboard range
      const [topClientTrainingRows] = await req.db.query(`
        SELECT
          h.id,
          h.name,
          COUNT(DISTINCT t.id) as training_count
        FROM healthcare h
        JOIN training_healthcare th ON th.healthcare_id = h.id
        JOIN trainings t ON t.id = th.training_id
        ${trainingDateWhereWithAlias.clause}
        GROUP BY h.id, h.name
        HAVING training_count > 0
        ORDER BY training_count DESC, h.name ASC
        LIMIT 20
      `, trainingDateWhereWithAlias.params);
      
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
              ${createdTrainingDateClause.clause}
            UNION DISTINCT
            SELECT tt.trainer_id, t.id, t.status, t.start_datetime, t.end_datetime
            FROM training_trainers tt
            JOIN trainings t ON t.id = tt.training_id
            ${assignedTrainingDateWhere.clause}
          ) trainer_trainings
          GROUP BY trainer_id
        ) tt ON tt.trainer_id = u.id
        WHERE u.role IN ('admin', 'trainer')
        ORDER BY u.last_name, u.first_name
      `, trainerTrainingParams);
      
      const traineeFilterClauses = [`t.trainee_status = 'registered'`];
      const traineeFilterParams = [];
      if (activeFilters.healthcareId) {
        traineeFilterClauses.push('t.healthcare_id = ?');
        traineeFilterParams.push(activeFilters.healthcareId);
      }

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
        WHERE ${traineeFilterClauses.join(' AND ')}
        ORDER BY t.created_at DESC
        LIMIT 10
      `, traineeFilterParams);

      // Upcoming recertifications (next 60 days), grouped by hospital
      const recertFilterClauses = [
        'ci.validity_end BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)'
      ];
      const recertFilterParams = [];
      if (activeFilters.healthcareId) {
        recertFilterClauses.push('tr.healthcare_id = ?');
        recertFilterParams.push(activeFilters.healthcareId);
      }
      if (activeFilters.moduleId) {
        recertFilterClauses.push('t.module_id = ?');
        recertFilterParams.push(activeFilters.moduleId);
      }

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
        WHERE ${recertFilterClauses.join(' AND ')}
        ORDER BY h.name, days_remaining ASC
      `, recertFilterParams);

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

      const healthcareReminderClauses = [
        'training_reminder_due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)'
      ];
      const healthcareReminderParams = [];
      if (activeFilters.healthcareId) {
        healthcareReminderClauses.push('id = ?');
        healthcareReminderParams.push(activeFilters.healthcareId);
      }

      const [healthcareReminderRows] = await req.db.query(`
        SELECT
          id,
          name,
          hospital_address,
          training_reminder_interval,
          training_reminder_due_date,
          DATEDIFF(training_reminder_due_date, CURDATE()) as days_remaining
        FROM healthcare
        WHERE ${healthcareReminderClauses.join(' AND ')}
        ORDER BY days_remaining ASC, name ASC, id ASC
      `, healthcareReminderParams);
      
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
        dashboardDateRange,
        activeFilters,
        allHealthcare: allHealthcare || [],
        allModules: allModules || []
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

router.get('/excel', async (req, res) => {
  try {
    const role = req.session.userRole;
    if (!['admin', 'trainer'].includes(role)) {
      return res.status(403).send('Access denied');
    }

    const report = await getTrainerDashboardReportData(req.db, req.query);
    const workbook = buildDashboardExcelWorkbook(report, req.session);
    const filenameDate = report.dashboardDateRange.isAllTime
      ? 'all-time'
      : `${report.dashboardDateRange.startDate}_to_${report.dashboardDateRange.endDate}`;
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Dashboard Report ${filenameDate}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Dashboard Excel error:', error);
    if (!res.headersSent) {
      res.status(500).send('Error generating dashboard Excel report');
    } else {
      res.end();
    }
  }
});

module.exports = router;
