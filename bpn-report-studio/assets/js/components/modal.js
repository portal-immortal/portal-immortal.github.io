/**
 * modal.js
 * ---------------------------------------------------------------------------
 * A single reusable confirmation modal. Expects the markup with
 * id="confirm-modal" defined once in index.html; this file only drives it.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  /**
   * Shows the shared confirmation modal and resolves true/false based on the
   * user's choice.
   * @param {{title?: string, message: string, confirmLabel?: string, confirmVariant?: string}} options
   * @returns {Promise<boolean>}
   */
  function confirmModal({ title = 'Konfirmasi', message, confirmLabel = 'Ya, lanjutkan', confirmVariant = 'danger' }) {
    return new Promise((resolve) => {
      const modalEl = document.getElementById('confirm-modal');
      if (!modalEl) {
        // eslint-disable-next-line no-alert
        resolve(window.confirm(message));
        return;
      }

      modalEl.querySelector('#confirm-modal-title').textContent = title;
      modalEl.querySelector('#confirm-modal-message').textContent = message;

      const confirmBtn = modalEl.querySelector('#confirm-modal-confirm');
      confirmBtn.textContent = confirmLabel;
      confirmBtn.className = `btn btn-${confirmVariant}`;

      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      let settled = false;

      const cleanup = () => {
        confirmBtn.removeEventListener('click', onConfirm);
        modalEl.removeEventListener('hidden.bs.modal', onHidden);
      };
      const onConfirm = () => {
        settled = true;
        cleanup();
        modal.hide();
        resolve(true);
      };
      const onHidden = () => {
        if (!settled) {
          cleanup();
          resolve(false);
        }
      };

      confirmBtn.addEventListener('click', onConfirm);
      modalEl.addEventListener('hidden.bs.modal', onHidden);
      modal.show();
    });
  }

  window.BPN = window.BPN || {};
  window.BPN.components = window.BPN.components || {};
  window.BPN.components.modal = { confirmModal };
})();
