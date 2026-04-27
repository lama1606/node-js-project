const asyncWrapper = require("../middleware/asyncWrapper");
const mongoose = require("mongoose");
const Category = require('../models/category.model');
const httpStatusText = require('../utils/httpStatus');
const appError = require('../utils/appError');

// ========================
// GET ALL CATEGORIES
// ========================
const getAllCategories = asyncWrapper(async (req, res) => {
    const categories = await Category.find()
        .populate('parentId', 'categoryId categoryName');

    res.json({ status: httpStatusText.SUCCESS, data: { categories } });
});

// ========================
// GET SINGLE CATEGORY
// ========================
const getCategory = asyncWrapper(async (req, res, next) => {
    const category = await Category.findById(req.params.id)
        .populate('parentId', 'categoryId categoryName');

    if (!category) {
        const error = appError.create('category not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    res.json({ status: httpStatusText.SUCCESS, data: { category } });
});

// ========================
// CREATE CATEGORY (ADMIN)
// ========================
const addCategory = asyncWrapper(async (req, res, next) => {
    if (req.currentUser.role !== 'ADMIN') {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    const { categoryName, parentId } = req.body;

    if (!categoryName) {
        const error = appError.create('categoryName is required', 400, httpStatusText.FAIL);
        return next(error);
    }

    if (parentId) {
        if (!mongoose.isValidObjectId(parentId)) {
            const error = appError.create('invalid parentId', 400, httpStatusText.FAIL);
            return next(error);
        }

        const parentCategory = await Category.findById(parentId);
        if (!parentCategory) {
            const error = appError.create('parent category not found', 404, httpStatusText.FAIL);
            return next(error);
        }
    }

    const existingCategory = await Category.findOne({ categoryName: categoryName.trim() });
    if (existingCategory) {
        const error = appError.create('category already exists', 400, httpStatusText.FAIL);
        return next(error);
    }

    const newCategory = new Category({
        categoryName,
        parentId: parentId || null
    });

    await newCategory.save();

    res.status(201).json({ status: httpStatusText.SUCCESS, data: { category: newCategory } });
});

// ========================
// UPDATE CATEGORY (ADMIN)
// ========================
const updateCategory = asyncWrapper(async (req, res, next) => {
    if (req.currentUser.role !== 'ADMIN') {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    const { categoryName, parentId } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) {
        const error = appError.create('category not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    if (parentId !== undefined) {
        if (parentId !== null && !mongoose.isValidObjectId(parentId)) {
            const error = appError.create('invalid parentId', 400, httpStatusText.FAIL);
            return next(error);
        }

        if (parentId && parentId.toString() === req.params.id) {
            const error = appError.create('category cannot be parent of itself', 400, httpStatusText.FAIL);
            return next(error);
        }

        if (parentId) {
            const parentCategory = await Category.findById(parentId);
            if (!parentCategory) {
                const error = appError.create('parent category not found', 404, httpStatusText.FAIL);
                return next(error);
            }
        }
    }

    if (categoryName && categoryName.trim() !== category.categoryName) {
        const existingCategory = await Category.findOne({ categoryName: categoryName.trim() });
        if (existingCategory) {
            const error = appError.create('category already exists', 400, httpStatusText.FAIL);
            return next(error);
        }
    }

    const updatedCategory = await Category.findByIdAndUpdate(
        req.params.id,
        {
            $set: {
                categoryName: categoryName !== undefined ? categoryName : category.categoryName,
                parentId: parentId !== undefined ? parentId : category.parentId
            }
        },
        { new: true }
    );

    res.json({ status: httpStatusText.SUCCESS, data: { category: updatedCategory } });
});

// ========================
// DELETE CATEGORY (ADMIN)
// ========================
const deleteCategory = asyncWrapper(async (req, res, next) => {
    if (req.currentUser.role !== 'ADMIN') {
        const error = appError.create('you are not authorized', 403, httpStatusText.FAIL);
        return next(error);
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
        const error = appError.create('category not found', 404, httpStatusText.FAIL);
        return next(error);
    }

    const hasChildren = await Category.findOne({ parentId: req.params.id });
    if (hasChildren) {
        const error = appError.create('cannot delete category with sub-categories', 400, httpStatusText.FAIL);
        return next(error);
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({ status: httpStatusText.SUCCESS, data: null });
});

module.exports = { getAllCategories, getCategory, addCategory, updateCategory, deleteCategory };
