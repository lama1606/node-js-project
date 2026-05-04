/**
 * Explicit CORS for browsers. The `cors` package often omits Access-Control-Allow-Origin
 * when the origin is not in the list—browsers then report "no header" on preflight.
 *
 * Set FRONTEND_URL on Vercel to your Thriftit origin, e.g.:
 *   https://thriftit-murex.vercel.app
 * Comma-separate multiple origins. No trailing slash.
 */
function normalizeOrigin(o) {
    if (!o || typeof o !== 'string') return '';
    return o.trim().replace(/\/+$/, '');
}

function parseAllowedOrigins() {
    const raw = process.env.FRONTEND_URL || '';
    const fromEnv = raw
        .split(',')
        .map((s) => normalizeOrigin(s))
        .filter(Boolean);
    const local = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4000',
        'http://127.0.0.1:4000',
    ];
    return [...new Set([...fromEnv, ...local])];
}

function isOriginAllowed(origin, allowedList) {
    if (!origin) return false;
    return allowedList.includes(normalizeOrigin(origin));
}

function corsMiddleware(req, res, next) {
    const allowed = parseAllowedOrigins();
    const origin = req.headers.origin;

    if (process.env.VERCEL && !process.env.FRONTEND_URL) {
        console.warn(
            '[cors] FRONTEND_URL is not set on Vercel — browser CORS will fail. Set it to your frontend origin (e.g. https://thriftit-murex.vercel.app).'
        );
    }

    if (origin && isOriginAllowed(origin, allowed)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        );
        res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-Requested-With'
        );
        res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
}

module.exports = corsMiddleware;
