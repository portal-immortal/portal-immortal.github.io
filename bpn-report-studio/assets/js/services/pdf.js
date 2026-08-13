/**
 * pdf.js
 * ---------------------------------------------------------------------------
 * Builds a printable BPN receipt PDF using jsPDF (loaded globally via CDN
 * script tag in index.html as `window.jspdf.jsPDF`, per the "no build
 * tools" constraint — this is the app's one runtime dependency, since
 * hand-rolling PDF byte streams is out of scope).
 *
 * The layout mirrors templates/bpn-template.js field-for-field: a 3-column
 * letterhead header (Bank Name left, title+subtitle centered, Kementerian
 * Keuangan right), a 2-column "Data Pembayaran:" grid, and a "Data
 * Setoran:" section where Jumlah Setoran + Mata Uang render on one row.
 * See bpn-template.js's file header for the full rationale.
 *
 * Content drawing (drawReportContent) is separated from document creation
 * so the Dashboard's batch download can merge several reports into ONE
 * multi-page PDF — each report becomes a fresh page in the same document —
 * rather than producing several separate files.
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
    timestampForFilename,
  } = window.BPN.utils.formatter;
  const { getDisclaimerText } = window.BPN.templates.bpnTemplate;

  const PAGE_MARGIN = 15;
  const PAGE_WIDTH = 210; // A4 page width, in mm
  const ROW_HEIGHT = 5.4;

  function getJsPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('Pustaka PDF belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
    }
    return window.jspdf.jsPDF;
  }

  function formatFieldValue(field, rawValue) {
    let value = rawValue;
    if (field.type === 'currency') value = formatCurrencyOfficial(value);
    if (field.type === 'date') value = formatDateOfficial(value);
    if (field.type === 'datetime-local') value = formatDateTimeOfficial(value);
    return value;
  }

  function drawSectionTitle(doc, title, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(title, PAGE_MARGIN, y);
    return y + 6;
  }

  /** Draws a single-column list of [label, value] rows, wrapping to a new page if needed. */
  function drawRows(doc, startY, rows, { labelWidth = 62 } = {}) {
    let y = startY;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const [label, rawValue] of rows) {
      const value = rawValue === undefined || rawValue === null || rawValue === '' ? '-' : String(rawValue);
      doc.setTextColor(40, 40, 40);
      doc.text(label, PAGE_MARGIN, y);
      const valueLines = doc.splitTextToSize(`: ${value}`, PAGE_WIDTH - PAGE_MARGIN * 2 - labelWidth);
      doc.text(valueLines, PAGE_MARGIN + labelWidth, y);
      y += Math.max(valueLines.length, 1) * ROW_HEIGHT;
      if (y > 270) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
    }
    return y;
  }

  /**
   * Draws the Jumlah Setoran + Mata Uang row specifically. Unlike
   * drawPairedRow (built for the independent half-page Data Pembayaran
   * grid), this reuses drawRows()'s 62mm label width for the amount half
   * so its value lines up at the exact same X as every other row in Data
   * Setoran, then places Mata Uang at a fixed offset past the widest
   * amount string is ever likely to reach.
   */
  function drawAmountCurrencyRow(doc, startY, amountLabel, amountValue, currencyLabel, currencyValue) {
    const amountLabelWidth = 62;
    const currencyLabelX = PAGE_MARGIN + amountLabelWidth + 42;
    const currencyLabelWidth = 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);

    doc.text(amountLabel, PAGE_MARGIN, startY);
    doc.text(`: ${amountValue === undefined || amountValue === null || amountValue === '' ? '-' : amountValue}`, PAGE_MARGIN + amountLabelWidth, startY);

    if (currencyLabel) {
      const value = currencyValue === undefined || currencyValue === null || currencyValue === '' ? '-' : String(currencyValue);
      doc.text(currencyLabel, currencyLabelX, startY);
      doc.text(`: ${value}`, currencyLabelX + currencyLabelWidth, startY);
    }

    return startY + ROW_HEIGHT;
  }

  /** Draws one row split into two independent label:value cells, side by side. */
  function drawPairedRow(doc, startY, labelA, valueA, labelB, valueB, { colWidth, labelWidth = 40 } = {}) {
    const width = colWidth || (PAGE_WIDTH - PAGE_MARGIN * 2) / 2;
    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + width;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const cell = (label, rawValue, x) => {
      if (!label) return;
      const value = rawValue === undefined || rawValue === null || rawValue === '' ? '-' : String(rawValue);
      doc.setTextColor(40, 40, 40);
      doc.text(label, x, startY);
      doc.text(`: ${value}`, x + labelWidth, startY);
    };

    cell(labelA, valueA, leftX);
    cell(labelB, valueB, rightX);
    return startY + ROW_HEIGHT;
  }

  /** Draws a 2-column grid: leftFields[i] pairs with rightFields[i] on the same row. */
  function drawGridSection(doc, title, startY, leftFields, rightFields, values) {
    let y = drawSectionTitle(doc, title, startY);
    const maxRows = Math.max(leftFields.length, rightFields.length);
    for (let i = 0; i < maxRows; i += 1) {
      const left = leftFields[i];
      const right = rightFields[i];
      y = drawPairedRow(
        doc,
        y,
        left?.label,
        left ? formatFieldValue(left, values[left.id]) : undefined,
        right?.label,
        right ? formatFieldValue(right, values[right.id]) : undefined
      );
    }
    return y;
  }

  /**
   * Draws one report's full receipt content onto `doc`, starting at the
   * top of whatever page is currently active. Callers are responsible for
   * calling doc.addPage() beforehand if this shouldn't land on doc's
   * existing current page (see buildMergedReportsPdf).
   * @param {import('jspdf').jsPDF} doc
   * @param {object} report
   */
  function drawReportContent(doc, report) {
    const definition = getReportDefinition(report.reportType);
    if (!definition) throw new Error('Jenis laporan tidak dikenali, PDF tidak dapat dibuat.');

    const payment = report.payment || {};
    const deposit = report.deposit || {};
    let y = PAGE_MARGIN;

    // --- Header: Bank Name (left) | "BUKTI PENERIMAAN NEGARA" + subtitle (centered) | Kementerian Keuangan (right) ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text(payment.bankname || '—', PAGE_MARGIN, y);
    doc.text('Kementerian Keuangan', PAGE_WIDTH - PAGE_MARGIN, y, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text('BUKTI PENERIMAAN NEGARA', PAGE_WIDTH / 2, y, { align: 'center' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(definition.subtitle, PAGE_WIDTH / 2, y, { align: 'center' });
    y += 8;

    // --- Data Pembayaran: 2-column grid (Bank Name excluded — shown in the header) ---
    const paymentFields = definition.paymentFields.filter((field) => field.id !== 'bankname');
    const half = Math.ceil(paymentFields.length / 2);
    y = drawGridSection(doc, 'Data Pembayaran:', y, paymentFields.slice(0, half), paymentFields.slice(half), payment);
    y += 4;

    // --- Data Setoran: single column, except Jumlah Setoran + Mata Uang paired on one row ---
    const amountField = definition.depositFields.find((field) => field.id === 'transactionamount');
    const currencyField = definition.depositFields.find((field) => field.id === 'currencycode');
    const amountIndex = definition.depositFields.indexOf(amountField);
    const beforeAmount = definition.depositFields.slice(0, amountIndex);
    const afterAmount = definition.depositFields.slice(amountIndex + 1).filter((field) => field.id !== 'currencycode');

    y = drawSectionTitle(doc, 'Data Setoran:', y);
    y = drawRows(
      doc,
      y,
      beforeAmount.map((field) => [field.label, formatFieldValue(field, deposit[field.id])])
    );
    // Uses the same 62mm label width as drawRows() above/below it, so the
    // amount value starts at the exact same X as every other row in this
    // section — a dedicated row rather than the generic 2-column
    // drawPairedRow (which assumes two independent half-page columns and
    // would misalign against the single-column rows surrounding it).
    y = drawAmountCurrencyRow(doc, y, amountField.label, formatFieldValue(amountField, deposit[amountField.id]), currencyField?.label, deposit[currencyField?.id]);
    y = drawRows(
      doc,
      y,
      afterAmount.map((field) => [field.label, formatFieldValue(field, deposit[field.id])])
    );

    y += 6;

    // --- Bilingual disclaimer (verbatim, matching the organization's own printout) ---
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text('This is a computer generated message and requires no signature.', PAGE_MARGIN, y);
    y += 4;
    doc.text('Informasi ini hasil cetakan komputer dan tidak memerlukan tanda tangan.', PAGE_MARGIN, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text(`Tanggal Cetak : ${formatPrintTimestamp()}`, PAGE_MARGIN, y);
    y += 6;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    const disclaimerLines = doc.splitTextToSize(getDisclaimerText(), PAGE_WIDTH - PAGE_MARGIN * 2);
    doc.text(disclaimerLines, PAGE_MARGIN, y);
  }

  /**
   * @param {object} report
   * @returns {import('jspdf').jsPDF}
   */
  function buildReportPdf(report) {
    const JsPDF = getJsPDF();
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    drawReportContent(doc, report);
    return doc;
  }

  /**
   * Builds ONE multi-page PDF containing every report in order — one
   * report per page — instead of several separate files. Used by the
   * Dashboard's "Unduh Terpilih" batch action.
   * @param {object[]} reports
   * @returns {import('jspdf').jsPDF}
   */
  function buildMergedReportsPdf(reports) {
    if (!reports || reports.length === 0) throw new Error('Tidak ada laporan yang dipilih.');
    const JsPDF = getJsPDF();
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    reports.forEach((report, index) => {
      if (index > 0) doc.addPage();
      drawReportContent(doc, report);
    });
    return doc;
  }

  /**
   * @param {object} report
   * @returns {string} suggested filename, unique per report (includes a
   *   slice of the report id) so it never collides with another report
   *   downloaded around the same minute.
   */
  function buildFilename(report) {
    const definition = getReportDefinition(report.reportType);
    const stamp = timestampForFilename(report.updatedAt || new Date().toISOString());
    const type = definition ? definition.shortLabel.replace(/\s+/g, '') : report.reportType;
    const uniqueSuffix = (report.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
    return `BPN-${type}-${stamp}${uniqueSuffix ? `-${uniqueSuffix}` : ''}.pdf`;
  }

  /** @param {object} report @returns {void} triggers a file download */
  function downloadReportPdf(report) {
    const doc = buildReportPdf(report);
    doc.save(buildFilename(report));
  }

  /** @param {object} report @returns {string} a blob URL suitable for an <iframe> or new tab */
  function previewReportPdfUrl(report) {
    const doc = buildReportPdf(report);
    return doc.output('bloburl');
  }

  /** @param {object} report opens the PDF in a new tab and triggers the print dialog */
  function printReportPdf(report) {
    const doc = buildReportPdf(report);
    doc.autoPrint();
    const url = doc.output('bloburl');
    window.open(url, '_blank');
  }

  /**
   * Downloads several reports merged into one multi-page PDF (one report
   * per page) — the Dashboard's batch download action.
   * @param {object[]} reports
   * @param {string} [filename]
   */
  function downloadReportsMerged(reports, filename) {
    const doc = buildMergedReportsPdf(reports);
    const stamp = timestampForFilename(new Date().toISOString());
    doc.save(filename || `BPN-Gabungan-${reports.length}Laporan-${stamp}.pdf`);
  }

  window.BPN = window.BPN || {};
  window.BPN.services = window.BPN.services || {};
  window.BPN.services.pdf = {
    buildReportPdf,
    buildMergedReportsPdf,
    downloadReportPdf,
    downloadReportsMerged,
    previewReportPdfUrl,
    printReportPdf,
  };
})();
