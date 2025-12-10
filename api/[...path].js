export const config = {
  api: {
    bodyParser: false, // ❗ Necesario para multipart/form-data
  }
};

import formidable from "formidable";
import fs from "fs";

// Convierte req a FormData en fetch()
async function convertToFormData(fields, files) {
  const form = new FormData();

  // Campos normales
  for (const key in fields) {
    form.append(key, fields[key]);
  }

  // Archivos
  for (const key in files) {
    const file = files[key];

    // formidable devuelve arrays
    const f = Array.isArray(file) ? file[0] : file;

    const buffer = fs.readFileSync(f.filepath);

    form.append(
      key,
      new Blob([buffer], { type: f.mimetype }),
      f.originalFilename
    );
  }

  return form;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Ruta reconstruida
  const { path } = req.query;
  const fullPath = Array.isArray(path) ? path.join("/") : path;

  const backendBase = process.env.API_BASE_URL; 
  const targetUrl = `${backendBase}/TM_${fullPath}`;

  console.log("➡️ Enviando al backend:", targetUrl);

  try {
    let fetchOptions = { method: req.method };

    // --- JSON o multipart ---
    if (req.method !== "GET" && req.method !== "HEAD") {
      const contentType = req.headers["content-type"] || "";

      if (contentType.includes("multipart/form-data")) {
        // --- Parsear el formdata ---
        const form = new formidable.IncomingForm({ multiples: true });

        const { fields, files } = await new Promise((resolve, reject) => {
          form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            resolve({ fields, files });
          });
        });

        fetchOptions.body = await convertToFormData(fields, files);

      } else {
        // --- JSON normal ---
        const body = await new Promise(resolve => {
          let raw = "";
          req.on("data", chunk => raw += chunk);
          req.on("end", () => resolve(raw));
        });

        fetchOptions.body = body;
        fetchOptions.headers = {
          "Content-Type": "application/json",
        };
      }
    }

    // Hacer proxy
    const backendResponse = await fetch(targetUrl, fetchOptions);
    const text = await backendResponse.text();

    res.setHeader("Content-Type", backendResponse.headers.get("content-type") || "application/json");
    return res.status(backendResponse.status).send(text);

  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({
      Success: false,
      Message: "Error en el proxy",
    });
  }
}
