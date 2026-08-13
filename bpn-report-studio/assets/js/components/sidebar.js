/**
 * sidebar.js
 * ---------------------------------------------------------------------------
 * The sidebar markup itself lives once in index.html (it never changes
 * shape). This module only toggles the active nav item and closes the
 * off-canvas sidebar on mobile after a navigation, and keeps the topbar
 * page title in sync.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    create: 'Buat Laporan',
    preview: 'Pratinjau Laporan',
    settings: 'Pengaturan',
    about: 'Tentang',
  };

  /**
   * @param {string} routeKey  e.g. 'dashboard', 'create', 'preview', 'settings', 'about'
   */
  function highlightActiveNav(routeKey) {
    document.querySelectorAll('[data-nav-link]').forEach((link) => {
      link.classList.toggle('active', link.dataset.navLink === routeKey);
    });

    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = PAGE_TITLES[routeKey] || 'BPN Report Studio';

    const offcanvasEl = document.getElementById('app-sidebar-offcanvas');
    if (offcanvasEl && window.bootstrap) {
      const instance = window.bootstrap.Offcanvas.getInstance(offcanvasEl);
      if (instance) instance.hide();
    }
  }

  window.BPN = window.BPN || {};
  window.BPN.components = window.BPN.components || {};
  window.BPN.components.sidebar = { highlightActiveNav };
})();
