// api/[...path].js
// Proxy catch-all para Vercel (Node 18+)
const allowedOrigins = ['*']; // ajusta si quieres restringir CORS

const TARGET = process.env.TARGET_BASE_URL; // ej. http://200.188.143.250:9062
const REQUIRED_API_KEY = process.env.PROXY_API_KEY || null; // opcional

function joinPaths(base, path) {
  if (!base.endsWith('/')) base = base + '/';
  if (path.startsWith('/')) path = path.slice(1);
  return base + path;
}

export default async function handler(req, res) {
  try {
    // Opcional: proteger el proxy con una API key enviada en header 'x-api-key'
    if (REQUIRED_API_KEY) {
      const key = req.headers['x-api-key'] || req.query['x-api-key'];
      if (!key || key !== REQUIRED_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    if (!TARGET) {
      return res.status(500).json({ error: 'Target not configured' });
    }

    // Construir URL destino (mantener query string)
    const pathParts = req.query.path || [];
    // Vercel pasa los segmentos capturados en req.query.path cuando el archivo se llama [...path].js
    const targetPath = Array.isArray(pathParts) ? pathParts.join('/') : pathParts;
    const search = Object.keys(req.query)
      .filter(k => k !== 'path')
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(req.query[k])}`)
      .join('&');
    const url = joinPaths(TARGET, targetPath) + (search ? `?${search}` : '');

    // Preparar headers: reenvía la mayoría, pero evita hop-by-hop headers
    const outgoingHeaders = {};
    for (const h in req.headers) {
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(h)) continue;
      outgoingHeaders[h] = req.headers[h];
    }
    // Forzar content-type si viene en req
    if (req.headers['content-type']) outgoingHeaders['content-type'] = req.headers['content-type'];

    // Obtener body: para Vercel serverless en Node 18, req.body ya viene parseado si JSON; en otros casos leer raw
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Si body ya está en req.body (parseado por Vercel), stringify si es objeto y content-type application/json
      if (req.body && typeof req.body === 'object' && outgoingHeaders['content-type'] && outgoingHeaders['content-type'].includes('application/json')) {
        body = JSON.stringify(req.body);
      } else if (req.body && typeof req.body === 'string') {
        body = req.body;
      } else {
        // leer el stream RAW
        body = await new Promise((resolve, reject) => {
          let data = [];
          req.on('data', chunk => data.push(chunk));
          req.on('end', () => resolve(Buffer.concat(data)));
          req.on('error', reject);
        });
      }
    }

    // Ejecutar fetch al backend (usa fetch global)
    const fetchOptions = {
      method: req.method,
      headers: outgoingHeaders,
      body: body && body.length === 0 ? undefined : body,
      redirect: 'manual'
    };

    const upstream = await fetch(url, fetchOptions);

    // Reenviar headers relevantes al cliente (no todos)
    upstream.headers.forEach((value, key) => {
      // evita sobreescribir seguridad del proxy
      if (['transfer-encoding', 'content-encoding', 'connection'].includes(key)) return;
      res.setHeader(key, value);
    });

    // Manejar CORS para el navegador (tu app Cordova también usa esto)
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(','));
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    // OPTIONS preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    // Pasar el body y status
    const respBuffer = await upstream.arrayBuffer();
    res.status(upstream.status);
    return res.send(Buffer.from(respBuffer));
  } catch (err) {
    console.error('Proxy error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(502).json({ error: 'Bad gateway', detail: String(err) });
  }
}
