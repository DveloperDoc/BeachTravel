// server/routes/personas.js
const express = require("express");
const { pool } = require("../config/db");
const { authRequired } = require("../config/middleware/authMiddleware");
const { body, param, validationResult } = require("express-validator");

const router = express.Router();

// Todas las rutas requieren estar logueado
router.use(authRequired);

/* ==========================================
   Helpers: validación y logging
========================================== */

// Manejo de errores de validación
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

// Validador de RUT chileno
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

// Helper centralizado para logs
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

// Helper rol admin (incluye SUPER_ADMIN)
function esAdmin(rol) {
  return rol === "ADMIN" || rol === "SUPER_ADMIN";
}

/* ==========================================
   FUNCIÓN AUXILIAR: valida cupo de villa
========================================== */
async function verificarCupoDisponible(villaId) {
  const villaRes = await pool.query(
    "SELECT cupo_maximo FROM villas WHERE id = $1",
    [villaId]
  );
  if (villaRes.rowCount === 0) {
    throw new Error("Villa no encontrada");
  }
  const { cupo_maximo } = villaRes.rows[0];

  // 0 = sin límite
  if (!cupo_maximo || cupo_maximo <= 0) {
    return true;
  }

  const countRes = await pool.query(
    "SELECT COUNT(*)::int AS total FROM personas WHERE villa_id = $1",
    [villaId]
  );

  const total = countRes.rows[0].total;
  return total < cupo_maximo;
}

/* ==========================================
   GET /api/personas  -> listado según rol
========================================== */
router.get("/", async (req, res) => {
  try {
    const { rol, villa_id } = req.user;

    if (esAdmin(rol)) {
      const result = await pool.query(
        `SELECT 
           p.id, p.nombre, p.rut, p.direccion, p.telefono, p.correo,
           p.villa_id,
           v.nombre AS villa_nombre
         FROM personas p
         JOIN villas v ON v.id = p.villa_id
         ORDER BY v.nombre, p.nombre`
      );
      return res.json(result.rows);
    }

    if (rol === "DIRIGENTE") {
      if (!villa_id) {
        return res.status(400).json({
          message:
            "No se ha definido una villa asociada al dirigente. Contacte al administrador.",
        });
      }

      const result = await pool.query(
        `SELECT 
           p.id, p.nombre, p.rut, p.direccion, p.telefono, p.correo,
           p.villa_id,
           v.nombre AS villa_nombre
         FROM personas p
         JOIN villas v ON v.id = p.villa_id
         WHERE p.villa_id = $1
         ORDER BY p.nombre`,
        [villa_id]
      );
      return res.json(result.rows);
    }

    // Rol desconocido
    return res.status(403).json({
      message: "No tiene permisos para ver el listado de personas.",
    });
  } catch (err) {
    console.error("Error GET /api/personas:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

/* ==========================================
   POST /api/personas  -> crear persona
========================================== */
router.post(
  "/",
  [
    body("nombre")
      .trim()
      .notEmpty()
      .withMessage("El nombre es obligatorio")
      .isLength({ min: 3 })
      .withMessage("El nombre debe tener al menos 3 caracteres"),
    body("rut")
      .trim()
      .notEmpty()
      .withMessage("El RUT es obligatorio")
      .custom((value) => {
        if (!validarRutChileno(value)) {
          throw new Error("RUT inválido");
        }
        return true;
      }),
    body("correo")
      .optional({ checkFalsy: true })
      .isEmail()
      .withMessage("Correo electrónico inválido")
      .normalizeEmail(),
    body("telefono")
      .optional({ checkFalsy: true })
      .matches(/^[0-9+\s-]{6,15}$/)
      .withMessage("Teléfono inválido"),
    body("direccion")
      .optional({ checkFalsy: true })
      .isLength({ max: 255 })
      .withMessage("Dirección demasiado larga"),
    body("villa_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("villa_id debe ser un entero válido"),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { nombre, rut, direccion, telefono, correo, villa_id } = req.body;
    const { rol, villa_id: userVillaId, id: usuarioId } = req.user;

    // Determinar villa a usar según rol
    let villaId = null;

    if (rol === "DIRIGENTE") {
      villaId = userVillaId;
    } else if (esAdmin(rol)) {
      villaId = villa_id;
    }

    if (!villaId) {
      return res
        .status(400)
        .json({ message: "No se ha definido una villa para esta persona" });
    }

    try {
      const cupoOk = await verificarCupoDisponible(villaId);
      if (!cupoOk) {
        return res.status(400).json({
          message:
            "Se alcanzó el cupo máximo de personas para esta villa. No se pueden agregar más registros.",
        });
      }

      const insertRes = await pool.query(
        `INSERT INTO personas (nombre, rut, direccion, telefono, correo, villa_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nombre, rut, direccion, telefono, correo, villa_id`,
        [nombre, rut, direccion || null, telefono || null, correo || null, villaId]
      );

      const nueva = insertRes.rows[0];

      await registrarLog({
        usuarioId,
        accion: "CREATE_PERSONA",
        entidad: "PERSONA",
        entidadId: nueva.id,
        datosAntes: null,
        datosDespues: nueva,
        ip: req.ip || null,
      });

      res.status(201).json(nueva);
    } catch (err) {
      console.error("Error POST /api/personas:", err);

      if (err.message === "Villa no encontrada") {
        return res
          .status(400)
          .json({ message: "La villa especificada no existe" });
      }

      // Unique constraint, por ejemplo rut único
      if (err.code === "23505") {
        return res
          .status(409)
          .json({ message: "Ya existe una persona con ese RUT o correo" });
      }

      res.status(500).json({ message: "Error interno del servidor" });
    }
  }
);

/* ==========================================
   PUT /api/personas/:id  -> editar persona
========================================== */
router.put(
  "/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("ID inválido"),
    body("nombre")
      .trim()
      .notEmpty()
      .withMessage("El nombre es obligatorio")
      .isLength({ min: 3 })
      .withMessage("El nombre debe tener al menos 3 caracteres"),
    body("rut")
      .trim()
      .notEmpty()
      .withMessage("El RUT es obligatorio")
      .custom((value) => {
        if (!validarRutChileno(value)) {
          throw new Error("RUT inválido");
        }
        return true;
      }),
    body("correo")
      .optional({ checkFalsy: true })
      .isEmail()
      .withMessage("Correo electrónico inválido")
      .normalizeEmail(),
    body("telefono")
      .optional({ checkFalsy: true })
      .matches(/^[0-9+\s-]{6,15}$/)
      .withMessage("Teléfono inválido"),
    body("direccion")
      .optional({ checkFalsy: true })
      .isLength({ max: 255 })
      .withMessage("Dirección demasiado larga"),
  ],
  handleValidationErrors,
  async (req, res) => {
    const personaId = parseInt(req.params.id, 10);
    const { nombre, rut, direccion, telefono, correo } = req.body;
    const { rol, villa_id: userVillaId, id: usuarioId } = req.user;
    const isDirigente = rol === "DIRIGENTE";

    try {
      // Buscar estado anterior
      const beforeRes = await pool.query(
        `SELECT 
           p.id, p.nombre, p.rut, p.direccion, p.telefono, p.correo, p.villa_id
         FROM personas p
         WHERE p.id = $1`,
        [personaId]
      );

      if (beforeRes.rowCount === 0) {
        return res.status(404).json({ message: "Persona no encontrada" });
      }

      const before = beforeRes.rows[0];

      // DIRIGENTE solo puede tocar su villa
      if (isDirigente && before.villa_id !== userVillaId) {
        return res
          .status(403)
          .json({ message: "No tienes permiso para editar esta persona" });
      }

      const updateRes = await pool.query(
        `UPDATE personas
         SET nombre = $1,
             rut = $2,
             direccion = $3,
             telefono = $4,
             correo = $5
         WHERE id = $6
         RETURNING id, nombre, rut, direccion, telefono, correo, villa_id`,
        [nombre, rut, direccion || null, telefono || null, correo || null, personaId]
      );

      const updated = updateRes.rows[0];

      await registrarLog({
        usuarioId,
        accion: "UPDATE_PERSONA",
        entidad: "PERSONA",
        entidadId: updated.id,
        datosAntes: before,
        datosDespues: updated,
        ip: req.ip || null,
      });

      res.json(updated);
    } catch (err) {
      console.error("Error PUT /api/personas/:id:", err);

      if (err.code === "23505") {
        return res
          .status(409)
          .json({ message: "Ya existe una persona con ese RUT o correo" });
      }

      res.status(500).json({ message: "Error interno del servidor" });
    }
  }
);

/* ==========================================
   DELETE /api/personas/:id  -> eliminar persona
========================================== */
router.delete(
  "/:id",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido")],
  handleValidationErrors,
  async (req, res) => {
    const personaId = parseInt(req.params.id, 10);
    const { rol, villa_id: userVillaId, id: usuarioId } = req.user;
    const isDirigente = rol === "DIRIGENTE";

    try {
      const beforeRes = await pool.query(
        `SELECT 
           p.id, p.nombre, p.rut, p.direccion, p.telefono, p.correo, p.villa_id
         FROM personas p
         WHERE p.id = $1`,
        [personaId]
      );

      if (beforeRes.rowCount === 0) {
        return res.status(404).json({ message: "Persona no encontrada" });
      }

      const before = beforeRes.rows[0];

      if (isDirigente && before.villa_id !== userVillaId) {
        return res
          .status(403)
          .json({ message: "No tienes permiso para eliminar esta persona" });
      }

      const deleteRes = await pool.query("DELETE FROM personas WHERE id = $1", [
        personaId,
      ]);

      if (deleteRes.rowCount === 0) {
        return res.status(404).json({ message: "Persona no encontrada" });
      }

      await registrarLog({
        usuarioId,
        accion: "DELETE_PERSONA",
        entidad: "PERSONA",
        entidadId: before.id,
        datosAntes: before,
        datosDespues: null,
        ip: req.ip || null,
      });

      res.json({ message: "Persona eliminada" });
    } catch (err) {
      console.error("Error DELETE /api/personas/:id:", err);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  }
);

module.exports = router;
