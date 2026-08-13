/**
 * report-definition.js
 * ---------------------------------------------------------------------------
 * Binds each BPN report type to its display metadata and field groups.
 * This is the layer the UI and PDF/CSV engines consult to know "what a
 * Pajak report looks like" — none of that shape is hardcoded elsewhere.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { PAYMENT_FIELDS, DEPOSIT_FIELDS } = window.BPN.config.fieldDefinition;
  const { REPORT_SUBTITLES } = window.BPN.config.billingPrefix;

  const REPORT_DEFINITIONS = Object.freeze({
    PAJAK: {
      code: 'PAJAK',
      shortLabel: 'Pajak',
      subtitle: REPORT_SUBTITLES.PAJAK,
      badgeClass: 'bpn-badge-pajak',
      paymentFields: PAYMENT_FIELDS,
      depositFields: DEPOSIT_FIELDS.PAJAK,
    },
    BEACUKAI: {
      code: 'BEACUKAI',
      shortLabel: 'Bea Cukai',
      subtitle: REPORT_SUBTITLES.BEACUKAI,
      badgeClass: 'bpn-badge-beacukai',
      paymentFields: PAYMENT_FIELDS,
      depositFields: DEPOSIT_FIELDS.BEACUKAI,
    },
    PNBP: {
      code: 'PNBP',
      shortLabel: 'PNBP',
      subtitle: REPORT_SUBTITLES.PNBP,
      badgeClass: 'bpn-badge-pnbp',
      paymentFields: PAYMENT_FIELDS,
      depositFields: DEPOSIT_FIELDS.PNBP,
    },
  });

  /**
   * @param {'PAJAK'|'BEACUKAI'|'PNBP'} type
   * @returns {object|null}
   */
  function getReportDefinition(type) {
    return REPORT_DEFINITIONS[type] || null;
  }

  /**
   * @returns {Array<{code:string,shortLabel:string,subtitle:string}>}
   */
  function listReportTypes() {
    return Object.values(REPORT_DEFINITIONS).map((d) => ({ code: d.code, shortLabel: d.shortLabel, subtitle: d.subtitle }));
  }

  window.BPN = window.BPN || {};
  window.BPN.config = window.BPN.config || {};
  window.BPN.config.reportDefinition = {
    REPORT_DEFINITIONS,
    getReportDefinition,
    listReportTypes,
  };
})();
