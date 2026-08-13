/**
 * csv.js
 * ---------------------------------------------------------------------------
 * CSV import/export. A single universal column set covers every report
 * type — Pajak, Bea Cukai, and PNBP rows can all live in the same file,
 * with the type auto-detected per row from its billing number, exactly
 * like the Create Report form does. Columns that don't apply to a row's
 * detected type are simply ignored on import and left blank on export.
 *
 * Import runs each row through the exact same field-level and
 * report-level validation as the manual Create Report form (fixed/max
 * length, required vs optional, numeric-only columns) — a row with an
 * invalid value is rejected with a specific message, not silently
 * accepted. Export normalizes localtransactiondatetime to the strict
 * "yyyy-MM-dd HH:mm:ss" column format; import accepts that format back
 * (or the native datetime-local "T" format) and converts it for the form.
 *
 * No external CSV library is used; quoted fields, escaped quotes, and
 * embedded commas/newlines are handled by the small parser below.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { PAYMENT_FIELDS, DEPOSIT_FIELDS } = window.BPN.config.fieldDefinition;
  const { detectReportType } = window.BPN.config.billingPrefix;
  const { getReportDefinition } = window.BPN.config.reportDefinition;
  const { createEmptyReport, withComputedAmountInWords } = window.BPN.services.report;
  const { validateReportData } = window.BPN.services.validation;
  const { generateId, normalizeDateTimeForExport, denormalizeDateTimeForForm, normalizeDateOnly } = window.BPN.utils.formatter;

  const PAYMENT_PREFIX = 'payment_';
  const DEPOSIT_PREFIX = 'deposit_';

  /** Union of every deposit field id across all three report types, in a stable order. */
  const ALL_DEPOSIT_FIELD_IDS = (() => {
    const seen = new Set();
    const ids = [];
    for (const type of Object.keys(DEPOSIT_FIELDS)) {
      for (const field of DEPOSIT_FIELDS[type]) {
        if (!seen.has(field.id)) {
          seen.add(field.id);
          ids.push(field.id);
        }
      }
    }
    return ids;
  })();

  /** @returns {string[]} the full, universal CSV header row (every element, every type) */
  function getUnifiedHeaders() {
    const paymentHeaders = PAYMENT_FIELDS.map((f) => `${PAYMENT_PREFIX}${f.id}`);
    // "terbilang" is excluded — it's always auto-computed from
    // transactionamount (see withComputedAmountInWords), so it's not a
    // real input column and shouldn't appear in the upload template.
    const depositHeaders = ALL_DEPOSIT_FIELD_IDS.filter((id) => id !== 'terbilang').map((id) => `${DEPOSIT_PREFIX}${id}`);
    return [...paymentHeaders, ...depositHeaders];
  }

  /** Escapes a single CSV field per RFC 4180. */
  function escapeCsvField(value) {
    const str = value === undefined || value === null ? '' : String(value);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function buildExampleRow(type) {
    const billingSeed = { PAJAK: '021234567890123', BEACUKAI: '521234567890123', PNBP: '821234567890123' }[type] || '021234567890123';
    const base = {
      [`${PAYMENT_PREFIX}bankname`]: 'Bank Mandiri',
      [`${PAYMENT_PREFIX}localtransactiondatetime`]: '2026-08-05 10:30:00',
      [`${PAYMENT_PREFIX}settlementdate`]: '2026-08-05',
      [`${PAYMENT_PREFIX}branchcode`]: '023100',
      [`${PAYMENT_PREFIX}retrievalreferencenumber`]: '012345678901',
      [`${PAYMENT_PREFIX}ntpn`]: 'A1B2C3D4E5F6G7H8',
      [`${PAYMENT_PREFIX}systemtraceauditnumber`]: '000123',
      [`${DEPOSIT_PREFIX}billingnumber`]: billingSeed,
      [`${DEPOSIT_PREFIX}transactionamount`]: '1000000',
      [`${DEPOSIT_PREFIX}currencycode`]: 'IDR',
    };
    if (type === 'PAJAK') {
      Object.assign(base, {
        [`${DEPOSIT_PREFIX}npwp`]: '1234567890123456',
        [`${DEPOSIT_PREFIX}namawp`]: 'PT Contoh Sejahtera',
        [`${DEPOSIT_PREFIX}alamatwp`]: 'Jl. Contoh No. 1, Jakarta',
        [`${DEPOSIT_PREFIX}jumlahdetail`]: '1',
      });
    } else if (type === 'BEACUKAI') {
      Object.assign(base, {
        [`${DEPOSIT_PREFIX}idwajibbayar`]: '1234567890',
        [`${DEPOSIT_PREFIX}namawp`]: 'PT Contoh Impor',
        [`${DEPOSIT_PREFIX}jenisdokumen`]: '01',
        [`${DEPOSIT_PREFIX}nomordokumen`]: '000123',
        [`${DEPOSIT_PREFIX}tanggaldokumen`]: '2026-08-01',
        [`${DEPOSIT_PREFIX}kodekpbc`]: '040100',
      });
    } else {
      Object.assign(base, {
        [`${DEPOSIT_PREFIX}namawp`]: 'PT Contoh Anggaran',
        [`${DEPOSIT_PREFIX}lembaga`]: '012',
        [`${DEPOSIT_PREFIX}uniteselon`]: '01',
        [`${DEPOSIT_PREFIX}kodesatker`]: '123456',
      });
    }
    return base;
  }

  /**
   * @returns {string} ONE universal CSV template: a single header row
   *   covering every element from every report type, followed by three
   *   example rows (Pajak, Bea Cukai, PNBP) showing which columns each
   *   type actually uses.
   */
  function generateUniversalCsvTemplate() {
    const headers = getUnifiedHeaders();
    const lines = [headers.join(',')];
    for (const type of ['PAJAK', 'BEACUKAI', 'PNBP']) {
      const exampleRow = buildExampleRow(type);
      lines.push(headers.map((h) => escapeCsvField(exampleRow[h] ?? '')).join(','));
    }
    return lines.join('\r\n');
  }

  /**
   * Parses raw CSV text into an array of row objects keyed by header.
   * Handles quoted fields, escaped quotes ("") and embedded commas/newlines.
   * @param {string} text
   * @returns {{headers: string[], rows: Record<string,string>[]}}
   */
  function parseCsv(text) {
    const rows = [];
    let field = '';
    let row = [];
    let inQuotes = false;
    const pushField = () => {
      row.push(field);
      field = '';
    };
    const pushRow = () => {
      pushField();
      rows.push(row);
      row = [];
    };

    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < normalized.length; i += 1) {
      const char = normalized[i];
      if (inQuotes) {
        if (char === '"') {
          if (normalized[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        pushField();
      } else if (char === '\n') {
        pushRow();
      } else {
        field += char;
      }
    }
    if (field.length > 0 || row.length > 0) pushRow();

    const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
    if (nonEmpty.length === 0) return { headers: [], rows: [] };

    const headers = nonEmpty[0].map((h) => h.trim());
    const dataRows = nonEmpty.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim();
      });
      return obj;
    });
    return { headers, rows: dataRows };
  }

  /**
   * @param {string[]} headers
   * @returns {{valid: boolean, missing: string[]}}
   */
  function validateCsvHeader(headers) {
    // Every column whose field is required (Nullable=NO in the column spec)
    // must be present in the file, or every row would fail validation anyway.
    const required = [
      ...PAYMENT_FIELDS.filter((f) => f.required).map((f) => `${PAYMENT_PREFIX}${f.id}`),
      `${DEPOSIT_PREFIX}billingnumber`,
      `${DEPOSIT_PREFIX}transactionamount`,
      `${DEPOSIT_PREFIX}currencycode`,
    ];
    const missing = required.filter((h) => !headers.includes(h));
    return { valid: missing.length === 0, missing };
  }

  /**
   * Converts parsed CSV rows into report objects, auto-detecting each row's
   * type from its billing number, then validating every field against the
   * same rules the manual form uses (required, fixed/max length, numeric
   * patterns). Rows that fail detection or validation are reported with a
   * specific message and excluded from the result.
   * @param {Record<string,string>[]} rows
   * @returns {{reports: object[], errors: Array<{rowNumber:number, message:string}>}}
   */
  function rowsToReports(rows) {
    const reports = [];
    const errors = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // header is row 1
      const billingnumber = row[`${DEPOSIT_PREFIX}billingnumber`];
      const type = detectReportType(billingnumber);
      if (!type) {
        errors.push({ rowNumber, message: `Baris ${rowNumber}: Kode Billing "${billingnumber || '-'}" tidak dikenali.` });
        return;
      }

      const payment = {};
      PAYMENT_FIELDS.forEach((f) => {
        let value = row[`${PAYMENT_PREFIX}${f.id}`] || '';
        if (value && f.id === 'localtransactiondatetime') {
          value = denormalizeDateTimeForForm(value);
        } else if (value && f.type === 'date') {
          value = normalizeDateOnly(value);
        }
        payment[f.id] = value;
      });

      const deposit = {};
      DEPOSIT_FIELDS[type].forEach((f) => {
        let value = row[`${DEPOSIT_PREFIX}${f.id}`] || '';
        if (value && f.type === 'date') {
          value = normalizeDateOnly(value);
        }
        deposit[f.id] = value;
      });
      if (!deposit.currencycode) deposit.currencycode = 'IDR';

      const definition = getReportDefinition(type);
      const { valid, errors: fieldErrors } = validateReportData(definition, payment, deposit);
      if (!valid) {
        const messages = Object.values(fieldErrors).join('; ');
        errors.push({ rowNumber, message: `Baris ${rowNumber} (${definition.shortLabel}): ${messages}` });
        return;
      }

      const skeleton = createEmptyReport(type);
      reports.push({
        ...skeleton,
        id: generateId(),
        payment,
        deposit: withComputedAmountInWords(deposit),
      });
    });

    return { reports, errors };
  }

  /**
   * @param {object[]} reports
   * @returns {string} full CSV text for the given reports, universal header set
   */
  function exportReportsToCsv(reports) {
    const headers = getUnifiedHeaders();
    const lines = [headers.join(',')];
    for (const report of reports) {
      const row = headers.map((header) => {
        if (header.startsWith(PAYMENT_PREFIX)) {
          const key = header.slice(PAYMENT_PREFIX.length);
          let value = report.payment?.[key];
          if (key === 'localtransactiondatetime' && value) value = normalizeDateTimeForExport(value);
          return escapeCsvField(value);
        }
        const key = header.slice(DEPOSIT_PREFIX.length);
        return escapeCsvField(report.deposit?.[key]);
      });
      lines.push(row.join(','));
    }
    return lines.join('\r\n');
  }

  /**
   * Triggers a browser download of CSV text.
   * @param {string} csvText
   * @param {string} filename
   */
  function downloadCsv(csvText, filename) {
    const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  window.BPN = window.BPN || {};
  window.BPN.services = window.BPN.services || {};
  window.BPN.services.csv = {
    getUnifiedHeaders,
    generateUniversalCsvTemplate,
    parseCsv,
    validateCsvHeader,
    rowsToReports,
    exportReportsToCsv,
    downloadCsv,
  };
})();
