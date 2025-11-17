// src/pages/NoAutorizado.jsx
import NavbarUser from "../components/NavbarUser";
import { Container, Alert } from "react-bootstrap";

export default function NoAutorizado() {
  return (
    <>
      <NavbarUser />
      <Container className="mt-4">
        <Alert variant="danger">
          No tienes permisos para acceder a esta sección.
        </Alert>
      </Container>
    </>
  );
}
