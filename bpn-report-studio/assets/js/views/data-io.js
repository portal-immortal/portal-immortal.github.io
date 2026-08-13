/**
 * views/data-io.js
 * ---------------------------------------------------------------------------
 * Import CSV, Export CSV, Import JSON, Export JSON — all in one place,
 * since they all operate on the same underlying report collection. CSV
 * import supports drag & drop and mixed report types within a single file.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { getReports, saveReportsBulk } = window.BPN.services.storage;
  const {
    generateUniversalCsvTemplate,
    parseCsv,
    validateCsvHeader,
    rowsToReports,
    exportReportsToCsv,
    downloadCsv,
  } = window.BPN.services.csv;
  const { showToast } = window.BPN.components.toast;
  const { highlightActiveNav } = window.BPN.components.sidebar;

  async function render(container) {
    highlightActiveNav('data');

    container.innerHTML = `
      <div class="row g-4">
        <div class="col-12 col-lg-6">
          <div class="card bpn-card h-100">
            <div class="card-header bpn-card-header"><i class="bi bi-filetype-csv me-2"></i>CSV</div>
            <div class="card-body d-flex flex-column gap-3">
              <div>
                <p class="text-secondary small mb-2">
                  Templat CSV bersifat universal — satu berkas berisi seluruh kolom untuk ketiga jenis laporan
                  (Pajak/Bea Cukai/PNBP), lengkap dengan satu baris contoh per jenis. Jenis laporan tiap baris
                  terdeteksi otomatis dari Kode Billing-nya, jadi ketiga jenis boleh dicampur dalam satu berkas.
                </p>
                <button class="btn btn-outline-secondary btn-sm mb-3" id="btn-download-template">
                  <i class="bi bi-download me-1"></i>Unduh Templat CSV Universal
                </button>
              </div>

              <div id="csv-dropzone" class="bpn-dropzone">
                <i class="bi bi-cloud-arrow-up fs-2 mb-2"></i>
                <p class="mb-1 fw-semibold">Seret & lepas berkas CSV di sini</p>
                <p class="text-secondary small mb-2">atau</p>
                <button class="btn btn-sm btn-outline-secondary" id="btn-browse-csv">Pilih Berkas</button>
                <input type="file" accept=".csv,text/csv" id="csv-file-input" class="d-none" />
              </div>

              <div id="csv-import-summary"></div>

              <button class="btn bpn-btn-primary mt-auto" id="btn-export-csv">
                <i class="bi bi-download me-1"></i>Ekspor Semua ke CSV
              </button>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <div class="card bpn-card h-100">
            <div class="card-header bpn-card-header"><i class="bi bi-filetype-json me-2"></i>JSON (Cadangan)</div>
            <div class="card-body d-flex flex-column gap-3">
              <p class="text-secondary small mb-0">
                JSON menyimpan seluruh data laporan apa adanya — cocok untuk cadangan penuh atau memindahkan
                data ke perangkat lain.
              </p>

              <div id="json-dropzone" class="bpn-dropzone">
                <i class="bi bi-cloud-arrow-up fs-2 mb-2"></i>
                <p class="mb-1 fw-semibold">Seret & lepas berkas JSON di sini</p>
                <p class="text-secondary small mb-2">atau</p>
                <button class="btn btn-sm btn-outline-secondary" id="btn-browse-json">Pilih Berkas</button>
                <input type="file" accept=".json,application/json" id="json-file-input" class="d-none" />
              </div>

              <div id="json-import-summary"></div>

              <button class="btn bpn-btn-primary mt-auto" id="btn-export-json">
                <i class="bi bi-download me-1"></i>Ekspor Semua ke JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    wireCsvTemplateButtons(container);
    wireCsvImport(container);
    wireCsvExport(container);
    wireJsonImport(container);
    wireJsonExport(container);
  }

  function wireCsvTemplateButtons(container) {
    const btn = container.querySelector('#btn-download-template');
    if (!btn) return;
    btn.addEventListener('click', () => {
      downloadCsv(generateUniversalCsvTemplate(), 'bpn-template-universal.csv');
      showToast('Templat CSV universal diunduh.', 'success');
    });
  }

  function wireCsvImport(container) {
    const dropzone = container.querySelector('#csv-dropzone');
    const fileInput = container.querySelector('#csv-file-input');
    const summary = container.querySelector('#csv-import-summary');

    container.querySelector('#btn-browse-csv').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) processCsvFile(fileInput.files[0], summary);
      fileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('bpn-dropzone-active');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('bpn-dropzone-active');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) processCsvFile(file, summary);
    });
  }

  async function processCsvFile(file, summaryEl) {
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    const headerCheck = validateCsvHeader(headers);

    if (!headerCheck.valid) {
      summaryEl.innerHTML = `
        <div class="alert alert-danger mb-0">
          Header CSV tidak valid. Kolom wajib yang hilang: <code>${headerCheck.missing.join(', ')}</code>
        </div>`;
      return;
    }

    const { reports, errors } = rowsToReports(rows);
    if (reports.length > 0) {
      const { added, updated } = await saveReportsBulk(reports);
      summaryEl.innerHTML = summaryHtml(added, updated, errors);
      showToast(`${reports.length} laporan diimpor dari CSV.`, 'success');
    } else {
      summaryEl.innerHTML = summaryHtml(0, 0, errors);
    }
  }

  function summaryHtml(added, updated, errors) {
    const errorHtml =
      errors.length > 0
        ? `<ul class="mb-0 small">${errors.map((e) => `<li>${e.message}</li>`).join('')}</ul>`
        : '';
    const variant = errors.length > 0 && added + updated === 0 ? 'danger' : errors.length > 0 ? 'warning' : 'success';
    return `
      <div class="alert alert-${variant} mb-0">
        <div class="fw-semibold mb-1">Ringkasan Impor</div>
        <div>Ditambahkan: ${added} &middot; Diperbarui: ${updated} &middot; Gagal: ${errors.length}</div>
        ${errorHtml}
      </div>`;
  }

  function wireCsvExport(container) {
    container.querySelector('#btn-export-csv').addEventListener('click', async () => {
      const reports = await getReports();
      if (reports.length === 0) {
        showToast('Belum ada laporan untuk diekspor.', 'warning');
        return;
      }
      downloadCsv(exportReportsToCsv(reports), `bpn-reports-export-${Date.now()}.csv`);
      showToast(`${reports.length} laporan diekspor ke CSV.`, 'success');
    });
  }

  function wireJsonImport(container) {
    const dropzone = container.querySelector('#json-dropzone');
    const fileInput = container.querySelector('#json-file-input');
    const summary = container.querySelector('#json-import-summary');

    container.querySelector('#btn-browse-json').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) processJsonFile(fileInput.files[0], summary);
      fileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('bpn-dropzone-active');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('bpn-dropzone-active');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) processJsonFile(file, summary);
    });
  }

  async function processJsonFile(file, summaryEl) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const reports = Array.isArray(parsed) ? parsed : parsed.reports;
      if (!Array.isArray(reports)) throw new Error('Format JSON tidak sesuai (diharapkan larik laporan).');

      const valid = reports.filter((r) => r && r.id && r.reportType);
      const { added, updated } = await saveReportsBulk(valid);
      summaryEl.innerHTML = summaryHtml(added, updated, []);
      showToast(`${valid.length} laporan dipulihkan dari JSON.`, 'success');
    } catch (err) {
      summaryEl.innerHTML = `<div class="alert alert-danger mb-0">Gagal membaca JSON: ${err.message}</div>`;
    }
  }

  function wireJsonExport(container) {
    container.querySelector('#btn-export-json').addEventListener('click', async () => {
      const reports = await getReports();
      if (reports.length === 0) {
        showToast('Belum ada laporan untuk diekspor.', 'warning');
        return;
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        source: 'BPN Report Studio',
        reports,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bpn-reports-backup-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`${reports.length} laporan diekspor ke JSON.`, 'success');
    });
  }

  window.BPN = window.BPN || {};
  window.BPN.views = window.BPN.views || {};
  window.BPN.views.dataIo = { render };
})();
