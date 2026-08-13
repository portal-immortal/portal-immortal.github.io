/**
 * terbilang.js
 * ---------------------------------------------------------------------------
 * Converts a non-negative integer into Indonesian words ("terbilang"),
 * used to auto-fill the "Amount In Words" field from "Amount".
 * Supports values up to 999,999,999,999,999 (hundreds of trillions).
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const ONES = [
    '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
    'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
    'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas',
  ];

  const SCALES = ['', 'ribu', 'juta', 'miliar', 'triliun'];

  /**
   * Converts a 0–999 chunk into words.
   * @param {number} n
   * @returns {string}
   */
  function chunkToWords(n) {
    if (n === 0) return '';
    if (n < 20) return ONES[n];
    if (n < 100) {
      const tens = Math.floor(n / 10);
      const rest = n % 10;
      return `${ONES[tens]} puluh${rest ? ' ' + ONES[rest] : ''}`;
    }
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const hundredWord = hundreds === 1 ? 'seratus' : `${ONES[hundreds]} ratus`;
    return `${hundredWord}${rest ? ' ' + chunkToWords(rest) : ''}`;
  }

  /**
   * Converts an integer amount into Indonesian words, e.g. 125000 ->
   * "seratus dua puluh lima ribu".
   * @param {number} amount
   * @returns {string}
   */
  function numberToWords(amount) {
    const value = Math.floor(Math.abs(Number(amount) || 0));
    if (value === 0) return 'nol';

    const chunks = [];
    let remaining = value;
    while (remaining > 0) {
      chunks.push(remaining % 1000);
      remaining = Math.floor(remaining / 1000);
    }

    const parts = [];
    for (let i = chunks.length - 1; i >= 0; i -= 1) {
      const chunk = chunks[i];
      if (chunk === 0) continue;
      if (i === 1 && chunk === 1) {
        parts.push('seribu');
      } else {
        const words = chunkToWords(chunk);
        parts.push(SCALES[i] ? `${words} ${SCALES[i]}` : words);
      }
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Builds the full "Amount In Words" sentence including the currency name,
   * capitalized as it would appear on an official receipt, e.g.
   * "Seratus Dua Puluh Lima Ribu Rupiah".
   * @param {number} amount
   * @param {string} [currency='IDR']
   * @returns {string}
   */
  function amountToWords(amount, currency = 'IDR') {
    const words = numberToWords(amount);
    const currencyName = currency === 'IDR' ? 'Rupiah' : currency;
    const sentence = `${words} ${currencyName}`;
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }

  window.BPN = window.BPN || {};
  window.BPN.utils = window.BPN.utils || {};
  window.BPN.utils.terbilang = { numberToWords, amountToWords };
})();
