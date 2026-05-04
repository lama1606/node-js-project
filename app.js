const express = require('express');
const path = require('path');

const connectDB = require('./config/database');
const corsMiddleware = require('./config/cors');

const app = express();

app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        next(err);
    }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const httpStatusText = require('./utils/httpStatus');

app.use(corsMiddleware);

const paymentController = require('./controllers/payment.controllers');
app.post(
    '/api/payments/stripe/webhook',
    express.raw({ type: 'application/json' }),
    (req, res) => {
        paymentController
            .stripeWebhook(req, res)
            .catch((err) => {
                if (!res.headersSent) {
                    res.status(500).json({ error: err.message });
                }
            });
    }
);

app.use(express.json());

const coursesRouter = require('./routes/courses.route');
const usersRouter = require('./routes/users.route');
const productsRouter = require('./routes/products.route');
const ordersRouter = require('./routes/orders.route');
const wishlistRouter = require('./routes/wishlist.route');
const reviewRouter = require('./routes/reviews.route');
const cartRouter = require('./routes/cart.route');
const categoriesRouter = require('./routes/categories.route');
const paymentRouter = require('./routes/payments.route');

app.use('/api/courses', coursesRouter);

app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/carts', cartRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/payments', paymentRouter);

app.get('/', (req, res) => {
    res.json({ ok: true, message: 'API is running' });
});

app.all('*path', (req, res, next) => {
    return res.status(404).json({ status: httpStatusText.ERROR, message: 'this resource is not available' });
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
