/**
 * bpn-template.js
 * ---------------------------------------------------------------------------
 * Builds the on-screen HTML representation of a BPN receipt, used by the
 * Preview Report view and by the live-preview panel on Create Report. The
 * PDF renderer (services/pdf.js) mirrors this same layout and field order.
 *
 * Layout matches the organization's own reference BPN printout precisely:
 *   - Header is a 3-column letterhead: Bank Name (left), "BUKTI PENERIMAAN
 *     NEGARA" + Report Subtitle stacked and centered, "Kementerian
 *     Keuangan" (right).
 *   - "Data Pembayaran:" renders as a 2-column grid: the first half of
 *     paymentFields on the left, the second half on the right, row for
 *     row (Tanggal dan Jam Bayar | NTB, Tanggal Buku | NTPN, Kode Cabang
 *     Bank | STAN).
 *   - "Data Setoran:" is a single column, except Jumlah Setoran + Mata
 *     Uang which render together on one row.
 *   - The footer carries the organization's own bilingual disclaimer
 *     verbatim, then Tanggal Cetak, then a small secondary note — see
 *     getDisclaimerText() for why that note exists.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { getReportDefinition } = window.BPN.config.reportDefinition;
  const {
    formatCurrencyOfficial,
    formatDateOfficial,
    formatDateTimeOfficial,
    formatPrintTimestamp,
    escapeHtml,
  } = window.BPN.utils.formatter;

  /** @returns {string} the small secondary disclaimer shown on every preview and PDF */
  function getDisclaimerText() {
    return 'Dokumen ini dibuat dengan BPN Report Studio sebagai rekaman internal, bukan dokumen resmi yang diterbitkan oleh negara. Verifikasi keabsahan setoran hanya melalui NTPN pada sistem resmi Kementerian Keuangan.';
  }

  function formatFieldValue(field, rawValue, currencyCode) {
    let value = rawValue;
    if (field.type === 'currency') value = formatCurrencyOfficial(value);
    if (field.type === 'date') value = formatDateOfficial(value);
    if (field.type === 'datetime-local') value = formatDateTimeOfficial(value);
    return value;
  }

  function fieldRow(label, value, { mono = false } = {}) {
    const valueClass = mono ? 'bpn-receipt-value bpn-mono' : 'bpn-receipt-value';
    return `
      <div class="bpn-receipt-row">
        <span class="bpn-receipt-label">${escapeHtml(label)}</span>
        <span class="${valueClass}">${escapeHtml(value ?? '-') || '-'}</span>
      </div>`;
  }

  /** One row split into two independent label:value cells, side by side. */
  function pairedRow(labelA, valueA, labelB, valueB) {
    const cell = (label, value) =>
      label
        ? `
      <div class="bpn-receipt-pair-cell">
        <span class="bpn-receipt-label">${escapeHtml(label)}</span>
        <span class="bpn-receipt-value">${escapeHtml(value ?? '-') || '-'}</span>
      </div>`
        : `<div class="bpn-receipt-pair-cell"></div>`;
    return `
      <div class="bpn-receipt-row bpn-receipt-row-paired">
        ${cell(labelA, valueA)}
        ${cell(labelB, valueB)}
      </div>`;
  }

  /**
   * @param {object} report
   * @returns {string} full receipt HTML markup (no outer <html>/<body>)
   */
  function buildReceiptHtml(report) {
    const definition = getReportDefinition(report.reportType);
    if (!definition) {
      return `<div class="alert alert-warning mb-0">Jenis laporan belum terdeteksi. Lengkapi Kode Billing terlebih dahulu.</div>`;
    }

    const payment = report.payment || {};
    const deposit = report.deposit || {};

    // --- Data Pembayaran: 2-column grid, Bank Name excluded (shown in the header) ---
    const paymentFields = definition.paymentFields.filter((field) => field.id !== 'bankname');
    const half = Math.ceil(paymentFields.length / 2);
    const leftCol = paymentFields.slice(0, half);
    const rightCol = paymentFields.slice(half);
    const paymentRowsHtml = leftCol
      .map((field, i) => {
        const rightField = rightCol[i];
        return pairedRow(
          field.label,
          formatFieldValue(field, payment[field.id], deposit.currencycode),
          rightField?.label,
          rightField ? formatFieldValue(rightField, payment[rightField.id], deposit.currencycode) : undefined
        );
      })
      .join('');

    // --- Data Setoran: single column, except Jumlah Setoran + Mata Uang paired on one row ---
    const amountField = definition.depositFields.find((field) => field.id === 'transactionamount');
    const currencyField = definition.depositFields.find((field) => field.id === 'currencycode');
    const amountIndex = definition.depositFields.indexOf(amountField);

    const beforeAmount = definition.depositFields.slice(0, amountIndex);
    const afterAmount = definition.depositFields.slice(amountIndex + 1).filter((field) => field.id !== 'currencycode');

    const depositRowsHtml = [
      ...beforeAmount.map((field) => fieldRow(field.label, formatFieldValue(field, deposit[field.id], deposit.currencycode), { mono: !!field.mono })),
      pairedRow(
        amountField.label,
        formatFieldValue(amountField, deposit[amountField.id], deposit.currencycode),
        currencyField?.label,
        deposit[currencyField?.id]
      ),
      ...afterAmount.map((field) => fieldRow(field.label, formatFieldValue(field, deposit[field.id], deposit.currencycode), { mono: !!field.mono })),
    ].join('');

    return `
      <div class="bpn-receipt bpn-receipt-${definition.code.toLowerCase()}">
        <div class="bpn-receipt-header">
          <span class="bpn-receipt-bank-corner">${escapeHtml(payment.bankname || '—')}</span>
          <div class="bpn-receipt-title-center">
            <div class="bpn-receipt-title-main">BUKTI PENERIMAAN NEGARA</div>
            <div class="bpn-receipt-subtitle-center">${escapeHtml(definition.subtitle)}</div>
          </div>
          <span class="bpn-receipt-ministry-corner">Kementerian Keuangan</span>
        </div>

        <div class="bpn-receipt-section">
          <h6 class="bpn-receipt-section-title">Data Pembayaran:</h6>
          ${paymentRowsHtml}
        </div>

        <div class="bpn-receipt-section">
          <h6 class="bpn-receipt-section-title">Data Setoran:</h6>
          ${depositRowsHtml}
        </div>

        <div class="bpn-receipt-official-disclaimer">
          <p>This is a computer generated message and requires no signature.</p>
          <p>Informasi ini hasil cetakan komputer dan tidak memerlukan tanda tangan.</p>
        </div>

        <div class="bpn-receipt-printdate">Tanggal Cetak : ${escapeHtml(formatPrintTimestamp())}</div>

        <p class="bpn-receipt-disclaimer">${escapeHtml(getDisclaimerText())}</p>
      </div>`;
  }

  window.BPN = window.BPN || {};
  window.BPN.templates = window.BPN.templates || {};
  window.BPN.templates.bpnTemplate = { getDisclaimerText, buildReceiptHtml };
})();
