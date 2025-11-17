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
  const { token } = useContext(AuthContext);

  const [villas, setVillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingVilla, setEditingVilla] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    cupo_maximo: 0,
  });
  const [saving, setSaving] = useState(false);

  // NUEVO: estados para eliminación
  const [showConfirmVilla, setShowConfirmVilla] = useState(false);
  const [villaToDelete, setVillaToDelete] = useState(null);
  const [deletingVilla, setDeletingVilla] = useState(false);

  const fetchVillas = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/villas", {
        headers: { Authorization: `Bearer ${token}` },
      });

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
  }, [token]);

  const openNewModal = () => {
    setEditingVilla(null);
    setForm({ nombre: "", cupo_maximo: 0 });
    setShowModal(true);
  };

  const openEditModal = (villa) => {
    setEditingVilla(villa);
    setForm({
      nombre: villa.nombre,
      cupo_maximo: villa.cupo_maximo ?? 0,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVilla(null);
    setForm({ nombre: "", cupo_maximo: 0 });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveVilla = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        nombre: form.nombre,
        cupo_maximo: Number(form.cupo_maximo) || 0,
      };

      const url = editingVilla
        ? `/api/villas/${editingVilla.id}`
        : "/api/villas";
      const method = editingVilla ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al guardar villa");
      }

      const saved = await res.json();

      if (editingVilla) {
        setVillas((prev) =>
          prev.map((v) => (v.id === saved.id ? saved : v))
        );
      } else {
        setVillas((prev) => [...prev, saved]);
      }

      closeModal();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al guardar villa");
    } finally {
      setSaving(false);
    }
  };

  // ============================
  // Eliminar villa (con modal)
  // ============================
  const handleAskDeleteVilla = (villa) => {
    setVillaToDelete(villa);
    setShowConfirmVilla(true);
  };

  const handleCloseConfirmVilla = () => {
    setShowConfirmVilla(false);
    setVillaToDelete(null);
  };

  const handleConfirmDeleteVilla = async () => {
    if (!villaToDelete) return;

    setDeletingVilla(true);
    setError("");

    try {
      const res = await fetch(`/api/villas/${villaToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al eliminar villa");
      }

      setVillas((prev) => prev.filter((v) => v.id !== villaToDelete.id));
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
            <h2>Administración de villas</h2>
            <p>
              Aquí puedes crear o editar villas y definir el cupo máximo de personas
              que pueden inscribirse en cada una.
            </p>
          </Col>
        </Row>

        {error && (
          <Row className="mb-3">
            <Col>
              <Alert variant="danger" onClose={() => setError("")} dismissible>
                {error}
              </Alert>
            </Col>
          </Row>
        )}

        <Row className="mb-3">
          <Col>
            <Button variant="primary" onClick={openNewModal}>
              + Nueva villa
            </Button>
          </Col>
        </Row>

        {loading ? (
          <div className="d-flex align-items-center">
            <Spinner animation="border" size="sm" className="me-2" />
            <span>Cargando villas...</span>
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
                    No hay villas registradas.
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
          <Modal.Header closeButton>
            <Modal.Title>
              {editingVilla ? "Editar villa" : "Nueva villa"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nombre de la villa</Form.Label>
              <Form.Control
                name="nombre"
                value={form.nombre}
                onChange={handleFormChange}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Cupo máximo de personas</Form.Label>
              <Form.Control
                type="number"
                name="cupo_maximo"
                min="0"
                value={form.cupo_maximo}
                onChange={handleFormChange}
              />
              <Form.Text className="text-muted">
                0 significa sin límite.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal show={showConfirmVilla} onHide={handleCloseConfirmVilla} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar eliminación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {villaToDelete ? (
            <>
              <p>¿Seguro que deseas eliminar la siguiente villa?</p>
              <p>
                <strong>{villaToDelete.nombre}</strong>
                <br />
                <small>
                  Cupo máximo:{" "}
                  {villaToDelete.cupo_maximo && villaToDelete.cupo_maximo > 0
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
          <Button variant="secondary" onClick={handleCloseConfirmVilla}>
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
