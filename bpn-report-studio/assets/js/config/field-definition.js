/**
 * field-definition.js
 * ---------------------------------------------------------------------------
 * Every input field in the application is described here as data, not as
 * markup. The form engine, the CSV importer/exporter, and the PDF renderer
 * all read from these definitions instead of hardcoding field lists.
 *
 * Field `id` values are the exact "Crystal Field" / database column names
 * from the organization's existing report-engine mapping, so the app's
 * internal report objects, its CSV columns, and that external system all
 * speak the same field names with zero translation layer.
 *
 * Field order and grouping (which fields live under "Data Pembayaran" vs
 * "Data Setoran") mirror the organization's own reference BPN printout:
 * the Kode Billing line sits under Data Setoran, not Data Pembayaran, even
 * though the Create Report page still asks for it first (outside this
 * form entirely) to drive type auto-detection.
 *
 * Length/required/numeric constraints mirror the organization's column
 * spec exactly:
 *   - "fixed length" columns use an exact-match pattern (^[0-9]{N}$)
 *   - plain max-length columns use a bounded pattern (^[0-9]{1,N}$) for
 *     numeric-only columns, or just `maxLength` for free-text columns
 *   - `required` reflects the spec's Nullable column (Nullable=NO -> required)
 *
 * Field shape:
 * {
 *   id:          string   the Crystal Field / column name; also the CSV column suffix
 *   label:       string   human label (Indonesian)
 *   group:       'payment' | 'deposit'
 *   type:        'text' | 'textarea' | 'number' | 'currency' | 'date' |
 *                'datetime-local' | 'computed'
 *   required:    boolean  false = Nullable=YES in the column spec
 *   mono:        boolean  render in a monospace, ledger-style input
 *   numericOnly: boolean  strip non-digit characters live as the user types
 *   placeholder: string
 *   help:        string   short helper text shown under the field
 *   pattern:     string   optional HTML5 pattern for validation
 *   maxLength:   number
 *   max:         number   optional upper bound for numeric/currency fields
 *   step:        number   optional HTML5 step attribute (e.g. 1 = show seconds on datetime-local)
 *   default:     string   optional value to prefill on brand-new reports
 *   autoDetect:  boolean  true only for the billing number field
 * }
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const PAYMENT_FIELDS = [
    {
      id: 'bankname',
      label: 'Bank Name',
      group: 'payment',
      type: 'text',
      required: true,
      maxLength: 100,
      placeholder: 'Bank Mandiri',
      help: 'Bank atau pos persepsi yang memproses setoran.',
    },
    {
      id: 'localtransactiondatetime',
      label: 'Tanggal dan Jam Bayar',
      group: 'payment',
      type: 'datetime-local',
      required: true,
      step: 1,
      help: 'Waktu setoran dilakukan di bank/pos persepsi (termasuk detik).',
    },
    {
      id: 'settlementdate',
      label: 'Tanggal Buku',
      group: 'payment',
      type: 'date',
      required: false,
      help: 'Tanggal pembukuan penerimaan negara.',
    },
    {
      id: 'branchcode',
      label: 'Kode Cabang Bank',
      group: 'payment',
      type: 'text',
      required: true,
      mono: true,
      numericOnly: true,
      pattern: '^[0-9]{6}$',
      maxLength: 6,
      placeholder: '023100',
      help: 'Harus tepat 6 digit.',
    },
    {
      id: 'retrievalreferencenumber',
      label: 'NTB',
      group: 'payment',
      type: 'text',
      required: false,
      mono: true,
      numericOnly: true,
      pattern: '^[0-9]{12}$',
      maxLength: 12,
      placeholder: '012345678901',
      help: 'NTB (Nomor Transaksi Bank). Jika diisi, harus tepat 12 digit.',
    },
    {
      id: 'ntpn',
      label: 'NTPN',
      group: 'payment',
      type: 'text',
      required: false,
      mono: true,
      pattern: '^[A-Za-z0-9]{16}$',
      maxLength: 16,
      placeholder: 'A1B2C3D4E5F6G7H8',
      help: 'NTPN (Nomor Transaksi Penerimaan Negara). Jika diisi, harus tepat 16 karakter alfanumerik.',
    },
    {
      id: 'systemtraceauditnumber',
      label: 'STAN',
      group: 'payment',
      type: 'text',
      required: true,
      mono: true,
      numericOnly: true,
      pattern: '^[0-9]{6}$',
      maxLength: 6,
      placeholder: '000123',
      help: 'STAN (System Trace Audit Number). Harus tepat 6 digit.',
    },
  ];

  /**
   * Kode Billing lives under "Data Setoran" on the reference printout, so
   * it's a *deposit* field — even though the Create Report page still
   * collects it first, via the standalone detect-input above the form, to
   * drive report-type auto-detection before the rest of the form exists.
   */
  const BILLING_FIELD = {
    id: 'billingnumber',
    label: 'Kode Billing',
    group: 'deposit',
    type: 'text',
    required: true,
    mono: true,
    numericOnly: true,
    autoDetect: true,
    pattern: '^[0-9]{15}$',
    maxLength: 15,
    placeholder: '021234567890123',
    help: 'Harus tepat 15 digit. Jenis laporan (Pajak/Bea Cukai/PNBP) terdeteksi otomatis dari digit pertama.',
  };

  const AMOUNT_FIELD = {
    id: 'transactionamount',
    label: 'Jumlah Setoran',
    group: 'deposit',
    type: 'currency',
    required: true,
    help: 'Nominal dalam angka, tanpa titik/koma pemisah.',
  };

  const CURRENCY_FIELD = {
    id: 'currencycode',
    label: 'Mata Uang',
    group: 'deposit',
    type: 'text',
    required: true,
    mono: true,
    maxLength: 3,
    placeholder: 'IDR',
    default: 'IDR',
  };

  const AMOUNT_IN_WORDS_FIELD = {
    id: 'terbilang',
    label: 'Terbilang',
    group: 'deposit',
    type: 'computed',
    required: false,
    help: 'Terisi otomatis dari Jumlah Setoran — dapat diedit manual bila perlu.',
  };

  /**
   * Type-specific deposit fields, keyed by report type, in the order they
   * appear on the reference printout. "Nama Wajib Pajak" (Pajak) and
   * "Nama Wajib Bayar" (Bea Cukai / PNBP) are the same underlying column
   * (`namawp`) with a label that changes per type. The type-identifying
   * extra field (Jumlah Detail for Pajak; Tanggal Dokumen + Kode KPPBC for
   * Bea Cukai) sits right before Jumlah Setoran, not after Terbilang —
   * confirmed against the organization's own reference PDF layout.
   */
  const DEPOSIT_FIELDS = {
    PAJAK: [
      BILLING_FIELD,
      {
        id: 'npwp',
        label: 'NPWP',
        group: 'deposit',
        type: 'text',
        required: false,
        mono: true,
        numericOnly: true,
        pattern: '^[0-9]{16}$',
        maxLength: 16,
        placeholder: '1234567890123456',
        help: 'Jika diisi, harus tepat 16 digit tanpa titik/strip.',
      },
      { id: 'namawp', label: 'Nama Wajib Pajak', group: 'deposit', type: 'text', required: false, maxLength: 200 },
      { id: 'alamatwp', label: 'Alamat', group: 'deposit', type: 'textarea', required: false, maxLength: 50 },
      {
        id: 'jumlahdetail',
        label: 'Jumlah Detail',
        group: 'deposit',
        type: 'number',
        required: false,
        max: 99,
        help: 'Jumlah baris rincian jenis setoran pada billing (maks. 2 digit).',
      },
      AMOUNT_FIELD,
      CURRENCY_FIELD,
      AMOUNT_IN_WORDS_FIELD,
    ],
    BEACUKAI: [
      BILLING_FIELD,
      {
        id: 'idwajibbayar',
        label: 'ID Wajib Bayar',
        group: 'deposit',
        type: 'text',
        required: false,
        mono: true,
        numericOnly: true,
        pattern: '^[0-9]{1,20}$',
        maxLength: 20,
        help: 'Angka, maksimal 20 digit.',
      },
      { id: 'namawp', label: 'Nama Wajib Bayar', group: 'deposit', type: 'text', required: false, maxLength: 200 },
      {
        id: 'jenisdokumen',
        label: 'Jenis Dokumen',
        group: 'deposit',
        type: 'text',
        required: false,
        mono: true,
        numericOnly: true,
        pattern: '^[0-9]{1,2}$',
        maxLength: 2,
        placeholder: '01',
        help: 'Kode angka, maksimal 2 digit.',
      },
      {
        id: 'nomordokumen',
        label: 'Nomor Dokumen',
        group: 'deposit',
        type: 'text',
        required: false,
        mono: true,
        numericOnly: true,
        pattern: '^[0-9]{1,30}$',
        maxLength: 30,
        help: 'Angka, maksimal 30 digit.',
      },
      { id: 'tanggaldokumen', label: 'Tanggal Dokumen', group: 'deposit', type: 'date', required: false },
      {
        id: 'kodekpbc',
        label: 'Kode KPPBC',
        group: 'deposit',
        type: 'text',
        required: false,
        mono: true,
        numericOnly: true,
        pattern: '^[0-9]{1,6}$',
        maxLength: 6,
        help: 'Kode Kantor Pengawasan dan Pelayanan Bea dan Cukai, angka maksimal 6 digit.',
      },
      AMOUNT_FIELD,
      CURRENCY_FIELD,
      AMOUNT_IN_WORDS_FIELD,
    ],
    PNBP: [
      BILLING_FIELD,
      {
        id: 'lembaga',
        label: 'Kementerian / Lembaga',
        group: 'deposit',
        type: 'text',
        required: false,
        mono: true,
        numericOnly: true,
        pattern: '^[0-9]{1,3}$',
        maxLength: 3,
        placeholder: '012',
        help: 'Kode Bagan Akun Standar, angka maksimal 3 digit.',
      },
      { id: 'namawp', label: 'Nama Wajib Bayar', group: 'deposit', type: 'text', required: false, maxLength: 200 },
      {
        id: 'uniteselon',
        label: 'Unit Eselon I',
        group: 'deposit',
        type: 'text',
        required: false,
        mono: true,
        numericOnly: true,
        pattern: '^[0-9]{1,2}$',
        maxLength: 2,
        placeholder: '01',
        help: 'Kode angka, maksimal 2 digit.',
      },
      {
        id: 'kodesatker',
        label: 'Satuan Kerja',
        group: 'deposit',
        type: 'text',
        required: false,
        mono: true,
        numericOnly: true,
        pattern: '^[0-9]{1,6}$',
        maxLength: 6,
        placeholder: '123456',
        help: 'Kode Satuan Kerja, angka maksimal 6 digit.',
      },
      AMOUNT_FIELD,
      CURRENCY_FIELD,
      AMOUNT_IN_WORDS_FIELD,
    ],
  };

  /**
   * Flat lookup of every field definition by id, per report type, including
   * shared payment fields.
   * @param {'PAJAK'|'BEACUKAI'|'PNBP'} type
   * @returns {Record<string, object>}
   */
  function getFieldMapForType(type) {
    const all = [...PAYMENT_FIELDS, ...(DEPOSIT_FIELDS[type] || [])];
    return Object.fromEntries(all.map((f) => [f.id, f]));
  }

  window.BPN = window.BPN || {};
  window.BPN.config = window.BPN.config || {};
  window.BPN.config.fieldDefinition = {
    PAYMENT_FIELDS,
    DEPOSIT_FIELDS,
    BILLING_FIELD,
    getFieldMapForType,
  };
})();
