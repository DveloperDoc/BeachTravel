import { useContext, useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Table,
  Button,
  Modal,
  Form,
  Alert,
  Spinner,
} from "react-bootstrap";
import NavbarUser from "../components/NavbarUser";
import { AuthContext } from "../context/AuthContext";

export default function AdminVillas() {
  const { token, authFetch } = useContext(AuthContext);

  const [villas, setVillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  
  const [editingVilla, setEditingVilla] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    cupo_maximo: 0,
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Estados para eliminación
  const [showConfirmVilla, setShowConfirmVilla] = useState(false);
  const [villaToDelete, setVillaToDelete] = useState(null);
  const [deletingVilla, setDeletingVilla] = useState(false);

  // ==========================
  // Carga inicial de villas
  // ==========================
  const fetchVillas = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await authFetch("/api/villas");

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al obtener villas");
      }

      const data = await res.json();
      setVillas(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al cargar villas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchVillas();
  }, [token, authFetch]);

  // ==========================
  // Validación frontend
  // ==========================
  const validateForm = (data) => {
    const errors = {};

    if (!data.nombre.trim()) {
      errors.nombre = "El nombre de la villa es obligatorio";
    } else if (data.nombre.trim().length < 3) {
      errors.nombre = "El nombre debe tener al menos 3 caracteres";
    }

    const cupoNum = Number(data.cupo_maximo);
    if (Number.isNaN(cupoNum) || cupoNum < 0) {
      errors.cupo_maximo =
        "El cupo máximo debe ser un número mayor o igual a 0";
    }

    return errors;
  };

  // ==========================
  // Manejo de formularios / modales
  // ==========================
  const openNewModal = () => {
    setEditingVilla(null);
    setForm({ nombre: "", cupo_maximo: 0 });
    setFormErrors({});
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openEditModal = (villa) => {
    setEditingVilla(villa);
    setForm({
      nombre: villa.nombre,
      cupo_maximo: villa.cupo_maximo ?? 0,
    });
    setFormErrors({});
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingVilla(null);
    setForm({ nombre: "", cupo_maximo: 0 });
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
    setError("");
  };

  const handleSaveVilla = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    setFormErrors({});

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSaving(false);
      return;
    }

    try {
      const payload = {
        nombre: form.nombre.trim(),
        cupo_maximo: Number(form.cupo_maximo) || 0,
      };

      const url = editingVilla
        ? `/api/villas/${editingVilla.id}`
        : "/api/villas";
      const method = editingVilla ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 400 && data?.errors) {
          const backendErrors = {};
          for (const err of data.errors) {
            if (err.path) {
              backendErrors[err.path] = err.msg || "Valor inválido";
            }
          }
          setFormErrors(backendErrors);
          setError(data?.message || "Datos inválidos");
        } else if (res.status === 409) {
          setError(data?.message || "Error de conflicto al guardar la villa");
        } else {
          setError(data?.message || "Error al guardar villa");
        }
        setSaving(false);
        return;
      }

      const saved = data;

      if (editingVilla) {
        setVillas((prev) =>
          prev.map((v) => (v.id === saved.id ? { ...v, ...saved } : v))
        );
        setSuccess("Villa actualizada correctamente");
      } else {
        setVillas((prev) => [...prev, saved]);
        setSuccess("Villa creada correctamente");
      }

      closeModal();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al guardar villa");
    } finally {
      setSaving(false);
    }
  };

  // ==========================
  // Eliminar villa (con modal)
  // ==========================
  const handleAskDeleteVilla = (villa) => {
    setVillaToDelete(villa);
    setShowConfirmVilla(true);
    setError("");
    setSuccess("");
  };

  const handleCloseConfirmVilla = () => {
    if (deletingVilla) return;
    setShowConfirmVilla(false);
    setVillaToDelete(null);
  };

  const handleConfirmDeleteVilla = async () => {
    if (!villaToDelete) return;

    setDeletingVilla(true);
    setError("");
    setSuccess("");

    try {
      const res = await authFetch(`/api/villas/${villaToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message || "Error al eliminar villa");
        setDeletingVilla(false);
        return;
      }

      setVillas((prev) => prev.filter((v) => v.id !== villaToDelete.id));
      setSuccess("Villa eliminada correctamente");
      handleCloseConfirmVilla();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al eliminar villa");
    } finally {
      setDeletingVilla(false);
    }
  };

  return (
    <>
      <NavbarUser />
      <Container className="mt-4">
        <Row className="mb-3">
          <Col>
            <h2>Administración de JJVV</h2>
            <p>
              Aquí puedes crear o editar juntas de vecino y definir el cupo máximo de
              personas que pueden inscribirse en cada una.
            </p>
          </Col>
        </Row>

        {(error || success) && (
          <Row className="mb-3">
            <Col>
              {error && (
                <Alert
                  variant="danger"
                  onClose={() => setError("")}
                  dismissible
                >
                  {error}
                </Alert>
              )}
              {success && (
                <Alert
                  variant="success"
                  onClose={() => setSuccess("")}
                  dismissible
                >
                  {success}
                </Alert>
              )}
            </Col>
          </Row>
        )}

        <Row className="mb-3">
          <Col>
            <Button variant="primary" onClick={openNewModal}>
              + Nueva junta de vecinos
            </Button>
          </Col>
        </Row>

        {loading ? (
          <div className="d-flex align-items-center">
            <Spinner animation="border" size="sm" className="me-2" />
            <span>Cargando jjvv...</span>
          </div>
        ) : (
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Cupo máximo</th>
                <th style={{ width: "180px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {villas.map((v, idx) => (
                <tr key={v.id}>
                  <td>{idx + 1}</td>
                  <td>{v.nombre}</td>
                  <td>
                    {v.cupo_maximo && v.cupo_maximo > 0
                      ? v.cupo_maximo
                      : "Sin límite"}
                  </td>
                  <td>
                    <Button
                      variant="warning"
                      size="sm"
                      className="me-2"
                      onClick={() => openEditModal(v)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleAskDeleteVilla(v)}
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
              {!villas.length && (
                <tr>
                  <td colSpan={4} className="text-center">
                    No hay jjvv registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Container>

      {/* Modal crear / editar */}
      <Modal show={showModal} onHide={closeModal}>
        <Form onSubmit={handleSaveVilla}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title>
              {editingVilla ? "Editar villa" : "Nueva villa"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nombre de la junta de vecinos</Form.Label>
              <Form.Control
                name="nombre"
                value={form.nombre}
                onChange={handleFormChange}
                isInvalid={!!formErrors.nombre}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.nombre}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Cupo máximo de personas</Form.Label>
              <Form.Control
                type="number"
                name="cupo_maximo"
                min="0"
                value={form.cupo_maximo}
                onChange={handleFormChange}
                isInvalid={!!formErrors.cupo_maximo}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.cupo_maximo}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                0 significa sin límite.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal
        show={showConfirmVilla}
        onHide={handleCloseConfirmVilla}
        centered
      >
        <Modal.Header closeButton={!deletingVilla}>
          <Modal.Title>Confirmar eliminación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {villaToDelete ? (
            <>
              <p>¿Seguro que deseas eliminar la siguiente jjvv?</p>
              <p>
                <strong>{villaToDelete.nombre}</strong>
                <br />
                <small>
                  Cupo máximo:{" "}
                  {villaToDelete.cupo_maximo &&
                  villaToDelete.cupo_maximo > 0
                    ? villaToDelete.cupo_maximo
                    : "Sin límite"}
                </small>
              </p>
              <p className="text-danger mb-0">
                Esta acción no se puede deshacer.
              </p>
            </>
          ) : (
            <p>Procesando…</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={handleCloseConfirmVilla}
            disabled={deletingVilla}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmDeleteVilla}
            disabled={deletingVilla}
          >
            {deletingVilla ? "Eliminando..." : "Eliminar villa"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
