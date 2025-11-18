// server/routes/villas.js
const express = require("express");
const { pool } = require("../config/db");
const {
  authRequired,
  adminOnly,
} = require("../config/middleware/authMiddleware");

const router = express.Router();

// Todos deben estar autenticados
router.use(authRequired);

// ================================
// GET /api/villas  → listado (ADMIN y DIRIGENTE)
// ================================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, cupo_maximo FROM villas ORDER BY nombre"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error GET /api/villas:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// POST /api/villas → Crear villa (solo ADMIN)
// ================================
router.post("/", adminOnly, async (req, res) => {
  const { nombre, cupo_maximo } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: "El nombre es requerido" });
  }

  const cupo = Number.isFinite(Number(cupo_maximo))
    ? Number(cupo_maximo)
    : 0;

  if (cupo < 0) {
    return res
      .status(400)
      .json({ message: "El cupo máximo no puede ser negativo" });
  }

  try {
    const insertRes = await pool.query(
      `INSERT INTO villas (nombre, cupo_maximo)
       VALUES ($1, $2)
       RETURNING id, nombre, cupo_maximo`,
      [nombre, cupo]
    );

    const nueva = insertRes.rows[0];

    // LOG: creación de villa
    await pool.query(
      `INSERT INTO logs (usuario_id, accion, entidad, entidad_id, datos_antes, datos_despues, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.id,
        "CREATE_VILLA",
        "VILLA",
        nueva.id,
        null,
        JSON.stringify(nueva),
        req.ip || null,
      ]
    );

    res.status(201).json(nueva);
  } catch (err) {
    console.error("Error POST /api/villas:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// PUT /api/villas/:id → Editar villa (solo ADMIN)
// ================================
router.put("/:id", adminOnly, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { nombre, cupo_maximo } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: "El nombre es requerido" });
  }

  const cupo = Number.isFinite(Number(cupo_maximo))
    ? Number(cupo_maximo)
    : 0;

  if (cupo < 0) {
    return res
      .status(400)
      .json({ message: "El cupo máximo no puede ser negativo" });
  }

  try {
    // Obtener estado antes
    const beforeRes = await pool.query(
      "SELECT id, nombre, cupo_maximo FROM villas WHERE id = $1",
      [id]
    );

    if (beforeRes.rowCount === 0) {
      return res.status(404).json({ message: "Villa no encontrada" });
    }

    const before = beforeRes.rows[0];

    // Actualizar
    const updateRes = await pool.query(
      `UPDATE villas
       SET nombre = $1,
           cupo_maximo = $2
       WHERE id = $3
       RETURNING id, nombre, cupo_maximo`,
      [nombre, cupo, id]
    );

    const updated = updateRes.rows[0];

    // LOG: actualización
    await pool.query(
      `INSERT INTO logs (usuario_id, accion, entidad, entidad_id, datos_antes, datos_despues, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.id,
        "UPDATE_VILLA",
        "VILLA",
        updated.id,
        JSON.stringify(before),
        JSON.stringify(updated),
        req.ip || null,
      ]
    );

    res.json(updated);
  } catch (err) {
    console.error("Error PUT /api/villas/:id:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// ================================
// DELETE /api/villas/:id → Eliminar villa (solo ADMIN)
// ================================
router.delete("/:id", adminOnly, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    // Obtener estado antes
    const beforeRes = await pool.query(
      "SELECT id, nombre, cupo_maximo FROM villas WHERE id = $1",
      [id]
    );

    if (beforeRes.rowCount === 0) {
      return res.status(404).json({ message: "Villa no encontrada" });
    }

    const before = beforeRes.rows[0];

    // Intentar eliminar
    try {
      await pool.query("DELETE FROM villas WHERE id = $1", [id]);
    } catch (err) {
      // FK violation (tiene dirigentes/personas asociadas)
      if (err.code === "23503") {
        return res.status(409).json({
          message:
            "No se puede eliminar la villa porque tiene registros asociados (por ejemplo dirigentes o personas).",
        });
      }
      throw err;
    }

    // LOG: eliminación
    await pool.query(
      `INSERT INTO logs (usuario_id, accion, entidad, entidad_id, datos_antes, datos_despues, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.id,
        "DELETE_VILLA",
        "VILLA",
        before.id,
        JSON.stringify(before),
        null,
        req.ip || null,
      ]
    );

    res.json({ message: "Villa eliminada correctamente" });
  } catch (err) {
    console.error("Error DELETE /api/villas/:id:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

module.exports = router;
