const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    const url = process.env.MONGO_URL;
    if (!url) {
        throw new Error('MONGO_URL is not defined');
    }

    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(url).then(async (m) => {
            console.log('mongodb server started');
            try {
                const Category = require('../models/category.model');
                await Category.syncIndexes();
            } catch (e) {
                console.warn('Category index sync (fix duplicate subcategories in DB if this fails):', e.message);
            }
            return m;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

module.exports = connectDB;
