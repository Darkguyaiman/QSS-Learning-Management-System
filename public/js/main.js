// QSS Message Modal (replaces browser alert for success/error messages)
(function () {
  const MODAL_ROOT_ID = 'qss-message-modal-root';

  function ensureModalRoot() {
    let root = document.getElementById(MODAL_ROOT_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = MODAL_ROOT_ID;
    root.innerHTML = `
      <div class="qss-message-overlay" data-qss-overlay="true" aria-hidden="true">
        <div class="qss-message-modal" role="dialog" aria-modal="true" aria-labelledby="qss-message-title">
          <div class="qss-message-header">
            <div class="qss-message-header-left">
              <span class="qss-message-icon" aria-hidden="true"></span>
              <div id="qss-message-title" class="qss-message-title"></div>
            </div>
            <button type="button" class="qss-message-close" aria-label="Close">×</button>
          </div>
          <div class="qss-message-body" id="qss-message-body"></div>
          <div class="qss-message-actions">
            <button type="button" class="btn btn-primary qss-message-ok">OK</button>
          </div>
        </div>
      </div>
    `;

    // Attach once DOM is available
    if (document.body) {
      document.body.appendChild(root);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(root), { once: true });
    }

    const overlay = root.querySelector('.qss-message-overlay');
    const closeBtn = root.querySelector('.qss-message-close');
    const okBtn = root.querySelector('.qss-message-ok');

    function close() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');

      if (typeof root.__qssOnClose === 'function') {
        const cb = root.__qssOnClose;
        root.__qssOnClose = null;
        try {
          cb();
        } catch (e) {
          console.error('qssShowMessage onClose error:', e);
        }
      } else {
        root.__qssOnClose = null;
      }
    }

    overlay.addEventListener('click', (e) => {
      if (e.target && e.target.dataset && e.target.dataset.qssOverlay === 'true') {
        close();
      }
    });
    closeBtn.addEventListener('click', close);
    okBtn.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
        close();
      }
    });

    // Expose close for internal calls if needed
    root.__qssClose = close;
    root.__qssOnClose = null;

    return root;
  }

  function iconForType(type) {
    // Font Awesome is present on most pages; fallback is simple characters.
    switch (type) {
      case 'success':
        return '<i class="fa-solid fa-circle-check"></i>';
      case 'error':
        return '<i class="fa-solid fa-circle-xmark"></i>';
      case 'warning':
        return '<i class="fa-solid fa-triangle-exclamation"></i>';
      default:
        return '<i class="fa-solid fa-circle-info"></i>';
    }
  }

  function defaultTitleForType(type) {
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      default:
        return 'Message';
    }
  }

  function appendIfMissing(text, extra, patterns) {
    if (!text || !extra) return text || '';
    const hay = String(text).toLowerCase();
    const has = patterns && patterns.some((p) => hay.includes(p));
    return has ? String(text) : `${text}\n\n${extra}`;
  }

  function enhanceMessage(type, message) {
    switch (type) {
      case 'error':
        return appendIfMissing(
          message,
          'Please try again. If the problem continues, refresh the page and retry.',
          ['please try again', 'refresh']
        );
      case 'warning':
        return appendIfMissing(
          message,
          'Review the information above and try again.',
          ['review', 'try again']
        );
      case 'success':
        return appendIfMissing(
          message,
          'You can continue with the next step or close this message.',
          ['continue', 'close']
        );
      default:
        return message || '';
    }
  }

  window.qssShowMessage = function ({ type = 'info', title, message, onClose } = {}) {
    const root = ensureModalRoot();
    const overlay = root.querySelector('.qss-message-overlay');
    const titleEl = root.querySelector('#qss-message-title');
    const bodyEl = root.querySelector('#qss-message-body');
    const iconEl = root.querySelector('.qss-message-icon');

    // Reset type classes
    overlay.classList.remove('type-success', 'type-error', 'type-warning', 'type-info');
    overlay.classList.add(`type-${type}`);

    titleEl.textContent = title || defaultTitleForType(type);
    bodyEl.textContent = enhanceMessage(type, message || '');
    iconEl.innerHTML = iconForType(type);
    root.__qssOnClose = typeof onClose === 'function' ? onClose : null;

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');

    // Focus OK for keyboard users
    const okBtn = root.querySelector('.qss-message-ok');
    okBtn && okBtn.focus && okBtn.focus();
  };

  window.qssShowSuccess = function (message, title = 'Success') {
    window.qssShowMessage({ type: 'success', title, message });
  };

  window.qssShowError = function (message, title = 'Error') {
    window.qssShowMessage({ type: 'error', title, message });
  };

  window.qssShowWarning = function (message, title = 'Warning') {
    window.qssShowMessage({ type: 'warning', title, message });
  };
})();

// QSS Confirm Modal (replaces browser confirm for destructive actions)
(function () {
  const ROOT_ID = 'qss-confirm-modal-root';

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="qss-confirm-overlay" data-qss-confirm-overlay="true" aria-hidden="true">
        <div class="qss-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="qss-confirm-title">
          <div class="qss-confirm-header">
            <div class="qss-confirm-header-left">
              <span class="qss-confirm-icon" aria-hidden="true"><i class="fa-solid fa-triangle-exclamation"></i></span>
              <div id="qss-confirm-title" class="qss-confirm-title"></div>
            </div>
            <button type="button" class="qss-confirm-close" aria-label="Close">×</button>
          </div>
          <div class="qss-confirm-body" id="qss-confirm-body"></div>
          <div class="qss-confirm-actions">
            <button type="button" class="btn btn-outline qss-confirm-cancel">Cancel</button>
            <button type="button" class="btn btn-primary qss-confirm-ok">Confirm</button>
          </div>
        </div>
      </div>
    `;

    if (document.body) {
      document.body.appendChild(root);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(root), { once: true });
    }

    const overlay = root.querySelector('.qss-confirm-overlay');
    const closeBtn = root.querySelector('.qss-confirm-close');
    const cancelBtn = root.querySelector('.qss-confirm-cancel');
    const okBtn = root.querySelector('.qss-confirm-ok');

    function close(result) {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      if (typeof root.__qssResolve === 'function') {
        const r = root.__qssResolve;
        root.__qssResolve = null;
        r(!!result);
      } else {
        root.__qssResolve = null;
      }
    }

    overlay.addEventListener('click', (e) => {
      if (e.target && e.target.dataset && e.target.dataset.qssConfirmOverlay === 'true') {
        close(false);
      }
    });
    closeBtn.addEventListener('click', () => close(false));
    cancelBtn.addEventListener('click', () => close(false));
    okBtn.addEventListener('click', () => close(true));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
        close(false);
      }
    });

    root.__qssResolve = null;
    root.__qssClose = close;
    return root;
  }

  window.qssConfirm = function ({
    title = 'Confirm',
    message = 'Are you sure?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false
  } = {}) {
    function appendIfMissing(text, extra, patterns) {
      if (!text || !extra) return text || '';
      const hay = String(text).toLowerCase();
      const has = patterns && patterns.some((p) => hay.includes(p));
      return has ? String(text) : `${text}\n\n${extra}`;
    }

    const root = ensureRoot();
    const overlay = root.querySelector('.qss-confirm-overlay');
    const titleEl = root.querySelector('#qss-confirm-title');
    const bodyEl = root.querySelector('#qss-confirm-body');
    const okBtn = root.querySelector('.qss-confirm-ok');
    const cancelBtn = root.querySelector('.qss-confirm-cancel');

    const detail = danger
      ? 'This action is permanent and cannot be undone.'
      : 'You can cancel to keep the current data.';
    const finalMessage = appendIfMissing(message || '', detail, ['cannot be undone', 'permanent', 'cancel']);
    titleEl.textContent = title || 'Confirm';
    bodyEl.textContent = finalMessage || '';
    okBtn.textContent = confirmText || 'Confirm';
    cancelBtn.textContent = cancelText || 'Cancel';

    okBtn.classList.toggle('btn-danger', !!danger);
    okBtn.classList.toggle('btn-primary', !danger);

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');

    // Focus cancel by default to reduce accidental confirmations
    cancelBtn && cancelBtn.focus && cancelBtn.focus();

    return new Promise((resolve) => {
      root.__qssResolve = resolve;
    });
  };
})();

// QSS Select Modal (mobile-friendly picker for long <select> options)
(function () {
  const ROOT_ID = 'qss-select-modal-root';

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="qss-select-overlay" data-qss-select-overlay="true" aria-hidden="true">
        <div class="qss-select-modal" role="dialog" aria-modal="true" aria-labelledby="qss-select-title">
          <div class="qss-select-header">
            <div class="qss-select-title" id="qss-select-title"></div>
            <button type="button" class="qss-select-close" aria-label="Close">×</button>
          </div>
          <div class="qss-select-body">
            <div class="qss-select-search-wrap">
              <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <input type="text" class="qss-select-search" placeholder="Search..." autocomplete="off" />
            </div>
            <div class="qss-select-list" role="listbox" tabindex="-1"></div>
          </div>
          <div class="qss-select-actions">
            <button type="button" class="btn btn-secondary qss-select-cancel">Cancel</button>
          </div>
        </div>
      </div>
    `;

    if (document.body) {
      document.body.appendChild(root);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(root), { once: true });
    }

    const overlay = root.querySelector('.qss-select-overlay');
    const closeBtn = root.querySelector('.qss-select-close');
    const cancelBtn = root.querySelector('.qss-select-cancel');

    function close() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      root.__qssOnPick = null;
    }

    overlay.addEventListener('click', (e) => {
      if (e.target && e.target.dataset && e.target.dataset.qssSelectOverlay === 'true') {
        close();
      }
    });
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
        close();
      }
    });

    root.__qssClose = close;
    root.__qssOnPick = null;
    return root;
  }

  function renderList(root, options, selectedValue, filterText) {
    const list = root.querySelector('.qss-select-list');
    const q = String(filterText || '').trim().toLowerCase();
    list.innerHTML = '';

    const filtered = q
      ? options.filter(o => String(o.label || '').toLowerCase().includes(q))
      : options;

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'qss-select-empty';
      empty.textContent = 'No matches';
      list.appendChild(empty);
      return;
    }

    filtered.forEach((opt) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'qss-select-item';
      item.setAttribute('role', 'option');
      item.dataset.value = String(opt.value);

      const isSelected = String(opt.value) === String(selectedValue);
      if (isSelected) {
        item.classList.add('is-selected');
        item.setAttribute('aria-selected', 'true');
      }

      const label = document.createElement('div');
      label.className = 'qss-select-item-label';
      label.textContent = String(opt.label || '');

      const check = document.createElement('div');
      check.className = 'qss-select-item-check';
      check.innerHTML = isSelected ? '<i class="fa-solid fa-check"></i>' : '';

      item.appendChild(label);
      item.appendChild(check);

      item.addEventListener('click', () => {
        if (typeof root.__qssOnPick === 'function') {
          root.__qssOnPick(String(opt.value));
        }
        root.__qssClose && root.__qssClose();
      });

      list.appendChild(item);
    });
  }

  window.qssShowSelectModal = function ({ title = 'Select', options = [], selectedValue = '', onPick } = {}) {
    const root = ensureRoot();
    const overlay = root.querySelector('.qss-select-overlay');
    const titleEl = root.querySelector('#qss-select-title');
    const searchEl = root.querySelector('.qss-select-search');

    titleEl.textContent = title;
    root.__qssOnPick = typeof onPick === 'function' ? onPick : null;

    // Initial render
    renderList(root, options, selectedValue, '');

    // Wire search
    searchEl.value = '';
    const onInput = () => renderList(root, options, selectedValue, searchEl.value);
    searchEl.oninput = onInput;

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');

    // Focus search for fast picking
    setTimeout(() => searchEl && searchEl.focus && searchEl.focus(), 0);
  };
})();

// Confirmation dialogs
document.addEventListener('DOMContentLoaded', () => {
  // Delete confirmations
  const deleteButtons = document.querySelectorAll('[data-confirm]');
  deleteButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      const msg = button.dataset.confirm || 'Are you sure?';
        e.preventDefault();

      const danger = button.dataset.confirmDanger !== 'false';
      const ok = typeof window.qssConfirm === 'function'
        ? await window.qssConfirm({ title: 'Confirm', message: msg, confirmText: danger ? 'Delete' : 'Confirm', cancelText: 'Cancel', danger })
        : false;

      if (!ok) return;

      // Proceed with original intent
      const tag = (button.tagName || '').toUpperCase();
      if (tag === 'A' && button.href) {
        window.location.href = button.href;
        return;
      }

      const form = button.form || button.closest('form');
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit(button);
        } else {
          form.submit();
        }
      }
    });
  });
  
  // Auto-hide alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  });
  
  // Highlight active sidebar link
  function highlightActiveSidebarLink() {
    const currentPath = window.location.pathname;
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    
    if (sidebarLinks.length === 0) {
      return; // No sidebar links found
    }
    
    sidebarLinks.forEach(link => {
      // Remove any existing active class first
      link.classList.remove('active');
      
      // Get href attribute and extract pathname
      const href = link.getAttribute('href');
      if (!href) return;
      
      let linkPath = href;
      
      // Extract pathname from href (handle both absolute and relative URLs)
      if (href.startsWith('http://') || href.startsWith('https://')) {
        try {
          linkPath = new URL(href).pathname;
        } catch (e) {
          linkPath = href.split('?')[0].split('#')[0];
        }
      } else {
        // For relative URLs, remove query strings and hash
        linkPath = href.split('?')[0].split('#')[0];
      }
      
      // Normalize: remove trailing slashes (except root)
      const cleanCurrentPath = currentPath.replace(/\/$/, '') || '/';
      const cleanLinkPath = linkPath.replace(/\/$/, '') || '/';
      
      // Exact match
      if (cleanCurrentPath === cleanLinkPath) {
        link.classList.add('active');
      }
      // Sub-path match (e.g., /training/123 should highlight /training, /questions/1/edit should highlight /questions)
      else if (cleanLinkPath !== '/' && cleanCurrentPath.startsWith(cleanLinkPath + '/')) {
        link.classList.add('active');
      }
    });
  }
  
  // Run immediately
  highlightActiveSidebarLink();
  
  // Also run after a short delay in case DOM isn't fully ready
  setTimeout(highlightActiveSidebarLink, 100);
});

// Attendance marking
async function markAttendance(enrollmentId, date, status) {
  try {
    const response = await fetch('/attendance/mark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enrollmentId, date, status, notes: '' })
    });
    
    const data = await response.json();
    if (data.success) {
      qssShowSuccess('Attendance marked successfully');
    }
  } catch (error) {
    console.error('Error marking attendance:', error);
    qssShowError('Error marking attendance');
  }
}

// Allow download results
async function allowDownload(enrollmentId) {
  if (typeof window.qssConfirm !== 'function') return;
  const ok = await window.qssConfirm({
    title: 'Allow Download?',
    message: 'Allow this trainee to download their results?',
    confirmText: 'Allow',
    cancelText: 'Cancel'
  });
  if (!ok) return;
  
  try {
    const response = await fetch(`/results/allow-download/${enrollmentId}`, {
      method: 'POST'
    });
    
    const data = await response.json();
    if (data.success) {
      qssShowMessage({
        type: 'success',
        title: 'Success',
        message: 'Download permission granted',
        onClose: () => location.reload()
      });
    }
  } catch (error) {
    console.error('Error allowing download:', error);
    qssShowError('Error granting permission');
  }
}

// Score hands-on aspect
async function scoreHandsOn(enrollmentId, aspectId, score, comments) {
  try {
    const response = await fetch('/results/score-hands-on', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enrollmentId, aspectId, score, comments })
    });
    
    const data = await response.json();
    if (data.success) {
      qssShowMessage({
        type: 'success',
        title: 'Success',
        message: 'Score saved successfully',
        onClose: () => location.reload()
      });
    }
  } catch (error) {
    console.error('Error saving score:', error);
    qssShowError('Error saving score');
  }
}
