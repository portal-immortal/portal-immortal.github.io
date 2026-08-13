/**
 * views/settings.js
 * ---------------------------------------------------------------------------
 * Theme, default currency, organization name, a read-only preview of the
 * freemium plan matrix (no payment — extension point only), storage usage,
 * and the destructive "clear all data" action.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const {
    getSettings,
    saveSettings,
    getTheme,
    setTheme,
    estimateStorageUsageBytes,
    clearAllAppData,
    exportDataFile,
    importDataFile,
  } = window.BPN.services.storage;
  const { PLANS, getActivePlanId } = window.BPN.config.appConfig;
  const { confirmModal } = window.BPN.components.modal;
  const { showToast } = window.BPN.components.toast;
  const { highlightActiveNav } = window.BPN.components.sidebar;
  const { escapeHtml } = window.BPN.utils.formatter;

  async function render(container) {
    highlightActiveNav('settings');

    const settings = await getSettings();
    const theme = await getTheme();
    const bytes = await estimateStorageUsageBytes();
    const activePlanId = getActivePlanId(settings);

    container.innerHTML = `
      <div class="row g-4">
        <div class="col-12 col-lg-6">
          <div class="card bpn-card mb-4">
            <div class="card-header bpn-card-header"><i class="bi bi-palette me-2"></i>Tampilan</div>
            <div class="card-body">
              <label class="form-label">Tema</label>
              <div class="btn-group w-100" role="group">
                ${['light', 'dark', 'system']
                  .map(
                    (t) => `
                  <input type="radio" class="btn-check" name="theme" id="theme-${t}" value="${t}" ${t === theme ? 'checked' : ''} autocomplete="off">
                  <label class="btn btn-outline-secondary" for="theme-${t}">${themeLabel(t)}</label>`
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div class="card bpn-card">
            <div class="card-header bpn-card-header"><i class="bi bi-sliders me-2"></i>Nilai Bawaan</div>
            <div class="card-body d-grid gap-3">
              <div>
                <label for="organizationName" class="form-label">Nama Organisasi</label>
                <input type="text" id="organizationName" class="form-control" value="${escapeHtml(settings.organizationName)}" placeholder="PT Contoh Sejahtera" />
              </div>
              <div>
                <label for="defaultBankName" class="form-label">Nama Bank Default</label>
                <input type="text" id="defaultBankName" class="form-control" value="${escapeHtml(settings.defaultBankName || '')}" placeholder="Bank Mandiri" />
                <div class="form-text">Otomatis mengisi field Bank Name saat membuat laporan baru.</div>
              </div>
              <div>
                <label for="defaultCurrency" class="form-label">Mata Uang Bawaan</label>
                <input type="text" id="defaultCurrency" class="form-control bpn-mono" maxlength="3" value="${escapeHtml(settings.defaultCurrency)}" />
              </div>
              <button class="btn bpn-btn-primary" id="btn-save-settings">Simpan Pengaturan</button>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <div class="card bpn-card mb-4">
            <div class="card-header bpn-card-header"><i class="bi bi-stars me-2"></i>Paket</div>
            <div class="card-body">
              <p class="text-secondary small">
                Versi ini berjalan sepenuhnya di perangkat Anda tanpa akun atau pembayaran.
                Daftar paket berikut adalah pratinjau untuk pengembangan SaaS mendatang.
              </p>
              <div class="d-grid gap-2">
                ${Object.values(PLANS)
                  .map(
                    (plan) => `
                  <div class="bpn-plan-row ${plan.id === activePlanId ? 'bpn-plan-row-active' : ''}">
                    <div>
                      <div class="fw-semibold">${plan.label} ${plan.id === activePlanId ? '<span class="badge bpn-badge-neutral ms-1">Aktif</span>' : ''}</div>
                      <div class="text-secondary small">${plan.maxReports === Infinity ? 'Laporan tanpa batas' : `Hingga ${plan.maxReports} laporan`}</div>
                    </div>
                    <div class="text-secondary small">${plan.priceLabel}</div>
                  </div>`
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div class="card bpn-card border-danger-subtle">
            <div class="card-header bpn-card-header text-danger"><i class="bi bi-exclamation-triangle me-2"></i>Zona Berbahaya</div>
            <div class="card-body d-grid gap-3">
              <div>
                <p class="text-secondary small mb-1">Penyimpanan file saat ini: <strong>${(bytes / 1024).toFixed(1)} KB</strong></p>
                <p class="text-secondary small">Semua data disimpan dalam berkas JSON yang dipilih secara manual, bukan di localStorage browser.</p>
              </div>

              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-outline-primary" id="btn-export-data-file"><i class="bi bi-download me-1"></i>Ekspor Data ke File</button>
                <button class="btn btn-outline-secondary" id="btn-import-data-file"><i class="bi bi-upload me-1"></i>Impor Data dari File</button>
                <input type="file" accept=".json,application/json" id="data-file-input" class="d-none" />
              </div>

              <button class="btn btn-outline-danger" id="btn-clear-data"><i class="bi bi-trash me-1"></i>Hapus Semua Data</button>
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('input[name="theme"]').forEach((radio) => {
      radio.addEventListener('change', async (e) => {
        await setTheme(e.target.value);
        window.BPN.app.applyTheme(e.target.value);
      });
    });

    container.querySelector('#btn-save-settings').addEventListener('click', async () => {
      await saveSettings({
        organizationName: container.querySelector('#organizationName').value.trim(),
        defaultBankName: container.querySelector('#defaultBankName').value.trim(),
        defaultCurrency: container.querySelector('#defaultCurrency').value.trim().toUpperCase() || 'IDR',
      });
      showToast('Pengaturan disimpan.', 'success');
    });

    const fileInput = container.querySelector('#data-file-input');
    container.querySelector('#btn-import-data-file').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        await importDataFile(file);
        showToast('Data berhasil dipulihkan dari file JSON.', 'success');
        render(container);
      } catch (err) {
        showToast(err.message || 'Gagal membaca data dari file.', 'danger');
      } finally {
        fileInput.value = '';
      }
    });

    container.querySelector('#btn-export-data-file').addEventListener('click', async () => {
      try {
        await exportDataFile('bpn-report-studio-data.json');
        showToast('Data berhasil diekspor ke file JSON.', 'success');
      } catch (err) {
        showToast(err.message || 'Gagal mengekspor data ke file.', 'danger');
      }
    });

    container.querySelector('#btn-clear-data').addEventListener('click', async () => {
      const ok = await confirmModal({
        title: 'Hapus semua data?',
        message: 'Tindakan ini akan menghapus seluruh laporan dan pengaturan secara permanen. Tindakan ini tidak dapat dibatalkan.',
        confirmLabel: 'Ya, hapus semua',
        confirmVariant: 'danger',
      });
      if (!ok) return;
      await clearAllAppData();
      showToast('Semua data telah dihapus.', 'success');
      render(container);
    });
  }

  function themeLabel(theme) {
    return { light: 'Terang', dark: 'Gelap', system: 'Sistem' }[theme] || theme;
  }

  window.BPN = window.BPN || {};
  window.BPN.views = window.BPN.views || {};
  window.BPN.views.settings = { render };
})();
