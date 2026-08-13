/**
 * validation.js
 * ---------------------------------------------------------------------------
 * Field- and report-level validation. Individual field rules are driven by
 * the metadata in field-definition.js (required / pattern / maxLength), so
 * this file mostly supplies the *engine* plus a few checks that need real
 * logic (billing number, dates, currency codes) rather than a static
 * pattern.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { detectReportType } = window.BPN.config.billingPrefix;

  /**
   * @param {string} code
   * @returns {{valid: boolean, message?: string}}
   */
  function validateBillingNumber(code) {
    if (!code || !code.trim()) return { valid: false, message: 'Kode Billing wajib diisi.' };
    const digitsOnly = code.replace(/\D/g, '');
    if (digitsOnly.length !== 15) {
      return { valid: false, message: 'Kode Billing harus tepat 15 digit.' };
    }
    if (!detectReportType(code)) {
      return { valid: false, message: 'Digit pertama Kode Billing tidak dikenali.' };
    }
    return { valid: true };
  }

  /**
   * @param {string} code ISO 4217-ish currency code
   * @returns {{valid: boolean, message?: string}}
   */
  function validateCurrency(code) {
    if (!code || !/^[A-Za-z]{3}$/.test(code.trim())) {
      return { valid: false, message: 'Mata uang harus 3 huruf, mis. IDR.' };
    }
    return { valid: true };
  }

  /**
   * @param {string} value
   * @returns {{valid: boolean, message?: string}}
   */
  function validateDate(value) {
    if (!value) return { valid: false, message: 'Tanggal wajib diisi.' };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { valid: false, message: 'Format tanggal tidak valid.' };
    return { valid: true };
  }

  /**
   * Validates a single field's raw string value against its definition.
   * @param {object} field   a field-definition entry
   * @param {*} rawValue
   * @returns {{valid: boolean, message?: string}}
   */
  function validateField(field, rawValue) {
    const value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();

    if (field.id === 'billingnumber') return validateBillingNumber(value);
    if (field.id === 'currencycode') return validateCurrency(value);
    if (field.type === 'date' || field.type === 'datetime-local') {
      if (!field.required && !value) return { valid: true };
      return validateDate(value);
    }

    if (field.required && !value) {
      return { valid: false, message: `${field.label} wajib diisi.` };
    }
    if (!value) return { valid: true };

    if (field.type === 'currency' || field.type === 'number') {
      if (Number.isNaN(Number(value)) || Number(value) < 0) {
        return { valid: false, message: `${field.label} harus berupa angka positif.` };
      }
      if (typeof field.max === 'number' && Number(value) > field.max) {
        return { valid: false, message: `${field.label} maksimal ${field.max}.` };
      }
    }

    if (field.pattern) {
      const regex = new RegExp(field.pattern);
      if (!regex.test(value)) {
        return { valid: false, message: `Format ${field.label} tidak sesuai.` };
      }
    }

    if (field.maxLength && value.length > field.maxLength) {
      return { valid: false, message: `${field.label} maksimal ${field.maxLength} karakter.` };
    }

    return { valid: true };
  }

  /**
   * Validates a full report's payment + deposit data against a report
   * definition.
   * @param {object} definition  a report-definition entry
   * @param {object} paymentData
   * @param {object} depositData
   * @returns {{valid: boolean, errors: Record<string,string>}}
   */
  function validateReportData(definition, paymentData, depositData) {
    const errors = {};

    for (const field of definition.paymentFields) {
      const result = validateField(field, paymentData?.[field.id]);
      if (!result.valid) errors[field.id] = result.message;
    }
    for (const field of definition.depositFields) {
      const result = validateField(field, depositData?.[field.id]);
      if (!result.valid) errors[field.id] = result.message;
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  window.BPN = window.BPN || {};
  window.BPN.services = window.BPN.services || {};
  window.BPN.services.validation = {
    validateBillingNumber,
    validateCurrency,
    validateDate,
    validateField,
    validateReportData,
  };
})();
