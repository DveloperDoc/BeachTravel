// server/middleware/bruteforce.js

// Mapa en memoria: clave = identificador (email/username/IP), valor = info de intentos
const attempts = new Map();

// Configuración
const WINDOW_MS = 10 * 60 * 1000; // ventana de 10 minutos
const MAX_ATTEMPTS = 5;           // máximo 5 intentos fallidos en la ventana

// Obtener IP real (pensando en proxys como Render)
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff && typeof xff === "string") {
    // Primer IP de la cadena
    return xff.split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "unknown";
}

// Middleware principal
function bruteforce(req, res, next) {
  const ip = getClientIp(req);
  const { email, username } = req.body || {};

  // Identificador: idealmente email; si no, username; si no, IP
  const identifier = (email || username || ip || "unknown").toString().toLowerCase();
  const now = Date.now();

  let record = attempts.get(identifier);

  if (record) {
    // Si pasó la ventana, reseteamos contador
    if (now - record.firstAttempt > WINDOW_MS) {
      record = null;
      attempts.delete(identifier);
    }
  }

  if (!record) {
    record = {
      attempts: 0,
      firstAttempt: now,
      blockedUntil: null,
    };
    attempts.set(identifier, record);
  }

  // Si está bloqueado
  if (record.blockedUntil && now < record.blockedUntil) {
    return res.status(429).json({
      message: "Demasiados intentos fallidos. Intente nuevamente más tarde.",
    });
  }

  // Guardamos el identificador para que lo use la ruta de login
  req.bruteforceIdentifier = identifier;

  next();
}

// Registrar intento fallido
function registerFailure(identifier) {
  if (!identifier) return;

  const now = Date.now();
  let record = attempts.get(identifier);

  if (!record) {
    record = {
      attempts: 0,
      firstAttempt: now,
      blockedUntil: null,
    };
  }

  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.blockedUntil = now + WINDOW_MS;
    console.warn(
      `[BRUTEFORCE] Bloqueado ${identifier} por demasiados intentos fallidos`
    );
  }

  attempts.set(identifier, record);
}

// Limpiar registro al éxito
function clear(identifier) {
  if (!identifier) return;
  attempts.delete(identifier);
}

// Mantengo compatibilidad con cómo lo vienes usando
module.exports = bruteforce;
module.exports.registerFailure = registerFailure;
module.exports.clear = clear;
