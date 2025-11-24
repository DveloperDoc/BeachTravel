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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

  const validate = () => {
    const errors = {};

    if (!email.trim()) {
      errors.email = "El correo es obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Formato de correo inválido";
    }

    if (!password.trim()) {
      errors.password = "La contraseña es obligatoria";
    } else if (password.length < 4) {
      errors.password = "La contraseña debe tener al menos 4 caracteres";
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const result = await login(email.trim(), password);

    if (!result.ok) {
      setError(result.message || "Credenciales inválidas");
      return;
    }

    const rol = result.user.rol;
    navigate(rol === "ADMIN" ? "/admin" : "/personas");
  };

  // Si ya está autenticado, redirige directo
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
        <Card className="shadow-sm border-0">
          <Card.Body className="p-4">
            {/* Encabezado */}
            <div className="text-center mb-3">
              <h5 className="mb-1">Registro de Juntas de Vecinos</h5>
              <p className="text-muted mb-0 small">
                Inicia sesión con las credenciales entregadas por la
                Municipalidad.
              </p>
            </div>

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
                <Form.Label>Correo electrónico</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="usuario@correo.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                  isInvalid={!!fieldErrors.email}
                />
                <Form.Control.Feedback type="invalid">
                  {fieldErrors.email}
                </Form.Control.Feedback>
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
                  isInvalid={!!fieldErrors.password}
                />
                <Form.Control.Feedback type="invalid">
                  {fieldErrors.password}
                </Form.Control.Feedback>
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

              <p className="text-center text-muted mt-3 mb-0 small">
                Si no tienes usuario o tienes problemas para ingresar,
                comunícate con la Unidad de Informática Municipal.
              </p>
            </Form>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
}
