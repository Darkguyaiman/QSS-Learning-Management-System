const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const puppeteer = require('puppeteer');

let browserPromise = null;
const headerCache = new Map();
const logoCache = new Map();
const PDF_RENDER_CONCURRENCY = 2;

function sanitizeFileName(name) {
  return String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeCompany(affiliatedCompany) {
  const code = String(affiliatedCompany || 'QSS').toUpperCase() === 'PMS' ? 'PMS' : 'QSS';
  return {
    code,
    name: code === 'PMS' ? 'Photomedic Solutions Sdn. Bhd.' : 'Quick Stop Solution Sdn. Bhd.'
  };
}

function getBestTestScore(tests, type) {
  const rows = (tests || []).filter(t => t.test_type === type);
  if (!rows.length) return null;
  return rows.reduce((best, t) => (parseFloat(t.score) || 0) > (parseFloat(best.score) || 0) ? t : best, rows[0]);
}

function getPerformanceDescriptor(pct) {
  const value = Number(pct) || 0;
  if (value > 80) return 'Outstanding';
  if (value > 60) return 'Above Average';
  if (value > 40) return 'Average';
  if (value > 20) return 'Below Average';
  return 'Needs Improvement';
}

function getPerformanceClass(pct) {
  const value = Number(pct) || 0;
  if (value > 80) return 'outstanding';
  if (value > 60) return 'above';
  if (value > 40) return 'average';
  if (value > 20) return 'below';
  return 'needs';
}

function formatAddress(address) {
  return String(address || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .join('<br>');
}

function formatFriendlyDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(`${String(dateStr).split('T')[0]}T00:00:00`);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatFriendlyDateTime(dateTimeStr) {
  if (!dateTimeStr) return 'N/A';
  const normalized = String(dateTimeStr).includes('T') ? String(dateTimeStr) : String(dateTimeStr).replace(' ', 'T');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return String(dateTimeStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatFriendlyTime(timeStr) {
  if (!timeStr) return 'N/A';
  const s = String(timeStr).substring(0, 5);
  const [hoursRaw, minutesRaw] = s.split(':');
  const hours = parseInt(hoursRaw, 10);
  const minutes = minutesRaw || '00';
  if (!Number.isFinite(hours)) return s;
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
}

function formatFriendlyDuration(duration) {
  const d = parseFloat(duration);
  if (!Number.isFinite(d)) return 'N/A';
  const rounded = Math.round(d * 100) / 100;
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
}

function trainingPeriodText(training) {
  const start = training.start_datetime;
  const end = training.end_datetime;
  if (start && end) {
    const startText = formatFriendlyDateTime(start);
    const endText = formatFriendlyDateTime(end);
    if (startText === endText) return startText;
    return `${startText} to ${endText}`;
  }
  if (start) return formatFriendlyDateTime(start);
  if (end) return formatFriendlyDateTime(end);
  return 'N/A';
}

function docRef(companyCode, trainingId, startDate) {
  const y = new Date(startDate || new Date()).getFullYear();
  return `${companyCode}/TRN/${y}/${String(trainingId).padStart(5, '0')}`;
}

function toPercent(score, maxScore) {
  const scoreNum = parseFloat(score) || 0;
  const maxNum = parseFloat(maxScore) || 0;
  return maxNum > 0 ? (scoreNum / maxNum) * 100 : 0;
}

function formatPercent(value) {
  const num = Number(value) || 0;
  const rounded = Math.round(num * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function baseHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || 'Document')}</title>
  <style>
    html, body { margin: 0; padding: 0; }
    body {
      font-family: Calibri, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.45;
      font-size: 10pt;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 100%;
      box-sizing: border-box;
      padding: 10px;
      overflow-wrap: anywhere;
      word-wrap: break-word;
    }
    .header-image {
      display: block;
      width: 100%;
      max-width: 100%;
      height: auto;
      margin: 0 auto 10px;
    }
    .card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      box-sizing: border-box;
    }
    .soft-card {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 12px;
      box-sizing: border-box;
    }
    .subject {
      font-weight: 700;
      margin: 15px 0;
      text-align: center;
      background: #e8f4fc;
      padding: 10px 12px;
      border-radius: 8px;
    }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { padding: 7px; border-bottom: 1px solid #eee; }
    .table-head th { background: #3498db; color: #fff; text-align: left; }
    .rounded-table-wrap {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
    }
    .rounded-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
    }
    .rounded-table thead th {
      background: #f3f4f6;
      color: #9ca3af;
      font-weight: 700;
      font-size: 10pt;
      border-bottom: 1px solid #d1d5db;
      padding: 12px 14px;
      text-align: left;
    }
    .rounded-table tbody td {
      padding: 12px 14px;
      border-bottom: 1px solid #eceff3;
      color: #374151;
      font-size: 10pt;
    }
    .rounded-table tbody tr:last-child td {
      border-bottom: none;
    }
    .report-title {
      font-size: 22pt;
      font-weight: 700;
      color: #334155;
      text-align: center;
      margin: 0 0 10px;
    }
    .section-title {
      font-size: 18pt;
      font-weight: 700;
      color: #334155;
      text-align: center;
      margin: 28px 0 12px;
      padding-bottom: 4px;
      border-bottom: 3px solid #4aa3df;
    }
    .report-table-wrap {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
      margin-bottom: 8px;
    }
    .report-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: auto;
    }
    .report-table th {
      background: #fff;
      color: #a8a29e;
      font-size: 9.5pt;
      font-weight: 700;
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .report-table td {
      font-size: 10pt;
      color: #374151;
      padding: 10px 8px;
      border-bottom: 1px solid #eef2f7;
      vertical-align: middle;
    }
    .report-table tbody tr:last-child td {
      border-bottom: none;
    }
    .report-table th.center,
    .report-table td.center {
      text-align: center;
    }
    .muted-cell {
      color: #94a3b8;
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      color: #fff;
      font-weight: 600;
      font-size: 8pt;
      min-width: 44px;
      text-align: center;
    }
    .badge-outstanding, .perf-outstanding { color: #27ae60; }
    .badge-above, .perf-above { color: #2980b9; }
    .badge-average, .perf-average { color: #f39c12; }
    .badge-below, .perf-below { color: #e67e22; }
    .badge-needs, .perf-needs { color: #c0392b; }
    .badge-outstanding { background: #27ae60; color: #fff; }
    .badge-above { background: #2980b9; color: #fff; }
    .badge-average { background: #f39c12; color: #fff; }
    .badge-below { background: #e67e22; color: #fff; }
    .badge-needs { background: #c0392b; color: #fff; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function headerDataUrl(companyCode) {
  if (headerCache.has(companyCode)) return headerCache.get(companyCode);
  const file = companyCode === 'PMS' ? 'PMS Header.jpg' : 'QSS Header.jpg';
  const headerPath = path.join(__dirname, '..', 'public', 'images', 'Headers', file);
  let value = '';
  if (fs.existsSync(headerPath)) {
    const raw = fs.readFileSync(headerPath);
    value = `data:image/jpeg;base64,${raw.toString('base64')}`;
  }
  headerCache.set(companyCode, value);
  return value;
}

function logoDataUrl(companyCode) {
  if (logoCache.has(companyCode)) return logoCache.get(companyCode);
  const file = companyCode === 'PMS' ? 'pmslogo.svg' : 'qsslogo.svg';
  const logoPath = path.join(__dirname, '..', 'public', 'images', 'Affiliated Companies', file);
  let value = '';
  if (fs.existsSync(logoPath)) {
    const raw = fs.readFileSync(logoPath, 'utf8');
    value = `data:image/svg+xml;base64,${Buffer.from(raw, 'utf8').toString('base64')}`;
  }
  logoCache.set(companyCode, value);
  return value;
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browserPromise;
}

async function htmlToPdfBuffer(html, orientation = 'portrait') {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const buffer = await page.pdf({
      format: 'A4',
      landscape: orientation === 'landscape',
      printBackground: true,
      margin: { top: '0.22in', right: '0.25in', bottom: '0.22in', left: '0.25in' }
    });
    return buffer;
  } finally {
    await page.close();
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const source = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Number(concurrency) || 1);
  const results = new Array(source.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor++;
      if (index >= source.length) return;
      results[index] = await worker(source[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, source.length) }, () => runWorker())
  );

  return results;
}

async function fetchPackageData(db, trainingId, trainingType) {
  const [objectiveResult, handsOnAspectResult, attendanceResult, sessionsResult] = await Promise.all([
    db.query('SELECT id, name FROM objectives ORDER BY id'),
    trainingType === 'main'
      ? db.query(
        'SELECT id, aspect_name, max_score FROM practical_learning_outcomes WHERE training_id = ? ORDER BY id',
        [trainingId]
      )
      : Promise.resolve([[]]),
    db.query(`
      SELECT e.id as enrollment_id, tr.id as trainee_db_id, tr.first_name, tr.last_name, tr.trainee_id, tr.ic_passport,
        COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0) as present_count,
        COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0) as absent_count
      FROM enrollments e
      JOIN trainees tr ON e.trainee_id = tr.id
      LEFT JOIN attendance a ON a.enrollment_id = e.id
      WHERE e.training_id = ?
      GROUP BY e.id, tr.id, tr.first_name, tr.last_name, tr.trainee_id, tr.ic_passport
      ORDER BY tr.last_name, tr.first_name
    `, [trainingId]),
    db.query(`
      SELECT DISTINCT DATE_FORMAT(a.date, '%Y-%m-%d') as date, TIME_FORMAT(a.time, '%H:%i:%s') as time, a.duration
      FROM attendance a
      JOIN enrollments e ON a.enrollment_id = e.id
      WHERE e.training_id = ?
      ORDER BY DATE_FORMAT(a.date, '%Y-%m-%d') DESC, TIME_FORMAT(a.time, '%H:%i:%s') DESC
    `, [trainingId])
  ]);

  const [objectiveRows] = objectiveResult;
  const [handsOnAspectRows] = handsOnAspectResult;
  const [rows] = attendanceResult;
  const [sessions] = sessionsResult;
  const attendanceRows = rows || [];
  const enrollmentIds = attendanceRows.map(row => row.enrollment_id);
  const marksByEnrollmentId = new Map(
    attendanceRows.map(row => [
      String(row.enrollment_id),
      { tests: [], handsOnScores: [], objectiveScores: {} }
    ])
  );

  if (enrollmentIds.length > 0) {
    const [testsResult, handsResult] = await Promise.all([
      db.query(
        'SELECT * FROM test_attempts WHERE enrollment_id IN (?) AND status = "completed" ORDER BY enrollment_id, test_type, id',
        [enrollmentIds]
      ),
      trainingType === 'main'
        ? db.query(`
          SELECT hs.*, ha.aspect_name, ha.max_score
          FROM practical_learning_outcome_scores hs
          JOIN practical_learning_outcomes ha ON hs.aspect_id = ha.id
          WHERE hs.enrollment_id IN (?)
          ORDER BY hs.enrollment_id, hs.id
        `, [enrollmentIds])
        : Promise.resolve([[]])
    ]);

    const [testRows] = testsResult;
    const [handsRows] = handsResult;

    for (const test of testRows || []) {
      test.score = parseFloat(test.score) || 0;
      const marks = marksByEnrollmentId.get(String(test.enrollment_id));
      if (marks) marks.tests.push(test);
    }

    for (const hand of handsRows || []) {
      const marks = marksByEnrollmentId.get(String(hand.enrollment_id));
      if (marks) marks.handsOnScores.push(hand);
    }

    const certAttemptIds = [];
    for (const marks of marksByEnrollmentId.values()) {
      const certAttempt = getBestTestScore(marks.tests, 'certificate_enrolment');
      if (certAttempt?.id) {
        marks.certificateAttemptId = certAttempt.id;
        certAttemptIds.push(certAttempt.id);
      }
    }

    if (certAttemptIds.length > 0) {
      const [objectiveAnswerRows] = await db.query(`
        SELECT ta.attempt_id, q.objective_id, o.name as objective_name, ta.selected_answer, q.correct_answer
        FROM test_answers ta
        JOIN questions q ON ta.question_id = q.id
        LEFT JOIN objectives o ON q.objective_id = o.id
        WHERE ta.attempt_id IN (?)
        ORDER BY ta.attempt_id, q.objective_id, ta.id
      `, [certAttemptIds]);

      const objectiveScoresByAttemptId = new Map();
      for (const answer of objectiveAnswerRows || []) {
        const objectiveId = String(answer.objective_id || '');
        if (!objectiveId) continue;

        const attemptKey = String(answer.attempt_id);
        if (!objectiveScoresByAttemptId.has(attemptKey)) {
          objectiveScoresByAttemptId.set(attemptKey, new Map());
        }

        const grouped = objectiveScoresByAttemptId.get(attemptKey);
        if (!grouped.has(objectiveId)) {
          grouped.set(objectiveId, {
            objectiveId: answer.objective_id,
            objectiveName: answer.objective_name || `Objective ${answer.objective_id}`,
            total: 0,
            correct: 0
          });
        }

        const entry = grouped.get(objectiveId);
        entry.total += 1;
        if (String(answer.selected_answer || '') === String(answer.correct_answer || '')) {
          entry.correct += 1;
        }
      }

      for (const marks of marksByEnrollmentId.values()) {
        const attemptKey = String(marks.certificateAttemptId || '');
        const grouped = objectiveScoresByAttemptId.get(attemptKey);
        if (!grouped) continue;

        marks.objectiveScores = Array.from(grouped.values()).reduce((acc, entry) => {
          acc[String(entry.objectiveId)] = {
            ...entry,
            percentage: entry.total > 0 ? (entry.correct / entry.total) * 100 : 0
          };
          return acc;
        }, {});
      }
    }

    for (const marks of marksByEnrollmentId.values()) {
      delete marks.certificateAttemptId;
    }
  }

  return {
    attendanceRows,
    marksByEnrollmentId,
    sessions: sessions || [],
    objectives: objectiveRows || [],
    handsOnAspects: handsOnAspectRows || []
  };
}

function buildLetterHtml({ training, company, formData, attendanceSessionCount, totalParticipants, traineeRows }) {
  const header = headerDataUrl(company.code);
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const ref = docRef(company.code, training.id, training.start_datetime || training.end_datetime);
  const trainingTypeLabel = String(training.type || '').toLowerCase() === 'main' ? 'Main Training' : 'Refresher Training';
  const headerHtml = header ? `<img src="${header}" alt="${escapeHtml(company.code)} Header" class="header-image">` : '';

  const html = `
  <div class="page">
    ${headerHtml}
    <table style="margin-bottom:14px;">
      <tr>
        <td style="width:62%;vertical-align:top;padding:6px 4px 6px 0;"><strong>${escapeHtml(formData.hospitalName)}</strong><br>${formatAddress(formData.address)}</td>
        <td style="width:38%;vertical-align:top;text-align:right;padding:6px 0 6px 4px;"><strong>Date:</strong> ${escapeHtml(currentDate)}<br><strong>Ref:</strong> ${escapeHtml(ref)}</td>
      </tr>
    </table>
    <p><strong>Attn to:</strong> Mr/Mrs ${escapeHtml(formData.recipientName)}</p>
    <p><strong>Phone num:</strong> ${escapeHtml(formData.recipientPhone)}</p>
    <div class="subject">CONFIRMATION OF IN-HOUSE TRAINING FOR DEVICE</div>
    <p>Dear ${escapeHtml(formData.recipientName)},</p>
    <p>We are pleased to confirm that the following staff members have successfully attended the in-house training for the ${escapeHtml(formData.deviceModel)} devicedevice. Details of the training are as below:</p>
    <div class="soft-card" style="margin:15px 0;">
      <div><strong>Date and Time:</strong> ${escapeHtml(trainingPeriodText(training))}</div>
      <div><strong>Device Model:</strong> ${escapeHtml(formData.deviceModel)}</div>
      <div><strong>Training Type:</strong> ${escapeHtml(trainingTypeLabel)}</div>
      <div><strong>Group Report:</strong> please refer to Group Report.pdf</div>
    </div>
    <div style="margin:14px 0;">
      <div style="font-weight:700;margin:0 0 6px 0;">Trained Staff Listing</div>
      <div class="rounded-table-wrap">
        <table class="rounded-table">
          <thead>
            <tr>
              <th style="width:44%;">Name</th>
              <th style="width:28%;">IC/Passport</th>
              <th style="width:28%;">Certificate Serial Number</th>
            </tr>
          </thead>
          <tbody>
            ${Array.isArray(traineeRows) && traineeRows.length
              ? traineeRows.map(row => `<tr>
                <td>${escapeHtml(row.name || '')}</td>
                <td>${escapeHtml(row.traineeId || '')}</td>
                <td>${escapeHtml(row.certificateNumber || 'N/A')}</td>
              </tr>`).join('')
              : '<tr><td colspan="3" style="text-align:center;color:#64748b;">No trainees found.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <p>The training was conducted by ${escapeHtml(company.name)}, covering safety, technical, and clinical aspects of the ${escapeHtml(formData.deviceModel)} device. The participants have demonstrated a satisfactory understanding of these key areas.</p>
    <p>As a result of this training, these staff members are now qualified to perform laser treatments using the ${escapeHtml(formData.deviceModel)} device.</p>
    <p>Should you require any further information or clarification, please do not hesitate to contact us. We appreciate your cooperation and look forward to continued collaboration.</p>
    <p>Thank you.</p>
    <p>Yours sincerely,</p>
    <div style="margin-top:18px;border-top:1.5px solid #000;width:240px;"></div>
    <p style="margin:5px 0 0 0;"><strong>Shah Zarak Kahn Bin Ashiq Hussain</strong><br><strong>Group Managing Director,</strong><br><strong>${escapeHtml(company.name)}</strong></p>
    <div class="soft-card" style="margin-top:16px;font-size:9pt;">
      <div><strong>Address:</strong> Unit T2A-08-06 Menara 3 (3 Towers), No 296, Jalan Ampang, 50450 Kuala Lumpur, Malaysia</div>
      <div><strong>(E)</strong> <span style="color:#1d4ed8;">qssmalaysia@yahoo.com / annez@pain.com.my</span></div>
      <div><strong>(W)</strong> <span style="color:#1d4ed8;">www.pain.com.my, www.klaser.com.my, www.photomedicine.com.my</span></div>
      <div><strong>(C)</strong> +6019-2621626 / +6012-7241626</div>
    </div>
    <p style="margin:12px 0 4px 0;text-align:center;font-style:italic;">Saving Limbs, Live Life, Pain Free, Drug Free, Medical Evidence Solutions</p>
    <p style="margin:0;text-align:center;font-size:8.5pt;">Malaysian address: Unit T2A-08-06 Menara 3 (3 Towers), No 296, Jalan Ampang, 50450 Kuala Lumpur, Malaysia</p>
  </div>`;

  return baseHtml('In House Training Letter', html);
}

function buildGroupHtml({ training, company, attendanceRows, marksByEnrollmentId, objectives, handsOnAspects }) {
  const header = headerDataUrl(company.code);
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const ref = docRef(company.code, training.id, training.start_datetime || training.end_datetime);
  const headerHtml = header ? `<img src="${header}" class="header-image" alt="${escapeHtml(company.code)} Header">` : '';
  const isMainTraining = String(training.type || '').toLowerCase() === 'main';
  const objectiveHeaders = Array.isArray(objectives) ? objectives : [];

  const overviewRowsHtml = attendanceRows.map((r) => {
    const marks = marksByEnrollmentId.get(String(r.enrollment_id));
    const pre = marks ? getBestTestScore(marks.tests, 'pre_test') : null;
    const post = marks ? (getBestTestScore(marks.tests, 'post_test') || getBestTestScore(marks.tests, 'refresher_training')) : null;
    const cert = marks ? getBestTestScore(marks.tests, 'certificate_enrolment') : null;
    const hands = Array.isArray(marks?.handsOnScores) ? marks.handsOnScores : [];
    const handsMax = hands.reduce((s, x) => s + (parseFloat(x.max_score) || 0), 0);
    const handsScore = hands.reduce((s, x) => s + (parseFloat(x.score) || 0), 0);
    const handsPct = handsMax > 0 ? (handsScore / handsMax) * 100 : null;
    const avg = [pre?.score, post?.score, cert?.score, handsPct]
      .filter(v => v !== undefined && v !== null)
      .map(v => parseFloat(v) || 0);
    const overall = avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length : 0;

    return `<tr>
      <td>${escapeHtml(`${r.first_name || ''} ${r.last_name || ''}`.trim())}</td>
      <td>${escapeHtml(r.ic_passport || r.trainee_id || '')}</td>
      ${isMainTraining ? `<td class="center">${formatPercent(pre?.score || 0)}</td>` : ''}
      ${isMainTraining ? `<td class="center">${formatPercent(post?.score || 0)}</td>` : ''}
      <td class="center">${formatPercent(cert?.score || 0)}</td>
      ${isMainTraining ? `<td class="center">${formatPercent(handsPct)}</td>` : ''}
      <td class="center perf-${getPerformanceClass(overall)}" style="font-weight:700;">${escapeHtml(getPerformanceDescriptor(overall))}</td>
      <td></td>
    </tr>`;
  }).join('') || `<tr><td colspan="${isMainTraining ? 8 : 5}" class="muted-cell">No enrolled trainees were found for this training.</td></tr>`;

  const objectiveRowsHtml = attendanceRows.map((r) => {
    const marks = marksByEnrollmentId.get(String(r.enrollment_id));
    const objectiveCells = objectiveHeaders.map((objective) => {
      const entry = marks?.objectiveScores?.[String(objective.id)];
      return `<td class="center">${entry ? formatPercent(entry.percentage) : '0%'}</td>`;
    }).join('');

    return `<tr>
      <td>${escapeHtml(`${r.first_name || ''} ${r.last_name || ''}`.trim())}</td>
      <td>${escapeHtml(r.ic_passport || r.trainee_id || '')}</td>
      ${objectiveCells}
    </tr>`;
  }).join('') || `<tr><td colspan="${2 + objectiveHeaders.length}" class="muted-cell">No enrolled trainees were found for this training.</td></tr>`;

  const html = `
  <div class="page">
    ${headerHtml}
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:16pt;font-weight:700;color:#2c3e50;">Group Report</div>
      <div style="text-align:right;font-size:9pt;"><strong>Date:</strong> ${escapeHtml(currentDate)}<br><strong>Ref:</strong> ${escapeHtml(ref)}</div>
    </div>
    <div class="report-title">Training Results</div>
    <div class="report-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th style="width:${isMainTraining ? '23%' : '30%'};">Name</th>
            <th style="width:${isMainTraining ? '15%' : '20%'};">IC/Passport</th>
            ${isMainTraining ? '<th class="center" style="width:10%;">Pre-Test</th>' : ''}
            ${isMainTraining ? '<th class="center" style="width:10%;">Post-Test</th>' : ''}
            <th class="center" style="width:${isMainTraining ? '14%' : '18%'};">Certificate Enrolment Test</th>
            ${isMainTraining ? '<th class="center" style="width:10%;">Hands On</th>' : ''}
            <th class="center" style="width:${isMainTraining ? '10%' : '16%'};">Performance Descriptor</th>
            <th style="width:${isMainTraining ? '8%' : '16%'};">Remarks</th>
          </tr>
        </thead>
        <tbody>${overviewRowsHtml}</tbody>
      </table>
    </div>
    ${objectiveHeaders.length ? `
    <div class="section-title">Understanding of Objectives</div>
    <div class="report-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th style="width:22%;">Name</th>
            <th style="width:14%;">IC/Passport</th>
            ${objectiveHeaders.map(objective => `<th class="center">${escapeHtml(objective.name || `Objective ${objective.id}`)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${objectiveRowsHtml}</tbody>
      </table>
    </div>` : ''}
  </div>`;

  return baseHtml('Group Report', html);
}

function buildIndividualHtml({ company, formData, row, marksByEnrollmentId, objectives }) {
  const header = headerDataUrl(company.code);
  const marks = marksByEnrollmentId.get(String(row.enrollment_id));
  const isMainTraining = Array.isArray(marks?.handsOnScores) && marks.handsOnScores.length > 0;
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const ref = docRef(company.code, row.enrollment_id || row.trainee_db_id || row.trainee_id || '0', new Date());
  const pre = marks ? getBestTestScore(marks.tests, 'pre_test') : null;
  const post = marks ? (getBestTestScore(marks.tests, 'post_test') || getBestTestScore(marks.tests, 'refresher_training')) : null;
  const cert = marks ? getBestTestScore(marks.tests, 'certificate_enrolment') : null;
  const hands = Array.isArray(marks?.handsOnScores) ? marks.handsOnScores : [];
  const handsMax = hands.reduce((s, x) => s + (parseFloat(x.max_score) || 0), 0);
  const handsScore = hands.reduce((s, x) => s + (parseFloat(x.score) || 0), 0);
  const handsPct = handsMax > 0 ? (handsScore / handsMax) * 100 : 0;
  const total = [pre?.score, post?.score, cert?.score, handsPct].filter(v => v !== undefined && v !== null).map(v => parseFloat(v) || 0);
  const overall = total.length ? total.reduce((a, b) => a + b, 0) / total.length : 0;
  const headerHtml = header ? `<img src="${header}" class="header-image" alt="${escapeHtml(company.code)} Header">` : '';
  const objectiveHeaders = Array.isArray(objectives) ? objectives : [];
  const trainingResultRows = [
    ...(isMainTraining ? [
      ['Pre-Test', parseFloat(pre?.score || 0)],
      ['Post-Test', parseFloat(post?.score || 0)]
    ] : []),
    ['Certificate Enrolment Test', parseFloat(cert?.score || 0)],
    ...(isMainTraining ? [['Hands On', handsPct]] : [])
  ].map(([label, value]) => `<tr>
      <td>${escapeHtml(label)}</td>
      <td class="center">${formatPercent(value)}</td>
      <td class="perf-${getPerformanceClass(value)}" style="font-weight:700;">${escapeHtml(getPerformanceDescriptor(value))}</td>
    </tr>`).join('');

  const objectiveRows = objectiveHeaders.map((objective) => {
    const entry = marks?.objectiveScores?.[String(objective.id)];
    const percentage = entry ? entry.percentage : 0;
    return `<tr>
      <td>${escapeHtml(objective.name || `Objective ${objective.id}`)}</td>
      <td class="center">${formatPercent(percentage)}</td>
      <td class="perf-${getPerformanceClass(percentage)}" style="font-weight:700;">${escapeHtml(getPerformanceDescriptor(percentage))}</td>
    </tr>`;
  }).join('');

  const practicalLearningOutcomeRows = hands.map((outcome) => {
    const percentage = toPercent(outcome.score, outcome.max_score);
    return `<tr>
      <td>${escapeHtml(outcome.aspect_name || 'Practical Learning Outcome')}</td>
      <td class="center">${formatPercent(percentage)}</td>
      <td class="perf-${getPerformanceClass(percentage)}" style="font-weight:700;">${escapeHtml(getPerformanceDescriptor(percentage))}</td>
    </tr>`;
  }).join('');

  const html = `
    <div class="page">
      ${headerHtml}
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin-bottom:15px;">
        <div><strong>Name:</strong> ${escapeHtml(`${row.first_name || ''} ${row.last_name || ''}`.trim())}</div>
        <div><strong>Hospital:</strong> ${escapeHtml(formData.hospitalName)}</div>
        <div><strong>Date:</strong> ${escapeHtml(currentDate)}</div>
        <div><strong>Ref:</strong> ${escapeHtml(ref)}</div>
      </div>
    <div class="section-title">Training Results</div>
    <div class="report-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th>Assessment</th>
            <th class="center" style="width:16%;">Marks (%)</th>
            <th style="width:28%;">Performance Descriptor</th>
          </tr>
        </thead>
        <tbody>
          ${trainingResultRows}
          <tr>
            <td style="font-weight:700;">Total</td>
            <td class="center">${formatPercent(overall)}</td>
            <td class="perf-${getPerformanceClass(overall)}" style="font-weight:700;">${escapeHtml(getPerformanceDescriptor(overall))}</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${objectiveHeaders.length ? `
    <div class="section-title">Understanding of Objectives</div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Objective</th>
            <th class="center" style="width:16%;">Marks (%)</th>
            <th style="width:28%;">Performance Descriptor</th>
          </tr>
          </thead>
          <tbody>${objectiveRows || '<tr><td colspan="3" class="muted-cell">No objective results found.</td></tr>'}</tbody>
        </table>
      </div>` : ''}
      ${isMainTraining ? `
      <div class="section-title">Practical Learning Outcomes</div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Practical Learning Outcome</th>
              <th class="center" style="width:16%;">Marks (%)</th>
              <th style="width:28%;">Performance Descriptor</th>
            </tr>
          </thead>
          <tbody>
            ${practicalLearningOutcomeRows || '<tr><td colspan="3" class="muted-cell">No practical learning outcome results found.</td></tr>'}
            <tr>
              <td style="font-weight:700;">Total</td>
              <td class="center">${formatPercent(handsPct)}</td>
              <td class="perf-${getPerformanceClass(handsPct)}" style="font-weight:700;">${escapeHtml(getPerformanceDescriptor(handsPct))}</td>
            </tr>
          </tbody>
        </table>
      </div>` : ''}
    </div>`;

  return baseHtml('Individual Report', html);
}

function buildAttendanceHtml({ training, company, session, records, generatedByName, generatedByPosition }) {
  const header = headerDataUrl(company.code);
  const headerHtml = header ? `<img src="${header}" class="header-image" alt="${escapeHtml(company.code)} Header">` : '';
  const summary = {
    total: records.length,
    present: records.filter(r => String(r.status || '').toLowerCase() === 'present').length,
    absent: records.filter(r => String(r.status || '').toLowerCase() === 'absent').length,
    late: records.filter(r => String(r.status || '').toLowerCase() === 'late').length
  };

  const rowsHtml = (records || []).map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${escapeHtml(`${r.first_name || ''} ${r.last_name || ''}`.trim())}</td>
    <td>${escapeHtml(r.trainee_id || '-')}</td>
    <td>${escapeHtml(String(r.status || '-').toUpperCase())}</td>
    <td>${escapeHtml(r.notes || '')}</td>
  </tr>`).join('') || '<tr><td colspan="5">No attendance records found.</td></tr>';

  const html = `
  <div class="page">
    ${headerHtml}
    <div class="card" style="margin-bottom:14px;">
      <div><strong>Training:</strong> ${escapeHtml(training.title || '-')}</div>
      <div><strong>Session Date:</strong> ${escapeHtml(formatFriendlyDate(session.date))}</div>
      <div><strong>Session Time:</strong> ${escapeHtml(formatFriendlyTime(session.time))}</div>
      <div><strong>Duration:</strong> ${escapeHtml(formatFriendlyDuration(session.duration))}</div>
      <div><strong>Prepared By:</strong> ${escapeHtml(generatedByPosition ? `${generatedByName} (${generatedByPosition})` : (generatedByName || '-'))}</div>
    </div>
    <table style="margin-bottom:14px;">
      <thead class="table-head"><tr><th style="width:40px;">No.</th><th>Trainee Name</th><th style="width:120px;">Trainee ID</th><th style="width:90px;">Status</th><th>Notes</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="soft-card"><strong>Summary:</strong> Total ${summary.total} | Present ${summary.present} | Absent ${summary.absent} | Late ${summary.late}</div>
  </div>`;

  return baseHtml('Attendance Report', html);
}

function buildCertificateHtml({ certificate, company }) {
  const logoPath = logoDataUrl(company.code);
  const participantName = escapeHtml(certificate.participant_name || '');
  const courseName = escapeHtml(certificate.course_name || '');
  const location = escapeHtml(certificate.location || 'N/A');
  const dateDisplay = escapeHtml(certificate.date_display || '');
  const certificateNumber = escapeHtml(certificate.certificate_number || '');
  const companyName = escapeHtml(company.name);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Training Certificate - ${participantName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      background: white;
      width: 100%;
      height: 100%;
    }
    .certificate-container {
      width: 100%;
      height: 100vh;
      min-height: 100vh;
      position: relative;
      overflow: hidden;
    }
    .bg-shape-left {
      position: absolute;
      left: 0; top: 0;
      width: 42%; height: 100%;
      background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%);
      clip-path: polygon(0 0, 100% 0, 85% 100%, 0 100%);
      z-index: 1;
    }
    .bg-shape-bottom {
      position: absolute;
      right: 0; bottom: 0;
      width: 35%; height: 25%;
      background: linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%);
      clip-path: polygon(20% 0, 100% 0, 100% 100%, 0 100%);
      z-index: 1;
    }
    .dot-pattern {
      position: absolute;
      right: 0; top: 0;
      width: 60%; height: 100%;
      background-image: radial-gradient(circle, #d0d0d0 1px, transparent 1px);
      background-size: 12px 12px;
      opacity: 0.3;
      z-index: 2;
    }
    .content { position: relative; z-index: 10; display: flex; height: 100%; }
    .left-panel {
      width: 42%;
      padding: 60px 50px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .logo { width: 220px; max-width: 100%; height: auto; display: block; margin-bottom: 50px; }
    .training-label { font-size: 28px; font-weight: 300; color: #1a1a1a; line-height: 1.2; margin-bottom: 5px; }
    .certificate-title { font-size: 48px; font-weight: 700; color: #1a1a1a; line-height: 1.1; margin-bottom: 18px; }
    .title-underline { width: 60px; height: 3px; background: #1a1a1a; margin-bottom: 22px; }
    .validity-box {
      background: #1a1a1a; color: white; padding: 15px 25px; border-radius: 30px;
      display: inline-block; font-size: 13px; font-weight: 500; max-width: 300px;
    }
    .right-panel {
      width: 58%;
      padding: 60px 50px 60px 40px;
      display: flex;
      flex-direction: column;
    }
    .certification-header { font-size: 16px; color: #1a1a1a; margin-bottom: 10px; font-weight: 500; }
    .participant-name {
      font-size: 24px; font-weight: 600; color: #1a1a1a; margin-bottom: 18px;
      padding-bottom: 8px; border-bottom: 2px solid #1a1a1a;
    }
    .completion-text { font-size: 16px; color: #333; margin-bottom: 10px; line-height: 1.6; }
    .course-name {
      font-size: 20px; font-weight: 600; color: #1a1a1a; margin-bottom: 28px;
      padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;
    }
    .details-row { display: flex; justify-content: space-between; margin-bottom: 50px; gap: 30px; }
    .detail-item { flex: 1; }
    .detail-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 8px; font-weight: 600; }
    .detail-value { font-size: 16px; color: #1a1a1a; font-weight: 500; padding-bottom: 10px; border-bottom: 2px solid #1a1a1a; }
    .signature-section { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; }
    .signature-line { font-size: 14px; color: #1a1a1a; font-weight: 600; }
    .signature-title { font-size: 13px; color: #666; margin-top: 3px; }
    .certificate-number {
      position: absolute;
      bottom: 30px;
      left: 50px;
      font-size: 12px;
      color: #666;
      z-index: 10;
    }
  </style>
</head>
<body>
  <div class="certificate-container">
    <div class="bg-shape-left"></div>
    <div class="bg-shape-bottom"></div>
    <div class="dot-pattern"></div>
    <div class="content">
      <div class="left-panel">
        <img src="${logoPath}" alt="${companyName}" class="logo">
        <div class="training-label">Training refreshment</div>
        <div class="certificate-title">Certificate</div>
        <div class="title-underline"></div>
        <div class="validity-box">The validity of this certificate is 2 years from the date issued.</div>
      </div>
      <div class="right-panel">
        <div class="certification-header">${companyName} certifies that,</div>
        <div class="participant-name">${participantName}</div>
        <div class="completion-text">Has successfully completed the course</div>
        <div class="course-name">${courseName}</div>
        <div class="details-row">
          <div class="detail-item">
            <div class="detail-label">Place</div>
            <div class="detail-value">${location}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Date</div>
            <div class="detail-value">${dateDisplay}</div>
          </div>
        </div>
        <div class="signature-section">
          <div>
            <div style="height: 60px; margin-bottom: 10px; font-family: 'Brush Script MT', cursive; font-size: 36px; color: #333;">Administrator</div>
            <div class="signature-line">Administrator</div>
            <div class="signature-title">Authorized Signatory</div>
            <div class="signature-title">${companyName}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="certificate-number">Certificate Number: ${certificateNumber}</div>
  </div>
</body>
</html>`;
}

async function generatePackageZipBuffer({ db, training, formData, generatedByName, generatedByPosition }) {
  const company = normalizeCompany(training.affiliated_company);
  const { attendanceRows, marksByEnrollmentId, objectives, handsOnAspects } = await fetchPackageData(db, training.id, training.type);
  const missingIcRows = (attendanceRows || []).filter(row => !String(row.ic_passport || '').trim());
  if (missingIcRows.length > 0) {
    const sample = missingIcRows.slice(0, 10).map(row => `${row.first_name || ''} ${row.last_name || ''}`.trim() || `Enrollment ${row.enrollment_id}`);
    const extra = missingIcRows.length > sample.length ? ` and ${missingIcRows.length - sample.length} more` : '';
    const err = new Error(`Cannot generate package: missing IC/Passport for ${missingIcRows.length} trainee(s): ${sample.join(', ')}${extra}.`);
    err.statusCode = 400;
    throw err;
  }
  const [issuedCertificates] = await db.query(`
    SELECT enrollment_id, certificate_number, participant_name, course_name, location, date_display
    FROM certificate_issues
    WHERE training_id = ?
    ORDER BY participant_name ASC
  `, [training.id]);
  const certByEnrollmentId = new Map((issuedCertificates || []).map(c => [String(c.enrollment_id), c]));
  const attendanceSessionCount = attendanceRows.reduce((max, r) => {
    const c = (parseInt(r.present_count || 0, 10) || 0) + (parseInt(r.absent_count || 0, 10) || 0);
    return Math.max(max, c);
  }, 0);

  const zip = new JSZip();
  const traineeRows = attendanceRows.map(row => ({
    name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    traineeId: String(row.ic_passport || row.trainee_id || ''),
    certificateNumber: certByEnrollmentId.get(String(row.enrollment_id))?.certificate_number || 'N/A'
  }));
  const groupHtml = buildGroupHtml({ training, company, attendanceRows, marksByEnrollmentId, objectives, handsOnAspects });
  const [letterBuffer, groupBuffer] = await Promise.all([
    generateLetterPdfBuffer({
      db,
      training,
      formData,
      preloadedAttendanceRows: attendanceRows,
      preloadedTraineeRows: traineeRows
    }),
    htmlToPdfBuffer(groupHtml, 'landscape')
  ]);
  zip.file('In House Training Letter.pdf', letterBuffer);
  zip.file('Group Report.pdf', groupBuffer);

  const individualFolder = zip.folder('Individual Reports');
  const individualEntries = await mapWithConcurrency(
    attendanceRows,
    PDF_RENDER_CONCURRENCY,
    async (row) => {
      const html = buildIndividualHtml({ company, formData, row, marksByEnrollmentId, objectives });
      const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Trainee';
      const traineeId = String(row.trainee_id || 'NA');
      const pdfBuffer = await htmlToPdfBuffer(html, 'portrait');
      return {
        fileName: `${sanitizeFileName(fullName)}_${sanitizeFileName(traineeId)}.pdf`,
        pdfBuffer
      };
    }
  );
  for (const entry of individualEntries) {
    individualFolder.file(entry.fileName, entry.pdfBuffer);
  }

  if (Array.isArray(issuedCertificates) && issuedCertificates.length > 0) {
    const certFolder = zip.folder('Certificates');
    const certificateEntries = await mapWithConcurrency(
      issuedCertificates,
      PDF_RENDER_CONCURRENCY,
      async (cert) => {
        const certHtml = buildCertificateHtml({ certificate: cert, company });
        const certPdf = await htmlToPdfBuffer(certHtml, 'landscape');
        const certName = sanitizeFileName(cert.participant_name || 'Participant');
        const certNo = sanitizeFileName(cert.certificate_number || 'CERT');
        return {
          fileName: `${certNo}_${certName}.pdf`,
          pdfBuffer: certPdf
        };
      }
    );
    for (const entry of certificateEntries) {
      certFolder.file(entry.fileName, entry.pdfBuffer);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

async function generateLetterPdfBuffer({ db, training, formData, preloadedAttendanceRows, preloadedTraineeRows }) {
  const company = normalizeCompany(training.affiliated_company);
  const attendanceRows = Array.isArray(preloadedAttendanceRows) ? preloadedAttendanceRows : (await fetchPackageData(db, training.id, training.type)).attendanceRows;
  const missingIcRows = (attendanceRows || []).filter(row => !String(row.ic_passport || '').trim());
  if (missingIcRows.length > 0) {
    const sample = missingIcRows.slice(0, 10).map(row => `${row.first_name || ''} ${row.last_name || ''}`.trim() || `Enrollment ${row.enrollment_id}`);
    const extra = missingIcRows.length > sample.length ? ` and ${missingIcRows.length - sample.length} more` : '';
    const err = new Error(`Cannot generate letter: missing IC/Passport for ${missingIcRows.length} trainee(s): ${sample.join(', ')}${extra}.`);
    err.statusCode = 400;
    throw err;
  }

  let traineeRows = preloadedTraineeRows;
  if (!Array.isArray(traineeRows)) {
    const [issuedCertificates] = await db.query(`
      SELECT enrollment_id, certificate_number
      FROM certificate_issues
      WHERE training_id = ?
    `, [training.id]);
    const certByEnrollmentId = new Map((issuedCertificates || []).map(c => [String(c.enrollment_id), c]));
    traineeRows = attendanceRows.map(row => ({
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      traineeId: String(row.ic_passport || row.trainee_id || ''),
      certificateNumber: certByEnrollmentId.get(String(row.enrollment_id))?.certificate_number || 'N/A'
    }));
  }

  const attendanceSessionCount = attendanceRows.reduce((max, r) => {
    const c = (parseInt(r.present_count || 0, 10) || 0) + (parseInt(r.absent_count || 0, 10) || 0);
    return Math.max(max, c);
  }, 0);

  const letterHtml = buildLetterHtml({
    training,
    company,
    formData,
    attendanceSessionCount,
    totalParticipants: attendanceRows.length,
    traineeRows
  });

  return htmlToPdfBuffer(letterHtml, 'portrait');
}

module.exports = {
  sanitizeFileName,
  normalizeCompany,
  generatePackageZipBuffer,
  generateLetterPdfBuffer
};
