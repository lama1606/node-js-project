const express = require('express');
const path = require('path');

const connectDB = require('./config/database');
const corsMiddleware = require('./config/cors');
const getApiRouter = require('./api-bundle');

const app = express();

/** Works without Mongo — use this on Vercel to verify the deployment (see Runtime Logs only if this fails). */
app.get('/health', (req, res) => {
    res.status(200).json({ ok: true, service: 'api', uptime: process.uptime() });
});

/** Root response without DB — isolates “function crashed” vs “Mongo misconfigured”. */
app.get('/', (req, res) => {
    res.status(200).json({
        ok: true,
        message: 'API is running',
        health: 'GET /health',
        mongoConfigured: Boolean(process.env.MONGO_URL_YWAELE || process.env.MONGO_URL),
        note: '/api/* uses MONGO_URL_YWAELE (preferred) or MONGO_URL in Vercel.',
    });
});

// CORS must run before DB connect so OPTIONS preflight always gets Allow-Origin headers.
app.use(corsMiddleware);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const httpStatusText = require('./utils/httpStatus');

const paymentController = require('./controllers/payment.controllers');
app.post(
    '/api/payments/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        try {
            await connectDB();
            await paymentController.stripeWebhook(req, res);
        } catch (err) {
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            }
        }
    }
);

// Lazy routes: parse controllers only after Mongo connects (smaller Vercel cold start).
app.use('/api', async (req, res, next) => {
    try {
        await connectDB();
        getApiRouter()(req, res, (err) => {
            if (err) {
                return next(err);
            }
            next();
        });
    } catch (e) {
        next(e);
    }
});

app.use((req, res) => {
    res.status(404).json({ status: httpStatusText.ERROR, message: 'this resource is not available' });
});

app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({
        status: error.statusText || httpStatusText.ERROR,
        message: error.message,
        code: error.statusCode || 500,
        data: null,
    });
});

module.exports = app;
