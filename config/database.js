const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    const url = process.env.MONGO_URL_YWAELE || process.env.MONGO_URL;
    if (!url) {
        throw new Error('MONGO_URL_YWAELE or MONGO_URL is not defined');
    }

    if (cached.conn) {
        return cached.conn;
    }

    const mongooseOpts = {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 12000,
        maxPoolSize: 5,
    };

    if (!cached.promise) {
        cached.promise = mongoose.connect(url, mongooseOpts).then(async (m) => {
            console.log('mongodb server started');
            // Index sync is slow; skip on Vercel cold starts to avoid 504 timeouts (run locally / migration if needed).
            if (!process.env.VERCEL) {
                try {
                    const Category = require('../models/category.model');
                    await Category.syncIndexes();
                } catch (e) {
                    console.warn('Category index sync:', e.message);
                }
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
