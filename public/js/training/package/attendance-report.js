(function () {
  const pkg = window.QSSPackage = window.QSSPackage || {};
  const utils = pkg.utils;

  function normalizeDate(value) {
    if (!value) return '';
    return String(value).split('T')[0].split(' ')[0];
  }

  function buildSessionReference(trainingId, date) {
    const ctx = window.PACKAGE_CONTEXT || {};
    return `${ctx.companyCode}-ATT-${trainingId || 'NA'}-${date || 'NA'}`;
  }

  async function fetchTrainingSessions(trainingId) {
    if (!trainingId) return [];
    const response = await fetch(`/attendance/sessions/${trainingId}`);
    if (!response.ok) throw new Error('Failed to load sessions');
    return await response.json();
  }

  async function fetchSessionRecords(trainingId, date, time) {
    if (!trainingId || !date || !time) return [];
    const response = await fetch(`/attendance/session-details/${trainingId}?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`);
    if (!response.ok) throw new Error('Failed to load session details');
    const data = await response.json();
    return Array.isArray(data.records) ? data.records : [];
  }

  async function loadLogoData() {
    return await utils.loadLogoPngDataUrl();
  }

  function summarize(records) {
    return {
      total: records.length,
      present: records.filter(r => (r.status || '').toLowerCase() === 'present').length,
      absent: records.filter(r => (r.status || '').toLowerCase() === 'absent').length,
      late: records.filter(r => (r.status || '').toLowerCase() === 'late').length
    };
  }

  async function generateAttendancePdfReport({
    trainingTitle,
    sessionDate,
    sessionTime,
    sessionDuration,
    records,
    generatedByName,
    generatedByPosition,
    reportReference,
    download = true
  }) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      qssShowError('jsPDF failed to load. Please refresh the page and try again.');
      return null;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const logoImage = await loadLogoData();
    const summary = summarize(records || []);
    const generatedBy = generatedByPosition ? `${generatedByName} (${generatedByPosition})` : (generatedByName || '-');
    const generatedAt = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let y = margin;

    function drawHeader() {
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 92, 8, 8, 'FD');

      if (logoImage && logoImage.dataUrl) {
        const boxW = 64;
        const boxH = 58;
        const safeW = logoImage.width || boxW;
        const safeH = logoImage.height || boxH;
        const scale = Math.min(boxW / safeW, boxH / safeH);
        const drawW = safeW * scale;
        const drawH = safeH * scale;
        const drawX = margin + 12 + (boxW - drawW) / 2;
        const drawY = y + 12 + (boxH - drawH) / 2;
        doc.addImage(logoImage.dataUrl, 'PNG', drawX, drawY, drawW, drawH);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text((window.PACKAGE_CONTEXT || {}).companyName || 'Training', margin + 82, y + 28);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text('Learning Management System', margin + 82, y + 44);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(11, 31, 68);
      doc.text('Attendance Report', pageWidth - margin - 12, y + 30, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${generatedAt}`, pageWidth - margin - 12, y + 48, { align: 'right' });
      doc.text(`Ref: ${reportReference || '-'}`, pageWidth - margin - 12, y + 62, { align: 'right' });
    }

    drawHeader();
    y += 108;

    doc.setDrawColor(209, 213, 219);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 86, 6, 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text('Training Title', margin + 12, y + 20);
    doc.text('Session Date', margin + 12, y + 42);
    doc.text('Session Time', margin + 12, y + 64);
    doc.text('Duration', margin + 290, y + 20);
    doc.text('Prepared By', margin + 290, y + 42);
    doc.text('Reference', margin + 290, y + 64);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(trainingTitle || '-', margin + 110, y + 20);
    doc.text(utils.formatFriendlyDate(sessionDate), margin + 110, y + 42);
    doc.text(utils.formatFriendlyTime(sessionTime), margin + 110, y + 64);
    doc.text(utils.formatFriendlyDuration(sessionDuration), margin + 365, y + 20);
    doc.text(generatedBy || '-', margin + 365, y + 42);
    doc.text(reportReference || '-', margin + 365, y + 64);

    y += 104;

    const columns = [
      { label: 'No.', width: 28 },
      { label: 'Trainee Name', width: 170 },
      { label: 'Trainee ID', width: 95 },
      { label: 'Status', width: 70 },
      { label: 'Notes', width: pageWidth - margin * 2 - (28 + 170 + 95 + 70) - 16 }
    ];

    const tableX = margin;
    const tableWidth = pageWidth - margin * 2;
    const rowPadding = 4;

    function drawTableHeader() {
      doc.setFillColor(238, 242, 247);
      doc.rect(tableX, y, tableWidth, 22, 'F');
      doc.setDrawColor(214, 222, 232);
      doc.rect(tableX, y, tableWidth, 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(31, 41, 55);
      let x = tableX + 8;
      columns.forEach(col => {
        doc.text(col.label, x, y + 14);
        x += col.width;
      });
      y += 24;
    }

    function hasSpace(neededHeight) {
      const signatureReserved = 150;
      return (y + neededHeight) <= (pageHeight - margin - signatureReserved);
    }

    drawTableHeader();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    (records || []).forEach((r, idx) => {
      const rowData = [
        String(idx + 1),
        `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-',
        String(r.trainee_id || '-'),
        String((r.status || '-')).toUpperCase(),
        String(r.notes || '-')
      ];

      const wrapped = rowData.map((v, i) => doc.splitTextToSize(v, columns[i].width - 10));
      const maxLines = Math.max(...wrapped.map(lines => Math.max(lines.length, 1)));
      const rowHeight = Math.max(18, maxLines * 11 + rowPadding * 2);

      if (!hasSpace(rowHeight + 8)) {
        doc.addPage();
        y = margin;
        drawHeader();
        y += 108;
        drawTableHeader();
      }

      doc.setDrawColor(230, 235, 241);
      doc.rect(tableX, y, tableWidth, rowHeight);

      let x = tableX + 8;
      wrapped.forEach((lines, i) => {
        doc.text(lines, x, y + 12 + rowPadding);
        x += columns[i].width;
      });

      y += rowHeight;
    });

    const summaryTableHeight = 62;
    if (y + summaryTableHeight > pageHeight - margin - 170) {
      doc.addPage();
      y = margin;
      drawHeader();
      y += 110;
    } else {
      y += 12;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Attendance Summary', margin, y);
    y += 10;

    const sumX = margin;
    const sumW = pageWidth - margin * 2;
    const sumHeadH = 20;
    const sumRowH = 24;
    const sumCols = [sumW * 0.28, sumW * 0.24, sumW * 0.24, sumW * 0.24];
    const sumLabels = ['Total Trainees', 'Present', 'Absent', 'Late'];
    const sumValues = [String(summary.total), String(summary.present), String(summary.absent), String(summary.late)];

    doc.setFillColor(237, 242, 247);
    doc.setDrawColor(203, 213, 225);
    doc.rect(sumX, y, sumW, sumHeadH, 'FD');
    doc.rect(sumX, y + sumHeadH, sumW, sumRowH);

    let sx = sumX;
    for (let i = 0; i < sumCols.length; i++) {
      if (i > 0) {
        doc.line(sx, y, sx, y + sumHeadH + sumRowH);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(31, 41, 55);
      doc.text(sumLabels[i], sx + sumCols[i] / 2, y + 13, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(11, 31, 68);
      doc.text(sumValues[i], sx + sumCols[i] / 2, y + sumHeadH + 16, { align: 'center' });
      sx += sumCols[i];
    }

    y += sumHeadH + sumRowH + 16;

    const neededForSignatures = 154;
    if (y + neededForSignatures > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
      y += 110;
    } else {
      y += 16;
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;

    const blockGap = 14;
    const signBlockWidth = (pageWidth - margin * 2 - blockGap * 2) / 3;
    const labels = ['Prepared By (Trainer)', 'Verified By', 'Approved By'];

    labels.forEach((label, i) => {
      const sx2 = margin + (signBlockWidth + blockGap) * i;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(label, sx2, y);

      doc.setDrawColor(17, 24, 39);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(sx2, y + 34, sx2 + signBlockWidth - 8, y + 34);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Signature', sx2, y + 48);

      doc.line(sx2, y + 78, sx2 + signBlockWidth - 8, y + 78);
      doc.text('Name', sx2, y + 92);

      doc.line(sx2, y + 114, sx2 + (signBlockWidth - 8) * 0.62, y + 114);
      doc.text('Date', sx2, y + 128);
      doc.setLineDashPattern([], 0);
    });

    if (download) {
      const safeDate = utils.sanitizeFileName(normalizeDate(sessionDate) || sessionDate || 'session');
      doc.save(`Attendance_Report_${safeDate}.pdf`);
      return null;
    }

    return doc.output('blob');
  }

  pkg.attendance = {
    buildSessionReference,
    fetchTrainingSessions,
    fetchSessionRecords,
    generateAttendancePdfReport
  };
})();
