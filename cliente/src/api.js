// client/src/api.js

// Solo usar la URL entregada por Render.
// No incluir fallback a localhost para evitar errores de producción.
const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;

  const newOptions = {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  };

  // Solo agregar Content-Type si hay body JSON
  if (options.body && typeof options.body === "object") {
    newOptions.headers["Content-Type"] = "application/json";
    newOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, newOptions);
  return res;
};
