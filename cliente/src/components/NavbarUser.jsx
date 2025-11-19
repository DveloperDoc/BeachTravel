// client/src/components/NavbarUser.jsx
import { useContext } from "react";
import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function NavbarUser() {
  const { user, logout, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Evitar errores si user aún no está listo
  if (!isAuthenticated || !user) return null;

  const isAdmin = user.rol === "ADMIN";
  const homePath = isAdmin ? "/admin" : "/personas";

  return (
    <Navbar
      bg="light"
      variant="light"
      expand="md"
      collapseOnSelect
      className="shadow-sm mb-3"
    >
      <Container fluid className="px-3 px-md-4">
        <Navbar.Brand as={Link} to={homePath} className="fw-semibold">
          Registro JJVV
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-navbar" />

        <Navbar.Collapse id="main-navbar">
          {/* Menú principal */}
          <Nav className="me-auto">
            {/* DIRIGENTE */}
            {user.rol === "DIRIGENTE" && (
              <Nav.Link as={Link} to="/personas">
                Personas
              </Nav.Link>
            )}

            {/* ADMIN */}
            {isAdmin && (
              <>
                <Nav.Link as={Link} to="/admin">
                  Usuarios
                </Nav.Link>

                <Nav.Link as={Link} to="/personas">
                  Personas
                </Nav.Link>

                <Nav.Link as={Link} to="/admin/villas">
                  JJVV
                </Nav.Link>

                <Nav.Link as={Link} to="/admin/logs">
                  Actividad
                </Nav.Link>
              </>
            )}
          </Nav>

          {/* Info usuario + logout */}
          <Nav className="ms-auto mt-2 mt-md-0 align-items-center gap-2 flex-wrap">
            <Navbar.Text className="small text-muted text-truncate">
              {user.nombre || user.email}{" "}
              {user.rol && <strong>({user.rol})</strong>}
            </Navbar.Text>

            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleLogout}
            >
              Cerrar sesión
            </Button>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
