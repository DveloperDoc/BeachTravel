// server/config/jwt.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "cambia_esto_en_produccion";
const JWT_EXPIRES_IN = "8h"; // ajustable: 1h, 12h, 1d, etc.

function signToken(user) {
  // Solo lo necesario en el payload
  const payload = {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    villa_id: user.villa_id ?? null,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  signToken,
  verifyToken,
};
