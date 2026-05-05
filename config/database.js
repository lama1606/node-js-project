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

    const isVercel = Boolean(process.env.VERCEL);
    // Hobby ~10s function cap: fail fast + IPv4 often fixes Atlas hangs from serverless.
    const mongooseOpts = {
        serverSelectionTimeoutMS: isVercel ? 4000 : 10000,
        connectTimeoutMS: isVercel ? 5000 : 12000,
        socketTimeoutMS: isVercel ? 8000 : 0,
        maxPoolSize: isVercel ? 2 : 5,
        ...(isVercel ? { family: 4 } : {}),
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
        if (isVercel) {
            await Promise.race([
                cached.promise,
                new Promise((_, rej) =>
                    setTimeout(
                        () =>
                            rej(
                                new Error(
                                    'MongoDB connect exceeded Vercel time budget. Check: (1) Atlas cluster is not paused, (2) Network Access 0.0.0.0/0, (3) MONGO_URL_YWAELE on Vercel, (4) correct password in URI.'
                                )
                            ),
                        8500
                    )
                ),
            ]);
        } else {
            await cached.promise;
        }
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        cached.conn = null;
        throw e;
    }

    return cached.conn;
}

module.exports = connectDB;
