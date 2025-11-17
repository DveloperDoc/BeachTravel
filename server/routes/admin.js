// server/routes/admin.js
const express = require("express");
const { pool } = require("../config/db");
const { authRequired, adminOnly } = require("../config/middleware/authMiddleware");
const { body, param, validationResult } = require("express-validator");

const router = express.Router();

router.use(authRequired, adminOnly);

/* ======================================================
   Helper: manejo de errores de validación
====================================================== */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Datos inválidos",
      errors: errors.array(),
    });
  }
  next();
}

/* ======================================================
   Helper: validador de RUT chileno
====================================================== */
function validarRutChileno(rut) {
  if (!rut) return false;
  const clean = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase();

  // 7 u 8 dígitos + DV
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;

  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dvCalc = 11 - resto;

  let dvEsperado;
  if (dvCalc === 11) dvEsperado = "0";
  else if (dvCalc === 10) dvEsperado = "K";
  else dvEsperado = String(dvCalc);

  return dv === dvEsperado;
}

/* ======================================================
   Helper: registrar log
   (ajústelo si su tabla tiene más/menos columnas)
====================================================== */
async function registrarLog({
  usuarioId,
  accion,
  entidad,
  entidadId,
  datosAntes = null,
  datosDespues = null,
  ip = null,
}) {
  try {
    await pool.query(
      `INSERT INTO logs (
         usuario_id,
         accion,
         entidad,
         entidad_id,
         datos_antes,
         datos_despues,
         ip
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        usuarioId || null,
        accion,
        entidad,
        entidadId || null,
        datosAntes ? JSON.stringify(datosAntes) : null,
        datosDespues ? JSON.stringify(datosDespues) : null,
        ip || null,
      ]
    );
  } catch (err) {
    console.error("Error registrando log:", err);
  }
}

/* ======================================================
   GET /api/admin/personas
====================================================== */
router.get("/personas", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          p.id, 
          p.nombre, 
          p.rut, 
          p.direccion, 
          p.telefono, 
          p.correo,
          p.villa_id,
          v.nombre AS villa_nombre
       FROM personas p
       JOIN villas v ON v.id = p.villa_id
       ORDER BY v.nombre, p.nombre`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error GET /api/admin/personas:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

/* ======================================================
   POST /api/admin/personas
   Crea persona con validaciones
====================================================== */
router.post(
  "/personas",
  [
    body("nombre")
      .trim()
      .notEmpty().withMessage("El nombre es obligatorio")
      .isLength({ min: 3 }).withMessage("El nombre debe tener al menos 3 caracteres"),
    body("rut")
      .trim()
      .notEmpty().withMessage("El RUT es obligatorio")
      .custom((value) => {
        if (!validarRutChileno(value)) {
          throw new Error("RUT inválido");
        }
        return true;
      }),
    body("correo")
      .optional({ checkFalsy: true })
      .isEmail().withMessage("Correo electrónico inválido")
      .normalizeEmail(),
    body("telefono")
      .optional({ checkFalsy: true })
      .matches(/^[0-9+\s-]{6,15}$/).withMessage("Teléfono inválido"),
    body("direccion")
      .optional({ checkFalsy: true })
      .isLength({ max: 255 }).withMessage("Dirección demasiado larga"),
    body("villa_id")
      .notEmpty().withMessage("La villa es obligatoria")
      .isInt({ min: 1 }).withMessage("villa_id debe ser un entero válido"),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { nombre, rut, direccion, telefono, correo, villa_id } = req.body;

    try {
      const inserted = await pool.query(
        `INSERT INTO personas (nombre, rut, direccion, telefono, correo, villa_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nombre, rut, direccion, telefono, correo, villa_id`,
        [nombre, rut, direccion || null, telefono || null, correo || null, villa_id]
      );

      const persona = inserted.rows[0];

      // Log de auditoría
      await registrarLog({
        usuarioId: req.user?.id,
        accion: "CREATE_PERSONA",
        entidad: "PERSONA",
        entidadId: persona.id,
        datosAntes: null,
        datosDespues: persona,
        ip: req.ip,
      });

      res.status(201).json(persona);
    } catch (err) {
      console.error("Error POST /api/admin/personas:", err);

      if (err.code === "23505") {
        return res.status(409).json({
          message: "Ya existe una persona con ese RUT o correo",
        });
      }

      res.status(500).json({ message: "Error interno del servidor" });
    }
  }
);

/* ======================================================
   PUT /api/admin/personas/:id
   Actualiza persona con validaciones
====================================================== */
router.put(
  "/personas/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("ID inválido"),
    body("nombre")
      .trim()
      .notEmpty().withMessage("El nombre es obligatorio")
      .isLength({ min: 3 }).withMessage("El nombre debe tener al menos 3 caracteres"),
    body("rut")
      .trim()
      .notEmpty().withMessage("El RUT es obligatorio")
      .custom((value) => {
        if (!validarRutChileno(value)) {
          throw new Error("RUT inválido");
        }
        return true;
      }),
    body("correo")
      .optional({ checkFalsy: true })
      .isEmail().withMessage("Correo electrónico inválido")
      .normalizeEmail(),
    body("telefono")
      .optional({ checkFalsy: true })
      .matches(/^[0-9+\s-]{6,15}$/).withMessage("Teléfono inválido"),
    body("direccion")
      .optional({ checkFalsy: true })
      .isLength({ max: 255 }).withMessage("Dirección demasiado larga"),
    body("villa_id")
      .notEmpty().withMessage("La villa es obligatoria")
      .isInt({ min: 1 }).withMessage("villa_id debe ser un entero válido"),
  ],
  handleValidationErrors,
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { nombre, rut, direccion, telefono, correo, villa_id } = req.body;

    try {
      // Obtener datos antes (para log)
      const before = await pool.query(
        `SELECT id, nombre, rut, direccion, telefono, correo, villa_id
         FROM personas WHERE id = $1`,
        [id]
      );

      if (before.rowCount === 0) {
        return res.status(404).json({ message: "Persona no encontrada" });
      }

      const datosAntes = before.rows[0];

      const updated = await pool.query(
        `UPDATE personas
         SET nombre = $1,
             rut = $2,
             direccion = $3,
             telefono = $4,
             correo = $5,
             villa_id = $6
         WHERE id = $7
         RETURNING id, nombre, rut, direccion, telefono, correo, villa_id`,
        [nombre, rut, direccion || null, telefono || null, correo || null, villa_id, id]
      );

      const persona = updated.rows[0];

      // Log de auditoría
      await registrarLog({
        usuarioId: req.user?.id,
        accion: "UPDATE_PERSONA",
        entidad: "PERSONA",
        entidadId: persona.id,
        datosAntes,
        datosDespues: persona,
        ip: req.ip,
      });

      res.json(persona);
    } catch (err) {
      console.error("Error PUT /api/admin/personas/:id:", err);

      if (err.code === "23505") {
        return res.status(409).json({
          message: "Ya existe una persona con ese RUT o correo",
        });
      }

      res.status(500).json({ message: "Error interno del servidor" });
    }
  }
);

/* ======================================================
   DELETE /api/admin/personas/:id
   Elimina persona (con log)
====================================================== */
router.delete(
  "/personas/:id",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido")],
  handleValidationErrors,
  async (req, res) => {
    const id = parseInt(req.params.id, 10);

    try {
      const before = await pool.query(
        `SELECT id, nombre, rut, direccion, telefono, correo, villa_id
         FROM personas WHERE id = $1`,
        [id]
      );

      if (before.rowCount === 0) {
        return res.status(404).json({ message: "Persona no encontrada" });
      }

      const datosAntes = before.rows[0];

      const result = await pool.query("DELETE FROM personas WHERE id = $1", [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Persona no encontrada" });
      }

      // Log de auditoría
      await registrarLog({
        usuarioId: req.user?.id,
        accion: "DELETE_PERSONA",
        entidad: "PERSONA",
        entidadId: id,
        datosAntes,
        datosDespues: null,
        ip: req.ip,
      });

      res.json({ message: "Persona eliminada correctamente" });
    } catch (err) {
      console.error("Error DELETE /api/admin/personas/:id:", err);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  }
);

/* ======================================================
   GET /api/admin/logs
   Lista últimos N logs (por defecto 200) con JOIN usuario
====================================================== */
router.get("/logs", async (req, res) => {
  const limit = parseInt(req.query.limit || "200", 10);

  try {
    const result = await pool.query(
      `
      SELECT 
        l.id,
        l.usuario_id,
        u.nombre AS usuario_nombre,
        u.rol AS usuario_rol,
        l.accion,
        l.entidad,
        l.entidad_id,

        -- Nombre exacto de la entidad afectada,
        -- priorizando el estado DESPUÉS del cambio
        COALESCE(
          NULLIF(
            CASE 
              WHEN l.datos_despues IS NOT NULL 
              THEN (l.datos_despues::jsonb ->> 'nombre')
            END,
            ''
          ),
          NULLIF(
            CASE 
              WHEN l.datos_antes IS NOT NULL 
              THEN (l.datos_antes::jsonb ->> 'nombre')
            END,
            ''
          )
        ) AS entidad_nombre,

        l.datos_antes,
        l.datos_despues,
        l.ip,
        l.created_at
      FROM logs l
      LEFT JOIN users u ON u.id = l.usuario_id
      ORDER BY l.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error GET /api/admin/logs:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

/* ======================================================
   Función que convierte el log técnico en texto humano
====================================================== */
async function formatoHumano(log) {
  let usuarioNombre = "";
  let entidadNombre = "";

  // 1. Obtener nombre del usuario que hizo la acción
  if (log.usuario_id) {
    const u = await pool.query("SELECT nombre, rol FROM users WHERE id = $1", [
      log.usuario_id,
    ]);
    if (u.rowCount > 0) usuarioNombre = u.rows[0].nombre;
  }

  // 2. Obtener nombre del elemento afectado
  if (log.entidad === "PERSONA") {
    const p = await pool.query(
      "SELECT nombre, villa_id FROM personas WHERE id = $1",
      [log.entidad_id]
    );
    if (p.rowCount > 0) entidadNombre = p.rows[0].nombre;
  }

  if (log.entidad === "USER") {
    const p = await pool.query(
      "SELECT nombre, rol FROM users WHERE id = $1",
      [log.entidad_id]
    );
    if (p.rowCount > 0) entidadNombre = p.rows[0].nombre;
  }

  // 3. Construir mensaje humano según la acción
  let mensaje = "";

  switch (log.accion) {
    case "CREATE_PERSONA":
      mensaje = `El dirigente "${usuarioNombre}" agregó a la persona "${entidadNombre}".`;
      break;

    case "UPDATE_PERSONA":
      mensaje = `El dirigente "${usuarioNombre}" actualizó los datos de "${entidadNombre}".`;
      break;

    case "DELETE_PERSONA":
      mensaje = `El dirigente "${usuarioNombre}" eliminó a la persona "${entidadNombre}".`;
      break;

    case "CREATE_USER":
      mensaje = `El administrador "${usuarioNombre}" creó al usuario "${entidadNombre}".`;
      break;

    case "UPDATE_USER":
      mensaje = `El administrador "${usuarioNombre}" actualizó al usuario "${entidadNombre}".`;
      break;

    case "DELETE_USER":
      mensaje = `El administrador "${usuarioNombre}" eliminó al usuario "${entidadNombre}".`;
      break;

    case "DEACTIVATE_USER":
      mensaje = `El administrador "${usuarioNombre}" desactivó al usuario "${entidadNombre}".`;
      break;

    default:
      mensaje = `${usuarioNombre} realizó la acción ${log.accion}.`;
  }

  return {
    fecha: log.created_at, // usamos created_at en vez de fecha
    mensaje,
  };
}

/* ======================================================
   GET /api/admin/logs/humano
   Logs formateados humanamente
====================================================== */
router.get("/logs/humano", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "200", 10);

    const rawLogs = await pool.query(
      `SELECT * FROM logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );

    const logsHumanos = [];
    for (const log of rawLogs.rows) {
      logsHumanos.push(await formatoHumano(log));
    }

    res.json(logsHumanos);
  } catch (err) {
    console.error("Error GET /api/admin/logs/humano:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

module.exports = router;
