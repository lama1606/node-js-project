const express = require('express');
const router = express.Router();
const multer = require('multer');
const productsController = require('../controllers/products.controllers');
const verifyToken = require('../middleware/verifyToken');
const appError = require('../utils/appError');

const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads');
    },
    filename: function (req, file, cb) {
        const ext = file.mimetype.split('/')[1];
        const fileName = `product-${Date.now()}.${ext}`;
        cb(null, fileName);
    }
})

const fileFilter = (req, file, cb) => {
    const imageType = file.mimetype.split('/')[0];
    if (imageType === 'image') {
        return cb(null, true);
    } else {
        return cb(appError.create('file must be an image', 400), false);
    }
}

const upload = multer({ storage: diskStorage, fileFilter });

router.route('/')
    .get(productsController.getAllProducts)
    .post(verifyToken, upload.array('images', 5), productsController.addProduct)
    //                  ^^^^^^^^^^^^^^^^^^^^
    //                  بتقبل لحد 5 صور

router.route('/:id')
    .get(productsController.getProduct)
    .patch(verifyToken, productsController.updateProduct)
    .delete(verifyToken, productsController.deleteProduct)

router.route('/:id/approve')
    .patch(verifyToken, productsController.approveProduct)

module.exports = router;