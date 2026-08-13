/**
 * views/preview-report.js
 * ---------------------------------------------------------------------------
 * Read-only preview of a saved report, with Generate PDF (download/print)
 * and a shortcut back into edit mode.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { getReportById } = window.BPN.services.storage;
  const { buildReceiptHtml } = window.BPN.templates.bpnTemplate;
  const { downloadReportPdf, printReportPdf } = window.BPN.services.pdf;
  const { showToast } = window.BPN.components.toast;
  const { highlightActiveNav } = window.BPN.components.sidebar;
  const { navigate } = window.BPN.utils.router;

  async function render(container, params) {
    highlightActiveNav('preview');
    const report = await getReportById(params.id);

    if (!report) {
      container.innerHTML = `
        <div class="alert alert-warning d-flex justify-content-between align-items-center">
          <span>Laporan tidak ditemukan — mungkin sudah dihapus.</span>
          <button class="btn btn-sm btn-outline-secondary" id="btn-back">Kembali</button>
        </div>`;
      container.querySelector('#btn-back').addEventListener('click', () => navigate('/dashboard'));
      return;
    }

    container.innerHTML = `
      <div class="row g-4">
        <div class="col-12 col-xl-7">
          <div id="receipt-slot"></div>
        </div>
        <div class="col-12 col-xl-5">
          <div class="card bpn-card bpn-sticky-preview">
            <div class="card-body d-grid gap-2">
              <h6 class="text-secondary text-uppercase small mb-1"><i class="bi bi-file-earmark-pdf me-1"></i>Generate PDF</h6>
              <button class="btn bpn-btn-primary" id="btn-download"><i class="bi bi-download me-1"></i>Unduh PDF</button>
              <button class="btn btn-outline-secondary" id="btn-print"><i class="bi bi-printer me-1"></i>Cetak</button>
              <hr />
              <button class="btn btn-outline-secondary" id="btn-edit"><i class="bi bi-pencil me-1"></i>Sunting Laporan</button>
              <button class="btn btn-outline-secondary" id="btn-back"><i class="bi bi-arrow-left me-1"></i>Kembali ke Dashboard</button>
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#receipt-slot').innerHTML = buildReceiptHtml(report);

    container.querySelector('#btn-download').addEventListener('click', () => {
      try {
        downloadReportPdf(report);
        showToast('PDF berhasil diunduh.', 'success');
      } catch (err) {
        showToast(err.message || 'Gagal membuat PDF.', 'danger');
      }
    });

    container.querySelector('#btn-print').addEventListener('click', () => {
      try {
        printReportPdf(report);
      } catch (err) {
        showToast(err.message || 'Gagal menyiapkan cetak.', 'danger');
      }
    });

    container.querySelector('#btn-edit').addEventListener('click', () => navigate(`/create/${report.id}`));
    container.querySelector('#btn-back').addEventListener('click', () => navigate('/dashboard'));
  }

  window.BPN = window.BPN || {};
  window.BPN.views = window.BPN.views || {};
  window.BPN.views.previewReport = { render };
})();
