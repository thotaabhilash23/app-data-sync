import { getData } from "./storageService";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { generateId } from "../utils/idGenerator";
import { syncCollection, persistCollection } from "./sheetsSync";

// Staff records double as portal accounts: `loginId` + `password` let a
// staff member sign in at /staff/login, and `status` (active/inactive)
// gates that login without touching their historical attendance data.
const DEFAULT_STAFF = [
  { id: "stf_seed1", name: "Amara Whitfield", role: "Floor Supervisor", department: "Operations", email: "amara.whitfield@example.com", phone: "555-0142", joinDate: "2023-02-14", status: "active", avatarColor: "#120D9E", loginId: "STF001", password: "staff123" },
  { id: "stf_seed2", name: "Devon Okafor", role: "Cashier", department: "Retail", email: "devon.okafor@example.com", phone: "555-0198", joinDate: "2023-06-01", status: "active", avatarColor: "#13A870", loginId: "STF002", password: "staff123" },
  { id: "stf_seed3", name: "Priya Nair", role: "Warehouse Lead", department: "Logistics", email: "priya.nair@example.com", phone: "555-0110", joinDate: "2022-11-20", status: "active", avatarColor: "#E14868", loginId: "STF003", password: "staff123" },
  { id: "stf_seed4", name: "Marcus Lee", role: "Barista", department: "Retail", email: "marcus.lee@example.com", phone: "555-0176", joinDate: "2024-01-09", status: "inactive", avatarColor: "#7B7FA0", loginId: "STF004", password: "staff123" },
];

export function getAllStaff() {
  return getData(STORAGE_KEYS.STAFF, DEFAULT_STAFF);
}

// Pulls the shared staff directory down from the Sheets backend (when
// configured) into the local cache. Call once on mount — see useStaff /
// useMyStaff. Stored as its own Collections-sheet blob rather than folded
// into the Employees sheet, since Staff here (job title, department,
// portal login) is a distinct record shape from Employees (admin auth) —
// see INTEGRATION.md.
export function syncStaff() {
  return syncCollection(STORAGE_KEYS.STAFF, DEFAULT_STAFF);
}

export function getStaffById(id) {
  return getAllStaff().find((s) => s.id === id) || null;
}

export function getStaffByLoginId(loginId) {
  if (!loginId) return null;
  const needle = loginId.trim().toLowerCase();
  return (
    getAllStaff().find(
      (s) =>
        (s.loginId && s.loginId.toLowerCase() === needle) ||
        (s.email && s.email.toLowerCase() === needle)
    ) || null
  );
}

export async function saveAllStaff(list) {
  return persistCollection(STORAGE_KEYS.STAFF, list);
}

// Suggests the next sequential Staff ID (e.g. STF005). Admin can still
// override it in the form — this just saves them from inventing one.
export function suggestLoginId() {
  const list = getAllStaff();
  let n = list.length + 1;
  const taken = new Set(list.map((s) => (s.loginId || "").toUpperCase()));
  let candidate = `STF${String(n).padStart(3, "0")}`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `STF${String(n).padStart(3, "0")}`;
  }
  return candidate;
}

export async function addStaff(data) {
  const list = getAllStaff();
  const record = {
    id: generateId("stf"),
    status: "active",
    joinDate: data.joinDate || new Date().toISOString().slice(0, 10),
    avatarColor: pickColor(list.length),
    ...data,
  };
  const updated = [...list, record];
  await saveAllStaff(updated);
  return record;
}

export async function updateStaff(id, updates) {
  const list = getAllStaff();
  const updated = list.map((s) => (s.id === id ? { ...s, ...updates } : s));
  await saveAllStaff(updated);
  return updated.find((s) => s.id === id);
}

export async function deleteStaff(id) {
  const list = getAllStaff();
  await saveAllStaff(list.filter((s) => s.id !== id));
}

export async function setStaffStatus(id, status) {
  return updateStaff(id, { status });
}

// Fields a Staff member is allowed to change about themselves from
// /staff/profile. Everything else (role, department, status, login id,
// assignments) stays admin-controlled.
const SELF_EDITABLE_FIELDS = ["email", "phone"];

export async function updateStaffSelf(id, updates) {
  const safeUpdates = {};
  for (const field of SELF_EDITABLE_FIELDS) {
    if (field in updates) safeUpdates[field] = updates[field];
  }
  return updateStaff(id, safeUpdates);
}

export async function changeStaffPassword(id, currentPassword, newPassword) {
  const staff = getStaffById(id);
  if (!staff) return { success: false, error: "Staff account not found." };
  if (staff.password !== currentPassword) {
    return { success: false, error: "Current password is incorrect." };
  }
  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: "New password must be at least 4 characters." };
  }
  await updateStaff(id, { password: newPassword });
  return { success: true };
}

function pickColor(index) {
  const palette = ["#120D9E", "#13A870", "#E14868", "#2E90E2", "#E29A2E", "#5451B9"];
  return palette[index % palette.length];
}
