/**
 * config.js
 * ---------------------------------------------------------------------------
 * Application-wide configuration.
 *
 * This file is the single source of truth for app metadata, storage key
 * names, and the freemium plan matrix. Nothing outside this file should
 * hardcode a plan name, a storage key, or an app-level constant.
 *
 * SAAS READINESS NOTE:
 * The `PLANS` map and `hasFeature()` helper below are extension points.
 * Version 1 ships with everyone on the `free` plan and no payment
 * integration. When a backend is introduced, `getActivePlanId()` can be
 * changed to read the plan from an authenticated session/API response
 * instead of local settings, without touching any calling code.
 *
 * Loaded as a plain <script> (not an ES module) so the app can run by
 * double-clicking index.html — no local web server required. Every file
 * publishes its API on the shared `window.BPN` namespace instead of using
 * import/export.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const APP_CONFIG = Object.freeze({
    name: 'BPN Report Studio',
    shortName: 'BPN Studio',
    version: '1.0.0',
    edition: 'Community',
    description:
      'Aplikasi pembuat dan pencatat rekaman Bukti Penerimaan Negara (BPN) untuk Pajak, Bea Cukai, dan PNBP.',
    defaultCurrency: 'IDR',
    defaultLocale: 'id-ID',
    supportUrl: 'https://github.com/',
  });

  /** Central registry of every localStorage key the app touches. */
  const STORAGE_KEYS = Object.freeze({
    reports: 'bpn_reports',
    settings: 'bpn_settings',
    theme: 'bpn_theme',
    recent: 'bpn_recent',
  });

  /**
   * Freemium plan matrix. `features` is a list of feature keys the plan
   * unlocks. `'*'` unlocks every feature. `maxReports` of `Infinity` means
   * unlimited. Nothing here calls a payment provider — these are descriptive
   * limits only, enforced client-side, ready to be re-validated server-side
   * once a backend exists.
   */
  const PLANS = Object.freeze({
    free: {
      id: 'free',
      label: 'Free',
      priceLabel: 'Rp 0 / bulan',
      maxReports: 50,
      features: ['csv-import', 'csv-export', 'json-backup', 'pdf-single', 'print'],
    },
    premium: {
      id: 'premium',
      label: 'Premium',
      priceLabel: 'Segera hadir',
      maxReports: Infinity,
      features: [
        'csv-import',
        'csv-export',
        'json-backup',
        'pdf-single',
        'pdf-bulk',
        'print',
        'cloud-sync',
        'custom-branding',
      ],
    },
    enterprise: {
      id: 'enterprise',
      label: 'Enterprise',
      priceLabel: 'Hubungi kami',
      maxReports: Infinity,
      features: ['*'],
    },
  });

  /**
   * Reads the active plan id from app settings. Defaults to `free`.
   * This is the single function to change when a real auth/subscription
   * backend is introduced.
   * @param {{planId?: string}} settings
   * @returns {string}
   */
  function getActivePlanId(settings) {
    return settings && PLANS[settings.planId] ? settings.planId : 'free';
  }

  /**
   * @param {{planId?: string}} settings
   * @returns {object} the full plan record
   */
  function getActivePlan(settings) {
    return PLANS[getActivePlanId(settings)];
  }

  /**
   * @param {{planId?: string}} settings
   * @param {string} featureKey
   * @returns {boolean}
   */
  function hasFeature(settings, featureKey) {
    const plan = getActivePlan(settings);
    return plan.features.includes('*') || plan.features.includes(featureKey);
  }

  /**
   * @param {{planId?: string}} settings
   * @param {number} currentCount
   * @returns {boolean} whether one more report may be created under the plan
   */
  function canCreateAnotherReport(settings, currentCount) {
    const plan = getActivePlan(settings);
    return currentCount < plan.maxReports;
  }

  window.BPN = window.BPN || {};
  window.BPN.config = window.BPN.config || {};
  window.BPN.config.appConfig = {
    APP_CONFIG,
    STORAGE_KEYS,
    PLANS,
    getActivePlanId,
    getActivePlan,
    hasFeature,
    canCreateAnotherReport,
  };
})();
