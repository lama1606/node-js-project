const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
    {
        categoryId: {
            type: String,
            unique: true,
            default: () => `CAT-${Date.now()}-${Math.floor(Math.random() * 100000)}`
        },
        categoryName: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
