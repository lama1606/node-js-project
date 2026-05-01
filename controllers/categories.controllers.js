    const asyncWrapper = require("../middleware/asyncWrapper");
    const mongoose = require("mongoose");
    const Category = require('../models/category.model');
    const httpStatusText = require('../utils/httpStatus');
    const appError = require('../utils/appError');
    const {
        ROOT_CATEGORY_NAMES,
        ALLOWED_SUBCATEGORIES,
        canonicalSubcategoryName
    } = require('../utils/categoryConstants');

    function normalizeParentIdValue(pid) {
        if (pid == null) return null;
        if (pid instanceof mongoose.Types.ObjectId) return pid;
        if (typeof pid === 'string' && mongoose.isValidObjectId(pid.trim())) {
            return new mongoose.Types.ObjectId(pid.trim());
        }
        return null;
    }

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

        let nameForSave;

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
            if (parentCategory.parentId) {
                const error = appError.create('sub-categories can only be created under Men or Women', 400, httpStatusText.FAIL);
                return next(error);
            }

            const sub = canonicalSubcategoryName(categoryName);
            if (!ALLOWED_SUBCATEGORIES.includes(sub)) {
                const error = appError.create(
                    `subcategory must be one of: ${ALLOWED_SUBCATEGORIES.join(', ')}`,
                    400,
                    httpStatusText.FAIL
                );
                return next(error);
            }
            nameForSave = sub;
        } else {
            if (!ROOT_CATEGORY_NAMES.includes(categoryName.trim())) {
                const error = appError.create('root categories must be Men or Women', 400, httpStatusText.FAIL);
                return next(error);
            }
            nameForSave = categoryName.trim();
        }

        const parentIdQuery = parentId ? normalizeParentIdValue(parentId) : null;
        if (parentId && !parentIdQuery) {
            const error = appError.create('invalid parentId', 400, httpStatusText.FAIL);
            return next(error);
        }

        const existingCategory = await Category.findOne({
            categoryName: nameForSave,
            parentId: parentIdQuery
        });
        if (existingCategory) {
            const error = appError.create('category already exists for this parent', 400, httpStatusText.FAIL);
            return next(error);
        }

        const newCategory = new Category({
            categoryName: nameForSave,
            parentId: parentIdQuery
        });

        try {
            await newCategory.save();
        } catch (err) {
            if (err && err.code === 11000) {
                return next(appError.create('category already exists for this parent', 400, httpStatusText.FAIL));
            }
            throw err;
        }

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
                if (parentCategory.parentId) {
                    const error = appError.create('sub-categories can only be under Men or Women', 400, httpStatusText.FAIL);
                    return next(error);
                }
            }
        }

        const effectiveParentId = parentId !== undefined ? parentId : category.parentId;

        let resolvedCategoryName;

        if (categoryName !== undefined) {
            if (!effectiveParentId) {
                const trimmed = categoryName.trim();
                if (!ROOT_CATEGORY_NAMES.includes(trimmed)) {
                    const error = appError.create('root categories must be Men or Women', 400, httpStatusText.FAIL);
                    return next(error);
                }
                resolvedCategoryName = trimmed;
            } else {
                const sub = canonicalSubcategoryName(categoryName);
                if (!ALLOWED_SUBCATEGORIES.includes(sub)) {
                    const error = appError.create(
                        `subcategory must be one of: ${ALLOWED_SUBCATEGORIES.join(', ')}`,
                        400,
                        httpStatusText.FAIL
                    );
                    return next(error);
                }
                resolvedCategoryName = sub;
            }
        } else if (effectiveParentId) {
            resolvedCategoryName = category.categoryName;
            const existing = canonicalSubcategoryName(category.categoryName);
            if (!ALLOWED_SUBCATEGORIES.includes(existing)) {
                const error = appError.create(
                    `subcategory must be one of: ${ALLOWED_SUBCATEGORIES.join(', ')}`,
                    400,
                    httpStatusText.FAIL
                );
                return next(error);
            }
        } else {
            resolvedCategoryName = category.categoryName;
        }

        if (!effectiveParentId && !ROOT_CATEGORY_NAMES.includes(resolvedCategoryName)) {
            const error = appError.create('root categories must be Men or Women', 400, httpStatusText.FAIL);
            return next(error);
        }

        const nextParentIdRaw = parentId !== undefined ? parentId : category.parentId;
        const nextParentId = normalizeParentIdValue(nextParentIdRaw);

        const siblingConflict = await Category.findOne({
            categoryName: resolvedCategoryName,
            parentId: nextParentId
        });
        if (siblingConflict && siblingConflict._id.toString() !== req.params.id) {
            const error = appError.create('category already exists for this parent', 400, httpStatusText.FAIL);
            return next(error);
        }

        try {
            const updatedCategory = await Category.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        categoryName: resolvedCategoryName,
                        parentId: nextParentId
                    }
                },
                { new: true }
            );
            if (!updatedCategory) {
                const error = appError.create('category not found', 404, httpStatusText.FAIL);
                return next(error);
            }
            res.json({ status: httpStatusText.SUCCESS, data: { category: updatedCategory } });
        } catch (err) {
            if (err && err.code === 11000) {
                return next(appError.create('category already exists for this parent', 400, httpStatusText.FAIL));
            }
            throw err;
        }
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