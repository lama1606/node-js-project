const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

/** Race `promise` against a wall-clock timeout so callers get a rejection instead of hanging. */
function withTimeout(promise, ms, timeoutMessage) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, ms);

        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

async function resetMongooseState(abandonedPromise) {
    if (abandonedPromise && typeof abandonedPromise.then === 'function') {
        abandonedPromise.catch(() => {});
    }
    cached.promise = null;
    cached.conn = null;
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    } catch (_) {
        // best-effort after failed or timed-out connect
    }
}

async function connectDB() {
    const url = process.env.MONGO_URL_YWAELE || process.env.MONGO_URL;
    if (!url) {
        throw new Error('MONGO_URL_YWAELE or MONGO_URL is not defined');
    }

    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    const isVercel = Boolean(process.env.VERCEL);

    const defaultOverallMs = isVercel ? 8500 : 20000;
    const overallMs = Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || defaultOverallMs;

    const timeoutMessage = isVercel
        ? `MongoDB connect exceeded ${overallMs}ms (Vercel budget). Check: (1) Atlas cluster running, (2) Network Access 0.0.0.0/0, (3) MONGO_URL_YWAELE set in Vercel, (4) password in URI, (5) function region near Atlas (e.g. iad1 for us-east-1).`
        : `MongoDB connect exceeded ${overallMs}ms. Check Atlas URI, network access, and that the cluster is reachable. Override with MONGO_CONNECT_TIMEOUT_MS.`;

    // Hobby/serverless caps: fail fast + IPv4 often fixes Atlas hangs from serverless.
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

    const pending = cached.promise;
    try {
        await withTimeout(pending, overallMs, timeoutMessage);
        const ready = mongoose.connection.readyState === 1;
        if (!ready) {
            await resetMongooseState(pending);
            throw new Error('MongoDB connection did not become ready after connect promise resolved.');
        }
        cached.conn = mongoose.connection;
        return cached.conn;
    } catch (e) {
        await resetMongooseState(pending);
        throw e;
    }
}

module.exports = connectDB;
