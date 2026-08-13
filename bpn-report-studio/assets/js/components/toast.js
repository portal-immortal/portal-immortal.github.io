/**
 * toast.js
 * ---------------------------------------------------------------------------
 * Thin wrapper around Bootstrap 5 toasts. Expects a container element with
 * id="toast-stack" to exist in index.html (position-fixed, top-right).
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const ICONS = {
    success: 'bi-check-circle-fill',
    danger: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill',
  };

  /**
   * @param {string} message
   * @param {'success'|'danger'|'warning'|'info'} [variant='success']
   */
  function showToast(message, variant = 'success') {
    const stack = document.getElementById('toast-stack');
    if (!stack) {
      console.warn('[toast] #toast-stack not found; message:', message);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = `toast align-items-center text-bg-${variant} border-0`;
    wrapper.setAttribute('role', 'alert');
    wrapper.setAttribute('aria-live', 'assertive');
    wrapper.setAttribute('aria-atomic', 'true');
    wrapper.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi ${ICONS[variant] || ICONS.info} me-2"></i>${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Tutup"></button>
      </div>`;
    stack.appendChild(wrapper);

    const toast = new bootstrap.Toast(wrapper, { delay: 4000 });
    wrapper.addEventListener('hidden.bs.toast', () => wrapper.remove());
    toast.show();
  }

  window.BPN = window.BPN || {};
  window.BPN.components = window.BPN.components || {};
  window.BPN.components.toast = { showToast };
})();
