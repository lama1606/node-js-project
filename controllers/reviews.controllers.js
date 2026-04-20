const asyncWrapper = require("../middleware/asyncWrapper");
const Review = require('../models/review.model');
const Order = require('../models/order.model');
const httpStatusText = require('../utils/httpStatus');
const appError = require('../utils/appError');

// ========================
// GET ALL REVIEWS ON A SELLER
// ========================
const getSellerReviews = asyncWrapper(async (req, res, next) => {
    const { sellerId } = req.params;

    const reviews = await Review.find({ sellerId })
        .populate('buyerId', 'firstName lastName')
        .populate('productId', 'productName price')
        .populate('orderId');

    res.json({ status: httpStatusText.SUCCESS, data: { reviews } });
})

// ========================
// GET SINGLE REVIEW
// ========================
const getReview = asyncWrapper(async (req, res, next) => {
    const review = await Review.findById(req.params.id)
        .populate('buyerId', 'firstName lastName')
        .populate('sellerId', 'firstName lastName')
        .populate('productId', 'productName price')
        .populate('orderId');

    if (!review) {
        const error = appError.create('review not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    res.json({ status: httpStatusText.SUCCESS, data: { review } });
})

// ========================
// ADD REVIEW
// ========================
const addReview = asyncWrapper(async (req, res, next) => {
    const { sellerId, orderId, productId, rating, comment } = req.body;

    if (!sellerId || !orderId || !productId || !rating) {
        const error = appError.create('sellerId, orderId, productId and rating are required', 400, httpStatusText.FAIL);
        return next(error);
    }

    // تأكد إن الـ rating بين 1 و 5
    if (rating < 1 || rating > 5) {
        const error = appError.create('rating must be between 1 and 5', 400, httpStatusText.FAIL);
        return next(error);
    }

    // تأكد إن الأوردر موجود وتاع المشتري
    const order = await Order.findOne({
        _id: orderId,
        userId: req.currentUser.id,
        status: 'delivered'
    });

    if (!order) {
        const error = appError.create('you can only review after receiving your order', 400, httpStatusText.FAIL);
        return next(error);
    }

    // تأكد إن المشتري مش عمل review قبل كده على نفس الأوردر
    const existingReview = await Review.findOne({
        orderId,
        buyerId: req.currentUser.id,
        productId
    });

    if (existingReview) {
        const error = appError.create('you already reviewed this product', 400, httpStatusText.FAIL);
        return next(error);
    }

    const newReview = new Review({
        sellerId,
        buyerId: req.currentUser.id,
        orderId,
        productId,
        rating,
        comment,
        isVerified: true
    });

    await newReview.save();

    res.status(201).json({ status: httpStatusText.SUCCESS, data: { review: newReview } });
})

// ========================
// UPDATE REVIEW
// ========================
const updateReview = asyncWrapper(async (req, res, next) => {
    const review = await Review.findById(req.params.id);

    if (!review) {
        const error = appError.create('review not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    // تأكد إن اليوزر هو صاحب الـ review
    if (review.buyerId.toString() !== req.currentUser.id) {
        const error = appError.create('you are not authorized to update this review', 403, httpStatusText.FAIL);
        return next(error);
    }

    const { rating, comment } = req.body;

    if (rating && (rating < 1 || rating > 5)) {
        const error = appError.create('rating must be between 1 and 5', 400, httpStatusText.FAIL);
        return next(error);
    }

    const updatedReview = await Review.findByIdAndUpdate(
        req.params.id,
        { $set: { rating, comment } },
        { new: true }
    );

    res.json({ status: httpStatusText.SUCCESS, data: { review: updatedReview } });
})

// ========================
// DELETE REVIEW
// ========================
const deleteReview = asyncWrapper(async (req, res, next) => {
    const review = await Review.findById(req.params.id);

    if (!review) {
        const error = appError.create('review not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    if (review.buyerId.toString() !== req.currentUser.id && req.currentUser.role !== 'admin') {
        const error = appError.create('you are not authorized to delete this review', 403, httpStatusText.FAIL);
        return next(error);
    }

    await Review.findByIdAndDelete(req.params.id);

    res.json({ status: httpStatusText.SUCCESS, data: null });
})

// ========================
// GET AVERAGE RATING FOR SELLER
// ========================
const getSellerRating = asyncWrapper(async (req, res) => {
    const { sellerId } = req.params;

    const result = await Review.aggregate([
        { $match: { sellerId: require('mongoose').Types.ObjectId(sellerId) } },
        { $group: { _id: '$sellerId', averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
    ]);

    const rating = result[0] || { averageRating: 0, totalReviews: 0 };

    res.json({ status: httpStatusText.SUCCESS, data: { rating } });
})

module.exports = { getSellerReviews, getReview, addReview, updateReview, deleteReview, getSellerRating }