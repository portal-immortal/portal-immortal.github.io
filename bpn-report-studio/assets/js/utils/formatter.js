/**
 * formatter.js
 * ---------------------------------------------------------------------------
 * Small, dependency-free formatting and helper utilities shared across the
 * app: currency display, date display, id generation, and HTML escaping.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  /**
   * @param {number|string} amount
   * @param {string} [currency='IDR']
   * @returns {string} e.g. "Rp125.000" — compact display for dashboards/tables
   */
  function formatCurrency(amount, currency = 'IDR') {
    const value = Number(amount) || 0;
    try {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: currency || 'IDR',
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${currency} ${value.toLocaleString('id-ID')}`;
    }
  }

  /**
   * Official receipt/PDF money format, matching the organization's
   * existing BPN printout: Indonesian thousands/decimal separators, two
   * decimal places — e.g. "100.000,00". No currency code suffix; that's
   * shown separately by its own "Mata Uang" row right next to it.
   * @param {number|string} amount
   * @returns {string}
   */
  function formatCurrencyOfficial(amount) {
    const value = Number(amount) || 0;
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * @param {string} isoDate  YYYY-MM-DD
   * @returns {string} e.g. "5 Agustus 2026" — used in casual UI, not the receipt
   */
  function formatDate(isoDate) {
    if (!isoDate) return '-';
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return isoDate;
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  /**
   * @param {string} isoDateTime  YYYY-MM-DDTHH:mm
   * @returns {string} e.g. "5 Agustus 2026, 14:30" — used in casual UI, not the receipt
   */
  function formatDateTime(isoDateTime) {
    if (!isoDateTime) return '-';
    const date = new Date(isoDateTime);
    if (Number.isNaN(date.getTime())) return isoDateTime;
    const datePart = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const timePart = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date);
    return `${datePart}, ${timePart}`;
  }

  /**
   * Official receipt/PDF date format, matching the organization's existing
   * BPN printout: "dd/MM/yyyy". Defensively strips any time component
   * that might have leaked in (e.g. a CSV/spreadsheet export that writes
   * dates as "2023-08-03 00:00:00.000") rather than falling back to
   * printing the raw, unparsed string.
   * @param {string} isoDate  YYYY-MM-DD, optionally with a trailing time
   * @returns {string} e.g. "23/07/2025"
   */
  function formatDateOfficial(isoDate) {
    if (!isoDate) return '-';
    const dateOnly = String(isoDate).trim().slice(0, 10);
    const date = new Date(`${dateOnly}T00:00:00`);
    if (Number.isNaN(date.getTime())) return isoDate;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  /**
   * Official receipt/PDF datetime format, matching the organization's
   * existing BPN printout: "dd/MM/yyyy HH:mm:ss".
   * @param {string} isoDateTime
   * @returns {string} e.g. "23/07/2025 13:36:10"
   */
  function formatDateTimeOfficial(isoDateTime) {
    if (!isoDateTime) return '-';
    const date = new Date(isoDateTime);
    if (Number.isNaN(date.getTime())) return isoDateTime;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}:${pad(date.getSeconds())}`;
  }

  /**
   * @returns {string} a compact, sufficiently unique id (not cryptographic)
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    const rand = Math.random().toString(16).slice(2);
    return `id-${Date.now().toString(16)}-${rand}`;
  }

  /**
   * Escapes a string for safe insertion into HTML.
   * @param {unknown} value
   * @returns {string}
   */
  function escapeHtml(value) {
    const str = value === null || value === undefined ? '' : String(value);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * @param {string} isoDateTime
   * @returns {string} filename-safe timestamp, e.g. 20260805-1430
   */
  function timestampForFilename(isoDateTime = new Date().toISOString()) {
    const date = new Date(isoDateTime);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
      date.getMinutes()
    )}`;
  }

  /**
   * "Tanggal Cetak" (print date) — always computed fresh at render/print
   * time, never stored on the report itself. Matches the organization's
   * existing BPN printout format exactly: "dd-MM-yyyy HH:mm:ss UTC+07:00",
   * fixed to Asia/Jakarta (WIB) regardless of the viewer's own timezone.
   * @param {Date} [date]
   * @returns {string} e.g. "12-12-2025 15:38:48 UTC+07:00"
   */
  function formatPrintTimestamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const hour = map.hour === '24' ? '00' : map.hour;
    return `${map.day}-${map.month}-${map.year} ${hour}:${map.minute}:${map.second} UTC+07:00`;
  }

  /**
   * Converts a datetime-local input value ("yyyy-MM-ddTHH:mm[:ss[.SSS]]")
   * into the strict "yyyy-MM-dd HH:mm:ss" (19-char) column format used by
   * the CSV/dataset spec: seconds default to "00" when the form widget
   * didn't collect them, and any milliseconds the browser appends (e.g.
   * when step="1" is set, HTML5 normalizes the value to include ".000")
   * are dropped.
   * @param {string} value
   * @returns {string}
   */
  function normalizeDateTimeForExport(value) {
    if (!value) return '';
    const [datePart, timePart = '00:00'] = value.trim().split(/[T ]/);
    const [h = '00', m = '00', sRaw = '00'] = timePart.split(':');
    const s = sRaw.split('.')[0]; // drop any trailing milliseconds (e.g. "30.000" -> "30")
    const pad = (n) => String(n).padStart(2, '0');
    return `${datePart} ${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  /**
   * Converts a value from an imported CSV row — either the strict
   * "yyyy-MM-dd HH:mm:ss" column format or the native
   * "yyyy-MM-ddTHH:mm[:ss]" form format — back into the
   * "yyyy-MM-ddTHH:mm:ss" shape <input type="datetime-local" step="1">
   * expects, preserving seconds when present.
   * @param {string} value
   * @returns {string}
   */
  function denormalizeDateTimeForForm(value) {
    if (!value) return '';
    return value.trim().replace(' ', 'T').split('.')[0].slice(0, 19);
  }

  /**
   * Normalizes a date-only value (settlementdate, tanggaldokumen) from an
   * imported CSV/spreadsheet cell down to the plain "yyyy-MM-dd" shape
   * <input type="date"> expects — spreadsheet exports sometimes write
   * dates with a trailing midnight timestamp (e.g. "2023-08-03
   * 00:00:00.000"), which would otherwise get stored and displayed as-is.
   * @param {string} value
   * @returns {string}
   */
  function normalizeDateOnly(value) {
    if (!value) return '';
    const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : String(value).trim();
  }

  /**
   * Reads a nested value safely, e.g. getPath(report, 'deposit.transactionamount').
   * @param {object} obj
   * @param {string} path
   * @returns {*}
   */
  function getPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
  }

  window.BPN = window.BPN || {};
  window.BPN.utils = window.BPN.utils || {};
  window.BPN.utils.formatter = {
    formatCurrency,
    formatCurrencyOfficial,
    formatDate,
    formatDateTime,
    formatDateOfficial,
    formatDateTimeOfficial,
    generateId,
    escapeHtml,
    timestampForFilename,
    formatPrintTimestamp,
    normalizeDateTimeForExport,
    denormalizeDateTimeForForm,
    normalizeDateOnly,
    getPath,
  };
})();
