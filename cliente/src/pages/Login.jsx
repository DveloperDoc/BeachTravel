import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import {
  Container,
  Card,
  Form,
  Button,
  Alert,
  Spinner,
} from "react-bootstrap";

export default function Login() {
  const { login, loading, isAuthenticated, user } = useContext(AuthContext);
  const [email, setEmail] = useState("correo@correo.cl");
  const [password, setPassword] = useState("54321");
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

    const rol = result.user.rol;
    navigate(rol === "ADMIN" ? "/admin" : "/personas");
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      const rol = user.rol;
      navigate(rol === "ADMIN" ? "/admin" : "/personas");
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <Container
      fluid
      className="min-vh-100 d-flex justify-content-center align-items-center bg-light py-4"
    >
      {/* Wrapper para controlar ancho y márgenes en móvil */}
      <div className="w-100 px-3" style={{ maxWidth: "420px" }}>
        <Card className="shadow-sm">
          <Card.Body className="p-4">
            <Card.Title className="text-center mb-2">
              Iniciar sesión
            </Card.Title>
            <p className="text-center text-muted mb-4 small">
              Accede al registro de juntas de vecinos con tu cuenta asignada.
            </p>

            {error && (
              <Alert
                variant="danger"
                onClose={() => setError("")}
                dismissible
              >
                {error}
              </Alert>
            )}

            <Form onSubmit={handleSubmit} noValidate>
              <Form.Group className="mb-3" controlId="loginEmail">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="usuario@correo.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="loginPassword">
                <Form.Label>Contraseña</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
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
      </div>
    </Container>
  );
}
