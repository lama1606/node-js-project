const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviews.controllers');
const verifyToken = require('../middleware/verifyToken');

// get all reviews on a seller
router.route('/seller/:sellerId')
    .get(reviewController.getSellerReviews)

// get seller average rating
router.route('/seller/:sellerId/rating')
    .get(reviewController.getSellerRating)

// add review
router.route('/')
    .post(verifyToken, reviewController.addReview)

// single review
router.route('/:id')
    .get(reviewController.getReview)
    .patch(verifyToken, reviewController.updateReview)
    .delete(verifyToken, reviewController.deleteReview)

module.exports = router;