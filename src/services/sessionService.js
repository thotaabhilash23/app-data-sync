// Login Activity / Session records — kept deliberately separate from
// Attendance (see spec: "Attendance Record" vs "Login Activity / Session
// Record" are two related but different concepts). This module is the
// single source of truth for who signed in/out of the *system*, when,
// from where (best-effort browser geolocation, with consent), and on
// what device — plus a security-relevant audit trail of every
// authentication event (successful login, failed login, logout, etc).
//
// IMPORTANT ARCHITECTURE NOTE: this app has no backend/server — every
// record here lives in the browser's LocalStorage, same as the rest of
// the app. That means:
//   - "IP information" cannot be captured client-side and is never
//     collected (there's no `ip` field). Don't fabricate it.
//   - Location is only ever what the browser's Geolocation API returns,
//     and only after the user grants permission — it is never silent or
//     guaranteed. A denied/unavailable permission just leaves it null.
//   - "Enforce at the backend/database authorization level" isn't
//     achievable without a real backend. What *is* enforced is that only
//     the admin-only routes/pages read this data, exactly like every
//     other admin-only page in this app (ProtectedRoute). If this app is
//     ever given a real backend, this file is the right place to swap
//     LocalStorage calls for API calls without touching callers.

import { getData } from "./storageService";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { generateId } from "../utils/idGenerator";
import { syncCollection, persistCollection } from "./sheetsSync";

export const EVENT_TYPES = {
  LOGIN: "login",
  LOGOUT: "logout",
  FAILED_LOGIN: "failed_login",
  SESSION_EXPIRED: "session_expired",
};

function parseDevice() {
  if (typeof navigator === "undefined") return { browser: null, os: null, raw: null };
  const ua = navigator.userAgent || "";
  const browser =
    (ua.match(/Edg\/([\d.]+)/) && "Edge") ||
    (ua.match(/Chrome\/([\d.]+)/) && "Chrome") ||
    (ua.match(/Firefox\/([\d.]+)/) && "Firefox") ||
    (ua.match(/Safari\/([\d.]+)/) && "Safari") ||
    "Unknown";
  const os =
    (ua.includes("Windows") && "Windows") ||
    (ua.includes("Mac OS") && "macOS") ||
    (ua.includes("Android") && "Android") ||
    (ua.includes("iPhone") || ua.includes("iPad") ? "iOS" : null) ||
    (ua.includes("Linux") && "Linux") ||
    "Unknown";
  return { browser, os, raw: ua };
}

export function getAllEvents() {
  return getData(STORAGE_KEYS.SESSIONS, []);
}

// Pulls the shared login-activity log down from the Sheets backend (when
// configured) into the local cache. Call once on mount — see LoginActivity.jsx.
export function syncEvents() {
  return syncCollection(STORAGE_KEYS.SESSIONS, []);
}

async function saveAllEvents(list) {
  return persistCollection(STORAGE_KEYS.SESSIONS, list);
}

// user: { id, name, loginId/staffId, role, department } — whatever the
// caller has on hand at the moment of the event.
export async function recordEvent(type, user, { location = null, reason = null } = {}) {
  const list = getAllEvents();
  const now = new Date().toISOString();
  const event = {
    id: generateId("sess"),
    type,
    userId: user?.id || user?.username || null,
    userName: user?.name || null,
    userLoginId: user?.staffId || user?.username || null,
    role: user?.role || null,
    department: user?.department || null,
    at: now,
    location,
    device: parseDevice(),
    reason,
    createdAt: now,
  };
  await saveAllEvents([...list, event]);
  return event;
}

export function recordLogin(user, location = null) {
  return recordEvent(EVENT_TYPES.LOGIN, user, { location });
}

export function recordFailedLogin(attemptedId, reason) {
  return recordEvent(EVENT_TYPES.FAILED_LOGIN, { id: attemptedId, name: attemptedId }, { reason });
}

// Closes the most recent open (no logout yet) login session for this user.
export async function recordLogout(user, location = null) {
  const list = getAllEvents();
  const openLogin = [...list]
    .reverse()
    .find((e) => e.userId === (user?.id || user?.username) && e.type === EVENT_TYPES.LOGIN && !e.closedAt);
  const now = new Date().toISOString();
  const logoutEvent = await recordEvent(EVENT_TYPES.LOGOUT, user, { location });
  if (openLogin) {
    const durationMinutes = Math.round((new Date(now) - new Date(openLogin.at)) / 60000);
    const updated = getAllEvents().map((e) =>
      e.id === openLogin.id ? { ...e, closedAt: now, logoutEventId: logoutEvent.id, durationMinutes } : e
    );
    await saveAllEvents(updated);
    return { logoutEvent, durationMinutes };
  }
  return { logoutEvent, durationMinutes: null };
}

// Users currently "online": a login event with no matching logout yet.
export function getLiveStatus() {
  const list = getAllEvents();
  const openLogins = list.filter((e) => e.type === EVENT_TYPES.LOGIN && !e.closedAt);
  return openLogins.map((e) => ({
    userId: e.userId,
    userName: e.userName,
    userLoginId: e.userLoginId,
    role: e.role,
    department: e.department,
    loginAt: e.at,
    location: e.location,
    device: e.device,
  }));
}

export function isUserOnline(userId) {
  return getAllEvents().some((e) => e.type === EVENT_TYPES.LOGIN && !e.closedAt && e.userId === userId);
}

export function getEventsForUser(userId) {
  return getAllEvents()
    .filter((e) => e.userId === userId)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

// Generic filter used by the Login Activity admin page.
export function filterEvents({
  userId = null,
  department = null,
  role = null,
  type = null,
  dateFrom = null, // ISO date "YYYY-MM-DD"
  dateTo = null,
  onlineOnly = false,
} = {}) {
  let events = getAllEvents();
  if (userId) events = events.filter((e) => e.userId === userId);
  if (department) events = events.filter((e) => e.department === department);
  if (role) events = events.filter((e) => e.role === role);
  if (type) events = events.filter((e) => e.type === type);
  if (dateFrom) events = events.filter((e) => e.at.slice(0, 10) >= dateFrom);
  if (dateTo) events = events.filter((e) => e.at.slice(0, 10) <= dateTo);
  if (onlineOnly) events = events.filter((e) => e.type === EVENT_TYPES.LOGIN && !e.closedAt);
  return events.sort((a, b) => new Date(b.at) - new Date(a.at));
}

// Pairs each login with its logout (if closed) into one row per session —
// the shape the History table and Excel export both want.
export function getSessionRows(filters = {}) {
  const events = filterEvents({ ...filters, type: filters.type === "login" || filters.type === "logout" ? null : filters.type });
  const logins = events.filter((e) => e.type === EVENT_TYPES.LOGIN);
  return logins.map((login) => {
    const logout = login.logoutEventId ? events.find((e) => e.id === login.logoutEventId) : null;
    return {
      id: login.id,
      userId: login.userId,
      userName: login.userName,
      userLoginId: login.userLoginId,
      role: login.role,
      department: login.department,
      loginAt: login.at,
      logoutAt: logout?.at || null,
      loginLocation: login.location,
      logoutLocation: logout?.location || null,
      durationMinutes: login.durationMinutes ?? null,
      device: login.device,
      online: !login.closedAt,
    };
  });
}

// Best-effort: geolocation is async and shouldn't block the login flow
// itself, so the initial login event is recorded with location: null and
// this patches it in a moment later once/if the browser grants permission.
export async function attachLocationToLastLogin(userId, location) {
  const list = getAllEvents();
  const idx = [...list].reverse().findIndex((e) => e.userId === userId && e.type === EVENT_TYPES.LOGIN);
  if (idx === -1) return;
  const realIdx = list.length - 1 - idx;
  const updated = list.map((e, i) => (i === realIdx ? { ...e, location } : e));
  await saveAllEvents(updated);
}

export async function clearAllEvents() {
  await saveAllEvents([]);
}
