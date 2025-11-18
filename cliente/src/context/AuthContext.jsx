// client/src/context/AuthContext.jsx
import { createContext, useState } from "react";
import { apiFetch } from "../api";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("token") || null;
  });

  const [loading, setLoading] = useState(false);

  const role = user?.rol || user?.role || null;
  const isAdmin =
    role === "ADMIN" ||
    role === "admin" ||
    role === "Administrador";

  const isAuthenticated = !!user && !!token;

  // ==============================
  // Login (email + password)
  // ==============================
  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }), // backend espera { email, password }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al iniciar sesión");
      }

      const data = await res.json();
      // Esperado: { token, user: { id, email, nombre, rol, ... } }

      setUser(data.user);
      setToken(data.token);

      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("token", data.token);

      return { ok: true, user: data.user };
    } catch (err) {
      console.error("Error en login:", err.message);
      return { ok: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  // ==============================
  // Helper seguro: authFetch
  // ==============================
  const authFetch = async (endpoint, options = {}) => {
    if (!token) {
      throw new Error("No autenticado. Inicie sesión nuevamente.");
    }

    try {
      const res = await apiFetch(endpoint, {
        ...options,
        headers: {
          "Content-Type": "application/json",   // aseguramos JSON
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });

      if (res.status === 401 || res.status === 403) {
        // token inválido o permisos insuficientes
        logout();
        throw new Error(
          "Sesión expirada o sin permisos. Inicie sesión nuevamente."
        );
      }

      return res;
    } catch (err) {
      console.error("Error en authFetch:", err);
      throw err;
    }
  };

  const value = {
    user,
    token,
    role,
    isAdmin,
    loading,
    login,
    logout,
    authFetch,
    isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
