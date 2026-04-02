(function () {
  const pkg = window.QSSPackage = window.QSSPackage || {};
  const utils = pkg.utils;

  function formatAddress(address) {
    return String(address || '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .join('<br>');
  }

  function buildTrainingLetterHtml({ formData, selectedRows, attendanceSessionCount }) {
    const ctx = window.PACKAGE_CONTEXT || {};
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const docRef = utils.toDateRef();
    const companyCode = String(ctx.companyCode || ctx.companyShortName || 'QSS').toUpperCase();
    const headerImagePath = companyCode === 'PMS'
      ? '/images/Headers/PMS%20Header.jpg'
      : '/images/Headers/QSS%20Header.jpg';
    const headerHtml = `<img src="${headerImagePath}" alt="${utils.escapeHtml(companyCode)} Header" class="qss-package-header-image">`;

    return `
    <div class="qss-package-letter-root" style="font-family:Calibri,'Segoe UI','Helvetica Neue',Arial,sans-serif;margin:0;padding:0;color:#1a1a1a;line-height:1.5;font-size:10pt;background:#fff;">
      <style>
        .qss-package-letter-root {
          box-sizing: border-box;
          width: 100%;
          max-width: 100%;
          overflow-wrap: anywhere;
          word-wrap: break-word;
        }
        .qss-package-letter-root .page {
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 10px 10px 10px 10px;
          box-sizing: border-box;
        }
        .header {
          text-align: center;
          margin: 0 0 10px 0;
        }
        .qss-package-header-image {
          display: block;
          margin: 0 auto;
          max-width: 100%;
          width: 100%;
          height: auto;
        }
        .container {
          width: 100%;
          box-sizing: border-box;
          padding-left: 0;
        }
        .letterhead-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          table-layout: fixed;
        }
        .letterhead-table td {
          vertical-align: top;
          padding: 12px 12px;
        }
        .address-block {
          width: 62%;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .date-ref-block {
          width: 38%;
          text-align: right;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .recipient-block {
          margin: 0 0 12px 0;
          padding: 0 2px;
        }
        .recipient-block p {
          margin: 3px 0;
        }
        .subject {
          font-weight: 700;
          font-size: 11pt;
          margin: 15px 0;
          color: #1a1a1a;
          text-align: center;
          background: #e8f4fc;
          padding: 10px 12px;
          border-radius: 8px;
          letter-spacing: 0.3px;
        }
        p {
          text-align: justify;
          margin: 7px 0;
          padding: 0 2px;
        }
        .details-block {
          background: #f9f9f9;
          border-radius: 8px;
          padding: 15px;
          margin: 15px 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        }
        .details-item {
          margin: 6px 0;
          font-size: 9.5pt;
        }
        .signature-block {
          margin: 25px 0 10px;
          padding: 0 2px;
        }
        .signature-line {
          border-top: 1.5px solid #000;
          width: 240px;
          margin-top: 25px;
        }
        .signatory {
          margin-top: 5px;
        }
        .signatory p {
          margin: 2px 0;
          line-height: 1.3;
        }
        .bold {
          font-weight: 700;
        }
        .contact-block {
          background: #f9f9f9;
          border-radius: 8px;
          padding: 12px 15px;
          margin: 10px 0 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
          font-size: 9pt;
        }
        .contact-item {
          margin: 4px 0;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .motto {
          font-style: italic;
          text-align: center;
          color: #444;
          margin: 8px 0;
          font-size: 9pt;
          letter-spacing: 0.3px;
        }
        .footer {
          font-size: 8pt;
          color: #444;
          border-top: 1px solid #ddd;
          padding-top: 8px;
          text-align: center;
        }
        @media print {
          .qss-package-letter-root {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .qss-package-letter-root .page {
            width: 100%;
            max-width: 100%;
            margin: 0;
          }
          .letterhead-table,
          .details-block,
          .contact-block {
            break-inside: avoid;
          }
          .signature-block {
            page-break-inside: avoid;
          }
        }
      </style>
      <div class="page">
        <div class="header">
          ${headerHtml}
        </div>

        <div class="container">
          <table class="letterhead-table">
            <tr>
              <td class="address-block">
                <strong>${utils.escapeHtml(formData.hospitalName)}</strong><br>
                ${formatAddress(formData.address)}
              </td>
              <td class="date-ref-block">
                <strong>Date:</strong> ${utils.escapeHtml(currentDate)}<br>
                <strong>Ref:</strong> ${utils.escapeHtml(docRef)}
              </td>
            </tr>
          </table>

          <div class="recipient-block">
            <p><strong>Attn to:</strong> Mr/Mrs ${utils.escapeHtml(formData.recipientName)}</p>
            <p><strong>Phone num:</strong> ${utils.escapeHtml(formData.recipientPhone)}</p>
          </div>

          <div class="subject">CONFIRMATION OF IN-HOUSE TRAINING FOR KLASER DEVICE</div>

          <p>Dear ${utils.escapeHtml(formData.recipientName)},</p>
          <p>We are pleased to confirm that the following staff members have successfully attended the in-house training for the KLaser device. Details of the training are as below:</p>

          <div class="details-block">
            <div class="details-item"><strong>Date and Time:</strong> ${utils.escapeHtml(utils.formatTrainingPeriod())}</div>
            <div class="details-item"><strong>KLaser Model:</strong> ${utils.escapeHtml(formData.deviceModel)}</div>
            <div class="details-item"><strong>Training Type:</strong> ${ctx.trainingType === 'main' ? 'Main Training' : 'Refresher Training'}</div>
            <div class="details-item"><strong>Attendance Scope:</strong> all recorded sessions${attendanceSessionCount ? ` (${attendanceSessionCount} session${attendanceSessionCount === 1 ? '' : 's'})` : ''}</div>
            <div class="details-item"><strong>Group Report:</strong> please refer to Group Report.pdf</div>
            <div class="details-item"><strong>Total Participants:</strong> ${selectedRows.length}</div>
          </div>

          <p>The training was conducted by ${utils.escapeHtml(ctx.companyName)}, covering safety, technical, and clinical aspects of the device. The participants have demonstrated a satisfactory understanding of these key areas.</p>
          <p>As a result of this training, these staff members are now qualified to perform laser treatments using the KLaser (${utils.escapeHtml(formData.deviceModel)}) device.</p>
          <p>Should you require any further information or clarification, please do not hesitate to contact us. We appreciate your cooperation and look forward to continued collaboration.</p>
          <p>Thank you.</p>
          <p>Yours sincerely,</p>

          <div class="signature-block">
            <div class="signature-line"></div>
            <div class="signatory">
              <p class="bold">Shah Zarak Kahn Bin Ashiq Hussain</p>
              <p class="bold">Group Managing Director,</p>
              <p class="bold">${utils.escapeHtml(ctx.companyName)}</p>
            </div>
          </div>

          <div class="contact-block">
            <div class="contact-item">
              <strong>Address:</strong> Unit T2A-08-06 Menara 3 (3 Towers), No 296, Jalan Ampang, 50450 Kuala Lumpur, Malaysia
            </div>
            <div class="contact-item">
              <strong>(E)</strong> qssmalaysia@yahoo.com / annez@pain.com.my
            </div>
            <div class="contact-item">
              <strong>(W)</strong> www.pain.com.my, www.klaser.com.my, www.photomedicine.com.my
            </div>
            <div class="contact-item"><strong>(C)</strong> +6019-2621626 / +6012-7241626</div>
          </div>

          <div class="motto">Saving Limbs, Live Life, Pain Free, Drug Free, Medical Evidence Solutions</div>

          <div class="footer">
            <strong>Malaysian address:</strong> Unit T2A-08-06 Menara 3 (3 Towers), No 296, Jalan Ampang, 50450 Kuala Lumpur, Malaysia.
          </div>
        </div>
      </div>
    </div>`;
  }

  async function buildTrainingLetterPdfBlob({ formData, selectedRows, attendanceSessionCount }) {
    const ctx = window.PACKAGE_CONTEXT || {};
    const endpoint = '/training/' + encodeURIComponent(ctx.trainingId) + '/package/letter-pdf';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        formData,
        attendanceSessionCount,
        totalParticipants: Array.isArray(selectedRows) ? selectedRows.length : 0
      })
    });
    if (!response.ok) {
      throw new Error('Backend letter PDF failed: HTTP ' + response.status);
    }
    return await response.blob();
  }

  pkg.buildTrainingLetterPdfBlob = buildTrainingLetterPdfBlob;
})();

