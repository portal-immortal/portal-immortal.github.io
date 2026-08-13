/**
 * app.js
 * ---------------------------------------------------------------------------
 * Application bootstrap: registers every route against its view module,
 * applies the saved theme, and wires the few pieces of chrome that live
 * once in index.html (sidebar toggle, theme application).
 *
 * Loaded last (after every config/util/service/component/view script), as a
 * plain <script> — not type="module" — so the whole app also runs by simply
 * double-clicking index.html, with no local web server and no build step.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { registerRoute, registerNotFound, startRouter, navigate } = window.BPN.utils.router;
  const { getTheme, setTheme } = window.BPN.services.storage;

  const DashboardView = window.BPN.views.dashboard;
  const CreateReportView = window.BPN.views.createReport;
  const PreviewReportView = window.BPN.views.previewReport;
  const DataIoView = window.BPN.views.dataIo;
  const SettingsView = window.BPN.views.settings;
  const AboutView = window.BPN.views.about;

  const contentEl = () => document.getElementById('app-content');

  /**
   * Applies a theme choice to the document root. 'system' follows the OS
   * preference via prefers-color-scheme and stays in sync if it changes.
   * @param {'light'|'dark'|'system'} theme
   */
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-bs-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-bs-theme', theme);
    }
  }

  function watchSystemTheme() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
      const theme = await getTheme();
      if (theme === 'system') applyTheme('system');
    });
  }

  function registerRoutes() {
    registerRoute('/dashboard', () => DashboardView.render(contentEl()));
    registerRoute('/create', () => CreateReportView.render(contentEl(), {}));
    registerRoute('/create/:id', (params) => CreateReportView.render(contentEl(), params));
    registerRoute('/preview/:id', (params) => PreviewReportView.render(contentEl(), params));
    registerRoute('/data', () => DataIoView.render(contentEl()));
    registerRoute('/settings', () => SettingsView.render(contentEl()));
    registerRoute('/about', () => AboutView.render(contentEl()));

    registerNotFound(() => {
      contentEl().innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-signpost-split fs-1 text-secondary"></i>
          <p class="mt-3 mb-3">Halaman tidak ditemukan.</p>
          <button class="btn bpn-btn-primary" id="btn-go-dashboard">Kembali ke Dashboard</button>
        </div>`;
      document.getElementById('btn-go-dashboard').addEventListener('click', () => navigate('/dashboard'));
    });
  }

  function warnIfStorageIsNotPersistent() {
    if (window.BPN.services.storage.isPersistent) return;
    const banner = document.getElementById('storage-warning-banner');
    const textEl = document.getElementById('storage-warning-text');
    if (!banner || !textEl) return;
    textEl.textContent =
      'Penyimpanan lokal peramban tidak dapat diakses saat ini (sering terjadi jika pengaturan privasi memblokir data situs untuk berkas file://). Laporan yang Anda buat hanya bertahan selama tab ini terbuka dan akan hilang setelah dimuat ulang. Untuk penyimpanan permanen, jalankan lewat server lokal (lihat README) atau periksa pengaturan "Block third-party cookies and site data" di peramban Anda.';
    banner.classList.remove('d-none');
  }

  function wireQuickThemeToggle() {
    const btn = document.getElementById('btn-quick-theme');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const current = document.documentElement.getAttribute('data-bs-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      await setTheme(next);
      applyTheme(next);
    });
  }

  async function init() {
    const theme = await getTheme();
    applyTheme(theme);
    watchSystemTheme();
    wireQuickThemeToggle();
    warnIfStorageIsNotPersistent();

    registerRoutes();
    startRouter();

    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  window.BPN = window.BPN || {};
  window.BPN.app = { applyTheme };

  document.addEventListener('DOMContentLoaded', init);
})();
