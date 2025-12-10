export default async function handler(req, res) {
    console.log("===== NUEVA PETICIÓN AL PROXY =====");
    console.log("🔹 Método:", req.method);
    console.log("🔹 Query.path:", req.query.path);
    console.log("🔹 Headers recibidos:", req.headers);
    console.log("🔹 Body recibido:", req.body);
    // ---- 1. CORS ----
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Responder preflight (OPTIONS) sin hacer proxy
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // ---- 2. Obtener ruta dinámica ----
    const { path } = req.query;
    const fullPath = Array.isArray(path) ? path.join("/") : path;

    // ---- 3. Construir URL del backend ----
    const backendBase = process.env.API_BASE_URL; 
    const targetUrl = `${backendBase}/TM_${fullPath}`;
    
    console.log("➡️ URL final que enviará el proxy:", targetUrl);

    try {
        // ---- 4. Configurar petición ----
        const options = {
            method: req.method,
            headers: {
                ...req.headers,
                host: undefined,
            },
        };

        // Si es POST o PUT, incluir body
        if (req.method !== "GET" && req.method !== "HEAD") {
            options.body = req.body ? JSON.stringify(req.body) : undefined;
            options.headers["Content-Type"] = "application/json";
        }

        // ---- 5. Reenviar petición ----
        const response = await fetch(targetUrl, options);

        // ---- 6. Leer respuesta (texto o json) ----
        const text = await response.text();
        console.log("⬅️ Respuesta backend BODY:", responseText);
        // ---- 7. Pasar el tipo de contenido ----
        res.setHeader(
            "Content-Type",
            response.headers.get("content-type") || "application/json"
        );

        // ---- 8. Devolver al cliente ----
        return res.status(response.status).send(text);

    } catch (error) {
        console.error("Proxy error:", error);

        return res.status(500).json({
            Success: false,
            Message: "Error en el proxy",
            value: null
        });
    }
}
