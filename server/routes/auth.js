// server/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { signToken } = require("../config/jwt");

const bruteforceModule = require("../config/middleware/bruteforce");
const bruteforce = bruteforceModule;
const { registerFailure, clear } = bruteforceModule;

const router = express.Router();

// Healthcheck sencillo
router.get("/health", (req, res) => {
  res.json({ ok: true, service: "auth" });
});

// POST http://localhost:3000/api/auth/login
router.post("/login", bruteforce, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    // Aquí cuenta como intento fallido también
    if (req.bruteforceIdentifier) {
      registerFailure(req.bruteforceIdentifier);
    }

    return res
      .status(400)
      .json({ message: "Email y contraseña son requeridos" });
  }

  try {
    const result = await pool.query(
      `SELECT 
         id, 
         nombre, 
         email, 
         password_hash, 
         rol, 
         villa_id,
         activo
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    const identifier = req.bruteforceIdentifier || email.toLowerCase();

    if (result.rowCount === 0) {
      registerFailure(identifier);
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const user = result.rows[0];

    // Verificar si el usuario está activo
    if (user.activo === false) {
      registerFailure(identifier);
      return res
        .status(403)
        .json({ message: "El usuario se encuentra inactivo" });
    }

    const passwordOk = bcrypt.compareSync(password, user.password_hash);

    if (!passwordOk) {
      registerFailure(identifier);
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Login exitoso => limpiamos contador de intentos
    clear(identifier);

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        villa_id: user.villa_id,
      },
    });
  } catch (err) {
    console.error("Error en /api/auth/login:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

module.exports = router;
