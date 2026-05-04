const asyncWrapper = require("../middleware/asyncWrapper");
const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const httpStatusText = require('../utils/httpStatus');
const appError = require('../utils/appError');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ========================
// GET ALL PAYMENTS (ADMIN)
// ========================
const getAllPayments = asyncWrapper(async (req, res, next) => {
    if (req.currentUser.role !== 'ADMIN') {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    const payments = await Payment.find().populate('orderId');
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
// CREATE CASH PAYMENT
// ========================
const createCashPayment = asyncWrapper(async (req, res, next) => {
    const { orderId } = req.body;

    if (!orderId) {
        const error = appError.create('orderId is required', 400, httpStatusText.FAIL);
        return next(error);
    }

    const order = await Order.findById(orderId);
    if (!order) {
        const error = appError.create('order not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    if (order.userId.toString() !== req.currentUser.id) {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    const existingPayment = await Payment.findOne({ orderId });
    if (existingPayment) {
        const error = appError.create('payment already exists for this order', 400, httpStatusText.FAIL);
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
// CREATE STRIPE PAYMENT INTENT
// ========================
const createStripePayment = asyncWrapper(async (req, res, next) => {
    const { orderId } = req.body;

    if (!orderId) {
        const error = appError.create('orderId is required', 400, httpStatusText.FAIL);
        return next(error);
    }

    const order = await Order.findById(orderId);
    if (!order) {
        const error = appError.create('order not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    if (order.userId.toString() !== req.currentUser.id) {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    const existingPayment = await Payment.findOne({ orderId });
    if (existingPayment) {
        const error = appError.create('payment already exists for this order', 400, httpStatusText.FAIL);
        return next(error);
    }

    // عمل Payment Intent على Stripe
    const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(order.amount * 100),
    currency: 'egp',
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'  // ← ده اللي هيحل المشكلة
    },
    metadata: {
        orderId: orderId,
        userId: req.currentUser.id
    }
});

    // احفظ الـ payment في الـ DB
    const newPayment = new Payment({
        orderId,
        paymentMethod: 'card',
        amount: order.amount,
        paymentStatus: 'pending',
        transactionId: paymentIntent.id,
        paymentDate: Date.now()
    });

    await newPayment.save();

    res.status(201).json({
        status: httpStatusText.SUCCESS,
        data: {
            clientSecret: paymentIntent.client_secret,
            payment: newPayment
        }
    });
})

// ========================
// CONFIRM STRIPE PAYMENT
// ========================
const confirmStripePayment = asyncWrapper(async (req, res, next) => {
    const { transactionId } = req.body;

    if (!transactionId) {
        const error = appError.create('transactionId is required', 400, httpStatusText.FAIL);
        return next(error);
    }

    // تأكد من الـ payment على Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);

    if (paymentIntent.status === 'succeeded') {
        // حدث الـ payment في الـ DB
        const payment = await Payment.findOneAndUpdate(
            { transactionId },
            { $set: { paymentStatus: 'completed' } },
            { new: true }
        );

        // حدث الـ order status
        await Order.findByIdAndUpdate(
            payment.orderId,
            { $set: { status: 'confirmed' } }
        );

        res.json({ status: httpStatusText.SUCCESS, data: { payment } });
    } else {
        const error = appError.create('payment not confirmed yet', 400, httpStatusText.FAIL);
        return next(error);
    }
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

    if (paymentStatus === 'completed') {
        await Order.findByIdAndUpdate(
            payment.orderId,
            { $set: { status: 'confirmed' } }
        );
    }

    res.json({ status: httpStatusText.SUCCESS, data: { payment } });
})

module.exports = { getAllPayments, getPayment, createCashPayment, createStripePayment, confirmStripePayment, updatePaymentStatus }