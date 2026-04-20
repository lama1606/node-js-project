const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    categoryName: {
        type: String,
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    condition: {
        type: String,
        enum: ['new', 'like new', 'good', 'fair', 'poor'],
        required: true
    },
    size: {
        type: String
    },
    brand: {
        type: String
    },
    material: {
        type: String
    },
    color: {
        type: String
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['available', 'sold', 'pending'],
        default: 'available'
    }
}, { timestamps: true })

module.exports = mongoose.model('Product', productSchema);