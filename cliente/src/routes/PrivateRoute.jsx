// src/routes/PrivateRoute.jsx
import { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function PrivateRoute() {
  const { user, token } = useContext(AuthContext);

  // Si no hay token => no está logueado
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Si quieres validar algo más (ej: usuario bloqueado), lo haces aquí
  // if (!user?.activo) return <Navigate to="/login" replace />;

  // Si pasa, deja entrar a las rutas hijas
  return <Outlet />;
}
