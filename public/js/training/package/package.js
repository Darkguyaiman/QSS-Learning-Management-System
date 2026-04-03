(function () {
  const pkg = window.QSSPackage = window.QSSPackage || {};
  const utils = pkg.utils;
  const POLL_INTERVAL_MS = 2000;

  function setPackageJobState(message) {
    const statusEl = document.getElementById('package-job-status');
    if (statusEl) {
      statusEl.textContent = message || '';
    }
  }

  function setGenerateButtonState(isBusy, labelHtml) {
    const btn = document.getElementById('btn-generate-package-tab');
    if (!btn) return { btn: null, previousHtml: '' };

    if (!btn.dataset.defaultLabel) {
      btn.dataset.defaultLabel = btn.innerHTML;
    }

    btn.disabled = !!isBusy;
    if (isBusy) {
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = labelHtml || '<i class="fas fa-spinner fa-spin"></i> Generating...';
    } else {
      btn.removeAttribute('aria-busy');
      btn.innerHTML = btn.dataset.defaultLabel;
    }

    return { btn, previousHtml: btn.dataset.defaultLabel };
  }

  async function downloadPackageZip(downloadUrl, fallbackName) {
    const response = await fetch(downloadUrl, {
      method: 'GET',
      credentials: 'same-origin'
    });
    if (!response.ok) {
      let message = 'Failed to download package.';
      try {
        const data = await response.json();
        if (data && data.error) message = data.error;
      } catch (_) {
        // no-op
      }
      throw new Error(message);
    }

    const zipBlob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/i);
    const filename = match && match[1] ? match[1] : fallbackName;
    await utils.downloadBlob(filename, zipBlob);
  }

  async function pollPackageJob(ctx, jobId) {
    while (true) {
      const response = await fetch(`/training/${encodeURIComponent(ctx.trainingId)}/package/jobs/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        credentials: 'same-origin'
      });

      if (!response.ok) {
        let message = 'Failed to check package job status.';
        try {
          const data = await response.json();
          if (data && data.error) message = data.error;
        } catch (_) {
          // no-op
        }
        throw new Error(message);
      }

      const result = await response.json();
      if (result.status === 'completed' && result.downloadUrl) {
        return result;
      }
      if (result.status === 'failed') {
        throw new Error(result.error || 'Package generation failed.');
      }

      setPackageJobState(result.status === 'processing'
        ? 'Package is generating in the background. This can take a while for large trainings.'
        : 'Package is queued. It will start shortly.');

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  async function generatePackage() {
    const ctx = window.PACKAGE_CONTEXT || {};
    const btn = document.getElementById('btn-generate-package-tab');

    if (btn && btn.disabled) {
      return;
    }

    if (!ctx.isCompleted) {
      return qssShowError('Package is only available after training is completed.');
    }

    const formData = utils.collectFormData();
    if (!formData.hospitalName || !formData.deviceModel || !formData.address || !formData.recipientName || !formData.recipientPhone) {
      return qssShowError('Please fill all package form fields.');
    }

    setGenerateButtonState(true, '<i class="fas fa-spinner fa-spin"></i> Queueing...');
    setPackageJobState('Submitting package generation job...');

    try {
      const response = await fetch(`/training/${encodeURIComponent(ctx.trainingId)}/package/jobs`, {
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

      const result = await response.json();
      const packDateSource = (ctx.trainingStartDate || ctx.trainingEndDate || new Date().toISOString().slice(0, 10)).toString().split('T')[0].split(' ')[0];
      const packDate = utils.sanitizeFileName(packDateSource);
      const name = utils.sanitizeFileName(ctx.trainingTitle || 'Training');
      const fallbackFilename = `${name}_${packDate}_Package.zip`;

      setGenerateButtonState(true, '<i class="fas fa-spinner fa-spin"></i> Waiting...');
      setPackageJobState(result.status === 'processing'
        ? 'Package generation started. Waiting for it to finish...'
        : 'Package queued. Waiting for worker to start...');

      const completedJob = await pollPackageJob(ctx, result.jobId);

      setGenerateButtonState(true, '<i class="fas fa-spinner fa-spin"></i> Downloading...');
      setPackageJobState('Package is ready. Downloading...');
      await downloadPackageZip(completedJob.downloadUrl, fallbackFilename);
      setPackageJobState('Package generated successfully.');
      if (window.qssShowSuccess) {
        window.qssShowSuccess('Package generated successfully.');
      }
    } catch (e) {
      console.error(e);
      setPackageJobState('');
      qssShowError(e && e.message ? e.message : 'Failed to generate package.');
    } finally {
      setGenerateButtonState(false);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btn-generate-package-tab')?.addEventListener('click', generatePackage);
  });
})();
