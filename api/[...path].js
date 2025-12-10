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
        for (const key in files) {
          const f = Array.isArray(files[key]) ? files[key][0] : files[key];
          const buffer = fs.readFileSync(f.filepath);

          formData.append(
            key,
            new Blob([buffer], { type: f.mimetype }),
            f.originalFilename
          );
        }

        fetchOptions.body = formData;

        console.log("📤 FormData listo para enviar al backend.");
      }

      // --------- JSON ----------
      else {
        console.log("📦 Tipo de contenido: JSON / texto");

        const raw = await new Promise(resolve => {
          let data = "";
          req.on("data", chunk => data += chunk);
          req.on("end", () => resolve(data));
        });

        console.log("📥 Cuerpo recibido RAW:", raw);
        fetchOptions.body = raw;

        // Mantener el header original
        fetchOptions.headers["Content-Type"] = contentType;
      }
    }

    // -----------------------------------------------------
    // 🔥 4. Reenviar petición al backend
    // -----------------------------------------------------
    console.log("🚀 Enviando al backend:", targetUrl);

    const backendResponse = await fetch(targetUrl, fetchOptions);

    const respText = await backendResponse.text();

    console.log("📨 Respuesta del backend (status " + backendResponse.status + "):");
    console.log(respText);

    // -----------------------------------------------------
    // 🔥 5. Enviar respuesta tal cual al cliente
    // -----------------------------------------------------
    res.setHeader("Content-Type", backendResponse.headers.get("content-type") || "application/json");
    return res.status(backendResponse.status).send(respText);

  } catch (err) {
    console.error("❌ Error en proxy:", err);
    return res.status(500).json({ Success: false, Message: "Error en el proxy" });
  }
}
