export default async function handler(req, res) {
    // 1. Obtener toda la ruta solicitada
    const { path } = req.query;

    // 2. Reconstruir el path completo (porque path puede ser array)
    const fullPath = Array.isArray(path) ? path.join("/") : path;

    // 2. Construir URL del backend real
    const backendBase = process.env.API_BASE_URL; // Ej: https://tu-api.com/
    const targetUrl = `${backendBase}/TM_${fullPath}`;

    try {
        // 4. Preparar opciones para reenviar la petición
        const options = {
            method: req.method,
            headers: {
                ...req.headers,
                host: undefined, // evitar conflictos
            },
        };

        // Si hay body (POST, PUT), reenviarlo
        if (req.method !== "GET" && req.method !== "HEAD") {
            options.body = req.body ? JSON.stringify(req.body) : undefined;
            options.headers["Content-Type"] = "application/json";
        }

        // 5. Realizar petición al backend original
        const response = await fetch(targetUrl, options);

        // 6. Obtener contenido (puede ser JSON o texto)
        const text = await response.text();

        // 7. Ajustar el tipo de contenido
        res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");

        // 8. Devolver la respuesta al cliente
        res.status(response.status).send(text);

    } catch (error) {
        console.error("Proxy error:", error);

        return res.status(500).json({
            Success: false,
            Message: "Error en el proxy",
            value: null
        });
    }
}
