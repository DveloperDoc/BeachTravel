// server/config/db.js
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[DB] No se encontró DATABASE_URL en las variables de entorno");
}

const isLocal =
  connectionString &&
  (connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1"));

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

module.exports = { pool };
