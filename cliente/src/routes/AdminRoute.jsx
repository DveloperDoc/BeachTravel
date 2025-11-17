// src/routes/AdminRoute.jsx
import { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function AdminRoute() {
  const { user, token } = useContext(AuthContext);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Detectar rol 
  const role = user?.rol || user?.role || user?.tipo;

  const isAdmin =
    role === "admin" ||
    role === "ADMIN" ||
    role === "Administrador" ||
    user?.is_admin === 1 ||
    user?.is_admin === true;

  if (!isAdmin) {
    // Si no es admin, lo mandamos a una página de "No autorizado" o al inicio
    return <Navigate to="/no-autorizado" replace />;
  }

  return <Outlet />;
}
