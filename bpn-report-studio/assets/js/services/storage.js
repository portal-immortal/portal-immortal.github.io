/**
 * storage.js
 * ---------------------------------------------------------------------------
 * All persistence goes through this file. Version 1 stores everything in
 * the browser's localStorage. Nothing else in the app calls
 * `localStorage` directly — every read/write goes through the functions
 * below, so persistence can move to a remote API later without touching
 * views, services, or components.
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

  /**
   * Interface every storage provider must implement.
   * @interface StorageProvider
   * @method getItem   (key: string) => Promise<string|null>
   * @method setItem    (key: string, value: string) => Promise<void>
   * @method removeItem (key: string) => Promise<void>
   */

  /** localStorage-backed implementation of StorageProvider. */
  class LocalStorageProvider {
    async getItem(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (err) {
        console.error('[storage] getItem failed', key, err);
        return null;
      }
    }

    async setItem(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (err) {
        console.error('[storage] setItem failed', key, err);
        throw new Error('Penyimpanan lokal penuh atau tidak tersedia.');
      }
    }

    async removeItem(key) {
      try {
        window.localStorage.removeItem(key);
      } catch (err) {
        console.error('[storage] removeItem failed', key, err);
      }
    }
  }

  /**
   * In-memory fallback used only when localStorage itself is unreachable
   * (some browser privacy settings — e.g. Chrome's "Block third-party
   * cookies and site data" — throw a SecurityError for localStorage on
   * file:// pages). Keeps the app fully usable for the current tab session
   * instead of silently discarding every save; see `isPersistent` below,
   * which the UI uses to warn the user that nothing will survive a reload.
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

  /** @returns {boolean} whether window.localStorage is actually readable/writable right now */
  function detectLocalStorageAvailable() {
    try {
      const testKey = '__bpn_storage_probe__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * True if data will actually persist across reloads. False means the
   * app is silently running on an in-memory fallback for this tab only —
   * views should surface this (see app.js's storage-warning banner).
   */
  const isPersistent = detectLocalStorageAvailable();

  /**
   * Swap this single instance to move the whole app to a different backend
   * (e.g. `new CloudStorageProvider(apiClient)`), as long as it implements
   * the same async getItem/setItem/removeItem interface.
   */
  const activeProvider = isPersistent ? new LocalStorageProvider() : new InMemoryStorageProvider();

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
    return (await activeProvider.getItem(STORAGE_KEYS.theme)) || 'system';
  }

  /** @param {'light'|'dark'|'system'} theme */
  async function setTheme(theme) {
    await activeProvider.setItem(STORAGE_KEYS.theme, theme);
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
   * Rough estimate of localStorage usage in bytes for app-owned keys.
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
  };
})();
