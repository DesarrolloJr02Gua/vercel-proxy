export const config = {
  api: { bodyParser: false }
};

import formidable from "formidable";
import fs from "fs";

export default async function handler(req, res) {

  // ----- CORS ------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // 🔥 RUTA EXACTA que llegó al proxy (sin modificar)
  const backendBase = process.env.API_BASE_URL; 
  const targetUrl = backendBase + req.url;

  console.log("➡️ Enviando al backend:", targetUrl);

  try {
    const contentType = req.headers["content-type"] || "";
    const fetchOptions = { method: req.method, headers: {} };

    // -------- JSON o multipart --------
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (contentType.includes("multipart/form-data")) {
        const form = new formidable.IncomingForm({ multiples: true });
        const { fields, files } = await new Promise((resolve, reject) => {
          form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            resolve({ fields, files });
          });
        });

        // Convertir a FormData para reenviar
        const formData = new FormData();
        Object.keys(fields).forEach(k => formData.append(k, fields[k]));

        for (const key in files) {
          const f = Array.isArray(files[key]) ? files[key][0] : files[key];
          const buffer = fs.readFileSync(f.filepath);
          formData.append(key, new Blob([buffer], { type: f.mimetype }), f.originalFilename);
        }

        fetchOptions.body = formData;
      }
      else {
        const raw = await new Promise(resolve => {
          let data = "";
          req.on("data", chunk => data += chunk);
          req.on("end", () => resolve(data));
        });

        fetchOptions.body = raw;
        fetchOptions.headers["Content-Type"] = "application/json";
      }
    }

    // -------- PROXY REQUEST --------
    const backendResponse = await fetch(targetUrl, fetchOptions);
    const text = await backendResponse.text();

    res.setHeader("Content-Type", backendResponse.headers.get("content-type") || "application/json");
    return res.status(backendResponse.status).send(text);

  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ Success: false, Message: "Error en el proxy" });
  }
}
