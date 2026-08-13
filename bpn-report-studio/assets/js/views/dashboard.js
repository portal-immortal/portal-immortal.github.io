/**
 * views/dashboard.js
 * ---------------------------------------------------------------------------
 * Landing view: at-a-glance stats, quick actions, and the full reports
 * table (preview / edit / delete). The three type stat cards double as
 * filter toggles for the table below, and the table supports selecting
 * multiple reports to download them merged into one multi-page PDF.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { getReports, deleteReport, estimateStorageUsageBytes } = window.BPN.services.storage;
  const { computeDashboardStats, summarizeReport } = window.BPN.services.report;
  const { downloadReportsMerged } = window.BPN.services.pdf;
  const { renderReportsTable, getSelectedIds } = window.BPN.components.dataTable;
  const { confirmModal } = window.BPN.components.modal;
  const { showToast } = window.BPN.components.toast;
  const { highlightActiveNav } = window.BPN.components.sidebar;
  const { navigate } = window.BPN.utils.router;
  const { formatCurrency } = window.BPN.utils.formatter;

  const FILTER_LABELS = { PAJAK: 'Pajak', BEACUKAI: 'Bea Cukai', PNBP: 'PNBP' };

  async function render(container) {
    highlightActiveNav('dashboard');

    // Local state for this visit to the page — reset every time the view
    // is (re-)entered, and captured by the closures below so filter
    // clicks and the download button can see the latest data without
    // threading it through function arguments everywhere.
    let activeFilter = null;
    let allReports = [];

    container.innerHTML = `
      <div class="row g-3 mb-2">
        ${statCardHtml('bi-stack', 'Total Laporan', 'stat-total')}
        ${statCardHtml('bi-bank', 'Pajak', 'stat-pajak', 'bpn-badge-pajak', 'PAJAK')}
        ${statCardHtml('bi-box-seam', 'Bea Cukai', 'stat-beacukai', 'bpn-badge-beacukai', 'BEACUKAI')}
        ${statCardHtml('bi-building', 'PNBP', 'stat-pnbp', 'bpn-badge-pnbp', 'PNBP')}
      </div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-lg-8">
          <div class="card bpn-card h-100">
            <div class="card-body d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
              <div>
                <div class="text-secondary small">Total Nilai Setoran Tercatat</div>
                <div class="fs-3 fw-semibold bpn-mono" id="stat-amount">Rp0</div>
              </div>
              <div class="text-secondary small" id="stat-storage">Penyimpanan lokal: menghitung…</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card bpn-card h-100">
            <div class="card-body d-grid gap-2">
              <button class="btn bpn-btn-primary" id="btn-new-report"><i class="bi bi-plus-lg me-1"></i>Laporan Baru</button>
              <button class="btn btn-outline-secondary" id="btn-goto-data"><i class="bi bi-arrow-left-right me-1"></i>Impor / Ekspor Data</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card bpn-card">
        <div class="card-header bpn-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span class="d-flex align-items-center flex-wrap gap-2">
            <span><i class="bi bi-table me-2"></i>Semua Laporan</span>
            <button type="button" class="btn btn-sm bpn-badge-neutral border-0 text-white d-none align-items-center gap-1" id="active-filter-chip">
              <span id="active-filter-chip-label"></span>
              <i class="bi bi-x-lg small"></i>
            </button>
          </span>
          <button class="btn btn-sm btn-outline-secondary" id="btn-download-selected" disabled>
            <i class="bi bi-file-earmark-pdf me-1"></i>Unduh Terpilih (<span id="selected-count">0</span>)
          </button>
        </div>
        <div class="card-body p-0" id="reports-table-slot">
          <div class="p-4 text-secondary">Memuat data…</div>
        </div>
      </div>
    `;

    container.querySelector('#btn-new-report').addEventListener('click', () => navigate('/create'));
    container.querySelector('#btn-goto-data').addEventListener('click', () => navigate('/data'));

    container.querySelectorAll('[data-filter-type]').forEach((card) => {
      const toggle = () => {
        const type = card.dataset.filterType;
        activeFilter = activeFilter === type ? null : type;
        applyFilterCardStyles(container, activeFilter);
        refresh();
      };
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    });

    container.querySelector('#active-filter-chip').addEventListener('click', () => {
      activeFilter = null;
      applyFilterCardStyles(container, activeFilter);
      refresh();
    });

    container.querySelector('#btn-download-selected').addEventListener('click', () => {
      const selectedIds = getSelectedIds(container.querySelector('#reports-table-slot'));
      const selectedReports = allReports.filter((r) => selectedIds.includes(r.id));
      if (selectedReports.length === 0) return;
      try {
        // Sort selected reports to match the order they appear in the
        // table (most recently updated first), not raw selection order.
        const ordered = selectedReports
          .slice()
          .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        downloadReportsMerged(ordered);
        showToast(`${ordered.length} laporan digabung menjadi satu PDF dan diunduh.`, 'success');
      } catch (err) {
        showToast(err.message || 'Gagal membuat PDF gabungan.', 'danger');
      }
    });

    async function refresh() {
      allReports = await getReports();
      const stats = computeDashboardStats(allReports); // stats always reflect the unfiltered total

      container.querySelector('#stat-total').textContent = stats.total;
      container.querySelector('#stat-pajak').textContent = stats.byType.PAJAK;
      container.querySelector('#stat-beacukai').textContent = stats.byType.BEACUKAI;
      container.querySelector('#stat-pnbp').textContent = stats.byType.PNBP;
      container.querySelector('#stat-amount').textContent = formatCurrency(stats.totalAmount);

      const bytes = await estimateStorageUsageBytes();
      container.querySelector('#stat-storage').textContent = `Penyimpanan lokal: ${(bytes / 1024).toFixed(1)} KB`;

      const chip = container.querySelector('#active-filter-chip');
      if (activeFilter) {
        chip.classList.remove('d-none');
        chip.classList.add('d-inline-flex');
        container.querySelector('#active-filter-chip-label').textContent = `Filter: ${FILTER_LABELS[activeFilter]}`;
      } else {
        chip.classList.add('d-none');
        chip.classList.remove('d-inline-flex');
      }

      const visibleReports = activeFilter ? allReports.filter((r) => r.reportType === activeFilter) : allReports;
      const rows = visibleReports
        .slice()
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .map(summarizeReport);

      renderReportsTable(
        container.querySelector('#reports-table-slot'),
        rows,
        {
          onPreview: (id) => navigate(`/preview/${id}`),
          onEdit: (id) => navigate(`/create/${id}`),
          onDelete: async (id) => {
            const ok = await confirmModal({
              title: 'Hapus laporan?',
              message: 'Laporan yang dihapus tidak dapat dikembalikan.',
              confirmLabel: 'Hapus',
              confirmVariant: 'danger',
            });
            if (!ok) return;
            await deleteReport(id);
            showToast('Laporan dihapus.', 'success');
            await refresh();
          },
          onSelectionChange: (selectedIds) => updateDownloadButtonState(container, selectedIds),
        },
        { selectable: true }
      );
    }

    await refresh();
  }

  function statCardHtml(icon, label, valueId, badgeClass = '', filterType = null) {
    const interactiveAttrs = filterType
      ? `data-filter-type="${filterType}" role="button" tabindex="0" aria-pressed="false"`
      : '';
    return `
      <div class="col-6 col-lg-3">
        <div class="card bpn-card h-100 ${filterType ? 'bpn-stat-card-filter' : ''}" ${interactiveAttrs}>
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <i class="bi ${icon} fs-4 text-secondary"></i>
              ${badgeClass ? `<span class="badge ${badgeClass}">&nbsp;</span>` : ''}
            </div>
            <div class="fs-3 fw-semibold" id="${valueId}">0</div>
            <div class="text-secondary small">${label}${filterType ? ' <span class="bpn-stat-card-hint">— klik untuk filter</span>' : ''}</div>
          </div>
        </div>
      </div>`;
  }

  function applyFilterCardStyles(container, activeFilter) {
    container.querySelectorAll('[data-filter-type]').forEach((card) => {
      const isActive = card.dataset.filterType === activeFilter;
      card.classList.toggle('bpn-stat-card-active', isActive);
      card.setAttribute('aria-pressed', String(isActive));
    });
  }

  function updateDownloadButtonState(container, selectedIds) {
    const btn = container.querySelector('#btn-download-selected');
    const countEl = container.querySelector('#selected-count');
    if (!btn || !countEl) return;
    countEl.textContent = selectedIds.length;
    btn.disabled = selectedIds.length === 0;
  }

  window.BPN = window.BPN || {};
  window.BPN.views = window.BPN.views || {};
  window.BPN.views.dashboard = { render };
})();
