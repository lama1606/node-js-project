/**
 * Vercel serverless entry — keep in sync with app.js (no app.listen here).
 */
require('dotenv').config();

let handler;
try {
    const serverless = require('serverless-http');
    const app = require('../app');
    handler = serverless(app);
} catch (err) {
    console.error('[api/index] failed to initialize', err);
    handler = function initError(req, res) {
        res.status(500).json({
            ok: false,
            error: 'Server failed to initialize',
            message: err.message,
        });
    };
}

module.exports = handler;
