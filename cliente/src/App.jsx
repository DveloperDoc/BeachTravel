  import { Routes, Route, Navigate } from "react-router-dom";
  import { useContext } from "react";
  import { AuthContext } from "./context/AuthContext";

  import Login from "./pages/Login";
  import Personas from "./pages/Personas";
  import AdminUsuarios from "./pages/AdminUsuarios";
  import AdminLogs from "./pages/AdminLogs";
  import AdminVillas from "./pages/AdminVillas";

  // Ruta protegida genérica (requiere estar autenticado)
  function PrivateRoute({ children }) {
    const { isAuthenticated, user } = useContext(AuthContext);

    if (!isAuthenticated || !user) {
      return <Navigate to="/login" replace />;
    }

    return children;
  }

  // Ruta solo para ADMIN
  function AdminRoute({ children }) {
    const { isAuthenticated, user } = useContext(AuthContext);

    if (!isAuthenticated || !user) {
      return <Navigate to="/login" replace />;
    }

    // Ajusta según cómo guardes el rol en el usuario
    const rol = user.rol;

    if (rol !== "ADMIN") {
      // Si no es admin, lo redirigimos a personas (o donde quieras)
      return <Navigate to="/personas" replace />;
    }

    return children;
  }

  export default function App() {
    return (
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<Login />} />

        {/* Usuario logueado (DIRIGENTE o ADMIN) */}
        <Route
          path="/personas"
          element={
            <PrivateRoute>
              <Personas />
            </PrivateRoute>
          }
        />

        {/* Solo ADMIN */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminUsuarios />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/logs"
          element={
            <AdminRoute>
              <AdminLogs />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/villas"
          element={
            <AdminRoute>
              <AdminVillas />
            </AdminRoute>
          }
        />

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
