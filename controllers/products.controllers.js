const asyncWrapper = require("../middleware/asyncWrapper");
const Product = require('../models/product.model');
const ProductImage = require('../models/productImg.model');
const httpStatusText = require('../utils/httpStatus');
const appError = require('../utils/appError');

// ========================
// GET ALL PRODUCTS
// ========================
const getAllProducts = asyncWrapper(async (req, res) => {
    const query = req.query;
    const limit = query.limit || 10;
    const page = query.page || 1;
    const skip = (page - 1) * limit;

    const products = await Product.find({ isApproved: true }, { "__v": false })
        .populate('userId', 'firstName lastName email')
        .limit(limit)
        .skip(skip);

    // جيب صور كل منتج
    const productsWithImages = await Promise.all(products.map(async (product) => {
        const images = await ProductImage.find({ productId: product._id }, { "__v": false });
        return { ...product.toObject(), images };
    }));

    res.json({ status: httpStatusText.SUCCESS, data: { products: productsWithImages } });
})

// ========================
// GET SINGLE PRODUCT
// ========================
const getProduct = asyncWrapper(async (req, res, next) => {
    const product = await Product.findById(req.params.id)
        .populate('userId', 'firstName lastName email');

    if (!product) {
        const error = appError.create('product not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    // جيب صور المنتج
    const images = await ProductImage.find({ productId: product._id }, { "__v": false });

    res.json({ status: httpStatusText.SUCCESS, data: { product: { ...product.toObject(), images } } });
})

// ========================
// ADD PRODUCT
// ========================
const addProduct = asyncWrapper(async (req, res, next) => {
    const { categoryName, productName, description, price, condition, size, brand, material, color } = req.body;

    if (!categoryName || !productName || !description || !price || !condition) {
        const error = appError.create('categoryName, productName, description, price and condition are required', 400, httpStatusText.FAIL);
        return next(error);
    }

    // لازم يكون فيه صورة واحدة على الأقل
    if (!req.files || req.files.length === 0) {
        const error = appError.create('at least one image is required', 400, httpStatusText.FAIL);
        return next(error);
    }

    // احفظ المنتج
    const newProduct = new Product({
        userId: req.currentUser.id,
        categoryName,
        productName,
        description,
        price,
        condition,
        size,
        brand,
        material,
        color
    });

    await newProduct.save();

    // احفظ الصور في ProductImages
    const images = await Promise.all(req.files.map(async (file) => {
        const productImage = new ProductImage({
            productId: newProduct._id,
            imageURL: file.filename
        });
        await productImage.save();
        return productImage;
    }));

    res.status(201).json({ status: httpStatusText.SUCCESS, data: { product: newProduct, images } });
})

// ========================
// UPDATE PRODUCT
// ========================
const updateProduct = asyncWrapper(async (req, res, next) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        const error = appError.create('product not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    if (product.userId.toString() !== req.currentUser.id) {
        const error = appError.create('you are not authorized to update this product', 403, httpStatusText.FAIL);
        return next(error);
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: { ...req.body } },
        { new: true }
    );

    res.json({ status: httpStatusText.SUCCESS, data: { product: updatedProduct } });
})

// ========================
// DELETE PRODUCT
// ========================
const deleteProduct = asyncWrapper(async (req, res, next) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        const error = appError.create('product not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    if (product.userId.toString() !== req.currentUser.id && req.currentUser.role !== 'ADMIN') {
        const error = appError.create('you are not authorized to delete this product', 403, httpStatusText.FAIL);
        return next(error);
    }

    // امسح المنتج وصوره
    await ProductImage.deleteMany({ productId: req.params.id });
    await Product.findByIdAndDelete(req.params.id);

    res.json({ status: httpStatusText.SUCCESS, data: null });
})

// ========================
// APPROVE PRODUCT (ADMIN)
// ========================
const approveProduct = asyncWrapper(async (req, res, next) => {
    if (req.currentUser.role !== 'ADMIN') {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: { isApproved: true } },
        { new: true }
    );

    if (!product) {
        const error = appError.create('product not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    res.json({ status: httpStatusText.SUCCESS, data: { product } });
})

module.exports = { getAllProducts, getProduct, addProduct, updateProduct, deleteProduct, approveProduct }