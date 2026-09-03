import { createContext, useContext, useState, useCallback, useEffect } from "react";
import * as authService from "../services/authService";
import * as sessionService from "../services/sessionService";
import { supabase } from "@/integrations/supabase/client";
import { captureLocation } from "../utils/geo";
import { hasPermission as checkPermission } from "../constants/permissions";

const AuthContext = createContext(null);

// Fire-and-forget: never let a location permission prompt/delay block the
// login itself. If the user grants permission, the login event this
// session already recorded gets its location filled in a moment later.
function captureLoginLocationInBackground(userId) {
  captureLocation()
    .then((location) => sessionService.attachLocationToLastLogin(userId, location))
    .catch(() => {
      /* denied or unavailable — the event just keeps location: null */
    });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `ready` stays false until the stored Cloud session has been validated, so
  // route guards don't bounce a signed-in user to the login screen on reload.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    authService
      .restoreSession()
      .then((session) => {
        if (!cancelled) setUser(session);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    // Keeps the app in step when the session is refreshed or cleared
    // elsewhere (another tab, an expired token).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
      } else if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        authService.restoreSession().then((session) => {
          if (!cancelled) setUser(session);
        });
      }
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await authService.login(email, password);
    if (result.success) {
      setUser(result.user);
      captureLoginLocationInBackground(result.user.id);
    }
    return result;
  }, []);

  const loginStaff = useCallback(async (email, password) => {
    const result = await authService.staffLogin(email, password);
    if (result.success) {
      setUser(result.user);
      captureLoginLocationInBackground(result.user.id);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const session = await authService.restoreSession();
    setUser(session);
    return session;
  }, []);

  const hasPermission = useCallback((permission) => checkPermission(user, permission), [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
        isStaff: user?.role === "staff",
        login,
        loginStaff,
        logout,
        refreshUser,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
