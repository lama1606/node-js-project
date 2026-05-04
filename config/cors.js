const cors = require('cors');

const raw = process.env.FRONTEND_URL;
const origins = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://localhost:5173'];

const corsOptions = {
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

module.exports = cors(corsOptions);
