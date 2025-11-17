// server/routes/users.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { authRequired, adminOnly } = require("../config/middleware/authMiddleware");
const { body, param, validationResult } = require("express-validator");

const router = express.Router();

// Todas estas rutas requieren admin
router.use(authRequired, adminOnly);

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

/* ==========================================
   GET /api/users  -> lista usuarios con villa (solo activos)
========================================== */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          u.id,
          u.nombre,
          u.email,
          u.rol,
          u.villa_id,
          u.activo,
          v.nombre AS villa_nombre
       FROM users u
       LEFT JOIN villas v ON v.id = u.villa_id
       WHERE u.activo = true
       ORDER BY u.id`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error GET /api/users:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

/* ==========================================
   POST /api/users  -> crear usuario
========================================== */
router.post(
  "/",
  [
    body("nombre")
      .trim()
      .notEmpty()
      .withMessage("El nombre es requerido")
      .isLength({ min: 3 })
      .withMessage("El nombre debe tener al menos 3 caracteres"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("El email es requerido")
      .isEmail()
      .withMessage("Email inválido")
      .normalizeEmail(),
    body("password")
      .notEmpty()
      .withMessage("La contraseña es requerida")
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
    body("rol")
      .trim()
      .notEmpty()
      .withMessage("El rol es requerido")
      .isIn(["ADMIN", "DIRIGENTE"])
      .withMessage("Rol inválido"),
    body("villa_id")
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage("villa_id debe ser un entero válido"),
  ],
  handleValidationErrors,
  async (req, res) => {
    let { nombre, email, password, rol, villa_id } = req.body;

    try {
      if (rol === "DIRIGENTE" && !villa_id) {
        return res
          .status(400)
          .json({ message: "villa_id es requerido para DIRIGENTE" });
      }

      if (rol === "ADMIN") {
        villa_id = null; // Admin global sin villa asociada
      }

      const password_hash = bcrypt.hashSync(password, 10);

      const insertUser = await pool.query(
        `INSERT INTO users (nombre, email, password_hash, rol, villa_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nombre, email, rol, villa_id`,
        [nombre, email, password_hash, rol, villa_id || null]
      );

      const newUser = insertUser.rows[0];

      await registrarLog({
        usuarioId: req.user.id,
        accion: "CREATE_USER",
        entidad: "USER",
        entidadId: newUser.id,
        datosAntes: null,
        datosDespues: newUser,
        ip: req.ip || null,
      });

      res.status(201).json(newUser);
    } catch (err) {
      console.error("Error POST /api/users:", err);
      if (err.code === "23505") {
        // unique_violation (email)
        return res.status(409).json({ message: "Email ya está en uso" });
      }
      res.status(500).json({ message: "Error interno del servidor" });
    }
  }
);

/* ==========================================
   PUT /api/users/:id  -> editar usuario
========================================== */
router.put(
  "/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("ID inválido"),
    body("nombre")
      .trim()
      .notEmpty()
      .withMessage("El nombre es requerido")
      .isLength({ min: 3 })
      .withMessage("El nombre debe tener al menos 3 caracteres"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("El email es requerido")
      .isEmail()
      .withMessage("Email inválido")
      .normalizeEmail(),
    body("rol")
      .trim()
      .notEmpty()
      .withMessage("El rol es requerido")
      .isIn(["ADMIN", "DIRIGENTE"])
      .withMessage("Rol inválido"),
    body("villa_id")
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage("villa_id debe ser un entero válido"),
    body("password")
      .optional({ checkFalsy: true })
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
  ],
  handleValidationErrors,
  async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    let { nombre, email, password, rol, villa_id } = req.body;

    try {
      // Estado anterior
      const beforeRes = await pool.query(
        `SELECT id, nombre, email, rol, villa_id, activo 
         FROM users 
         WHERE id = $1`,
        [userId]
      );
      if (beforeRes.rowCount === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      const before = beforeRes.rows[0];

      if (rol === "DIRIGENTE" && !villa_id) {
        return res
          .status(400)
          .json({ message: "villa_id es requerido para DIRIGENTE" });
      }

      const villaToUse = rol === "ADMIN" ? null : villa_id || null;

      let password_hash = null;
      if (password && password.trim() !== "") {
        password_hash = bcrypt.hashSync(password, 10);
      }

      const updateRes = await pool.query(
        `
        UPDATE users
        SET nombre = $1,
            email = $2,
            rol = $3,
            villa_id = $4,
            password_hash = COALESCE($5, password_hash)
        WHERE id = $6
        RETURNING id, nombre, email, rol, villa_id, activo
      `,
        [nombre, email, rol, villaToUse, password_hash, userId]
      );

      const updated = updateRes.rows[0];

      await registrarLog({
        usuarioId: req.user.id,
        accion: "UPDATE_USER",
        entidad: "USER",
        entidadId: updated.id,
        datosAntes: before,
        datosDespues: updated,
        ip: req.ip || null,
      });

      res.json(updated);
    } catch (err) {
      console.error("Error PUT /api/users/:id:", err);
      if (err.code === "23505") {
        return res.status(409).json({ message: "Email ya está en uso" });
      }
      res.status(500).json({ message: "Error interno del servidor" });
    }
  }
);

/* ==========================================
   DELETE /api/users/:id  -> desactivar usuario (soft delete)
========================================== */
router.delete(
  "/:id",
  [param("id").isInt({ min: 1 }).withMessage("ID inválido")],
  handleValidationErrors,
  async (req, res) => {
    const userId = parseInt(req.params.id, 10);

    try {
      // Estado anterior
      const beforeRes = await pool.query(
        `SELECT id, nombre, email, rol, villa_id, activo
         FROM users
         WHERE id = $1`,
        [userId]
      );

      if (beforeRes.rowCount === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const before = beforeRes.rows[0];

      const updateRes = await pool.query(
        `UPDATE users
         SET activo = false
         WHERE id = $1 AND activo = true`,
        [userId]
      );

      if (updateRes.rowCount === 0) {
        return res
          .status(409)
          .json({ message: "El usuario ya se encuentra inactivo" });
      }

      await registrarLog({
        usuarioId: req.user.id,
        accion: "DEACTIVATE_USER",
        entidad: "USER",
        entidadId: before.id,
        datosAntes: before,
        datosDespues: { ...before, activo: false },
        ip: req.ip || null,
      });

      res.json({ message: "Usuario desactivado correctamente" });
    } catch (err) {
      console.error("Error DELETE /api/users/:id:", err);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  }
);

module.exports = router;
