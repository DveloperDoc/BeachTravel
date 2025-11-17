// client/src/components/NavbarUser.jsx
import { useContext } from "react";
import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function NavbarUser() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const homePath = user?.rol === "ADMIN" ? "/admin" : "/personas";

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        {/* IMPORTANTE: navegación interna con Link */}
        <Navbar.Brand as={Link} to={homePath}>
          Registro de Dirigentes
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-navbar" />
        <Navbar.Collapse id="main-navbar">
          <Nav className="me-auto">
            {user?.rol === "DIRIGENTE" && (
              <Nav.Link as={Link} to="/personas">
                Personas
              </Nav.Link>
            )}

            {user?.rol === "ADMIN" && (
            <>
                <Nav.Link as={Link} to="/admin">
                Usuarios
                </Nav.Link>
                <Nav.Link as={Link} to="/personas">
                Personas
                </Nav.Link>
                <Nav.Link as={Link} to="/admin/villas">
                Villas
                </Nav.Link>
                <Nav.Link as={Link} to="/admin/logs">
                Logs
                </Nav.Link>
            </>
            )}
          </Nav>

          <Nav>
            <Navbar.Text className="me-3">
              {user?.nombre} — {user?.rol}
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