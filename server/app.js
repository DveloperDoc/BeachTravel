// server/app.js
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

//==============================
// 1. Configuración CORS segura
//==============================
const NODE_ENV = process.env.NODE_ENV || "production";

const allowedOrigins = [
  "https://beachtravelmdc.onrender.com", // FRONTEND en Render
  "http://localhost:5173",               // FRONTEND local (Vite)
  process.env.REMOTE_CLIENT_APP,
  process.env.LOCAL_CLIENT_APP,
].filter(Boolean); // quita undefined/null

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // permite Postman, curl, health
    if (allowedOrigins.includes(origin)) return callback(null, true);

    console.warn("[CORS] Origin bloqueado:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
};

//====================================
// 2. Helmet endurecido (seguridad HTTP)
//====================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));
app.use(helmet.frameguard({ action: "sameorigin" }));
app.use(helmet.noSniff());

//==============================
// 3. Rate limit global de API
//==============================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas solicitudes desde esta IP, intenta más tarde.",
  },
});

app.use("/api", apiLimiter);

//==============================
// 4. Middlewares base
//==============================
app.use(express.json());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // manejo de preflight

//==============================
// 5. Rutas API
//==============================
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/personas", require("./routes/personas"));
app.use("/api/users", require("./routes/users"));
app.use("/api/villas", require("./routes/villas"));

//==============================
// 6. Ruta de health-check
//==============================
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API funcionando" });
});

//==============================
// 7. Servir frontend SOLO si existe dist
//==============================
if (NODE_ENV === "production") {
  const clientPath = path.join(__dirname, "..", "client", "dist");
  const indexPath = path.join(clientPath, "index.html");

  if (fs.existsSync(indexPath)) {
    console.log("[APP] Detectado client/dist, sirviendo frontend estático");
    app.use(express.static(clientPath));

    app.get("*", (req, res) => {
      res.sendFile(indexPath);
    });
  } else {
    console.log(
      "[APP] client/dist no encontrado, no se sirve frontend desde el backend"
    );
  }
}

//==============================
// 8. Levantar servidor
//==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor escuchando en puerto", PORT);
});
