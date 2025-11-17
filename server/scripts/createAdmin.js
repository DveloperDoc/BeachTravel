require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");

async function main() {
  const email = "admin@municipalidad.cl";
  const password = "Admin1234"; // cámbialo después en producción
  const nombre = "Admin Municipal";

  const password_hash = bcrypt.hashSync(password, 10);

  try {
    // Insertar usuario ADMIN con villa_id NULL (admin global)
    await pool.query(
      `INSERT INTO users (email, password_hash, nombre, rol, villa_id)
       VALUES ($1, $2, $3, $4, NULL)
       ON CONFLICT (email) DO NOTHING`,
      [email, password_hash, nombre, "ADMIN"]
    );

    console.log("Usuario admin creado (o ya existía):");
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
  } catch (err) {
    console.error("Error creando admin:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();