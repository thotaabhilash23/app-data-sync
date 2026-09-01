// Shared write-through cache helper for every service that stores a whole
// collection (Staff, Departments, Holidays, Leave Types/Reasons, Leaves,
// Sessions) as one JSON blob under a STORAGE_KEYS.* key.
//
// Mirrors the pattern attendanceService.js already established for
// Attendance itself: reads stay perfectly synchronous (served from the
// local LocalStorage cache) so no page/component has to change how it
// consumes getAllX(); syncCollection() refreshes that cache from the
// Google Apps Script "Collections" sheet (see handleGetCollection /
// handleSetCollection in Code.gs) and persistCollection() writes a change
// back to both places. When VITE_APPS_SCRIPT_URL isn't set, both are
// no-ops beyond the local cache, so the app behaves exactly as it did
// before this backend existed.
import { getData, setData } from "./storageService";
import * as sheetsApi from "./sheetsApi";

export const USE_SHEETS = sheetsApi.isSheetsBackendConfigured();

// Call once (e.g. from a hook's mount effect) to pull the latest shared
// value for `key` down from Sheets and mirror it into the local cache.
// Resolves to the value now in the cache either way, so callers can just
// do `setState(await syncCollection(...))`.
export async function syncCollection(key, defaultValue) {
  if (!USE_SHEETS) return getData(key, defaultValue);
  try {
    const remote = await sheetsApi.getCollection(key);
    const value = remote === null || remote === undefined ? defaultValue : remote;
    setData(key, value);
    return value;
  } catch (err) {
    console.error(`sheetsSync: failed to fetch collection "${key}"`, err);
    // Fall back to whatever's already cached locally rather than blocking
    // the page — the next successful sync will reconcile it.
    return getData(key, defaultValue);
  }
}

// Persists `value` for `key` to Sheets and mirrors it into the local
// cache. Always await this — unlike the old LocalStorage-only writes,
// this can now fail (network/auth), and callers should surface that to
// the user (see the try/catch wrapping in Settings.jsx / Staff.jsx etc.)
// rather than silently losing the write.
export async function persistCollection(key, value) {
  setData(key, value); // optimistic local mirror, same behavior as before
  if (!USE_SHEETS) return value;
  await sheetsApi.setCollection(key, value);
  return value;
}
