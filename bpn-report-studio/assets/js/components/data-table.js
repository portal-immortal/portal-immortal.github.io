/**
 * data-table.js
 * ---------------------------------------------------------------------------
 * Renders the responsive reports table used on the Dashboard and anywhere
 * else a list of reports needs to be browsed. Purely presentational; the
 * caller supplies summarized rows and receives events through callbacks.
 *
 * Supports an optional selection column (checkboxes + a header "select
 * all") for batch actions like the Dashboard's "Unduh Terpilih" button.
 * Selection state lives in the DOM (checked attributes) — callers read it
 * via getSelectedIds() rather than the table tracking it separately.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { escapeHtml, formatCurrency, formatDateTime } = window.BPN.utils.formatter;

  const BADGE_CLASS = { PAJAK: 'bpn-badge-pajak', BEACUKAI: 'bpn-badge-beacukai', PNBP: 'bpn-badge-pnbp' };

  /**
   * @param {HTMLElement} container
   * @param {object[]} rows
   * @param {{onPreview:(id:string)=>void, onEdit:(id:string)=>void, onDelete:(id:string)=>void, onSelectionChange?:(selectedIds:string[])=>void}} handlers
   * @param {{selectable?: boolean}} [options]
   */
  function renderReportsTable(container, rows, handlers, options = {}) {
    const selectable = !!options.selectable;

    if (rows.length === 0) {
      container.innerHTML = `
        <div class="bpn-empty-state">
          <i class="bi bi-inbox"></i>
          <p class="mb-1 fw-semibold">Belum ada laporan.</p>
          <p class="text-secondary mb-0">Buat laporan baru atau impor dari CSV/JSON untuk mulai mengisi daftar ini.</p>
        </div>`;
      if (handlers.onSelectionChange) handlers.onSelectionChange([]);
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table bpn-table align-middle mb-0">
          <thead>
            <tr>
              ${selectable ? `<th style="width:2.5rem;"><input type="checkbox" class="form-check-input" id="select-all-reports" aria-label="Pilih semua"></th>` : ''}
              <th>Jenis</th>
              <th>Kode Billing</th>
              <th>Nama</th>
              <th class="text-end">Jumlah</th>
              <th>Diperbarui</th>
              <th class="text-end">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => rowHtml(row, selectable)).join('')}
          </tbody>
        </table>
      </div>`;

    container.querySelectorAll('[data-action="preview"]').forEach((btn) => {
      btn.addEventListener('click', () => handlers.onPreview(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => handlers.onEdit(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => handlers.onDelete(btn.dataset.id));
    });

    if (!selectable) return;

    const selectAllEl = container.querySelector('#select-all-reports');
    const rowCheckboxes = () => Array.from(container.querySelectorAll('.bpn-row-checkbox'));

    function emitSelectionChange() {
      const selected = rowCheckboxes()
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
      const total = rowCheckboxes().length;
      selectAllEl.checked = total > 0 && selected.length === total;
      selectAllEl.indeterminate = selected.length > 0 && selected.length < total;
      if (handlers.onSelectionChange) handlers.onSelectionChange(selected);
    }

    selectAllEl.addEventListener('change', () => {
      rowCheckboxes().forEach((cb) => {
        cb.checked = selectAllEl.checked;
      });
      emitSelectionChange();
    });

    rowCheckboxes().forEach((cb) => {
      cb.addEventListener('change', emitSelectionChange);
    });

    emitSelectionChange();
  }

  /**
   * Reads the currently checked report ids straight from the DOM.
   * @param {HTMLElement} container
   * @returns {string[]}
   */
  function getSelectedIds(container) {
    return Array.from(container.querySelectorAll('.bpn-row-checkbox:checked')).map((cb) => cb.value);
  }

  function rowHtml(row, selectable) {
    return `
      <tr>
        ${selectable ? `<td><input type="checkbox" class="form-check-input bpn-row-checkbox" value="${row.id}" aria-label="Pilih laporan"></td>` : ''}
        <td><span class="badge ${BADGE_CLASS[row.reportType] || 'bg-secondary'}">${escapeHtml(row.reportType)}</span></td>
        <td class="bpn-mono">${escapeHtml(row.billingnumber)}</td>
        <td>${escapeHtml(row.primaryName)}</td>
        <td class="text-end bpn-mono">${escapeHtml(formatCurrency(row.amount, row.currency))}</td>
        <td class="text-secondary small">${escapeHtml(formatDateTime(row.updatedAt))}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-secondary" data-action="preview" data-id="${row.id}" title="Pratinjau">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-secondary" data-action="edit" data-id="${row.id}" title="Sunting">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger" data-action="delete" data-id="${row.id}" title="Hapus">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }

  window.BPN = window.BPN || {};
  window.BPN.components = window.BPN.components || {};
  window.BPN.components.dataTable = { renderReportsTable, getSelectedIds };
})();
