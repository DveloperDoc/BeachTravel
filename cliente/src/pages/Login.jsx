import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Container, Card, Form, Button, Alert, Spinner } from "react-bootstrap";

export default function Login() {
  const { login, loading, isAuthenticated, user } = useContext(AuthContext);
  const [email, setEmail] = useState("correo@correo.cl"); // puedes dejar vacío
  const [password, setPassword] = useState("54321");        // para pruebas
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const result = await login(email, password);

    if (!result.ok) {
      setError(result.message || "Credenciales inválidas");
      return;
    }

    // Redirigir según rol
    const rol = result.user.rol;
    if (rol === "ADMIN") {
      navigate("/admin");
    } else {
      navigate("/personas");
    }
  };

  // Si ya está autenticado y recarga /login, lo redirigimos
  if (isAuthenticated && user) {
    if (user.rol === "ADMIN") {
      navigate("/admin");
    } else {
      navigate("/personas");
    }
  }

  return (
    <Container className="d-flex justify-content-center align-items-center vh-100">
      <Card style={{ width: "28rem" }} className="shadow">
        <Card.Body>
          <Card.Title className="text-center mb-4">
            Iniciar sesión
          </Card.Title>

          {error && (
            <Alert variant="danger">
              {error}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="usuario@correo.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Contraseña</Form.Label>
              <Form.Control
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </Form.Group>

            <Button
              className="w-100"
              variant="primary"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    className="me-2"
                  />
                  Iniciando sesión...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}