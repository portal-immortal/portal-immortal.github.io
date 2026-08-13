/**
 * form-engine.js
 * ---------------------------------------------------------------------------
 * Renders a Bootstrap 5 form from an array of field-definition objects. No
 * form in the app is hand-written in HTML — Create Report, and the CSV
 * import summary, all go through this renderer. Grouping ('payment' /
 * 'deposit') is read from each field's `group` property.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { escapeHtml, formatCurrency } = window.BPN.utils.formatter;

  const GROUP_LABELS = {
    payment: 'Data Pembayaran',
    deposit: 'Data Setoran',
  };

  const GROUP_ICONS = {
    payment: 'bi-credit-card',
    deposit: 'bi-receipt',
  };

  function inputTypeFor(field) {
    if (field.type === 'currency' || field.type === 'number') return 'number';
    if (field.type === 'date') return 'date';
    if (field.type === 'datetime-local') return 'datetime-local';
    return 'text';
  }

  /**
   * Strips every non-digit character from a text input's value in place,
   * live as the user types — used for "numeric only" columns (billing
   * number, branch code, NTB, STAN, NPWP, and the various code fields)
   * where digits must never even be typeable, not just validated after
   * the fact. Makes a reasonable effort to keep the caret in place rather
   * than jumping to the end.
   * @param {HTMLInputElement} el
   */
  function filterNumericInput(el) {
    const before = el.value;
    let filtered = before.replace(/\D/g, '');
    // Defense in depth: the HTML `maxlength` attribute only constrains
    // interactive typing/pasting, not values set programmatically (e.g. a
    // pasted string assigned via .value in one shot) — cap it here too.
    if (el.maxLength && el.maxLength > 0 && filtered.length > el.maxLength) {
      filtered = filtered.slice(0, el.maxLength);
    }
    if (filtered === before) return;
    const caret = el.selectionStart ?? filtered.length;
    const removedBeforeCaret = before.slice(0, caret).replace(/[0-9]/g, '').length;
    el.value = filtered;
    const newCaret = Math.max(0, caret - removedBeforeCaret);
    try {
      el.setSelectionRange(newCaret, newCaret);
    } catch {
      /* setSelectionRange can throw on some input types; safe to ignore */
    }
  }

  function renderFieldControl(field, value) {
    const monoClass = field.mono ? ' bpn-mono' : '';
    const commonAttrs = `
      id="field-${field.id}"
      data-field-id="${field.id}"
      data-group="${field.group}"
      ${field.required ? 'required' : ''}
      ${field.pattern ? `pattern="${field.pattern}"` : ''}
      ${field.maxLength ? `maxlength="${field.maxLength}"` : ''}
      ${typeof field.max === 'number' ? `max="${field.max}"` : ''}
      ${field.step ? `step="${field.step}"` : ''}
      ${field.numericOnly ? 'inputmode="numeric" autocomplete="off"' : ''}
    `;

    if (field.type === 'textarea') {
      return `<textarea class="form-control${monoClass}" rows="2" ${commonAttrs}>${escapeHtml(value)}</textarea>`;
    }

    if (field.type === 'computed') {
      return `
        <div class="input-group">
          <textarea class="form-control${monoClass}" rows="2" ${commonAttrs} readonly>${escapeHtml(value)}</textarea>
          <button class="btn btn-outline-secondary bpn-edit-computed" type="button" data-target="field-${field.id}" title="Sunting manual">
            <i class="bi bi-pencil"></i>
          </button>
        </div>`;
    }

    if (field.type === 'currency') {
      return `
        <div class="input-group">
          <span class="input-group-text">Rp</span>
          <input type="number" min="0" step="1" class="form-control${monoClass}" value="${escapeHtml(value)}" ${commonAttrs} />
        </div>
        <div class="form-text bpn-currency-preview" data-preview-for="${field.id}">${formatCurrency(value || 0)}</div>`;
    }

    return `<input type="${inputTypeFor(field)}" class="form-control${monoClass}" value="${escapeHtml(value)}" ${commonAttrs} placeholder="${escapeHtml(field.placeholder || '')}" />`;
  }

  function renderField(field, value) {
    return `
      <div class="col-12 col-md-6 bpn-field" data-field-wrapper="${field.id}">
        <label for="field-${field.id}" class="form-label">
          ${escapeHtml(field.label)}${field.required ? ' <span class="text-danger">*</span>' : ''}
        </label>
        ${renderFieldControl(field, value)}
        ${field.help ? `<div class="form-text">${escapeHtml(field.help)}</div>` : ''}
        <div class="invalid-feedback" data-error-for="${field.id}"></div>
      </div>`;
  }

  function renderGroup(groupKey, fields, values) {
    if (fields.length === 0) return '';
    return `
      <div class="card bpn-card mb-4" data-group-card="${groupKey}">
        <div class="card-header bpn-card-header">
          <i class="bi ${GROUP_ICONS[groupKey] || 'bi-folder'} me-2"></i>${GROUP_LABELS[groupKey] || groupKey}
        </div>
        <div class="card-body">
          <div class="row g-3">
            ${fields.map((f) => renderField(f, values[f.id] ?? f.default ?? '')).join('')}
          </div>
        </div>
      </div>`;
  }

  /**
   * Renders the full form (all groups) into `container` and wires up change
   * listeners. Returns nothing; use collectFormValues() to read state back.
   * @param {HTMLElement} container
   * @param {object[]} fields  full field list (payment + deposit), in order
   * @param {{payment: object, deposit: object}} values
   * @param {{onFieldChange?: (fieldId:string, value:string, group:string) => void}} [options]
   */
  function renderReportForm(container, fields, values, options = {}) {
    const paymentFields = fields.filter((f) => f.group === 'payment');
    const depositFields = fields.filter((f) => f.group === 'deposit');
    const flatValues = { ...values.payment, ...values.deposit };
    const fieldsById = Object.fromEntries(fields.map((f) => [f.id, f]));

    container.innerHTML = renderGroup('payment', paymentFields, flatValues) + renderGroup('deposit', depositFields, flatValues);

    container.querySelectorAll('[data-field-id]').forEach((el) => {
      el.addEventListener('input', () => {
        const fieldDef = fieldsById[el.dataset.fieldId];
        if (fieldDef?.numericOnly) {
          filterNumericInput(el);
        }
        if (options.onFieldChange) {
          options.onFieldChange(el.dataset.fieldId, el.value, el.dataset.group);
        }
        clearFieldError(container, el.dataset.fieldId);
      });
    });

    // Live currency preview
    container.querySelectorAll('.bpn-currency-preview').forEach((previewEl) => {
      const fieldId = previewEl.dataset.previewFor;
      const input = container.querySelector(`#field-${fieldId}`);
      if (!input) return;
      input.addEventListener('input', () => {
        previewEl.textContent = formatCurrency(input.value || 0);
      });
    });

    // Computed-field manual edit toggle
    container.querySelectorAll('.bpn-edit-computed').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = container.querySelector(`#${btn.dataset.target}`);
        if (!target) return;
        target.readOnly = false;
        target.focus();
        btn.disabled = true;
        btn.title = 'Sedang disunting manual';
      });
    });
  }

  /**
   * Reads current input values from the DOM back into a
   * {payment, deposit} shape.
   * @param {HTMLElement} container
   * @param {object[]} fields
   * @returns {{payment: object, deposit: object}}
   */
  function collectFormValues(container, fields) {
    const payment = {};
    const deposit = {};
    for (const field of fields) {
      const el = container.querySelector(`#field-${field.id}`);
      const value = el ? el.value : '';
      if (field.group === 'payment') payment[field.id] = value;
      else deposit[field.id] = value;
    }
    return { payment, deposit };
  }

  /**
   * Applies validation error messages to the form.
   * @param {HTMLElement} container
   * @param {Record<string,string>} errors
   */
  function applyFormErrors(container, errors) {
    container.querySelectorAll('[data-field-id]').forEach((el) => el.classList.remove('is-invalid'));
    container.querySelectorAll('[data-error-for]').forEach((el) => {
      el.textContent = '';
    });
    Object.entries(errors).forEach(([fieldId, message]) => {
      const input = container.querySelector(`#field-${fieldId}`);
      const feedback = container.querySelector(`[data-error-for="${fieldId}"]`);
      if (input) input.classList.add('is-invalid');
      if (feedback) feedback.textContent = message;
    });
  }

  /**
   * Clears the error state for a single field (called as the user types).
   * @param {HTMLElement} container
   * @param {string} fieldId
   */
  function clearFieldError(container, fieldId) {
    const input = container.querySelector(`#field-${fieldId}`);
    const feedback = container.querySelector(`[data-error-for="${fieldId}"]`);
    if (input) input.classList.remove('is-invalid');
    if (feedback) feedback.textContent = '';
  }

  /**
   * Updates a single field's displayed value (used e.g. to push a recomputed
   * "Amount In Words" back into the form without a full re-render).
   * @param {HTMLElement} container
   * @param {string} fieldId
   * @param {string} value
   */
  function setFieldValue(container, fieldId, value) {
    const input = container.querySelector(`#field-${fieldId}`);
    if (input && !input.matches(':focus')) input.value = value;
  }

  window.BPN = window.BPN || {};
  window.BPN.components = window.BPN.components || {};
  window.BPN.components.formEngine = {
    renderReportForm,
    collectFormValues,
    applyFormErrors,
    clearFieldError,
    setFieldValue,
    filterNumericInput,
  };
})();
