/**
 * tw-components.js
 * Reusable Tailwind CSS UI Components
 * - TailwindDropdown: single-select and multi-select dropdown
 * - TailwindModal: success, error, and confirm modals
 *
 * Usage is available globally on `window.TailwindDropdown` and `window.TailwindModal`.
 */

/* ============================================================
   TailwindDropdown
   ============================================================ */
(function () {
  /**
   * TailwindDropdown
   * @param {string} containerId - ID of the wrapper <div>
   * @param {object} options
   *   - items: [{ label, value }]
   *   - multiSelect: boolean (default false)
   *   - placeholder: string
   *   - onChange: function(selectedValue | selectedValues[])
   *   - initialValue: string | string[] (pre-selected value(s))
   */
  function TailwindDropdown(containerId, options) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn('[TailwindDropdown] Container not found:', containerId);
      return;
    }
    this.container.classList.add('tw-dropdown');

    this.items = options.items || [];
    this.isMulti = !!options.multiSelect;
    this.placeholder = options.placeholder || 'Select an option';
    this.onChange = typeof options.onChange === 'function' ? options.onChange : function () {};

    if (this.isMulti) {
      var iv = options.initialValue;
      this.selected = Array.isArray(iv) ? iv.slice() : (iv ? [iv] : []);
    } else {
      this.selected = options.initialValue !== undefined ? options.initialValue : null;
    }

    this.isOpen = false;
    this._build();
    this._renderItems();
    this._updateLabel();
    this._bindEvents();

    // Register instance so only one dropdown stays open
    TailwindDropdown._instances = TailwindDropdown._instances || [];
    TailwindDropdown._instances.push(this);
  }

  TailwindDropdown.prototype._build = function () {
    this.container.style.position = 'relative';

    // Button
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className =
      'tw-dropdown__btn w-full flex justify-between items-center bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm';
    this.button.setAttribute('aria-haspopup', 'listbox');
    this.button.setAttribute('aria-expanded', 'false');

    this.labelEl = document.createElement('span');
    this.labelEl.className = 'truncate block text-left';
    this.labelEl.textContent = this.placeholder;

    var chevron = document.createElement('span');
    chevron.innerHTML =
      '<svg class="h-5 w-5 text-gray-400 flex-shrink-0 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>';

    this.button.appendChild(this.labelEl);
    this.button.appendChild(chevron);

    // Menu
    this.menu = document.createElement('div');
    this.menu.className =
      'tw-dropdown__menu absolute z-50 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm hidden';
    this.menu.setAttribute('role', 'listbox');
    this.menu.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    this.menu.style.opacity = '0';
    this.menu.style.transform = 'scale(0.95)';
    this.menu.style.transformOrigin = 'top';

    this.container.appendChild(this.button);
    this.container.appendChild(this.menu);
  };

  TailwindDropdown.prototype._renderItems = function () {
    var self = this;
    this.menu.innerHTML = '';

    if (this.items.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'py-2 px-4 text-sm text-gray-500';
      empty.textContent = 'No options available';
      this.menu.appendChild(empty);
      return;
    }

    this.items.forEach(function (item) {
      var isSelected = self.isMulti
        ? self.selected.indexOf(item.value) !== -1
        : self.selected === item.value;

      var opt = document.createElement('div');
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      opt.className =
        'tw-dropdown__option cursor-pointer relative py-2 pl-3 pr-9 select-none transition-colors flex items-center gap-2 ' +
        (isSelected
          ? 'text-indigo-900 bg-indigo-50 font-medium hover:bg-indigo-600 hover:text-white'
          : 'text-gray-900 hover:bg-indigo-600 hover:text-white');
      if (isSelected) {
        opt.classList.add('is-selected');
        opt.dataset.selected = 'true';
      } else {
        opt.dataset.selected = 'false';
      }

      if (self.isMulti) {
        // Checkbox box
        var box = document.createElement('div');
        box.className =
          'h-4 w-4 flex-shrink-0 border rounded flex items-center justify-center transition-colors ' +
          (isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white');
        if (isSelected) {
          box.innerHTML =
            '<svg class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
        }
        opt.appendChild(box);
      }

      var text = document.createElement('span');
      text.className = 'block truncate flex-1';
      text.textContent = item.label;
      opt.appendChild(text);

      if (!self.isMulti) {
        // Single checkmark
        var check = document.createElement('span');
        check.className =
          'absolute inset-y-0 right-0 flex items-center pr-4 ' +
          (isSelected ? 'text-indigo-600' : 'text-transparent');
        check.innerHTML =
          '<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" /></svg>';
        opt.appendChild(check);
      }

      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        self._select(item.value);
      });

      self.menu.appendChild(opt);
    });
  };

  TailwindDropdown.prototype._select = function (value) {
    if (this.isMulti) {
      var idx = this.selected.indexOf(value);
      if (idx !== -1) {
        this.selected.splice(idx, 1);
      } else {
        this.selected.push(value);
      }
    } else {
      this.selected = value;
      this.close();
    }
    this._renderItems();
    this._updateLabel();
    this.onChange(this.isMulti ? this.selected.slice() : this.selected);
  };

  TailwindDropdown.prototype._updateLabel = function () {
    if (this.isMulti) {
      if (this.selected.length === 0) {
        this.labelEl.textContent = this.placeholder;
        this.labelEl.className = 'truncate block text-left text-gray-500';
      } else if (this.selected.length === 1) {
        var item = this._findItem(this.selected[0]);
        this.labelEl.textContent = item ? item.label : this.placeholder;
        this.labelEl.className = 'truncate block text-left';
      } else {
        this.labelEl.textContent = this.selected.length + ' items selected';
        this.labelEl.className = 'truncate block text-left';
      }
    } else {
      if (this.selected !== null && this.selected !== undefined && this.selected !== '') {
        var item = this._findItem(this.selected);
        this.labelEl.textContent = item ? item.label : this.placeholder;
        this.labelEl.className = 'truncate block text-left';
      } else {
        this.labelEl.textContent = this.placeholder;
        this.labelEl.className = 'truncate block text-left text-gray-500';
      }
    }
  };

  TailwindDropdown.prototype._findItem = function (value) {
    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].value === value) return this.items[i];
    }
    return null;
  };

  TailwindDropdown.prototype._bindEvents = function () {
    var self = this;
    this.button.addEventListener('click', function (e) {
      e.stopPropagation();
      self.toggle();
    });
    document.addEventListener('click', function (e) {
      if (!self.container.contains(e.target) && self.isOpen) {
        self.close();
      }
    });
  };

  TailwindDropdown.prototype.toggle = function () {
    this.isOpen ? this.close() : this.open();
  };

  TailwindDropdown.prototype.open = function () {
    // Close any other open dropdowns on the page
    if (TailwindDropdown._instances && TailwindDropdown._instances.length) {
      TailwindDropdown._instances.forEach(function (inst) {
        if (inst && inst !== this && inst.isOpen) inst.close();
      }, this);
    }
    this.isOpen = true;
    this.button.setAttribute('aria-expanded', 'true');
    this.menu.classList.remove('hidden');
    var menu = this.menu;
    requestAnimationFrame(function () {
      menu.style.opacity = '1';
      menu.style.transform = 'scale(1)';
    });
  };

  TailwindDropdown.prototype.close = function () {
    this.isOpen = false;
    this.button.setAttribute('aria-expanded', 'false');
    this.menu.style.opacity = '0';
    this.menu.style.transform = 'scale(0.95)';
    var menu = this.menu;
    setTimeout(function () {
      if (menu.style.opacity === '0') {
        menu.classList.add('hidden');
      }
    }, 150);
  };

  /** Get currently selected value(s) */
  TailwindDropdown.prototype.getValue = function () {
    return this.isMulti ? this.selected.slice() : this.selected;
  };

  /** Programmatically set the value */
  TailwindDropdown.prototype.setValue = function (value) {
    if (this.isMulti) {
      this.selected = Array.isArray(value) ? value.slice() : (value ? [value] : []);
    } else {
      this.selected = value;
    }
    this._renderItems();
    this._updateLabel();
  };

  window.TailwindDropdown = TailwindDropdown;
})();


/* ============================================================
   TailwindModal
   ============================================================ */
(function () {
  var TailwindModal = {
    _root: function () {
      var root = document.getElementById('tw-modal-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'tw-modal-root';
        document.body.appendChild(root);
      }
      return root;
    },

    _icon: function (type) {
      if (type === 'success') {
        return '<div class="tw-modal-icon mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">' +
          '<svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></div>';
      }
      if (type === 'error') {
        return '<div class="tw-modal-icon mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">' +
          '<svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg></div>';
      }
      // info / confirm
      return '<div class="tw-modal-icon mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">' +
        '<svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg></div>';
    },

    _btnColor: function (type) {
      if (type === 'success') return 'bg-green-600 hover:bg-green-500';
      if (type === 'error') return 'bg-red-600 hover:bg-red-500';
      return 'bg-indigo-600 hover:bg-indigo-500';
    },

    _render: function (opts) {
      var self = this;
      return new Promise(function (resolve) {
        var root = self._root();
        var type = opts.type || 'info';
        var btnColor = self._btnColor(type);

        root.innerHTML =
          '<div class="tw-modal-backdrop fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 opacity-0 z-40" id="tw-modal-backdrop"></div>' +
          '<div class="tw-modal-wrap fixed inset-0 z-50 w-screen overflow-y-auto">' +
            '<div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">' +
              '<div class="tw-modal-panel relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all duration-300 ease-out sm:my-8 sm:w-full sm:max-w-lg opacity-0 translate-y-8" id="tw-modal-panel">' +
                '<div class="tw-modal-body bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">' +
                  '<div class="sm:flex sm:items-start">' +
                    self._icon(type) +
                    '<div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">' +
                      '<h3 class="tw-modal-title text-lg font-semibold leading-6 text-gray-900">' + (opts.title || '') + '</h3>' +
                      '<div class="mt-2"><p class="tw-modal-message text-sm text-gray-500 leading-relaxed">' + (opts.message || '') + '</p></div>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="tw-modal-actions bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-3">' +
                  '<button type="button" id="tw-modal-ok-btn" class="tw-modal-ok inline-flex w-full justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm sm:w-auto transition-colors ' + btnColor + '">' + (opts.confirmText || 'OK') + '</button>' +
                  (opts.isConfirm ? '<button type="button" id="tw-modal-cancel-btn" class="tw-modal-cancel mt-3 inline-flex w-full justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto transition-colors">' + (opts.cancelText || 'Cancel') + '</button>' : '') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';

        var backdrop = document.getElementById('tw-modal-backdrop');
        var panel = document.getElementById('tw-modal-panel');
        var okBtn = document.getElementById('tw-modal-ok-btn');
        var cancelBtn = document.getElementById('tw-modal-cancel-btn');

        // Animate in
        requestAnimationFrame(function () {
          backdrop.style.opacity = '1';
          panel.style.opacity = '1';
          panel.style.transform = 'translateY(0)';
        });

        function close(result) {
          backdrop.style.opacity = '0';
          panel.style.opacity = '0';
          panel.style.transform = 'translateY(2rem)';
          setTimeout(function () {
            root.innerHTML = '';
            resolve(result);
          }, 300);
        }

        okBtn.addEventListener('click', function () { close(true); });
        if (cancelBtn) cancelBtn.addEventListener('click', function () { close(false); });
        backdrop.addEventListener('click', function () { close(false); });
        document.addEventListener('keydown', function escHandler(e) {
          if (e.key === 'Escape') {
            document.removeEventListener('keydown', escHandler);
            close(false);
          }
        });

        setTimeout(function () { okBtn && okBtn.focus(); }, 50);
      });
    },

    /** Show a success modal. Returns a Promise. */
    success: function (title, message, confirmText) {
      return this._render({ type: 'success', title: title, message: message, confirmText: confirmText || 'Great!', isConfirm: false });
    },

    /** Show an error modal. Returns a Promise. */
    error: function (title, message, confirmText) {
      return this._render({ type: 'error', title: title, message: message, confirmText: confirmText || 'Close', isConfirm: false });
    },

    /** Show a confirm modal. Returns a Promise<boolean>. */
    confirm: function (title, message, confirmText, cancelText, isDanger) {
      return this._render({
        type: isDanger ? 'error' : 'info',
        title: title,
        message: message,
        confirmText: confirmText || 'Confirm',
        cancelText: cancelText || 'Cancel',
        isConfirm: true
      });
    }
  };

  window.TailwindModal = TailwindModal;
})();
