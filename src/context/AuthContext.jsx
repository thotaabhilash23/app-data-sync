import { createContext, useContext, useState, useCallback } from "react";
import * as authService from "../services/authService";
import * as sessionService from "../services/sessionService";
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
  const [user, setUser] = useState(() => authService.getCurrentUser());

  const login = useCallback(async (username, password) => {
    const result = await authService.login(username, password);
    if (result.success) {
      setUser(result.user);
      captureLoginLocationInBackground(result.user.id);
    }
    return result;
  }, []);

  const loginStaff = useCallback(async (loginId, password) => {
    const result = await authService.staffLogin(loginId, password);
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

  const refreshUser = useCallback(() => setUser(authService.getCurrentUser()), []);

  const hasPermission = useCallback((permission) => checkPermission(user, permission), [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
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
