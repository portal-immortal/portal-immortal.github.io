/**
 * billing-prefix.js
 * ---------------------------------------------------------------------------
 * Maps the first digit of a Kode Billing to a BPN report type. This is the
 * single source of truth for auto-detection — no other file should encode
 * this mapping.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  /** @type {Record<string, 'PAJAK'|'BEACUKAI'|'PNBP'>} */
  const BILLING_PREFIX_MAP = Object.freeze({
    0: 'PAJAK',
    1: 'PAJAK',
    2: 'PAJAK',
    3: 'PAJAK',
    4: 'BEACUKAI',
    5: 'BEACUKAI',
    6: 'BEACUKAI',
    7: 'PNBP',
    8: 'PNBP',
    9: 'PNBP',
  });

  /** The "Report Subtitle" static text per type — Static Text derived from the billing prefix digit. */
  const REPORT_SUBTITLES = Object.freeze({
    PAJAK: 'Penerimaan Pajak',
    BEACUKAI: 'Penerimaan Bea dan Cukai',
    PNBP: 'Penerimaan Negara Bukan Pajak',
  });

  /**
   * Detects the BPN report type from a billing code using its first digit.
   * Non-numeric characters are ignored before inspecting the first digit.
   * @param {string} billingNumber
   * @returns {'PAJAK'|'BEACUKAI'|'PNBP'|null}
   */
  function detectReportType(billingNumber) {
    if (!billingNumber) return null;
    const digitsOnly = String(billingNumber).replace(/\D/g, '');
    if (!digitsOnly) return null;
    const firstDigit = digitsOnly.charAt(0);
    return BILLING_PREFIX_MAP[firstDigit] || null;
  }

  /**
   * @param {'PAJAK'|'BEACUKAI'|'PNBP'|null} type
   * @returns {string}
   */
  function getReportSubtitle(type) {
    return REPORT_SUBTITLES[type] || 'Tidak diketahui';
  }

  window.BPN = window.BPN || {};
  window.BPN.config = window.BPN.config || {};
  window.BPN.config.billingPrefix = {
    BILLING_PREFIX_MAP,
    REPORT_SUBTITLES,
    detectReportType,
    getReportSubtitle,
  };
})();
