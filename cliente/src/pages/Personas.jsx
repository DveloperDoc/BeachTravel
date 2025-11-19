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
  Pagination,
  InputGroup,
} from "react-bootstrap";
import NavbarUser from "../components/NavbarUser";
import { AuthContext } from "../context/AuthContext";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function Personas() {
  const { token, user, authFetch } = useContext(AuthContext);

  const [personas, setPersonas] = useState([]);
  const [villas, setVillas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    rut: "",
    direccion: "",
    telefono: "",
    correo: "",
    villa_id: "",
  });
  const [formErrors, setFormErrors] = useState({});

  const [saving, setSaving] = useState(false);

  // Confirmación de eliminación
  const [showConfirm, setShowConfirm] = useState(false);
  const [personaToDelete, setPersonaToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Modal de cupo máximo alcanzado (para dirigente y admin)
  const [showCupoMaxModal, setShowCupoMaxModal] = useState(false);
  const [cupoMaxData, setCupoMaxData] = useState({
    actual: 0,
    max: 0,
    contexto: "",
  });

  // Filtros y paginación
  const [search, setSearch] = useState("");
  const [filterVillaId, setFilterVillaId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Cupo máximo para el dirigente (si no viene, por defecto 2)
  const CUPO_MAX = user?.cupo_maximo || 2;

  // ==============================
  // Helpers: RUT y teléfono
  // ==============================
  const validarRutChileno = (rutRaw) => {
    if (!rutRaw) return false;

    const rut = rutRaw.replace(/\./g, "").replace(/-/g, "").toUpperCase();
    if (rut.length < 2) return false;

    const cuerpo = rut.slice(0, -1);
    const dv = rut.slice(-1);

    if (!/^\d+$/.test(cuerpo)) return false;

    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += parseInt(cuerpo[i], 10) * multiplo;
      multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }

    const resto = suma % 11;
    const dvCalcNum = 11 - resto;
    let dvCalc;

    if (dvCalcNum === 11) dvCalc = "0";
    else if (dvCalcNum === 10) dvCalc = "K";
    else dvCalc = String(dvCalcNum);

    return dv === dvCalc;
  };

  const normalizarTelefono9 = (value) => {
    // Solo dígitos, máximo 9
    return value.replace(/\D/g, "").slice(0, 9);
  };

  // ==============================
  // Carga inicial: personas + villas
  // ==============================
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const [personasRes, villasRes] = await Promise.all([
          authFetch("/api/personas"),
          authFetch("/api/villas"),
        ]);

        if (!personasRes.ok) {
          const err = await personasRes.json().catch(() => ({}));
          throw new Error(err.message || "Error al obtener personas");
        }

        if (!villasRes.ok) {
          const err = await villasRes.json().catch(() => ({}));
          throw new Error(err.message || "Error al obtener villas");
        }

        const personasData = await personasRes.json();
        const villasData = await villasRes.json();

        setPersonas(personasData);
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
  }, [token, authFetch, user]);

  // ==============================
  // Validación frontend
  // ==============================
  const validateForm = (data, isEdit) => {
    const errors = {};

    // Nombre
    if (!data.nombre.trim()) {
      errors.nombre = "El nombre es obligatorio";
    } else if (data.nombre.trim().length < 3) {
      errors.nombre = "El nombre debe tener al menos 3 caracteres";
    }

    // RUT
    if (!data.rut.trim()) {
      errors.rut = "El RUT es obligatorio";
    } else if (!validarRutChileno(data.rut)) {
      errors.rut = "RUT inválido";
    }

    // Correo
    if (data.correo && data.correo.trim() !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) {
        errors.correo = "Correo electrónico inválido";
      }
    }

    // Teléfono (opcional, pero si se ingresa debe tener 9 dígitos)
    if (data.telefono && data.telefono.trim() !== "") {
      const soloDigitos = normalizarTelefono9(data.telefono);
      if (soloDigitos.length !== 9) {
        errors.telefono = "Debe ingresar 9 dígitos (sin +56, solo número celular)";
      }
    }

    // Villa solo editable/obligatoria para ADMIN
    if (user?.rol === "ADMIN") {
      if (!data.villa_id) {
        errors.villa_id = "Debe seleccionar una villa";
      }
    }

    return errors;
  };

  // ==============================
  // Manejo de formularios / modales
  // ==============================
  const openNewModal = () => {
    if (user?.rol === "DIRIGENTE" && personas.length >= CUPO_MAX) {
      setCupoMaxData({
        actual: personas.length,
        max: CUPO_MAX,
        contexto:
          "Ya has inscrito el número máximo permitido de personas para tu junta de vecinos.",
      });
      setShowCupoMaxModal(true);
      return;
    }

    setEditingPersona(null);
    setForm({
      nombre: "",
      rut: "",
      direccion: "",
      telefono: "",
      correo: "",
      villa_id: "",
    });
    setFormErrors({});
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openEditModal = (persona) => {
    setEditingPersona(persona);
    setForm({
      nombre: persona.nombre || "",
      rut: persona.rut || "",
      direccion: persona.direccion || "",
      telefono: persona.telefono || "",
      correo: persona.correo || "",
      villa_id: persona.villa_id || "",
    });
    setFormErrors({});
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingPersona(null);
    setForm({
      nombre: "",
      rut: "",
      direccion: "",
      telefono: "",
      correo: "",
      villa_id: "",
    });
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    let newValue = value;
    if (name === "telefono") {
      newValue = normalizarTelefono9(value);
    }

    setForm((prev) => ({
      ...prev,
      [name]: newValue,
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
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    setFormErrors({});

    const isEdit = !!editingPersona;
    const errors = validateForm(form, isEdit);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSaving(false);
      return;
    }

    const targetVillaId =
      user?.rol === "ADMIN"
        ? form.villa_id
          ? Number(form.villa_id)
          : null
        : Number(user?.villa_id);

    // Validación de cupo para ADMIN al crear
    if (user?.rol === "ADMIN" && !isEdit && targetVillaId) {
      const villa = villas.find((v) => Number(v.id) === targetVillaId);
      const villaCupoMax = villa?.cupo_maximo ?? null;

      if (villaCupoMax != null) {
        const inscritosEnVilla = personas.filter(
          (p) => Number(p.villa_id) === targetVillaId
        ).length;

        if (inscritosEnVilla >= villaCupoMax) {
          setCupoMaxData({
            actual: inscritosEnVilla,
            max: villaCupoMax,
            contexto: `Ya se alcanzó el cupo máximo de personas para la villa "${
              villa?.nombre || "seleccionada"
            }".`,
          });
          setShowCupoMaxModal(true);
          setSaving(false);
          return;
        }
      }
    }

    try {
      const payload = {
        nombre: form.nombre,
        rut: form.rut,
        direccion: form.direccion,
        telefono: form.telefono
          ? normalizarTelefono9(form.telefono)
          : "", // guardar solo 9 dígitos
        correo: form.correo,
        villa_id: targetVillaId,
      };

      const url = editingPersona
        ? `/api/personas/${editingPersona.id}`
        : "/api/personas";
      const method = editingPersona ? "PUT" : "POST";

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
          setError(data?.message || "Datos en conflicto");
          if (data?.message?.toLowerCase().includes("rut")) {
            setFormErrors((prev) => ({
              ...prev,
              rut: data.message,
            }));
          }
        } else {
          setError(data?.message || "Error al guardar persona");
        }
        setSaving(false);
        return;
      }

      const saved = data;

      if (editingPersona) {
        setPersonas((prev) =>
          prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p))
        );
        setSuccess("Persona actualizada correctamente");
      } else {
        setPersonas((prev) => [...prev, saved]);
        setSuccess("Persona creada correctamente");
      }

      closeModal();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al guardar persona");
    } finally {
      setSaving(false);
    }
  };

  // ==============================
  // Eliminar persona (con modal)
  // ==============================
  const handleAskDelete = (persona) => {
    setPersonaToDelete(persona);
    setShowConfirm(true);
    setError("");
    setSuccess("");
  };

  const handleCloseConfirm = () => {
    if (deleting) return;
    setShowConfirm(false);
    setPersonaToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!personaToDelete) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const res = await authFetch(`/api/personas/${personaToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message || "Error al eliminar persona");
        setDeleting(false);
        return;
      }

      setPersonas((prev) => prev.filter((p) => p.id !== personaToDelete.id));
      setSuccess("Persona eliminada correctamente");
      handleCloseConfirm();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al eliminar persona");
    } finally {
      setDeleting(false);
    }
  };

  // ==============================
  // Filtros + paginación (derivados)
  // ==============================
  const filteredPersonas = useMemo(() => {
    let data = [...personas];

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      data = data.filter(
        (p) =>
          p.nombre.toLowerCase().includes(term) ||
          (p.rut || "").toLowerCase().includes(term)
      );
    }

    if (user?.rol === "ADMIN" && filterVillaId) {
      const vid = Number(filterVillaId);
      data = data.filter((p) => Number(p.villa_id) === vid);
    }

    return data;
  }, [personas, search, filterVillaId, user]);

  const totalItems = filteredPersonas.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const paginatedPersonas = filteredPersonas.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterVillaId]);

  // ==============================
  // Exportar a Excel (respeta filtros)
  // ==============================
  const exportPersonasExcel = () => {
    try {
      if (!filteredPersonas.length) {
        alert("No hay personas para exportar con los filtros actuales.");
        return;
      }

      const data = filteredPersonas.map((p) => ({
        Nombre: p.nombre,
        RUT: p.rut,
        Dirección: p.direccion || "",
        Teléfono: p.telefono ? `+56 ${p.telefono}` : "",
        Correo: p.correo || "",
        Villa: p.villa_nombre || "",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Personas");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const nombreArchivo =
        user?.rol === "DIRIGENTE"
          ? `personas_villa_${(filteredPersonas[0]?.villa_nombre || "mi_villa")
              .replace(/\s+/g, "_")
              .toLowerCase()}.xlsx`
          : "personas_filtradas.xlsx";

      saveAs(blob, nombreArchivo);
    } catch (err) {
      console.error(err);
      setError("Error al exportar personas a Excel");
    }
  };

  // ==============================
  // Render
  // ==============================
  const nombreVillaDirigente = villas.find(
    (v) => v.id == user?.villa_id
  )?.nombre;
  const tituloVilla =
    user?.rol === "DIRIGENTE"
      ? `Listado de la junta de vecinos ${nombreVillaDirigente || ""}`
      : "Listado de personas de todas las villas";

  return (
    <>
      <NavbarUser />

      <Container fluid className="py-4 px-3 px-md-4">
        {/* Título + botón Excel */}
        <Row className="mb-3 align-items-center">
          <Col xs={12} md={8} className="mb-2 mb-md-0">
            <h2 className="mb-1">Personas inscritas</h2>
            <p className="mb-0 text-muted">{tituloVilla}</p>
          </Col>
          <Col
            xs={12}
            md={4}
            className="d-flex justify-content-md-end justify-content-start"
          >
            <Button
              variant="success"
              onClick={exportPersonasExcel}
              className="w-100 w-md-auto"
            >
              Exportar listado a Excel
            </Button>
          </Col>
        </Row>

        {/* Contador de cupos para DIRIGENTE */}
        {user?.rol === "DIRIGENTE" && (
          <Row className="mb-3">
            <Col xs={12} className="d-flex justify-content-md-end">
              <div className="d-flex align-items-center p-2 px-3 bg-light border rounded shadow-sm w-100 w-md-auto">
                <span className="fw-bold me-2">Cupos:</span>
                <span className="badge bg-primary fs-6 me-1">
                  {personas.length}
                </span>
                <span className="fw-bold">/ {CUPO_MAX}</span>
              </div>
            </Col>
          </Row>
        )}

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

        {/* Filtros */}
        <Row className="mb-3 g-2 align-items-end">
          <Col xs={12} md={4}>
            <Form.Label className="d-md-none">Buscar</Form.Label>
            <Form.Control
              placeholder="Buscar por nombre o RUT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Col>

          {user?.rol === "ADMIN" && (
            <Col xs={12} md={4}>
              <Form.Label className="d-md-none">Villa</Form.Label>
              <Form.Select
                value={filterVillaId}
                onChange={(e) => setFilterVillaId(e.target.value)}
              >
                <option value="">Todas las villas</option>
                {villas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </Form.Select>
            </Col>
          )}

          <Col
            xs={12}
            md={4}
            className="d-flex justify-content-md-end justify-content-start"
          >
            <Button
              variant="primary"
              onClick={openNewModal}
              className="w-100 w-md-auto"
            >
              + Nueva persona
            </Button>
          </Col>
        </Row>

        {/* Info cantidad */}
        <Row className="mb-2">
          <Col>
            <small className="text-muted">
              Mostrando {paginatedPersonas.length} de {totalItems} personas
              {search || filterVillaId ? " (filtradas)" : ""}.
            </small>
          </Col>
        </Row>

        {/* Tabla / loading */}
        {loading ? (
          <div className="d-flex align-items-center justify-content-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            <span>Cargando personas...</span>
          </div>
        ) : (
          <>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>RUT</th>
                  <th>Dirección</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Villa</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPersonas.map((p, idx) => (
                  <tr key={p.id}>
                    <td>{startIndex + idx + 1}</td>
                    <td>{p.nombre}</td>
                    <td>{p.rut}</td>
                    <td>{p.direccion}</td>
                    <td>{p.telefono ? `+56 ${p.telefono}` : ""}</td>
                    <td>{p.correo}</td>
                    <td>
                      {p.villa_nombre ||
                        villas.find((v) => v.id === p.villa_id)?.nombre ||
                        "—"}
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => openEditModal(p)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleAskDelete(p)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!paginatedPersonas.length && (
                  <tr>
                    <td colSpan={8} className="text-center">
                      No hay personas que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>

            {totalPages > 1 && (
              <div className="d-flex justify-content-center">
                <Pagination>
                  <Pagination.First
                    disabled={currentPageSafe === 1}
                    onClick={() => setCurrentPage(1)}
                  />
                  <Pagination.Prev
                    disabled={currentPageSafe === 1}
                    onClick={() =>
                      setCurrentPage((p) => Math.max(1, p - 1))
                    }
                  />
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Pagination.Item
                      key={i + 1}
                      active={currentPageSafe === i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </Pagination.Item>
                  ))}
                  <Pagination.Next
                    disabled={currentPageSafe === totalPages}
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                  />
                  <Pagination.Last
                    disabled={currentPageSafe === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  />
                </Pagination>
              </div>
            )}
          </>
        )}
      </Container>

      {/* Modal crear / editar persona */}
      <Modal show={showModal} onHide={closeModal}>
        <Form onSubmit={handleSave}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title>
              {editingPersona ? "Editar persona" : "Nueva persona"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
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
              <Form.Label>RUT</Form.Label>
              <Form.Control
                name="rut"
                value={form.rut}
                onChange={handleFormChange}
                placeholder="12345678-9"
                isInvalid={!!formErrors.rut}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.rut}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Dirección</Form.Label>
              <Form.Control
                name="direccion"
                value={form.direccion}
                onChange={handleFormChange}
                isInvalid={!!formErrors.direccion}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.direccion}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Teléfono</Form.Label>
              <InputGroup>
                <InputGroup.Text>(+56)</InputGroup.Text>
                <Form.Control
                  name="telefono"
                  value={form.telefono}
                  onChange={handleFormChange}
                  isInvalid={!!formErrors.telefono}
                  inputMode="tel"
                  maxLength={9}
                  placeholder="9 dígitos"
                />
                <Form.Control.Feedback type="invalid">
                  {formErrors.telefono}
                </Form.Control.Feedback>
              </InputGroup>
              <Form.Text className="text-muted">
                Ingrese solo 9 dígitos del celular, sin el +56.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Correo</Form.Label>
              <Form.Control
                type="email"
                name="correo"
                value={form.correo}
                onChange={handleFormChange}
                isInvalid={!!formErrors.correo}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.correo}
              </Form.Control.Feedback>
            </Form.Group>

            {user?.rol === "ADMIN" && (
              <Form.Group className="mb-3">
                <Form.Label>Villa</Form.Label>
                <Form.Select
                  name="villa_id"
                  value={form.villa_id}
                  onChange={handleFormChange}
                  isInvalid={!!formErrors.villa_id}
                >
                  <option value="">Seleccione una villa</option>
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

            {user?.rol === "DIRIGENTE" && (
              <p className="text-muted mb-0">
                La persona quedará automáticamente asociada a tu villa.
              </p>
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
          {personaToDelete ? (
            <>
              <p>¿Seguro que deseas eliminar a la siguiente persona?</p>
              <p>
                <strong>{personaToDelete.nombre}</strong>
                <br />
                <small>{personaToDelete.rut}</small>
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
            onClick={handleCloseConfirm}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmDelete}
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : "Eliminar persona"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de cupo máximo alcanzado */}
      <Modal
        show={showCupoMaxModal}
        onHide={() => setShowCupoMaxModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Cupo máximo alcanzado</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {cupoMaxData.contexto ||
              "Ya has inscrito el número máximo permitido de personas."}
          </p>
          <p className="mb-0">
            Cupo actual:{" "}
            <strong>
              {cupoMaxData.actual} / {cupoMaxData.max}
            </strong>
            .
          </p>
          <p className="text-muted mt-2 mb-0">
            Si necesitas agregar a otra persona, primero debes eliminar a una
            persona ya inscrita o consultar con el administrador.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowCupoMaxModal(false)}>
            Aceptar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
