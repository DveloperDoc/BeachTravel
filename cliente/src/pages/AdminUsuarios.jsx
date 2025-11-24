import { useContext, useEffect, useState, useMemo } from "react";
import {
  Container,
  Button,
  Table,
  Modal,
  Form,
  Row,
  Col,
  Alert,
  Spinner,
  InputGroup,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import NavbarUser from "../components/NavbarUser";
import { AuthContext } from "../context/AuthContext";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Link } from "react-router-dom";

export default function AdminUsuarios() {
  const { token, authFetch } = useContext(AuthContext);

  const [users, setUsers] = useState([]);
  const [villas, setVillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "DIRIGENTE",
    villa_id: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterRol, setFilterRol] = useState("");
  const [filterVillaId, setFilterVillaId] = useState("");

  // ==============================
  // Carga inicial: usuarios + villas
  // ==============================
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const [usersRes, villasRes] = await Promise.all([
          authFetch("/api/users"),
          authFetch("/api/villas"),
        ]);

        if (!usersRes.ok) {
          const err = await usersRes.json().catch(() => ({}));
          throw new Error(err.message || "Error al obtener usuarios");
        }
        if (!villasRes.ok) {
          const err = await villasRes.json().catch(() => ({}));
          throw new Error(err.message || "Error al obtener villas");
        }

        const usersData = await usersRes.json();
        const villasData = await villasRes.json();

        setUsers(usersData);
        setVillas(villasData);
      } catch (err) {
        console.error(err);
        setError(err.message || "Error de carga");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token, authFetch]);

  // ==============================
  // Copiar email al portapapeles
  // ==============================
  const copyEmailToClipboard = async (email) => {
    if (!email) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = email;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setSuccess("Correo copiado al portapapeles");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      console.error(err);
      setError("No se pudo copiar el correo");
      setTimeout(() => setError(""), 2000);
    }
  };

  // ==============================
  // Validación frontend
  // ==============================
  const validateForm = (data, isEdit) => {
    const errors = {};

    if (!data.nombre.trim()) {
      errors.nombre = "El nombre es requerido";
    } else if (data.nombre.trim().length < 3) {
      errors.nombre = "El nombre debe tener al menos 3 caracteres";
    }

    if (!data.email.trim()) {
      errors.email = "El email es requerido";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = "Email inválido";
    }

    if (!data.rol) {
      errors.rol = "El rol es requerido";
    } else if (!["ADMIN", "DIRIGENTE"].includes(data.rol)) {
      errors.rol = "Rol inválido";
    }

    if (!isEdit) {
      if (!data.password || data.password.trim() === "") {
        errors.password = "La contraseña es requerida";
      } else if (data.password.length < 6) {
        errors.password = "La contraseña debe tener al menos 6 caracteres";
      }
    } else if (data.password && data.password.trim() !== "") {
      if (data.password.length < 6) {
        errors.password = "La contraseña debe tener al menos 6 caracteres";
      }
    }

    if (data.rol === "DIRIGENTE") {
      if (!data.villa_id) {
        errors.villa_id = "Debe seleccionar una villa para el dirigente";
      }
    }

    return errors;
  };

  // ==============================
  // Manejo de formularios / modales
  // ==============================
  const openNewUserModal = () => {
    setEditingUser(null);
    setForm({
      nombre: "",
      email: "",
      password: "",
      rol: "DIRIGENTE",
      villa_id: "",
    });
    setFormErrors({});
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openEditUserModal = (user) => {
    setEditingUser(user);
    setForm({
      nombre: user.nombre,
      email: user.email,
      password: "",
      rol: user.rol,
      villa_id: user.villa_id || "",
    });
    setFormErrors({});
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingUser(null);
    setForm({
      nombre: "",
      email: "",
      password: "",
      rol: "DIRIGENTE",
      villa_id: "",
    });
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setFormErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
    setError("");
  };

  // ==============================
  // Guardar (create / update)
  // ==============================
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    setFormErrors({});

    const isEdit = !!editingUser;
    const errors = validateForm(form, isEdit);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSaving(false);
      return;
    }

    try {
      const payload = {
        nombre: form.nombre,
        email: form.email,
        rol: form.rol,
        villa_id: form.rol === "DIRIGENTE" ? form.villa_id || null : null,
      };

      if (form.password && form.password.trim() !== "") {
        payload.password = form.password;
      }

      const url = isEdit ? `/api/users/${editingUser.id}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";

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
          setError(data?.message || "Email ya está en uso");
          setFormErrors((prev) => ({
            ...prev,
            email: data?.message || "Email ya está en uso",
          }));
        } else {
          setError(data?.message || "Error al guardar usuario");
        }
        setSaving(false);
        return;
      }

      const saved = data;

      if (isEdit) {
        setUsers((prev) =>
          prev.map((u) => (u.id === saved.id ? { ...u, ...saved } : u))
        );
        setSuccess("Usuario actualizado correctamente");
      } else {
        setUsers((prev) => [...prev, saved]);
        setSuccess("Usuario creado correctamente");
      }

      closeModal();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al guardar usuario");
    } finally {
      setSaving(false);
    }
  };

  // ==============================
  // Eliminar usuario (soft delete)
  // ==============================
  const handleAskDeleteUser = (user) => {
    setUserToDelete(user);
    setShowConfirm(true);
    setError("");
    setSuccess("");
  };

  const handleCloseConfirm = () => {
    if (deleting) return;
    setShowConfirm(false);
    setUserToDelete(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const res = await authFetch(`/api/users/${userToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message || "Error al eliminar usuario");
        setDeleting(false);
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setSuccess("Usuario desactivado correctamente");
      handleCloseConfirm();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al eliminar usuario");
    } finally {
      setDeleting(false);
    }
  };

  // ==============================
  // Exportar dirigentes a Excel
  // ==============================
  const exportDirigentesExcel = () => {
    try {
      const dirigentes = users.filter((u) => u.rol === "DIRIGENTE");

      if (dirigentes.length === 0) {
        alert("No hay dirigentes para exportar.");
        return;
      }

      const data = dirigentes.map((u) => ({
        Nombre: u.nombre,
        Email: u.email,
        Rol: u.rol,
        Villa: u.villa_nombre || "",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dirigentes");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, "dirigentes.xlsx");
    } catch (err) {
      console.error(err);
      setError("Error al exportar dirigentes a Excel");
    }
  };

  // ==============================
  // Exportar integrantes a Excel
  // ==============================
  const exportIntegrantesExcel = async () => {
    try {
      const res = await authFetch("/api/admin/personas");

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al obtener integrantes");
      }

      const personas = await res.json();

      if (personas.length === 0) {
        alert("No hay integrantes para exportar.");
        return;
      }

      const data = personas.map((p) => ({
        Nombre: p.nombre,
        RUT: p.rut,
        Dirección: p.direccion || "",
        Teléfono: p.telefono || "",
        Correo: p.correo || "",
        Villa: p.villa_nombre || "",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Integrantes");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, "integrantes_villas.xlsx");
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al exportar integrantes a Excel");
    }
  };

  // ==============================
  // Filtros (derivados)
  // ==============================
  const filteredUsers = useMemo(() => {
    let data = [...users];

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      data = data.filter(
        (u) =>
          u.nombre.toLowerCase().includes(term) ||
          (u.email || "").toLowerCase().includes(term)
      );
    }

    if (filterRol) {
      data = data.filter((u) => u.rol === filterRol);
    }

    if (filterVillaId) {
      const vid = Number(filterVillaId);
      data = data.filter((u) => Number(u.villa_id) === vid);
    }

    return data;
  }, [users, search, filterRol, filterVillaId]);

  // ==============================
  // Render
  // ==============================
  return (
    <>
      <NavbarUser />

      <Container fluid className="py-4 px-3 px-md-4 admin-usuarios-page">
        {/* Título + botón logs */}
        <Row className="mb-3 align-items-center">
          <Col xs={12} md={8} className="mb-2 mb-md-0">
            <h2 className="mb-1">Administración de usuarios</h2>
            <p className="mb-0 text-muted">
              Aquí se gestiona la creación, edición y eliminación de dirigentes
              y administradores.
            </p>
          </Col>
          <Col
            xs={12}
            md={4}
            className="d-flex justify-content-md-end justify-content-start"
          >
            <Link
              to="/admin/logs"
              className="btn btn-outline-secondary w-100 w-md-auto mt-2 mt-md-0"
            >
              <i className="bi bi-clipboard-data me-1" />
              Ver registro de actividad
            </Link>
          </Col>
        </Row>

        {/* Alertas */}
        {error && (
          <Alert
            variant="danger"
            onClose={() => setError("")}
            dismissible
            className="mb-3"
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            variant="success"
            onClose={() => setSuccess("")}
            dismissible
            className="mb-3"
          >
            {success}
          </Alert>
        )}

        {/* Botones principales */}
        <Row className="mb-3">
          <Col>
            <div className="d-flex flex-wrap gap-2">
              <Button variant="primary" onClick={openNewUserModal}>
                <i className="bi bi-person-plus me-1" />
                + Nuevo usuario
              </Button>
              <Button variant="success" onClick={exportDirigentesExcel}>
                <i className="bi bi-file-earmark-excel me-1" />
                Exportar dirigentes
              </Button>
              <Button
                variant="outline-success"
                onClick={exportIntegrantesExcel}
              >
                <i className="bi bi-people-fill me-1" />
                Exportar integrantes de villas
              </Button>
            </div>
          </Col>
        </Row>

        {/* Filtros de usuarios */}
        <Row className="mb-3 g-2 align-items-end">
          <Col xs={12} md={4}>
            <Form.Label className="d-md-none">Buscar usuario</Form.Label>
            <InputGroup>
              <Form.Control
                placeholder="Buscar por nombre o correo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <Button
                  variant="outline-secondary"
                  onClick={() => setSearch("")}
                >
                  Limpiar
                </Button>
              )}
            </InputGroup>
          </Col>
          <Col xs={12} md={4}>
            <Form.Label className="d-md-none">Rol</Form.Label>
            <Form.Select
              value={filterRol}
              onChange={(e) => setFilterRol(e.target.value)}
            >
              <option value="">Todos los roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="DIRIGENTE">DIRIGENTE</option>
            </Form.Select>
          </Col>
          <Col xs={12} md={4}>
            <Form.Label className="d-md-none">Villa (dirigentes)</Form.Label>
            <Form.Select
              value={filterVillaId}
              onChange={(e) => setFilterVillaId(e.target.value)}
            >
              <option value="">Todas las JJVV</option>
              {villas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Row>

        {/* Info cantidad */}
        <Row className="mb-2">
          <Col>
            <small className="text-muted">
              Mostrando {filteredUsers.length} de {users.length} usuarios
              {search || filterRol || filterVillaId ? " (filtrados)" : ""}.
            </small>
          </Col>
        </Row>

        {/* Tabla / loading */}
        {loading ? (
          <div className="d-flex align-items-center justify-content-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            <span>Cargando usuarios...</span>
          </div>
        ) : (
          <Table
            striped
            bordered
            hover
            responsive
            className="admin-usuarios-table"
          >
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th className="text-center">Correo</th>
                <th>Rol</th>
                <th>Villa</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, idx) => (
                <tr key={u.id}>
                  <td>{idx + 1}</td>
                  <td>{u.nombre}</td>
                  <td className="text-center">
                    <OverlayTrigger
                      placement="top"
                      overlay={
                        <Tooltip>Copiar correo al portapapeles</Tooltip>
                      }
                    >
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => copyEmailToClipboard(u.email)}
                      >
                        Correo
                      </Button>
                    </OverlayTrigger>
                  </td>
                  <td>{u.rol}</td>
                  <td>{u.villa_nombre || "—"}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      <Button
                        variant="warning"
                        size="sm"
                        onClick={() => openEditUserModal(u)}
                      >
                        <i className="bi bi-pencil-square me-1" />
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleAskDeleteUser(u)}
                      >
                        <i className="bi bi-trash me-1" />
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredUsers.length && users.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center">
                    No hay usuarios registrados. Use el botón{" "}
                    <strong>“+ Nuevo usuario”</strong> para crear el primero.
                  </td>
                </tr>
              )}

              {!filteredUsers.length && users.length > 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center">
                    No hay usuarios que coincidan con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Container>

      {/* Modal crear / editar usuario */}
      <Modal show={showModal} onHide={closeModal}>
        <Form onSubmit={handleSaveUser}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title>
              {editingUser ? "Editar usuario" : "Nuevo usuario"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted">
              Los campos marcados con <strong>*</strong> son obligatorios.
            </p>

            <Form.Group className="mb-3">
              <Form.Label>Nombre *</Form.Label>
              <Form.Control
                name="nombre"
                value={form.nombre}
                onChange={handleFormChange}
                isInvalid={!!formErrors.nombre}
                autoFocus
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.nombre}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={form.email}
                onChange={handleFormChange}
                isInvalid={!!formErrors.email}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.email}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Contraseña{" "}
                {editingUser && (
                  <small>(dejar en blanco para no cambiar)</small>
                )}
              </Form.Label>
              <Form.Control
                type="password"
                name="password"
                value={form.password}
                onChange={handleFormChange}
                placeholder={editingUser ? "*****" : ""}
                isInvalid={!!formErrors.password}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.password}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Rol *</Form.Label>
              <Form.Select
                name="rol"
                value={form.rol}
                onChange={handleFormChange}
                isInvalid={!!formErrors.rol}
              >
                <option value="DIRIGENTE">DIRIGENTE</option>
                <option value="ADMIN">ADMIN</option>
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {formErrors.rol}
              </Form.Control.Feedback>
            </Form.Group>

            {form.rol === "DIRIGENTE" && (
              <Form.Group className="mb-3">
                <Form.Label>Villa *</Form.Label>
                <Form.Select
                  name="villa_id"
                  value={form.villa_id}
                  onChange={handleFormChange}
                  isInvalid={!!formErrors.villa_id}
                >
                  <option value="">Seleccione una JJVV</option>
                  {villas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nombre}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {formErrors.villa_id}
                </Form.Control.Feedback>
              </Form.Group>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal show={showConfirm} onHide={handleCloseConfirm} centered>
        <Modal.Header closeButton={!deleting}>
          <Modal.Title>Confirmar eliminación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {userToDelete ? (
            <>
              <p>¿Seguro que deseas desactivar al siguiente usuario?</p>
              <p>
                <strong>{userToDelete.nombre}</strong>
                <br />
                <small>{userToDelete.email}</small>
              </p>
              <p className="text-danger mb-0">
                El usuario dejará de tener acceso al sistema.
              </p>
            </>
          ) : (
            <p>Procesando…</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={handleCloseConfirm}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmDeleteUser}
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : "Eliminar usuario"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
