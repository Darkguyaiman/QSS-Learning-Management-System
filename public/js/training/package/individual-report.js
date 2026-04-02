(function () {
  const pkg = window.QSSPackage = window.QSSPackage || {};
  const utils = pkg.utils;

  function buildIndividualReportHtml(formData, row, marksMap, logoDataUrl) {
    const ctx = window.PACKAGE_CONTEXT || {};
    const marks = marksMap.get(String(row.trainee_id || '').trim());
    const pre = marks ? utils.getBestTestScore(marks.tests, 'pre_test') : null;
    const post = marks ? (utils.getBestTestScore(marks.tests, 'post_test') || utils.getBestTestScore(marks.tests, 'refresher_training')) : null;
    const cert = marks ? utils.getBestTestScore(marks.tests, 'certificate_enrolment') : null;
    const hands = Array.isArray(marks?.handsOnScores) ? marks.handsOnScores : [];
    const handsMax = hands.reduce((s, x) => s + (parseFloat(x.max_score) || 0), 0);
    const handsScore = hands.reduce((s, x) => s + (parseFloat(x.score) || 0), 0);
    const handsPct = handsMax > 0 ? (handsScore / handsMax) * 100 : 0;
    const overallValues = [pre?.score, post?.score, cert?.score, handsPct].filter(v => v !== undefined && v !== null).map(v => parseFloat(v) || 0);
    const total = overallValues.length ? overallValues.reduce((a, b) => a + b, 0) / overallValues.length : 0;
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const presentCount = parseInt(row.present_count || 0, 10) || 0;
    const absentCount = parseInt(row.absent_count || 0, 10) || 0;
    const attendanceTotal = presentCount + absentCount;
    const attendanceRate = attendanceTotal > 0 ? `${((presentCount / attendanceTotal) * 100).toFixed(1)}%` : '0%';
    const logoHtml = logoDataUrl
      ? `<img src="${logoDataUrl}" alt="Company Logo" style="max-width:420px;max-height:92px;width:auto;height:auto;object-fit:contain;">`
      : `<h1>${utils.escapeHtml(ctx.companyShortName)}</h1>`;

    const handsRows = hands.map(h => {
      const max = parseFloat(h.max_score) || 0;
      const score = parseFloat(h.score) || 0;
      const pct = max > 0 ? (score / max) * 100 : 0;
      return `<tr>
          <td>${utils.escapeHtml(h.aspect_name || 'Aspect')}</td>
          <td style="text-align:center;"><span class="badge badge-${utils.getPerformanceClass(pct)}">${Math.round(pct)}%</span></td>
          <td class="perf-${utils.getPerformanceClass(pct)}">${utils.escapeHtml(utils.getPerformanceDescriptor(pct))}</td>
        </tr>`;
    }).join('');

    return `
      <div style="font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#333;font-size:10pt;background:#fff;padding:0.5in;">
        <div style="text-align:center;margin-bottom:14px;">${logoHtml}</div>
        <div style="background:#f8f9fa;border-radius:8px;padding:13px;margin-bottom:15px;display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;">
          <div><strong>Ref:</strong> ${utils.escapeHtml(utils.toDateRef())}</div>
          <div><strong>Date:</strong> ${utils.escapeHtml(currentDate)}</div>
          <div><strong>Name:</strong> ${utils.escapeHtml(`${row.first_name || ''} ${row.last_name || ''}`.trim())}</div>
          <div><strong>IC/Passport:</strong> ${utils.escapeHtml(row.trainee_id || '')}</div>
          <div><strong>Hospital:</strong> ${utils.escapeHtml(formData.hospitalName)}</div>
          <div><strong>Attendance Rate:</strong> ${utils.escapeHtml(attendanceRate)}</div>
          <div><strong>Present:</strong> ${utils.escapeHtml(String(presentCount))}</div>
          <div><strong>Absent:</strong> ${utils.escapeHtml(String(absentCount))}</div>
        </div>
        <h2 style="color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:6px;font-size:14pt;">Training Result</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
          <tr style="background:#3498db;color:#fff;">
            <th style="padding:8px;text-align:left;">Grading Aspects</th>
            <th style="padding:8px;text-align:center;">Marks (%)</th>
            <th style="padding:8px;text-align:left;">Performance Descriptor</th>
          </tr>
          ${[
            ['Pre-Test', parseFloat(pre?.score || 0)],
            [post ? 'Post-Test' : 'Refresher Test', parseFloat(post?.score || 0)],
            ['Certificate Enrolment', parseFloat(cert?.score || 0)],
            ['Hands On', handsPct],
            ['Total', total]
          ].map(item => `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${utils.escapeHtml(item[0])}</td>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;"><span class="badge badge-${utils.getPerformanceClass(item[1])}">${Math.round(item[1])}%</span></td>
            <td style="padding:8px;border-bottom:1px solid #eee;" class="perf-${utils.getPerformanceClass(item[1])}">${utils.escapeHtml(utils.getPerformanceDescriptor(item[1]))}</td>
          </tr>`).join('')}
          ${row.notes ? `<tr><td style="padding:8px;"><strong>Remarks:</strong></td><td colspan="2" style="padding:8px;font-style:italic;">${utils.escapeHtml(row.notes)}</td></tr>` : ''}
        </table>
        <h2 style="color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:6px;font-size:14pt;">Hands On Results</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#3498db;color:#fff;">
            <th style="padding:8px;text-align:left;">Hands On Aspects</th>
            <th style="padding:8px;text-align:center;">Marks (%)</th>
            <th style="padding:8px;text-align:left;">Performance Descriptor</th>
          </tr>
          ${handsRows || '<tr><td colspan="3" style="padding:8px;">No hands on scores recorded.</td></tr>'}
        </table>
        <style>
          .badge{display:inline-block;padding:3px 8px;border-radius:12px;color:#fff;font-weight:600;font-size:8pt;min-width:44px;}
          .badge-outstanding{background:#27ae60;}
          .badge-above{background:#2980b9;}
          .badge-average{background:#f39c12;}
          .badge-below{background:#e67e22;}
          .badge-needs{background:#c0392b;}
          .perf-outstanding{color:#27ae60;font-weight:600;}
          .perf-above{color:#2980b9;font-weight:600;}
          .perf-average{color:#f39c12;font-weight:600;}
          .perf-below{color:#e67e22;font-weight:600;}
          .perf-needs{color:#c0392b;font-weight:600;}
        </style>
      </div>`;
  }

  pkg.buildIndividualReportHtml = buildIndividualReportHtml;
})();
