// server/middleware/bruteforce.js

// Mapa en memoria: clave = email/IP, valor = info de intentos
const attempts = new Map();

// Configuración
const WINDOW_MS = 10 * 60 * 1000; // ventana de 10 minutos
const MAX_ATTEMPTS = 5;           // máximo 5 intentos fallidos en la ventana

// Middleware principal
function bruteforce(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const { email, username } = req.body;

  // Identificador: idealmente email; si no, username; si no, IP
  const identifier = (email || username || ip).toLowerCase();
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

  // Guardamos el identificador para que lo use la ruta
  req.bruteforceIdentifier = identifier;

  next();
}

// Registrar intento fallido
function registerFailure(identifier) {
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
  attempts.delete(identifier);
}

module.exports = bruteforce;
module.exports.registerFailure = registerFailure;
module.exports.clear = clear;
