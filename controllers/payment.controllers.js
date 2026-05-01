const asyncWrapper = require("../middleware/asyncWrapper");
const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const httpStatusText = require('../utils/httpStatus');
const appError = require('../utils/appError');
const { getStripe, isStripeEnabled, amountToStripeUnit } = require('../utils/stripeClient');

// ========================
// GET ALL PAYMENTS (ADMIN)
// ========================
const getAllPayments = asyncWrapper(async (req, res, next) => {
    if (req.currentUser.role !== 'ADMIN') {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    const payments = await Payment.find()
        .populate('orderId');

    res.json({ status: httpStatusText.SUCCESS, data: { payments } });
})

// ========================
// GET SINGLE PAYMENT
// ========================
const getPayment = asyncWrapper(async (req, res, next) => {
    const payment = await Payment.findById(req.params.id)
        .populate({
            path: 'orderId',
            populate: {
                path: 'userId',
                select: 'firstName lastName email'
            }
        });

    if (!payment) {
        const error = appError.create('payment not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    res.json({ status: httpStatusText.SUCCESS, data: { payment } });
})

// ========================
// CREATE PAYMENT
// ========================
const createPayment = asyncWrapper(async (req, res, next) => {
    const { orderId, paymentMethod } = req.body;

    if (!orderId || !paymentMethod) {
        const error = appError.create('orderId and paymentMethod are required', 400, httpStatusText.FAIL);
        return next(error);
    }

    // تأكد إن الأوردر موجود
    const order = await Order.findById(orderId);
    if (!order) {
        const error = appError.create('order not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    // تأكد إن الأوردر تاع اليوزر ده
    if (order.userId.toString() !== req.currentUser.id) {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    // تأكد إن الأوردر مش عنده payment بالفعل
    const existingPayment = await Payment.findOne({ orderId });
    if (existingPayment) {
        const error = appError.create('payment already exists for this order', 400, httpStatusText.FAIL);
        return next(error);
    }

    if (paymentMethod === 'card') {
        const error = appError.create(
            'card payments use the Stripe flow: POST /api/payments/stripe/create-intent with orderId',
            400,
            httpStatusText.FAIL
        );
        return next(error);
    }
    if (paymentMethod !== 'cash') {
        const error = appError.create('use paymentMethod "cash" here, or use Stripe for card', 400, httpStatusText.FAIL);
        return next(error);
    }

    const newPayment = new Payment({
        orderId,
        paymentMethod: 'cash',
        amount: order.amount,
        paymentStatus: 'pending',
        paymentDate: Date.now()
    });

    await newPayment.save();

    res.status(201).json({ status: httpStatusText.SUCCESS, data: { payment: newPayment } });
})

// ========================
// UPDATE PAYMENT STATUS (ADMIN)
// ========================
const updatePaymentStatus = asyncWrapper(async (req, res, next) => {
    if (req.currentUser.role !== 'ADMIN') {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    const { paymentStatus } = req.body;

    const payment = await Payment.findByIdAndUpdate(
        req.params.id,
        { $set: { paymentStatus } },
        { new: true }
    );

    if (!payment) {
        const error = appError.create('payment not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    // لو الـ payment اتكمل، غير status الأوردر لـ confirmed
    if (paymentStatus === 'completed') {
        await Order.findByIdAndUpdate(payment.orderId, { $set: { status: 'confirmed' } });
    }

    res.json({ status: httpStatusText.SUCCESS, data: { payment } });
})

// ========================
// STRIPE: CREATE PAYMENT INTENT (CARD)
// ========================
const createStripePaymentIntent = asyncWrapper(async (req, res, next) => {
    if (!isStripeEnabled()) {
        return next(
            appError.create(
                'Stripe is not configured. Set STRIPE_SECRET_KEY in .env (test key starts with sk_test_)',
                503,
                httpStatusText.FAIL
            )
        );
    }
    const stripe = getStripe();
    const { orderId } = req.body;

    if (!orderId) {
        return next(appError.create('orderId is required', 400, httpStatusText.FAIL));
    }

    const order = await Order.findById(orderId);
    if (!order) {
        return next(appError.create('order not found', 404, httpStatusText.FAIL));
    }
    if (order.userId.toString() !== req.currentUser.id) {
        return next(appError.create('you are not authorized', 403, httpStatusText.FAIL));
    }

    const existingPayment = await Payment.findOne({ orderId });
    if (existingPayment) {
        if (existingPayment.stripePaymentIntentId && existingPayment.paymentStatus === 'pending') {
            const intent = await stripe.paymentIntents.retrieve(existingPayment.stripePaymentIntentId);
            return res.status(200).json({
                status: httpStatusText.SUCCESS,
                data: {
                    clientSecret: intent.client_secret,
                    paymentId: existingPayment._id,
                    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null
                }
            });
        }
        return next(appError.create('payment already exists for this order', 400, httpStatusText.FAIL));
    }

    const newPayment = new Payment({
        orderId,
        paymentMethod: 'card',
        amount: order.amount,
        paymentStatus: 'pending',
        paymentDate: new Date()
    });
    await newPayment.save();

    const currency = (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
    const amountStripe = amountToStripeUnit(order.amount);
    // Stripe minimum e.g. USD: 50 ($0.50)
    const minAmount = currency === 'usd' ? 50 : 1;
    if (amountStripe < minAmount) {
        await Payment.findByIdAndDelete(newPayment._id);
        return next(
            appError.create(
                `order total is too small to charge in ${currency} (increase amount or use another currency)`,
                400,
                httpStatusText.FAIL
            )
        );
    }

    try {
        const intent = await stripe.paymentIntents.create({
            amount: amountStripe,
            currency,
            automatic_payment_methods: { enabled: true },
            metadata: {
                orderId: order._id.toString(),
                paymentId: newPayment._id.toString()
            }
        });

        newPayment.stripePaymentIntentId = intent.id;
        await newPayment.save();

        res.status(201).json({
            status: httpStatusText.SUCCESS,
            data: {
                clientSecret: intent.client_secret,
                paymentId: newPayment._id,
                paymentIntentId: intent.id,
                publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null
            }
        });
    } catch (err) {
        await Payment.findByIdAndDelete(newPayment._id);
        return next(
            appError.create(err.message || 'Stripe could not create payment', 500, httpStatusText.ERROR)
        );
    }
});

// ========================
// STRIPE: WEBHOOK (raw body — use express.raw in index.js)
// ========================
const stripeWebhook = async (req, res) => {
    if (!isStripeEnabled()) {
        return res.status(503).json({ error: 'Stripe not configured' });
    }
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!whSecret) {
        return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET missing' });
    }
    const stripe = getStripe();
    let event;
    try {
        const sig = req.headers['stripe-signature'];
        event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'payment_intent.succeeded') {
            const pi = event.data.object;
            const paymentId = pi.metadata && pi.metadata.paymentId;
            if (paymentId) {
                const payment = await Payment.findById(paymentId);
                if (payment && payment.paymentStatus !== 'completed') {
                    payment.paymentStatus = 'completed';
                    await payment.save();
                    await Order.findByIdAndUpdate(payment.orderId, { $set: { status: 'confirmed' } });
                }
            }
        } else if (event.type === 'payment_intent.payment_failed') {
            const pi = event.data.object;
            const paymentId = pi.metadata && pi.metadata.paymentId;
            if (paymentId) {
                await Payment.findByIdAndUpdate(paymentId, { $set: { paymentStatus: 'failed' } });
            }
        }
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }

    return res.json({ received: true });
};

module.exports = {
    getAllPayments,
    getPayment,
    createPayment,
    updatePaymentStatus,
    createStripePaymentIntent,
    stripeWebhook
}