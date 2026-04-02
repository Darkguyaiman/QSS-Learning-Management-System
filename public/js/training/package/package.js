(function () {
  const pkg = window.QSSPackage = window.QSSPackage || {};
  const utils = pkg.utils;

  async function generatePackage() {
    const ctx = window.PACKAGE_CONTEXT || {};

    if (!ctx.isLocked) {
      return qssShowError('Package is only available after training is locked.');
    }

    const formData = utils.collectFormData();
    if (!formData.hospitalName || !formData.deviceModel || !formData.address || !formData.recipientName || !formData.recipientPhone) {
      return qssShowError('Please fill all package form fields.');
    }

    const btn = document.getElementById('btn-generate-package-tab');
    const prev = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    }

    try {
      const response = await fetch(`/training/${encodeURIComponent(ctx.trainingId)}/package/zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ formData })
      });
      if (!response.ok) {
        let message = 'Failed to generate package.';
        try {
          const data = await response.json();
          if (data && data.error) message = data.error;
        } catch (_) {
          // no-op
        }
        throw new Error(message);
      }
      const zipBlob = await response.blob();
      const packDateSource = (ctx.trainingStartDate || ctx.trainingEndDate || new Date().toISOString().slice(0, 10)).toString().split('T')[0].split(' ')[0];
      const packDate = utils.sanitizeFileName(packDateSource);
      const name = utils.sanitizeFileName(ctx.trainingTitle || 'Training');
      await utils.downloadBlob(`${name}_${packDate}_Package.zip`, zipBlob);
    } catch (e) {
      console.error(e);
      qssShowError(e && e.message ? e.message : 'Failed to generate package.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btn-generate-package-tab')?.addEventListener('click', generatePackage);
  });
})();
