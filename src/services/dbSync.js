// Cloud-backed replacement for the old Google Sheets sync layer.
//
// Every collection service in this app (staff, departments, holidays, leave
// types/reasons, leaves, login activity, attendance) keeps a synchronous
// LocalStorage cache for reads and calls syncCollection()/persistCollection()
// to talk to the shared backend. This module implements those two operations
// against the Cloud database (Postgres) instead of a spreadsheet, mapping the
// app's camelCase record shapes to the tables' snake_case columns.
//
// Writes use "replace the whole collection" semantics — the same contract the
// services already assume — implemented as an upsert of every row plus a
// delete of the rows that disappeared. Row-level security in the database is
// what actually decides whether a given write is allowed, so a Staff session
// can never modify another member's data even though it calls the same code.
import { supabase } from "@/integrations/supabase/client";
import { STORAGE_KEYS } from "../constants/storageKeys";

const camelToSnake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const snakeToCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Columns each collection is allowed to send. Anything else on the record
// (e.g. a legacy `password` field) is dropped rather than causing the write
// to fail against the real schema.
const COLLECTIONS = {
  [STORAGE_KEYS.STAFF]: {
    table: "staff",
    columns: [
      "id",
      "name",
      "role",
      "department",
      "email",
      "phone",
      "joinDate",
      "status",
      "avatarColor",
      "loginId",
    ],
    order: { column: "created_at", ascending: true },
  },
  [STORAGE_KEYS.DEPARTMENTS]: {
    table: "departments",
    columns: ["id", "name"],
    order: { column: "name", ascending: true },
  },
  [STORAGE_KEYS.HOLIDAYS]: {
    table: "holidays",
    columns: ["id", "name", "description", "type", "date", "recurring"],
    order: { column: "date", ascending: true },
  },
  [STORAGE_KEYS.LEAVE_TYPES]: {
    table: "leave_types",
    columns: ["id", "name", "color", "paid"],
    order: { column: "created_at", ascending: true },
  },
  [STORAGE_KEYS.LEAVE_REASONS]: {
    table: "leave_reasons",
    columns: ["id", "name"],
    order: { column: "created_at", ascending: true },
  },
  [STORAGE_KEYS.LEAVES]: {
    table: "leaves",
    columns: [
      "id",
      "staffId",
      "fromDate",
      "toDate",
      "days",
      "reason",
      "type",
      "status",
      "requestedAt",
      "requestedBy",
      "decidedAt",
      "decidedBy",
      "adminNote",
    ],
    order: { column: "from_date", ascending: false },
  },
  [STORAGE_KEYS.SESSIONS]: {
    table: "login_events",
    columns: [
      "id",
      "type",
      "userId",
      "userName",
      "userLoginId",
      "role",
      "department",
      "at",
      "location",
      "device",
      "reason",
      "closedAt",
      "logoutEventId",
      "durationMinutes",
    ],
    order: { column: "at", ascending: false },
    // Login activity is an append-only audit trail — never delete rows that
    // a client's local cache happens not to know about.
    appendOnly: true,
  },
  [STORAGE_KEYS.ATTENDANCE]: {
    table: "attendance",
    columns: [
      "id",
      "staffId",
      "date",
      "clockIn",
      "clockOut",
      "status",
      "loginStatus",
      "lateMinutes",
      "logoutStatus",
      "earlyMinutes",
      "requiredMinutes",
      "workedMinutes",
      "workingHoursDiff",
      "note",
      "markedBy",
      "correctedBy",
      "correctedAt",
      "clockInLocation",
      "clockOutLocation",
    ],
    order: { column: "date", ascending: false },
  },
};

// Columns the database manages itself; never echoed back on a write, but
// stripped from reads too so they don't pollute the app's record shapes.
const MANAGED = new Set(["created_at", "updated_at", "auth_user_id"]);

function rowToRecord(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (MANAGED.has(key)) continue;
    out[snakeToCamel(key)] = value;
  }
  return out;
}

function recordToRow(record, columns) {
  const row = {};
  for (const key of columns) {
    if (key in record && record[key] !== undefined) row[camelToSnake(key)] = record[key];
  }
  return row;
}

export function isCloudCollection(key) {
  return key in COLLECTIONS;
}

// Reads the whole collection from the database. Rows the signed-in user
// isn't allowed to see are simply absent (row-level security), which is
// exactly what each screen should render.
export async function fetchCollection(key) {
  const config = COLLECTIONS[key];
  if (!config) throw new Error(`dbSync: unknown collection "${key}"`);
  const query = supabase.from(config.table).select("*");
  if (config.order) query.order(config.order.column, { ascending: config.order.ascending });
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(rowToRecord);
}

// Writes the whole collection: upserts every record and removes rows that
// are no longer present (except for append-only audit collections).
export async function saveCollection(key, list) {
  const config = COLLECTIONS[key];
  if (!config) throw new Error(`dbSync: unknown collection "${key}"`);
  const records = Array.isArray(list) ? list : [];
  const rows = records.map((r) => recordToRow(r, config.columns)).filter((r) => r.id);

  if (rows.length) {
    const { error } = await supabase.from(config.table).upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  if (!config.appendOnly) {
    const keepIds = rows.map((r) => r.id);
    let del = supabase.from(config.table).delete();
    if (keepIds.length) del = del.not("id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);
    const { error } = await del;
    // A Staff session isn't allowed to delete other people's rows; row-level
    // security silently filters those out, so only real errors surface here.
    if (error) throw error;
  }

  return records;
}

// ---- Settings (single key/value row) ----

const SETTINGS_KEY = "app";

export async function fetchSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  if (error) throw error;
  return data?.value || {};
}

export async function saveSettingsToCloud(value) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: SETTINGS_KEY, value }, { onConflict: "key" });
  if (error) throw error;
  return value;
}
