export const config = {
  api: { bodyParser: false }
};

import formidable from "formidable";
import fs from "fs";

export default async function handler(req, res) {

  // -----------------------------------------------------
  // 🔥 1. CORS
  // -----------------------------------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // -----------------------------------------------------
  // 🔥 2. Construir ruta exacta hacia el backend
  // -----------------------------------------------------
  const backendBase = process.env.API_BASE_URL;
  const targetUrl = backendBase + req.url;

  console.log("\n\n==============================================");
  console.log("📌 PROXY RECIBIÓ PETICIÓN:");
  console.log("➡️ Método:", req.method);
  console.log("➡️ URL destino:", targetUrl);
  console.log("➡️ Headers recibidos:", req.headers);


  try {
    const contentType = req.headers["content-type"] || "";
    const fetchOptions = { method: req.method, headers: {} };

    // -----------------------------------------------------
    // 🔥 3. Procesar cuerpo JSON o multipart
    // -----------------------------------------------------
    if (req.method !== "GET" && req.method !== "HEAD") {

      // --------- MULTIPART ----------
      if (contentType.includes("multipart/form-data")) {

        console.log("📦 Tipo de contenido: multipart/form-data");

        const form = new formidable.IncomingForm({ multiples: true });

        const { fields, files } = await new Promise((resolve, reject) => {
          form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            resolve({ fields, files });
          });
        });

        console.log("📝 Campos recibidos:", fields);
        console.log("📎 Archivos recibidos:", files);

        // Convertir a FormData para reenviar
        const formData = new FormData();

        // Campos
        Object.keys(fields).forEach(k => {
          formData.append(k, fields[k]);
        });

        // Archivos
        for (const key in
