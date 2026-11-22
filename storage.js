require('./config');
const { MongoClient } = require('mongodb');

function createStorage({ uri = process.env.MONGODB_URI,
    databaseName = process.env.MONGODB_DB_NAME || 'easykart' } = {}) {
    let client;
    let database;
    const projection = { _id: 0 };

    function db() {
        if (!database) throw new Error('MongoDB is not connected.');
        return database;
    }
    async function connect() {
        if (database) return;
        if (!uri || uri.includes('YOUR_CLUSTER') || uri.includes('DATABASE_USER')) {
            throw new Error('Set MONGODB_URI in your local .env file first. See .env.example.');
        }
        // Atlas/network handshakes can fail transiently. Retry only connection
        // failures, with a fresh client; authentication and data errors fail at once.
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await openConnection();
                return;
            } catch (error) {
                if (attempt === 2 || !['MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoServerSelectionError'].includes(error.name)) throw error;
                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
        }
    }
    async function openConnection() {
        // Use the IPv4 route allowed in Atlas; this network's default route fails TLS.
        const nextClient = new MongoClient(uri, { family: 4, serverSelectionTimeoutMS: 10000 });
        try {
            await nextClient.connect();
            const nextDatabase = nextClient.db(databaseName);
            await nextDatabase.command({ ping: 1 });
            await Promise.all([
                nextDatabase.collection('products').createIndex({ id: 1 }, { unique: true }),
                nextDatabase.collection('products').createIndex({ name: 1 }, { unique: true }),
                nextDatabase.collection('orders').createIndex({ id: 1 }, { unique: true }),
                nextDatabase.collection('orders').createIndex({ visitorId: 1, requestId: 1 }, { unique: true }),
                nextDatabase.collection('carts').createIndex({ visitorId: 1 }, { unique: true }),
                nextDatabase.collection('help_requests').createIndex({ submitted_at: -1 })
            ]);
            client = nextClient;
            database = nextDatabase;
        } catch (error) {
            await nextClient.close().catch(() => {});
            throw error;
        }
    }
    async function close() {
        database = undefined;
        const previous = client;
        client = undefined;
        await previous?.close();
    }
    async function health() {
        try {
            await db().command({ ping: 1 }, { timeoutMS: 3000 });
            return { mode: 'mongodb', connected: true };
        } catch {
            return { mode: 'mongodb', connected: false };
        }
    }
    const listProducts = () => db().collection('products').find({}, { projection }).sort({ name: 1 }).toArray();
    const listOrders = () => db().collection('orders').find({}, { projection }).sort({ created_at: 1 }).toArray();
    const listCarts = () => db().collection('carts').find({}, { projection: { _id: 0, visitorId: 0 } }).sort({ updated_at: 1 }).toArray();
    const listHelp = () => db().collection('help_requests').find({}, { projection }).sort({ submitted_at: 1 }).toArray();
    const addHelp = request => db().collection('help_requests').insertOne({ ...request });
    async function saveCart(visitorId, cart) {
        if (!cart) return db().collection('carts').deleteOne({ visitorId });
        return db().collection('carts').updateOne({ visitorId }, {
            $set: cart, $setOnInsert: { visitorId }
        }, { upsert: true });
    }
    const findOrder = (visitorId, requestId) => db().collection('orders').findOne({ visitorId, requestId }, { projection });
    async function finishCheckout(order) {
        // An interrupted checkout may be retried; keep carts updated after this order.
        await db().collection('carts').deleteOne({ visitorId: order.visitorId, $or: [
            { updated_at: { $lte: order.created_at } }, { updated_at: { $exists: false } }
        ] });
    }
    async function createOrder(order) {
        let created = false;
        try {
            const result = await db().collection('orders').updateOne(
                { visitorId: order.visitorId, requestId: order.requestId },
                { $setOnInsert: order }, { upsert: true });
            created = result.upsertedCount === 1;
        } catch (error) {
            if (error.code !== 11000 || !await findOrder(order.visitorId, order.requestId)) throw error;
        }
        const saved = await findOrder(order.visitorId, order.requestId);
        if (!saved) throw new Error('Order could not be confirmed.');
        await finishCheckout(saved);
        return { order: saved, created };
    }
    const updateOrder = (id, update) => db().collection('orders').findOneAndUpdate(
        { id }, { $set: update }, { returnDocument: 'after', projection });

    return { connect, close, health, db, listProducts, listOrders, listCarts,
        listHelp, addHelp, saveCart, findOrder, finishCheckout, createOrder, updateOrder };
}

module.exports = { ...createStorage(), createStorage };
