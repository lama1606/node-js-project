const asyncWrapper = require("../middleware/asyncWrapper");
const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const httpStatusText = require('../utils/httpStatus');
const appError = require('../utils/appError');

// ========================
// GET ALL PAYMENTS (ADMIN)
// ========================
const getAllPayments = asyncWrapper(async (req, res, next) => {
    if (req.currentUser.role !== 'admin') {
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

    const newPayment = new Payment({
        orderId,
        paymentMethod,
        amount: order.amount,
        paymentStatus: paymentMethod === 'cash' ? 'pending' : 'completed',
        paymentDate: Date.now()
    });

    await newPayment.save();

    // لو الدفع بكارت، غير status الأوردر لـ confirmed
    if (paymentMethod === 'card') {
        await Order.findByIdAndUpdate(orderId, { $set: { status: 'confirmed' } });
    }

    res.status(201).json({ status: httpStatusText.SUCCESS, data: { payment: newPayment } });
})

// ========================
// UPDATE PAYMENT STATUS (ADMIN)
// ========================
const updatePaymentStatus = asyncWrapper(async (req, res, next) => {
    if (req.currentUser.role !== 'admin') {
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

module.exports = { getAllPayments, getPayment, createPayment, updatePaymentStatus }