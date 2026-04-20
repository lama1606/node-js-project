const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controllers');
const verifyToken = require('../middleware/verifyToken');

router.route('/')
    .get(verifyToken, paymentController.getAllPayments)
    .post(verifyToken, paymentController.createPayment)

router.route('/:id')
    .get(verifyToken, paymentController.getPayment)
    .patch(verifyToken, paymentController.updatePaymentStatus)

module.exports = router;