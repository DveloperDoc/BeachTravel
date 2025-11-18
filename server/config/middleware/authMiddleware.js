// server/config/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn(
    "[authMiddleware] ATENCIÓN: JWT_SECRET no está definido en las variables de entorno."
  );
}

// Extrae el token Bearer del header
function getTokenFromHeader(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "").trim();
}

// Debe estar logueado
function authRequired(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({
      message:
        "No se encontró token de autenticación. Inicie sesión nuevamente.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // decoded: { id, nombre, email, rol, villa_id, iat, exp }

    // Normalizar rol
    const rol = (decoded.rol || "").toString().toUpperCase();

    req.user = {
      ...decoded,
      rol,
      isAdmin: rol === "ADMIN",
      isDirigente: rol === "DIRIGENTE",
    };

    next();
  } catch (err) {
    console.error("Error en authRequired (JWT):", err.message);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "La sesión ha expirado. Inicie sesión nuevamente.",
      });
    }

    return res.status(401).json({
      message: "Token inválido. Inicie sesión nuevamente.",
    });
  }
}

// Solo rol ADMIN
function adminOnly(req, res, next) {
  if (!req.user || req.user.rol !== "ADMIN") {
    return res.status(403).json({
      message: "No tiene permisos para acceder a este recurso.",
    });
  }
  next();
}

// Solo rol DIRIGENTE
function dirigenteOnly(req, res, next) {
  if (!req.user || req.user.rol !== "DIRIGENTE") {
    return res.status(403).json({
      message: "Solo los dirigentes pueden realizar esta acción.",
    });
  }
  next();
}

module.exports = {
  authRequired,
  adminOnly,
  dirigenteOnly,
};
