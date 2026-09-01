import { getData, setData, removeData } from "./storageService";
import { STORAGE_KEYS } from "../constants/storageKeys";
import * as staffService from "./staffService";
import * as sessionService from "./sessionService";
import * as sheetsApi from "./sheetsApi";

// When VITE_APPS_SCRIPT_URL is set, login/staffLogin/logout are backed by
// the Google Apps Script + Google Sheets backend instead of LocalStorage —
// see sheetsApi.js and google-apps-script/Code.gs. All other exports here
// (getCurrentUser/getUsers) keep working unchanged either way, since the
// Sheets-authenticated session is still mirrored into the same
// STORAGE_KEYS.CURRENT_USER slot the rest of the app already reads.
const USE_SHEETS = sheetsApi.isSheetsBackendConfigured();

const DEFAULT_USERS = [
  { username: "admin", password: "admin123", name: "Admin User", role: "admin" },
];

export function getUsers() {
  return getData(STORAGE_KEYS.USERS, DEFAULT_USERS);
}

// Admin login — checks the admin users collection only. Staff accounts
// never live in this collection, so this can never silently hand a
// Staff member an Admin session.
// `location`, when provided, is a { lat, lng, accuracy, address, capturedAt }
// snapshot (see utils/geo.js) captured by the caller *before* calling
// login, with the user's consent — same pattern as staff clock-in.
export async function login(username, password, location = null) {
  if (USE_SHEETS) return sheetsLogin(username, password, location);

  const users = getUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
  );
  if (!user) {
    await sessionService.recordFailedLogin(username.trim(), "Invalid admin credentials");
    return { success: false, error: "Invalid username or password." };
  }
  const session = {
    id: user.username,
    username: user.username,
    name: user.name,
    role: user.role,
    loggedInAt: new Date().toISOString(),
  };
  setData(STORAGE_KEYS.CURRENT_USER, session);
  await sessionService.recordLogin(session, location);
  return { success: true, user: session };
}

// Shared by login() and staffLogin() when the Google Sheets backend is
// configured — the backend's Employees sheet holds both admin and staff
// accounts (Role column), so one call covers both.
async function sheetsLogin(loginId, password, location) {
  try {
    const employee = await sheetsApi.login(loginId, password);
    const session = {
      id: employee.employeeId,
      staffId: employee.loginId,
      username: employee.loginId,
      name: employee.name,
      email: employee.email,
      role: employee.role === "admin" ? "admin" : "staff",
      department: employee.department,
      loggedInAt: new Date().toISOString(),
    };
    setData(STORAGE_KEYS.CURRENT_USER, session);
    await sessionService.recordLogin(session, location);
    return { success: true, user: session };
  } catch (err) {
    await sessionService.recordFailedLogin(loginId.trim(), err.message);
    return { success: false, error: err.message };
  }
}

// Staff login — checks the staff collection by Staff ID or email, and
// enforces the account's active/inactive status. Never falls back to
// granting admin access.
export async function staffLogin(loginId, password, location = null) {
  if (!loginId || !loginId.trim()) {
    return { success: false, error: "Enter your Staff ID or email." };
  }
  if (USE_SHEETS) return sheetsLogin(loginId, password, location);

  const staff = staffService.getStaffByLoginId(loginId);
  if (!staff || staff.password !== password) {
    await sessionService.recordFailedLogin(loginId.trim(), "Invalid staff credentials");
    return { success: false, error: "Invalid Staff ID/email or password." };
  }
  if (staff.status !== "active") {
    await sessionService.recordFailedLogin(loginId.trim(), "Account deactivated");
    return {
      success: false,
      error: "Your account has been deactivated. Please contact the administrator.",
    };
  }
  const session = {
    id: staff.id,
    staffId: staff.loginId,
    name: staff.name,
    email: staff.email,
    role: "staff",
    department: staff.department,
    loggedInAt: new Date().toISOString(),
  };
  setData(STORAGE_KEYS.CURRENT_USER, session);
  await sessionService.recordLogin(session, location);
  return { success: true, user: session };
}

// `location` here is the *logout* location snapshot (optional, best-effort).
export async function logout(location = null) {
  const user = getCurrentUser();
  if (user) await sessionService.recordLogout(user, location);
  removeData(STORAGE_KEYS.CURRENT_USER);
  if (USE_SHEETS) {
    try {
      await sheetsApi.logout();
    } catch {
      // token already invalid/expired — local session is cleared regardless
    }
  }
}

export function getCurrentUser() {
  return getData(STORAGE_KEYS.CURRENT_USER, null);
}
