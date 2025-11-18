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
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand as={Link} to={homePath}>
          Registro JJVV
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-navbar" />
        <Navbar.Collapse id="main-navbar">
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
                  Logs
                </Nav.Link>
              </>
            )}
          </Nav>

          <Nav>
            <Navbar.Text className="me-3">
              {user.nombre} — {user.rol}
            </Navbar.Text>

            <Button
              variant="outline-light"
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
