const asyncWrapper = require("../middleware/asyncWrapper");
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const httpStatusText = require('../utils/httpStatus');
const appError = require('../utils/appError');

// ========================
// GET ALL ORDERS (ADMIN)
// ========================
const getAllOrders = asyncWrapper(async (req, res) => {
    const orders = await Order.find()
        .populate('userId', 'firstName lastName email')
        .populate('products.productId');

    res.json({ status: httpStatusText.SUCCESS, data: { orders } });
})

// ========================
// GET MY ORDERS
// ========================
const getMyOrders = asyncWrapper(async (req, res) => {
    const orders = await Order.find({ userId: req.currentUser.id })
        .populate('products.productId');

    res.json({ status: httpStatusText.SUCCESS, data: { orders } });
})

// ========================
// GET SINGLE ORDER
// ========================
const getOrder = asyncWrapper(async (req, res, next) => {
    const order = await Order.findById(req.params.id)
        .populate('userId', 'firstName lastName email')
        .populate('products.productId');

    if (!order) {
        const error = appError.create('order not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    // التأكد إن اليوزر هو صاحب الأوردر أو admin
    if (order.userId._id.toString() !== req.currentUser.id && req.currentUser.role !== 'ADMIN') {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    res.json({ status: httpStatusText.SUCCESS, data: { order } });
})

// ========================
// CREATE ORDER
// ========================
const createOrder = asyncWrapper(async (req, res, next) => {
    const { address, products } = req.body;

    if (!address || !products || products.length === 0) {
        const error = appError.create('address and products are required', 400, httpStatusText.FAIL);
        return next(error);
    }

    // حساب الـ amount من أسعار المنتجات
    let amount = 0;
    for (const item of products) {
        const product = await Product.findById(item.productId);
        if (!product) {
            const error = appError.create(`product ${item.productId} not found`, 404, httpStatusText.FAIL);
            return next(error);
        }
        amount += product.price * (item.quantity || 1);
    }

    const newOrder = new Order({
        userId: req.currentUser.id,
        address,
        products,
        amount
    });

    await newOrder.save();

    res.status(201).json({ status: httpStatusText.SUCCESS, data: { order: newOrder } });
})

// ========================
// UPDATE ORDER STATUS (ADMIN)
// ========================
const updateOrderStatus = asyncWrapper(async (req, res, next) => {
    if (req.currentUser.role !== 'ADMIN') {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
        req.params.id,
        { $set: { status } },
        { new: true }
    );

    if (!order) {
        const error = appError.create('order not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    res.json({ status: httpStatusText.SUCCESS, data: { order } });
})

// ========================
// CANCEL ORDER
// ========================
const cancelOrder = asyncWrapper(async (req, res, next) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        const error = appError.create('order not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    if (order.userId.toString() !== req.currentUser.id) {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    if (order.status !== 'pending') {
        const error = appError.create('only pending orders can be cancelled', 400, httpStatusText.FAIL);
        return next(error);
    }

    order.status = 'cancelled';
    await order.save();

    res.json({ status: httpStatusText.SUCCESS, data: { order } });
})

module.exports = { getAllOrders, getMyOrders, getOrder, createOrder, updateOrderStatus, cancelOrder }