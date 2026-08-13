/**
 * views/about.js
 * ---------------------------------------------------------------------------
 * Static informational view: what the app is, the internal-record
 * disclaimer, tech stack, and version.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { APP_CONFIG } = window.BPN.config.appConfig;
  const { getDisclaimerText } = window.BPN.templates.bpnTemplate;
  const { highlightActiveNav } = window.BPN.components.sidebar;

  async function render(container) {
    highlightActiveNav('about');

    container.innerHTML = `
      <div class="row g-4">
        <div class="col-12 col-lg-8">
          <div class="card bpn-card mb-4">
            <div class="card-body">
              <h4 class="mb-1">${APP_CONFIG.name}</h4>
              <p class="text-secondary mb-3">Versi ${APP_CONFIG.version} · Edisi ${APP_CONFIG.edition}</p>
              <p>${APP_CONFIG.description}</p>
              <div class="alert alert-warning d-flex gap-2 mb-0">
                <i class="bi bi-info-circle-fill flex-shrink-0 mt-1"></i>
                <div>${getDisclaimerText()}</div>
              </div>
            </div>
          </div>

          <div class="card bpn-card">
            <div class="card-header bpn-card-header"><i class="bi bi-diagram-3 me-2"></i>Cara Kerja</div>
            <div class="card-body">
              <ol class="mb-0">
                <li>Masukkan Kode Billing — jenis laporan (Pajak, Bea Cukai, atau PNBP) terdeteksi otomatis dari digit pertamanya.</li>
                <li>Lengkapi Data Pembayaran dan Data Setoran pada form yang muncul otomatis sesuai jenisnya.</li>
                <li>Simpan laporan, lihat pratinjau, lalu unduh atau cetak sebagai PDF.</li>
                <li>Gunakan Impor/Ekspor untuk memindahkan banyak laporan sekaligus lewat CSV atau mencadangkan seluruh data lewat JSON.</li>
              </ol>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-4">
          <div class="card bpn-card">
            <div class="card-header bpn-card-header"><i class="bi bi-cpu me-2"></i>Teknologi</div>
            <div class="card-body">
              <ul class="list-unstyled mb-0 d-grid gap-2">
                <li><i class="bi bi-check2 text-success me-2"></i>HTML5 + CSS3</li>
                <li><i class="bi bi-check2 text-success me-2"></i>Bootstrap 5</li>
                <li><i class="bi bi-check2 text-success me-2"></i>JavaScript (tanpa build tool, tanpa framework)</li>
                <li><i class="bi bi-check2 text-success me-2"></i>jsPDF untuk pembuatan PDF</li>
                <li><i class="bi bi-check2 text-success me-2"></i>Penyimpanan lokal di peramban (tanpa server)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.BPN = window.BPN || {};
  window.BPN.views = window.BPN.views || {};
  window.BPN.views.about = { render };
})();
