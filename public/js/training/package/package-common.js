(function () {
  const pkg = window.QSSPackage = window.QSSPackage || {};

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeFileName(name) {
    return String(name || 'file').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
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

  function drawSimpleWrappedText(doc, text, x, y, maxWidth, lineHeight) {
    const lines = doc.splitTextToSize(String(text || ''), maxWidth);
    doc.text(lines, x, y);
    return y + (Math.max(lines.length, 1) * lineHeight);
  }

  function toDateRef(dateStr) {
    const ctx = window.PACKAGE_CONTEXT || {};
    const fallback = ctx.trainingStartDate || ctx.trainingEndDate || '';
    const value = dateStr || fallback;
    const normalized = value ? String(value).split('T')[0].split(' ')[0] : '';
    const d = normalized ? new Date(`${normalized}T00:00:00`) : new Date();
    const y = d.getFullYear();
    return `${ctx.companyCode}/TRN/${y}/${String(ctx.trainingId).padStart(5, '0')}`;
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

  function buildMarksMap() {
    const map = new Map();
    const ctx = window.PACKAGE_CONTEXT || {};
    (ctx.marksData || []).forEach(item => {
      map.set(String(item.trainee_id || '').trim(), item);
    });
    return map;
  }

  function formatTrainingPeriod() {
    const ctx = window.PACKAGE_CONTEXT || {};
    const start = ctx.trainingStartDate;
    const end = ctx.trainingEndDate;
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

  function getAttendanceSessionCount(rows) {
    const totals = (Array.isArray(rows) ? rows : []).map(row => {
      const presentCount = parseInt(row.present_count || 0, 10) || 0;
      const absentCount = parseInt(row.absent_count || 0, 10) || 0;
      return presentCount + absentCount;
    }).filter(count => count > 0);
    return totals.length ? Math.max(...totals) : 0;
  }

  function getAutoRows() {
    const ctx = window.PACKAGE_CONTEXT || {};
    const rows = Array.isArray(ctx.attendanceData) ? ctx.attendanceData : [];
    const seen = new Set();
    return rows.filter(row => {
      const key = String(row.trainee_id || row.id || '').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function collectFormData() {
    return {
      hospitalName: (document.getElementById('package-hospital-name-hidden')?.value || document.getElementById('package-hospital-name')?.value || '').trim(),
      deviceModel: (document.getElementById('package-device-model')?.value || '').trim(),
      address: (document.getElementById('package-address-hidden')?.value || document.getElementById('package-address')?.value || '').trim(),
      recipientName: (document.getElementById('package-recipient-name')?.value || '').trim(),
      recipientPhone: (document.getElementById('package-recipient-phone')?.value || '').trim()
    };
  }

  async function loadLogoPngDataUrl() {
    const ctx = window.PACKAGE_CONTEXT || {};
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 300;
          c.height = img.naturalHeight || 120;
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve({
            dataUrl: c.toDataURL('image/png'),
            width: c.width,
            height: c.height
          });
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = ctx.companyLogo || '';
    });
  }

  async function loadLogoAsDataUrl() {
    const image = await loadLogoPngDataUrl();
    return image ? image.dataUrl : null;
  }

  function pdfPageWidthIn(orientation) {
    const shortIn = 210 / 25.4;
    const longIn = 297 / 25.4;
    return orientation === 'landscape' ? longIn : shortIn;
  }

  /** Horizontal margins (inches) from html2pdf `margin`: number, [v,h], or [top,left,bottom,right]. */
  function pdfHorizontalMarginsIn(margin) {
    if (typeof margin === 'number' && Number.isFinite(margin)) {
      return { left: margin, right: margin };
    }
    if (Array.isArray(margin)) {
      if (margin.length >= 4) {
        return { left: margin[1], right: margin[3] };
      }
      if (margin.length >= 2) {
        return { left: margin[1], right: margin[1] };
      }
    }
    return { left: 0.2, right: 0.2 };
  }

  /** CSS px width matching jsPDF content area for the given margins (avoids scale/clipping mismatch). */
  function pdfContentSlotWidthPx(orientation, margin) {
    const cssPxPerIn = 96;
    const pageWidthIn = pdfPageWidthIn(orientation);
    const { left, right } = pdfHorizontalMarginsIn(margin);
    return Math.max(320, Math.round((pageWidthIn - left - right) * cssPxPerIn));
  }

  async function htmlToPdfBlob(html, orientation = 'portrait', pdfOptions = {}) {
    const margin = pdfOptions.margin != null ? pdfOptions.margin : 0.2;
    const slotW = pdfContentSlotWidthPx(orientation, margin);
    const mount = document.createElement('div');
    mount.style.position = 'absolute';
    mount.style.left = '0';
    mount.style.top = '0';
    mount.style.visibility = 'hidden';
    mount.style.zIndex = '-1';
    mount.style.pointerEvents = 'none';
    mount.style.width = `${slotW}px`;
    mount.style.maxWidth = `${slotW}px`;
    mount.style.boxSizing = 'border-box';
    mount.style.background = '#ffffff';
    mount.style.overflow = 'visible';
    mount.innerHTML = html;
    document.body.appendChild(mount);
    let root = mount.firstElementChild || mount;
    if (root && root.tagName === 'HTML') {
      const bodyEl = root.querySelector('body');
      if (bodyEl) root = bodyEl;
    }
    root.style.background = '#ffffff';
    root.style.overflow = 'visible';
    root.style.width = `${slotW}px`;
    root.style.maxWidth = `${slotW}px`;
    root.style.boxSizing = 'border-box';
    root.style.margin = '0';
    root.style.padding = '0';

    await new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });

    const pagebreak = pdfOptions.pagebreak || { mode: ['css', 'legacy'] };

    const opt = {
      margin,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: slotW,
        windowHeight: Math.max(400, Math.ceil(root.scrollHeight || 0))
      },
      jsPDF: { unit: 'in', format: 'a4', orientation },
      pagebreak
    };

    try {
      const worker = window.html2pdf().set(opt).from(root);
      try {
        return await worker.outputPdf('blob');
      } catch (_) {
        const pdf = await worker.toPdf().get('pdf');
        return pdf.output('blob');
      }
    } finally {
      document.body.removeChild(mount);
    }
  }

  async function downloadBlob(filename, blob) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  pkg.utils = {
    escapeHtml,
    sanitizeFileName,
    formatFriendlyDate,
    formatFriendlyDateTime,
    formatFriendlyTime,
    formatFriendlyDuration,
    drawSimpleWrappedText,
    toDateRef,
    getBestTestScore,
    getPerformanceDescriptor,
    getPerformanceClass,
    buildMarksMap,
    formatTrainingPeriod,
    getAttendanceSessionCount,
    getAutoRows,
    collectFormData,
    loadLogoAsDataUrl,
    loadLogoPngDataUrl,
    htmlToPdfBlob,
    downloadBlob
  };
})();
