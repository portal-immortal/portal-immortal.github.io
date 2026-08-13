/**
 * storage.js
 * ---------------------------------------------------------------------------
 * All persistence goes through this file. Data is kept in a user-selected
 * JSON file rather than browser localStorage, so uploads and report data are
 * not silently saved into the browser's built-in storage.
 *
 * SAAS READINESS NOTE:
 * `StorageProvider` documents the interface any future provider must
 * implement (e.g. a `CloudStorageProvider` backed by REST/Supabase/
 * Firebase). Swapping `activeProvider` below is the only change required
 * to move the whole app to a remote backend.
 * ---------------------------------------------------------------------------
 */

(function () {
  'use strict';

  const { STORAGE_KEYS } = window.BPN.config.appConfig;

  const FILE_STORAGE_DEFAULTS = Object.freeze({
    [STORAGE_KEYS.reports]: '[]',
    [STORAGE_KEYS.settings]: '{}',
    [STORAGE_KEYS.theme]: '"system"',
    [STORAGE_KEYS.recent]: '[]',
  });

  /**
   * Interface every storage provider must implement.
   * @interface StorageProvider
   * @method getItem   (key: string) => Promise<string|null>
   * @method setItem    (key: string, value: string) => Promise<void>
   * @method removeItem (key: string) => Promise<void>
   */

  class FileStorageProvider {
    constructor() {
      this._cache = null;
      this._fileHandle = null;
    }

    async ensureFileHandle(mode = 'read') {
      if (this._fileHandle) return this._fileHandle;

      const pickerName = mode === 'read' ? 'showOpenFilePicker' : 'showSaveFilePicker';
      const picker = window[pickerName];
      if (typeof picker !== 'function') return null;

      if (mode === 'read') {
        const [handle] = await picker.call(window, {
          types: [
            {
              description: 'JSON Data File',
              accept: {
                'application/json': ['.json'],
              },
            },
          ],
          multiple: false,
        });
        this._fileHandle = handle;
        return handle;
      }

      this._fileHandle = await picker.call(window, {
        suggestedName: 'bpn-report-studio-data.json',
        types: [
          {
            description: 'JSON Data File',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
      });
      return this._fileHandle;
    }

    async readFileData() {
      const handle = await this.ensureFileHandle('read').catch(() => null);
      if (!handle) return { ...FILE_STORAGE_DEFAULTS };

      const file = await handle.getFile().catch(() => null);
      if (!file || file.size === 0) return { ...FILE_STORAGE_DEFAULTS };

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return { ...FILE_STORAGE_DEFAULTS };
        }
        return { ...FILE_STORAGE_DEFAULTS, ...parsed };
      } catch (err) {
        console.warn('[storage] failed to parse data file, resetting defaults', err);
        return { ...FILE_STORAGE_DEFAULTS };
      }
    }

    async ensureCache() {
      if (this._cache) return this._cache;
      this._cache = await this.readFileData();
      return this._cache;
    }

    async flush() {
      const handle = await this.ensureFileHandle('write').catch(() => null);
      if (!handle) return false;

      const writable = await handle.createWritable().catch(() => null);
      if (!writable) return false;

      await writable.write(JSON.stringify(this._cache, null, 2));
      await writable.close();
      return true;
    }

    async getItem(key) {
      const cache = await this.ensureCache();
      return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null;
    }

    async setItem(key, value) {
      const cache = await this.ensureCache();
      cache[key] = value;
      await this.flush();
    }

    async removeItem(key) {
      const cache = await this.ensureCache();
      delete cache[key];
      await this.flush();
    }
  }

  /**
   * In-memory fallback used only when the browser cannot expose a file picker.
   * Kept as a last resort so the app remains usable in the current tab.
   */
  class InMemoryStorageProvider {
    constructor() {
      this._store = new Map();
    }
    async getItem(key) {
      return this._store.has(key) ? this._store.get(key) : null;
    }
    async setItem(key, value) {
      this._store.set(key, value);
    }
    async removeItem(key) {
      this._store.delete(key);
    }
  }

  /** @returns {boolean} whether the browser exposes a file-picker API for JSON storage */
  function detectFileStorageAvailable() {
    return typeof window.showOpenFilePicker === 'function' || typeof window.showSaveFilePicker === 'function';
  }

  /**
   * True if data will actually persist across reloads through the saved JSON file.
   * False means the app is running on an in-memory fallback for this tab only.
   */
  const isPersistent = detectFileStorageAvailable();

  /**
   * Swap this single instance to move the whole app to a different backend,
   * as long as it implements the same async getItem/setItem/removeItem
   * interface.
   */
  const activeProvider = isPersistent ? new FileStorageProvider() : new InMemoryStorageProvider();

  async function readJson(key, fallback) {
    const raw = await activeProvider.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.error('[storage] corrupt JSON for key', key, err);
      return fallback;
    }
  }

  async function writeJson(key, value) {
    await activeProvider.setItem(key, JSON.stringify(value));
  }

  /* ---------------------------- Reports ----------------------------------- */

  /** @returns {Promise<object[]>} */
  async function getReports() {
    return readJson(STORAGE_KEYS.reports, []);
  }

  /** @param {string} id @returns {Promise<object|null>} */
  async function getReportById(id) {
    const reports = await getReports();
    return reports.find((r) => r.id === id) || null;
  }

  /**
   * Inserts or updates a report by id.
   * @param {object} report
   * @returns {Promise<object>} the saved report
   */
  async function saveReport(report) {
    const reports = await getReports();
    const index = reports.findIndex((r) => r.id === report.id);
    const now = new Date().toISOString();
    const toSave = { ...report, updatedAt: now, createdAt: report.createdAt || now };
    if (index >= 0) {
      reports[index] = toSave;
    } else {
      reports.push(toSave);
    }
    await writeJson(STORAGE_KEYS.reports, reports);
    await pushRecent(toSave.id);
    return toSave;
  }

  /**
   * Inserts or updates many reports at once (used by CSV/JSON import).
   * @param {object[]} newReports
   * @returns {Promise<{added: number, updated: number}>}
   */
  async function saveReportsBulk(newReports) {
    const reports = await getReports();
    const byId = new Map(reports.map((r) => [r.id, r]));
    let added = 0;
    let updated = 0;
    const now = new Date().toISOString();
    for (const report of newReports) {
      const existing = byId.get(report.id);
      if (existing) updated += 1;
      else added += 1;
      byId.set(report.id, { ...report, updatedAt: now, createdAt: existing?.createdAt || report.createdAt || now });
    }
    await writeJson(STORAGE_KEYS.reports, Array.from(byId.values()));
    return { added, updated };
  }

  /** @param {string} id @returns {Promise<void>} */
  async function deleteReport(id) {
    const reports = await getReports();
    await writeJson(STORAGE_KEYS.reports, reports.filter((r) => r.id !== id));
  }

  /** @returns {Promise<void>} */
  async function clearAllReports() {
    await writeJson(STORAGE_KEYS.reports, []);
  }

  /* ---------------------------- Settings ------------------------------------ */

  const DEFAULT_SETTINGS = Object.freeze({
    planId: 'free',
    defaultCurrency: 'IDR',
    organizationName: '',
    defaultBankName: '',
  });

  /** @returns {Promise<object>} */
  async function getSettings() {
    const stored = await readJson(STORAGE_KEYS.settings, {});
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  /** @param {object} settings @returns {Promise<object>} */
  async function saveSettings(settings) {
    const merged = { ...(await getSettings()), ...settings };
    await writeJson(STORAGE_KEYS.settings, merged);
    return merged;
  }

  /* ------------------------------ Theme -------------------------------------- */

  /** @returns {Promise<'light'|'dark'|'system'>} */
  async function getTheme() {
    const stored = await activeProvider.getItem(STORAGE_KEYS.theme);
    return stored ? JSON.parse(stored) : 'system';
  }

  /** @param {'light'|'dark'|'system'} theme */
  async function setTheme(theme) {
    await activeProvider.setItem(STORAGE_KEYS.theme, JSON.stringify(theme));
  }

  /* ------------------------------ Recent -------------------------------------- */

  const MAX_RECENT = 8;

  /** @returns {Promise<string[]>} report ids, most recent first */
  async function getRecentIds() {
    return readJson(STORAGE_KEYS.recent, []);
  }

  /** @param {string} id */
  async function pushRecent(id) {
    const recent = (await getRecentIds()).filter((existing) => existing !== id);
    recent.unshift(id);
    await writeJson(STORAGE_KEYS.recent, recent.slice(0, MAX_RECENT));
  }

  /* ------------------------------ Utilities ----------------------------------- */

  /**
   * Rough estimate of JSON file data size in bytes for app-owned keys.
   * @returns {Promise<number>}
   */
  async function estimateStorageUsageBytes() {
    let total = 0;
    for (const key of Object.values(STORAGE_KEYS)) {
      const value = await activeProvider.getItem(key);
      if (value) total += value.length;
    }
    return total;
  }

  /**
   * Wipes every app-owned key. Used by Settings > "Hapus semua data".
   */
  async function clearAllAppData() {
    for (const key of Object.values(STORAGE_KEYS)) {
      await activeProvider.removeItem(key);
    }
  }

  /**
   * Exports all app-owned data to a JSON file.
   * @param {string} fileName
   * @returns {Promise<void>}
   */
  async function exportDataFile(fileName = 'bpn-report-studio-data.json') {
    const payload = {};
    for (const key of Object.values(STORAGE_KEYS)) {
      const raw = await activeProvider.getItem(key);
      if (raw !== null && raw !== undefined) {
        try {
          payload[key] = JSON.parse(raw);
        } catch {
          payload[key] = raw;
        }
      }
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });

    if (typeof window.showSaveFilePicker === 'function') {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'JSON Data File', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Imports all app-owned data from a JSON file.
   * @param {File} file
   * @returns {Promise<void>}
   */
  async function importDataFile(file) {
    if (!file) throw new Error('Berkas data tidak ditemukan.');

    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Format file tidak valid. Harap pilih file JSON yang benar.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Format JSON tidak sesuai. File harus berisi objek data aplikasi.');
    }

    for (const key of Object.values(STORAGE_KEYS)) {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) {
        await activeProvider.setItem(key, JSON.stringify(parsed[key]));
      }
    }
  }

  window.BPN = window.BPN || {};
  window.BPN.services = window.BPN.services || {};
  window.BPN.services.storage = {
    isPersistent,
    getReports,
    getReportById,
    saveReport,
    saveReportsBulk,
    deleteReport,
    clearAllReports,
    getSettings,
    saveSettings,
    getTheme,
    setTheme,
    getRecentIds,
    pushRecent,
    estimateStorageUsageBytes,
    clearAllAppData,
    exportDataFile,
    importDataFile,
  };
})();
