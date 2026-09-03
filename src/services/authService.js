// Authentication against the Cloud backend (real email + password accounts).
//
// The session object this module produces is the same shape the whole app
// already consumes ({ id, name, role, department, staffId, ... }) and is
// mirrored into STORAGE_KEYS.CURRENT_USER so synchronous readers such as
// attendanceService.actorStamp() keep working unchanged. The authoritative
// session, however, always lives in the Cloud auth client — restoreSession()
// re-derives the app session from it on every page load.
import { getData, setData, removeData } from "./storageService";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { supabase } from "@/integrations/supabase/client";
import * as sessionService from "./sessionService";

function friendlyAuthError(message) {
  if (!message) return "Unable to sign in. Please try again.";
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) {
    return "This account still needs to confirm its email address.";
  }
  return message;
}

// Builds the app-level session from the authenticated user: the role comes
// from the user_roles table (never from anything the client can set), and a
// staff member's own directory record supplies their name/department/Staff ID.
async function buildSession(authUser) {
  const [{ data: roles }, { data: staffRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", authUser.id),
    supabase.from("staff").select("*").eq("auth_user_id", authUser.id).limit(1),
    supabase.from("profiles").select("name, email").eq("id", authUser.id).maybeSingle(),
  ]);

  const isAdmin = (roles || []).some((r) => r.role === "admin");
  const staff = (staffRows || [])[0] || null;

  return {
    id: isAdmin ? authUser.id : staff?.id || authUser.id,
    authUserId: authUser.id,
    username: authUser.email,
    email: authUser.email,
    staffId: staff?.login_id || null,
    name: staff?.name || profile?.name || authUser.email,
    role: isAdmin ? "admin" : "staff",
    department: staff?.department || null,
    loggedInAt: new Date().toISOString(),
  };
}

async function signIn(email, password, location, { requireRole } = {}) {
  const trimmed = (email || "").trim();
  if (!trimmed) return { success: false, error: "Enter your email address." };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  });
  if (error || !data?.user) {
    await sessionService.recordFailedLogin(trimmed, error?.message || "Invalid credentials");
    return { success: false, error: friendlyAuthError(error?.message) };
  }

  const session = await buildSession(data.user);

  if (requireRole && session.role !== requireRole) {
    await supabase.auth.signOut();
    removeData(STORAGE_KEYS.CURRENT_USER);
    await sessionService.recordFailedLogin(trimmed, `Not a ${requireRole} account`);
    return {
      success: false,
      error:
        requireRole === "admin"
          ? "This account isn't an administrator. Use the Staff Portal sign-in."
          : "This is an administrator account. Use the Admin Portal sign-in.",
    };
  }

  if (session.role === "staff") {
    const { data: staffRows } = await supabase
      .from("staff")
      .select("status")
      .eq("auth_user_id", data.user.id)
      .limit(1);
    if (staffRows?.[0]?.status && staffRows[0].status !== "active") {
      await supabase.auth.signOut();
      removeData(STORAGE_KEYS.CURRENT_USER);
      await sessionService.recordFailedLogin(trimmed, "Account deactivated");
      return {
        success: false,
        error: "Your account has been deactivated. Please contact the administrator.",
      };
    }
  }

  setData(STORAGE_KEYS.CURRENT_USER, session);
  await sessionService.recordLogin(session, location);
  return { success: true, user: session };
}

// Admin login — only accounts holding the admin role can complete it.
export async function login(email, password, location = null) {
  return signIn(email, password, location, { requireRole: "admin" });
}

// Staff portal login — admin accounts are bounced to the admin sign-in.
export async function staffLogin(email, password, location = null) {
  return signIn(email, password, location, { requireRole: "staff" });
}

// Re-derives the app session from the Cloud auth session. Called on every
// app boot and whenever the auth state changes.
export async function restoreSession() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    removeData(STORAGE_KEYS.CURRENT_USER);
    return null;
  }
  const session = await buildSession(data.user);
  setData(STORAGE_KEYS.CURRENT_USER, session);
  return session;
}

// `location` here is the *logout* location snapshot (optional, best-effort).
export async function logout(location = null) {
  const user = getCurrentUser();
  if (user) {
    try {
      await sessionService.recordLogout(user, location);
    } catch {
      // never block sign-out on the audit write
    }
  }
  removeData(STORAGE_KEYS.CURRENT_USER);
  await supabase.auth.signOut();
}

export async function changeOwnPassword(currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: "New password must be at least 6 characters." };
  }
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Synchronous mirror of the current session, for the many call sites that
// stamp records with "who did this" while already inside a signed-in screen.
export function getCurrentUser() {
  return getData(STORAGE_KEYS.CURRENT_USER, null);
}
