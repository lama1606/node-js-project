/**
 * Explicit CORS for browsers.
 * FRONTEND_URL: comma-separated origins. Also allows any https://thriftit*.vercel.app for Vercel-only workflow.
 */
function normalizeOrigin(o) {
    if (!o || typeof o !== 'string') return '';
    return o.trim().replace(/\/+$/, '');
}

const DEFAULT_FRONTEND_ORIGINS = ['https://thriftit-murex.vercel.app'];

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
    return [...new Set([...fromEnv, ...DEFAULT_FRONTEND_ORIGINS, ...local])];
}

function isThriftitVercelOrigin(n) {
    return /^https:\/\/thriftit.*\.vercel\.app$/i.test(n);
}

function isOriginAllowed(origin, allowedList) {
    if (!origin) return false;
    const n = normalizeOrigin(origin);
    if (allowedList.includes(n)) return true;
    if (isThriftitVercelOrigin(n)) return true;
    return false;
}

function applyCorsHeaders(req, res) {
    const allowed = parseAllowedOrigins();
    const origin = req.headers.origin;

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
}

function corsMiddleware(req, res, next) {
    if (process.env.VERCEL && !process.env.FRONTEND_URL) {
        console.warn(
            '[cors] FRONTEND_URL is not set — Thriftit *.vercel.app hosts are still allowed by pattern.'
        );
    }

    applyCorsHeaders(req, res);
    next();
}

corsMiddleware.applyCorsHeaders = applyCorsHeaders;
module.exports = corsMiddleware;
