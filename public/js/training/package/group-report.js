(function () {
  const pkg = window.QSSPackage = window.QSSPackage || {};
  const utils = pkg.utils;

  function buildGroupReportHtml(formData, rows, marksMap, logoDataUrl) {
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const docRef = utils.toDateRef();
    const ctx = window.PACKAGE_CONTEXT || {};
    const logoHtml = logoDataUrl
      ? `<img src="${logoDataUrl}" style="max-width:420px;max-height:92px;width:auto;height:auto;object-fit:contain;" alt="Company Logo">`
      : `<h2>${utils.escapeHtml(ctx.companyShortName)}</h2>`;

    const resultRows = rows.map(r => {
      const marks = marksMap.get(String(r.trainee_id || '').trim());
      const pre = marks ? utils.getBestTestScore(marks.tests, 'pre_test') : null;
      const post = marks ? (utils.getBestTestScore(marks.tests, 'post_test') || utils.getBestTestScore(marks.tests, 'refresher_training')) : null;
      const cert = marks ? utils.getBestTestScore(marks.tests, 'certificate_enrolment') : null;
      const hands = Array.isArray(marks?.handsOnScores) ? marks.handsOnScores : [];
      const handsMax = hands.reduce((s, x) => s + (parseFloat(x.max_score) || 0), 0);
      const handsScore = hands.reduce((s, x) => s + (parseFloat(x.score) || 0), 0);
      const handsPct = handsMax > 0 ? (handsScore / handsMax) * 100 : 0;
      const avg = [pre?.score, post?.score, cert?.score, handsPct].filter(v => v !== undefined && v !== null).map(v => parseFloat(v) || 0);
      const overall = avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length : 0;
      const descriptor = utils.getPerformanceDescriptor(overall);
      return `<tr>
          <td>${utils.escapeHtml(`${r.first_name || ''} ${r.last_name || ''}`.trim())}</td>
          <td>${utils.escapeHtml(r.trainee_id || '')}</td>
          <td style="text-align:center;">${Math.round(parseFloat(pre?.score || 0))}%</td>
          <td style="text-align:center;">${Math.round(parseFloat(post?.score || 0))}%</td>
          <td style="text-align:center;">${Math.round(parseFloat(cert?.score || 0))}%</td>
          <td style="text-align:center;">${Math.round(handsPct)}%</td>
          <td class="performance-${utils.getPerformanceClass(overall)}">${utils.escapeHtml(descriptor)}</td>
          <td style="font-style:italic;">${utils.escapeHtml(r.notes || '')}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="8" style="padding:10px;text-align:center;color:#475569;">No enrolled trainees were found for this training.</td></tr>`;

    return `
      <div style="font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;font-size:10pt;color:#333;background:#fff;padding:0.45in;">
        <div style="text-align:center;margin-bottom:12px;">${logoHtml}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f8f9fa;border-radius:8px;padding:12px 14px;margin-bottom:16px;">
          <div style="font-size:16pt;font-weight:700;color:#2c3e50;">Group Report</div>
          <div style="text-align:right;font-size:9pt;"><strong>Date:</strong> ${utils.escapeHtml(currentDate)}<br><strong>Ref:</strong> ${utils.escapeHtml(docRef)}</div>
        </div>
        <h2 style="font-size:13pt;text-align:center;color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:6px;">Training Results</h2>
        <table style="width:100%;border-collapse:collapse;font-size:9pt;">
          <thead>
            <tr style="background:#3498db;color:#fff;">
              <th style="padding:8px;text-align:left;">Name</th>
              <th style="padding:8px;text-align:left;">IC/Passport</th>
              <th style="padding:8px;text-align:center;">Pre</th>
              <th style="padding:8px;text-align:center;">Post/Ref</th>
              <th style="padding:8px;text-align:center;">Cert</th>
              <th style="padding:8px;text-align:center;">Hands On</th>
              <th style="padding:8px;text-align:left;">Performance</th>
              <th style="padding:8px;text-align:left;">Remarks</th>
            </tr>
          </thead>
          <tbody>${resultRows}</tbody>
        </table>
        <style>
          tbody tr:nth-child(even){background:#f8f9fa;}
          td{padding:7px;border-bottom:1px solid #eee;}
          .performance-outstanding{color:#27ae60;font-weight:600;}
          .performance-above{color:#2980b9;font-weight:600;}
          .performance-average{color:#f39c12;font-weight:600;}
          .performance-below{color:#e67e22;font-weight:600;}
          .performance-needs{color:#c0392b;font-weight:600;}
        </style>
      </div>`;
  }

  pkg.buildGroupReportHtml = buildGroupReportHtml;
})();
