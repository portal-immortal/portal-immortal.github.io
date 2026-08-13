/**
 * views/create-report.js
 * ---------------------------------------------------------------------------
 * Create Report (and, via an :id param, Edit Report). Flow:
 *   1. User types a Kode Billing.
 *   2. Report type is auto-detected from its first digit — no dropdown.
 *   3. Once a type is known, the full payment + deposit form renders,
 *      metadata-driven via form-engine.js.
 *   4. A live preview panel mirrors the receipt as the user types.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { getReportDefinition } = window.BPN.config.reportDefinition;
  const { BILLING_FIELD } = window.BPN.config.fieldDefinition;
  const { detectReportType, getReportSubtitle } = window.BPN.config.billingPrefix;
  const { validateReportData } = window.BPN.services.validation;
  const { createEmptyReport, withComputedAmountInWords } = window.BPN.services.report;
  const { getReportById, saveReport, getSettings } = window.BPN.services.storage;
  const { renderReportForm, collectFormValues, applyFormErrors, setFieldValue, filterNumericInput } = window.BPN.components.formEngine;
  const { buildReceiptHtml } = window.BPN.templates.bpnTemplate;
  const { showToast } = window.BPN.components.toast;
  const { highlightActiveNav } = window.BPN.components.sidebar;
  const { navigate } = window.BPN.utils.router;

  // Drive the standalone detect-input's constraints from the single source
  // of truth in field-definition.js, instead of duplicating maxlength/pattern
  // by hand here (a previous hardcoded "20" silently drifted out of sync
  // with the real 15-digit spec — this can't happen again). Kode Billing
  // lives under "Data Setoran" on the receipt (it's a deposit field), but
  // is still collected here first, before the rest of the form exists, to
  // drive report-type auto-detection.
  const BILLING_FIELD_DEF = BILLING_FIELD;
  const BILLING_HELP_TEXT = BILLING_FIELD_DEF.help;

  async function render(container, params) {
    highlightActiveNav('create');
    const editingId = params && params.id;
    const isNewReport = !editingId;

    let report = editingId ? await getReportById(editingId) : createEmptyReport(null);
    if (editingId && !report) {
      container.innerHTML = `<div class="alert alert-warning">Laporan tidak ditemukan.</div>`;
      return;
    }
    if (!report) report = createEmptyReport(null);

    // Prefill Bank Name on brand-new reports from the organization's saved default, if any.
    if (isNewReport) {
      const settings = await getSettings();
      if (settings.defaultBankName) {
        report = { ...report, payment: { ...report.payment, bankname: settings.defaultBankName } };
      }
    }

    container.innerHTML = `
      <div class="row g-4">
        <div class="col-12 col-xl-7">
          <div class="card bpn-card mb-4">
            <div class="card-body">
              <label for="field-billingnumber-detect" class="form-label">Kode Billing</label>
              <input type="text" id="field-billingnumber-detect" class="form-control bpn-mono form-control-lg"
                     placeholder="${BILLING_FIELD_DEF.placeholder}" maxlength="${BILLING_FIELD_DEF.maxLength}"
                     inputmode="numeric" autocomplete="off"
                     value="${report.deposit?.billingnumber ? report.deposit.billingnumber : ''}" />
              <div class="form-text">${BILLING_HELP_TEXT}</div>
              <div id="detect-banner" class="mt-2"></div>
            </div>
          </div>

          <form id="report-form" novalidate>
            <div id="form-fields-slot"></div>
          </form>

          <div class="d-flex flex-wrap gap-2 mb-5" id="form-actions" style="display:none !important;"></div>
        </div>

        <div class="col-12 col-xl-5">
          <div class="bpn-sticky-preview">
            <h6 class="text-secondary text-uppercase small mb-2"><i class="bi bi-eye me-1"></i>Pratinjau Langsung</h6>
            <div id="live-preview-slot"></div>
          </div>
        </div>
      </div>
    `;

    const billingInput = container.querySelector('#field-billingnumber-detect');
    const detectBanner = container.querySelector('#detect-banner');
    const formFieldsSlot = container.querySelector('#form-fields-slot');
    const previewSlot = container.querySelector('#live-preview-slot');

    let currentType = report.reportType;
    let paymentData = { ...report.payment };
    let depositData = { ...report.deposit };

    function updatePreview() {
      previewSlot.innerHTML = buildReceiptHtml({ reportType: currentType, payment: paymentData, deposit: depositData });
    }

    function renderFullForm() {
      const definition = getReportDefinition(currentType);
      if (!definition) {
        formFieldsSlot.innerHTML = `
          <div class="bpn-empty-state">
            <i class="bi bi-search"></i>
            <p class="mb-0 text-secondary">Masukkan Kode Billing di atas untuk memulai — form akan muncul otomatis.</p>
          </div>`;
        updatePreview();
        return;
      }

      const allFields = [...definition.paymentFields, ...definition.depositFields];
      renderReportForm(formFieldsSlot, allFields, { payment: paymentData, deposit: depositData }, {
        onFieldChange: (fieldId, value, group) => {
          if (group === 'payment') paymentData[fieldId] = value;
          else depositData[fieldId] = value;

          if (fieldId === 'billingnumber') {
            billingInput.value = value;
            handleBillingChange(value, { skipFormRerender: true });
          }
          if (fieldId === 'transactionamount' || fieldId === 'currencycode') {
            depositData = withComputedAmountInWords(depositData);
            setFieldValue(formFieldsSlot, 'terbilang', depositData.terbilang);
          }
          updatePreview();
        },
      });

      // Sync the billing number field inside the rendered form with the top input.
      setFieldValue(formFieldsSlot, 'billingnumber', depositData.billingnumber || '');
      updatePreview();
      renderActions(definition);
    }

    function renderActions(definition) {
      const actions = container.querySelector('#form-actions');
      actions.removeAttribute('style');
      actions.innerHTML = `
        <button type="button" class="btn bpn-btn-primary" id="btn-save">
          <i class="bi bi-save me-1"></i>Simpan Laporan
        </button>
        <button type="button" class="btn btn-outline-secondary" id="btn-save-preview">
          <i class="bi bi-eye me-1"></i>Simpan &amp; Pratinjau
        </button>
        <button type="button" class="btn btn-outline-secondary ms-auto" id="btn-cancel">Batal</button>
      `;
      actions.querySelector('#btn-cancel').addEventListener('click', () => navigate('/dashboard'));
      actions.querySelector('#btn-save').addEventListener('click', () => handleSave(definition, false));
      actions.querySelector('#btn-save-preview').addEventListener('click', () => handleSave(definition, true));
    }

    async function handleSave(definition, goToPreview) {
      const values = collectFormValues(formFieldsSlot, [...definition.paymentFields, ...definition.depositFields]);
      values.deposit = withComputedAmountInWords(values.deposit);
      const { valid, errors } = validateReportData(definition, values.payment, values.deposit);

      if (!valid) {
        applyFormErrors(formFieldsSlot, errors);
        showToast('Beberapa isian belum lengkap atau valid. Periksa kembali form.', 'danger');
        return;
      }

      const saved = await saveReport({
        ...report,
        reportType: currentType,
        status: 'final',
        payment: values.payment,
        deposit: values.deposit,
      });

      showToast('Laporan berhasil disimpan.', 'success');
      navigate(goToPreview ? `/preview/${saved.id}` : '/dashboard');
    }

    function handleBillingChange(rawValue, { skipFormRerender = false } = {}) {
      depositData.billingnumber = rawValue;
      const detected = detectReportType(rawValue);

      if (!detected) {
        detectBanner.innerHTML = rawValue
          ? `<div class="alert alert-warning py-2 mb-0"><i class="bi bi-exclamation-triangle me-1"></i>Jenis laporan belum dapat dikenali dari kode ini.</div>`
          : '';
        if (currentType !== null) {
          currentType = null;
          if (!skipFormRerender) renderFullForm();
        }
        updatePreview();
        return;
      }

      const definition = getReportDefinition(detected);
      detectBanner.innerHTML = `
        <div class="alert alert-success py-2 mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-check-circle"></i>
          Terdeteksi sebagai <strong>${definition.shortLabel}</strong> — ${getReportSubtitle(detected)}
        </div>`;

      if (detected !== currentType) {
        currentType = detected;
        if (!skipFormRerender) renderFullForm();
      } else if (!skipFormRerender) {
        // Type hasn't changed, so renderFullForm() (and the field sync it
        // does) doesn't run — but the user is still typing more digits
        // into the standalone input, so the in-form Kode Billing field
        // needs to keep following along on every keystroke, not just the
        // one that first locked in the type.
        setFieldValue(formFieldsSlot, 'billingnumber', rawValue);
      }
      updatePreview();
    }

    billingInput.addEventListener('input', (e) => {
      filterNumericInput(e.target);
      handleBillingChange(e.target.value);
    });

    currentType = detectReportType(depositData.billingnumber) || null;
    handleBillingChange(depositData.billingnumber || '', { skipFormRerender: true });
    renderFullForm();
  }

  window.BPN = window.BPN || {};
  window.BPN.views = window.BPN.views || {};
  window.BPN.views.createReport = { render };
})();
