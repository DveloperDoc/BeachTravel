import { useContext, useEffect, useMemo, useState } from "react";
import {
  Container,
  Row,
  Col,
  Alert,
  Spinner,
  Form,
  Button,
  Card,
  Table,
  Pagination,
  Modal,
  Badge,
} from "react-bootstrap";
import NavbarUser from "../components/NavbarUser";
import { AuthContext } from "../context/AuthContext";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function AdminLogs() {
  const { token, authFetch } = useContext(AuthContext);

  const [logs, setLogs] = useState([]);
  const [limit, setLimit] = useState(200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filtros
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Modal detalle
  const [showDetail, setShowDetail] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const parseJsonSafe = (value) => {
    if (!value) return null;
    try {
      if (typeof value === "object") return value;
      return JSON.parse(value);
    } catch (_) {
      return value;
    }
  };

  // ===== Helpers de “texto humano” =====
  const mapAccionLabel = (accion) => {
    switch (accion) {
      case "CREATE_PERSONA":
        return "Creación de persona";
      case "UPDATE_PERSONA":
        return "Actualización de persona";
      case "DELETE_PERSONA":
        return "Eliminación de persona";
      case "CREATE_USER":
        return "Creación de usuario";
      case "UPDATE_USER":
        return "Actualización de usuario";
      case "DEACTIVATE_USER":
        return "Desactivación de usuario";
      case "CREATE_VILLA":
        return "Creación de villa";
      case "UPDATE_VILLA":
        return "Actualización de villa";
      case "DELETE_VILLA":
        return "Eliminación de villa";
      default:
        return accion || "Acción";
    }
  };

  const mapEntidadLabel = (entidad) => {
    switch (entidad) {
      case "PERSONA":
        return "Persona";
      case "USER":
        return "Usuario";
      case "VILLA":
        return "Villa";
      default:
        return entidad || "Otro";
    }
  };

  const buildResumen = (log) => {
    const usuario = log.usuario_nombre || "Usuario desconocido";
    const accionLabel = mapAccionLabel(log.accion);
    const entidadLabel = mapEntidadLabel(log.entidad);
    const nombreAfectado = log.entidad_nombre || entidadLabel;
    return `${usuario} realizó: ${accionLabel} sobre "${nombreAfectado}"`;
  };

  const rolVariant = (rol) => {
    switch (rol) {
      case "ADMIN":
        return "primary";
      case "DIRIGENTE":
        return "success";
      default:
        return "secondary";
    }
  };

  const accionVariant = (accion) => {
    if (!accion) return "secondary";
    if (accion.startsWith("CREATE")) return "success";
    if (accion.startsWith("UPDATE")) return "warning";
    if (accion.startsWith("DELETE") || accion.startsWith("DEACTIVATE"))
      return "danger";
    return "info";
  };

  const fetchLogs = async (currentLimit = limit) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await authFetch(`/api/admin/logs?limit=${currentLimit}`);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || "Error al obtener el registro de actividad"
        );
      }

      const data = await res.json();
      setLogs(data);
      setSuccess(`Se cargaron ${data.length} registros de actividad.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al cargar el registro de actividad");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // =========================
  // Derivados: filtros
  // =========================
  const filteredLogs = useMemo(() => {
    let data = [...logs];

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      data = data.filter((log) => {
        const usuario = (log.usuario_nombre || "").toLowerCase();
        const accion = (log.accion || "").toLowerCase();
        const accionLabel = mapAccionLabel(log.accion).toLowerCase();
        const entidad = (log.entidad || "").toLowerCase();
        const entidadLabel = mapEntidadLabel(log.entidad).toLowerCase();
        const entidadNombre = (log.entidad_nombre || "").toLowerCase();
        const ip = (log.ip || "").toLowerCase();
        const entidadId = String(log.entidad_id ?? "").toLowerCase();
        return (
          usuario.includes(term) ||
          accion.includes(term) ||
          accionLabel.includes(term) ||
          entidad.includes(term) ||
          entidadLabel.includes(term) ||
          entidadNombre.includes(term) ||
          ip.includes(term) ||
          entidadId.includes(term)
        );
      });
    }

    if (filterUser) {
      data = data.filter((log) => log.usuario_nombre === filterUser);
    }

    if (filterAction) {
      data = data.filter((log) => log.accion === filterAction);
    }

    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00");
      data = data.filter((log) => {
        const d = new Date(log.created_at);
        return d >= from;
      });
    }

    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59");
      data = data.filter((log) => {
        const d = new Date(log.created_at);
        return d <= to;
      });
    }

    return data;
  }, [logs, search, filterUser, filterAction, dateFrom, dateTo]);

  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterUser, filterAction, dateFrom, dateTo]);

  const uniqueUsers = useMemo(() => {
    const setNames = new Set(
      logs
        .map((l) => l.usuario_nombre)
        .filter((n) => n && n.trim() !== "")
    );
    return Array.from(setNames).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const uniqueActions = useMemo(() => {
    const setAccion = new Set(
      logs
        .map((l) => l.accion)
        .filter((a) => a && a.trim() !== "")
    );
    return Array.from(setAccion).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  // =========================
  // Exportar a Excel
  // =========================
  const exportLogsExcel = () => {
    try {
      if (!filteredLogs.length) {
        alert("No hay registros para exportar con los filtros actuales.");
        return;
      }

      const data = filteredLogs.map((l) => ({
        ID: l.id,
        Fecha: l.created_at,
        Usuario: l.usuario_nombre || "",
        Rol: l.usuario_rol || "",
        "Acción (código)": l.accion,
        "Acción (descripción)": mapAccionLabel(l.accion),
        Entidad: mapEntidadLabel(l.entidad),
        "Nombre afectado": l.entidad_nombre || "",
        "ID Entidad": l.entidad_id,
        IP: l.ip || "",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Logs");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, "registro_actividad.xlsx");
    } catch (err) {
      console.error(err);
      setError("Error al exportar logs a Excel");
    }
  };

  // =========================
  // Detalle de log
  // =========================
  const openDetail = (log) => {
    setSelectedLog({
      ...log,
      datos_antes_parsed: parseJsonSafe(log.datos_antes),
      datos_despues_parsed: parseJsonSafe(log.datos_despues),
    });
    setShowDetail(true);
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedLog(null);
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleString("es-CL");
  };

  return (
    <>
      <NavbarUser />

      <Container fluid className="py-4 px-3 px-md-4">
        {/* Título + botones */}
        <Row className="mb-3 align-items-center">
          <Col xs={12} md={8} className="mb-2 mb-md-0">
            <h2 className="mb-1">Registro de actividad</h2>
            <p className="mb-0 text-muted">
              Aquí puedes revisar quién hizo qué cambio y en qué momento.
            </p>
          </Col>
          <Col
            xs={12}
            md={4}
            className="d-flex justify-content-md-end justify-content-start"
          >
            <div className="d-flex flex-wrap gap-2 w-100 justify-content-md-end">
              <Button
                variant="outline-secondary"
                className="w-100 w-md-auto"
                onClick={() => fetchLogs(limit)}
                disabled={loading}
              >
                Recargar
              </Button>
              <Button
                variant="success"
                className="w-100 w-md-auto"
                onClick={exportLogsExcel}
                disabled={!filteredLogs.length}
              >
                Exportar a Excel
              </Button>
            </div>
          </Col>
        </Row>

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
        <Card className="mb-3">
          <Card.Body>
            <Row className="g-2 align-items-end">
              <Col xs={12} md={2}>
                <Form.Label>Tamaño de muestra</Form.Label>
                <Form.Select
                  value={limit}
                  onChange={(e) => {
                    const newLimit = Number(e.target.value) || 200;
                    setLimit(newLimit);
                    fetchLogs(newLimit);
                  }}
                  disabled={loading}
                >
                  <option value={100}>Últimos 100</option>
                  <option value={200}>Últimos 200</option>
                  <option value={500}>Últimos 500</option>
                  <option value={1000}>Últimos 1000</option>
                </Form.Select>
              </Col>

              <Col xs={12} md={3}>
                <Form.Label>Buscar en el registro</Form.Label>
                <Form.Control
                  placeholder="Nombre, acción, tipo, IP..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Col>

              <Col xs={12} md={2}>
                <Form.Label>Realizado por</Form.Label>
                <Form.Select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                >
                  <option value="">Todos</option>
                  {uniqueUsers.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col xs={12} md={2}>
                <Form.Label>Tipo de acción</Form.Label>
                <Form.Select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                >
                  <option value="">Todas</option>
                  {uniqueActions.map((a) => (
                    <option key={a} value={a}>
                      {mapAccionLabel(a)}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col xs={6} md={1}>
                <Form.Label>Desde</Form.Label>
                <Form.Control
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </Col>

              <Col xs={6} md={1}>
                <Form.Label>Hasta</Form.Label>
                <Form.Control
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </Col>

              <Col xs={12} md={2} className="text-md-end">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="mt-2 w-100 w-md-auto"
                  onClick={() => {
                    setSearch("");
                    setFilterUser("");
                    setFilterAction("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Limpiar filtros
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Row className="mb-2">
          <Col>
            <small className="text-muted">
              Mostrando {paginatedLogs.length} de {totalItems} registros
              {search || filterUser || filterAction || dateFrom || dateTo
                ? " (filtrados)"
                : ""}
              .
            </small>
          </Col>
        </Row>

        {loading ? (
          <div className="d-flex align-items-center justify-content-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            <span>Cargando registros...</span>
          </div>
        ) : (
          <>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha / hora</th>
                  <th>Realizado por</th>
                  <th>Rol</th>
                  <th>Acción realizada</th>
                  <th>Resumen</th>
                  <th>IP</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, idx) => (
                  <tr key={log.id}>
                    <td>{startIndex + idx + 1}</td>
                    <td>{formatDateTime(log.created_at)}</td>
                    <td>{log.usuario_nombre || "—"}</td>
                    <td>
                      {log.usuario_rol ? (
                        <Badge pill bg={rolVariant(log.usuario_rol)}>
                          {log.usuario_rol}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <Badge bg={accionVariant(log.accion)}>
                        {mapAccionLabel(log.accion)}
                      </Badge>
                    </td>
                    <td>{buildResumen(log)}</td>
                    <td>{log.ip || "—"}</td>
                    <td className="text-center">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => openDetail(log)}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
                {!paginatedLogs.length && (
                  <tr>
                    <td colSpan={8} className="text-center">
                      No hay registros que coincidan con los filtros.
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

      {/* Modal detalle de log */}
      <Modal show={showDetail} onHide={closeDetail} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Detalle del cambio</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLog ? (
            <>
              <p>
                <strong>Fecha:</strong>{" "}
                {formatDateTime(selectedLog.created_at)}
                <br />
                <strong>Realizado por:</strong>{" "}
                {selectedLog.usuario_nombre || "—"} (
                {selectedLog.usuario_rol || "sin rol"})
                <br />
                <strong>Acción:</strong>{" "}
                {mapAccionLabel(selectedLog.accion)}{" "}
                <small className="text-muted">
                  [{selectedLog.accion}]
                </small>
                <br />
                <strong>Entidad afectada:</strong>{" "}
                {mapEntidadLabel(selectedLog.entidad)}{" "}
                {selectedLog.entidad_nombre
                  ? `("${selectedLog.entidad_nombre}")`
                  : ""}
                {selectedLog.entidad_id != null
                  ? ` [ID ${selectedLog.entidad_id}]`
                  : ""}
                <br />
                <strong>Dirección IP:</strong> {selectedLog.ip || "—"}
              </p>
              <Row>
                <Col md={6}>
                  <h6>Datos antes del cambio</h6>
                  <pre className="bg-light p-2 small" style={{ overflowX: "auto" }}>
                    {JSON.stringify(
                      selectedLog.datos_antes_parsed,
                      null,
                      2
                    ) || "Sin datos"}
                  </pre>
                </Col>
                <Col md={6}>
                  <h6>Datos después del cambio</h6>
                  <pre className="bg-light p-2 small" style={{ overflowX: "auto" }}>
                    {JSON.stringify(
                      selectedLog.datos_despues_parsed,
                      null,
                      2
                    ) || "Sin datos"}
                  </pre>
                </Col>
              </Row>
            </>
          ) : (
            <p>Cargando detalle…</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDetail}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
