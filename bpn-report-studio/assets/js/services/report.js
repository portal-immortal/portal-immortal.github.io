/**
 * report.js
 * ---------------------------------------------------------------------------
 * Domain logic for a BPN report: shape, creation, amount-in-words
 * computation, and summarization for tables/cards. This is the layer views
 * talk to instead of poking at storage or field-definitions directly.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { getReportDefinition } = window.BPN.config.reportDefinition;
  const { detectReportType } = window.BPN.config.billingPrefix;
  const { amountToWords } = window.BPN.utils.terbilang;
  const { generateId } = window.BPN.utils.formatter;

  /**
   * @param {'PAJAK'|'BEACUKAI'|'PNBP'} reportType
   * @returns {object} a blank report skeleton
   */
  function createEmptyReport(reportType) {
    return {
      id: generateId(),
      reportType,
      status: 'draft',
      payment: {},
      deposit: {},
      createdAt: null,
      updatedAt: null,
    };
  }

  /**
   * Builds/updates a report object from raw form data, auto-detecting the
   * type from the billing number if not already known.
   * @param {object} existing  existing report (or a skeleton from createEmptyReport)
   * @param {object} paymentData
   * @param {object} depositData
   * @returns {object}
   */
  function buildReport(existing, paymentData, depositData) {
    const reportType = detectReportType(depositData.billingnumber) || existing.reportType;
    return {
      ...existing,
      reportType,
      payment: { ...paymentData },
      deposit: { ...depositData },
    };
  }

  /**
   * Recomputes "Terbilang" from "Jumlah Setoran" + "Mata Uang" and returns
   * a new deposit object (does not mutate the input).
   * @param {object} deposit
   * @returns {object}
   */
  function withComputedAmountInWords(deposit) {
    const amount = deposit?.transactionamount;
    if (!deposit || amount === undefined || amount === '' || Number.isNaN(Number(amount))) {
      return { ...deposit, terbilang: deposit?.terbilang || '' };
    }
    return {
      ...deposit,
      terbilang: amountToWords(Number(amount), deposit.currencycode || 'IDR'),
    };
  }

  /**
   * @param {'PAJAK'|'BEACUKAI'|'PNBP'} type
   * @returns {object|null}
   */
  function getDefinitionForReport(type) {
    return getReportDefinition(type);
  }

  /**
   * Produces a compact row shape for tables/dashboards. `namawp` (Nama
   * Wajib Pajak / Nama Wajib Bayar) is the same Crystal Field across every
   * report type, so no per-type branching is needed here anymore.
   * @param {object} report
   * @returns {{id:string, reportType:string, billingnumber:string, primaryName:string, amount:number, currency:string, status:string, updatedAt:string}}
   */
  function summarizeReport(report) {
    const definition = getReportDefinition(report.reportType);
    return {
      id: report.id,
      reportType: report.reportType,
      reportSubtitle: definition ? definition.subtitle : report.reportType,
      billingnumber: report.deposit?.billingnumber || '-',
      primaryName: report.deposit?.namawp || '-',
      amount: Number(report.deposit?.transactionamount) || 0,
      currency: report.deposit?.currencycode || 'IDR',
      status: report.status || 'draft',
      updatedAt: report.updatedAt,
    };
  }

  /**
   * @param {object[]} reports
   * @returns {{total:number, byType:Record<string,number>, totalAmount:number}}
   */
  function computeDashboardStats(reports) {
    const byType = { PAJAK: 0, BEACUKAI: 0, PNBP: 0 };
    let totalAmount = 0;
    for (const report of reports) {
      if (byType[report.reportType] !== undefined) byType[report.reportType] += 1;
      totalAmount += Number(report.deposit?.transactionamount) || 0;
    }
    return { total: reports.length, byType, totalAmount };
  }

  window.BPN = window.BPN || {};
  window.BPN.services = window.BPN.services || {};
  window.BPN.services.report = {
    createEmptyReport,
    buildReport,
    withComputedAmountInWords,
    getDefinitionForReport,
    summarizeReport,
    computeDashboardStats,
  };
})();
