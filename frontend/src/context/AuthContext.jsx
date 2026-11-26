import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi, clearAuth, errorMessage, getStoredUser, getToken, saveAuth, userApi } from "../api/api.js";
import { disconnectSocket } from "../api/socket.js";
import { AuthContext } from "./auth-context.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getToken());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Validate stored token on first load so stale sessions don't look logged-in.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    userApi
      .getProfile()
      .then((res) => {
        if (cancelled) return;
        const fetched = res.data?.user;
        if (fetched) {
          setUser({ id: fetched._id || fetched.id, name: fetched.name, email: fetched.email, phone: fetched.phone || "", role: fetched.role });
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearAuth();
        setUser(null);
        setToken(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySession = useCallback((data) => {
    const nextUser = data?.user || null;
    const nextToken = data?.token || null;
    saveAuth({ token: nextToken, user: nextUser ? { id: nextUser.id || nextUser._id, name: nextUser.name, email: nextUser.email, phone: nextUser.phone || "", role: nextUser.role } : null });
    setToken(nextToken);
    setUser(nextUser);
    setAuthError("");
    return data;
  }, []);

  const login = useCallback(
    async (email, password) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        const res = await authApi.login({ email, password });
        return applySession(res.data);
      } catch (err) {
        const message = errorMessage(err, "Invalid email or password.");
        setAuthError(message);
        throw new Error(message, { cause: err });
      } finally {
        setAuthLoading(false);
      }
    },
    [applySession]
  );

  const register = useCallback(
    async ({ name, email, password, role, phone }) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        const res = await authApi.register({ name, email, password, role, phone });
        return applySession(res.data);
      } catch (err) {
        const message = errorMessage(err, "Registration failed. Please try again.");
        setAuthError(message);
        throw new Error(message, { cause: err });
      } finally {
        setAuthLoading(false);
      }
    },
    [applySession]
  );

  const logout = useCallback(() => {
    disconnectSocket();
    clearAuth();
    setUser(null);
    setToken(null);
    setAuthError("");
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...patch };
      saveAuth({ token: getToken(), user: next });
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      userRole: user?.role || null,
      authLoading,
      authError,
      login,
      register,
      logout,
      updateUser,
    }),
    [user, token, authLoading, authError, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
