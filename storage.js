// MongoDB is used when MONGODB_URI is configured; JSON files remain a local fallback.
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');

const dataDir = path.join(__dirname, 'data');
const commerceFile = path.join(dataDir, 'commerce.json');
const helpFile = path.join(dataDir, 'help_requests.json');
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB_NAME || 'easykart';
let client;
let collections;

function readJson(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temporary, file);
}

async function connect() {
    if (!uri) {
        console.log('Storage: local JSON files (set MONGODB_URI to use MongoDB).');
        return;
    }
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    const db = client.db(databaseName);
    collections = {
        orders: db.collection('orders'),
        carts: db.collection('carts'),
        help: db.collection('help_requests')
    };
    await Promise.all([
        collections.orders.createIndex({ id: 1 }, { unique: true }),
        collections.orders.createIndex({ visitorId: 1, requestId: 1 }, { unique: true }),
        collections.carts.createIndex({ visitorId: 1 }, { unique: true }),
        collections.help.createIndex({ submitted_at: -1 })
    ]);
    await migrateJsonData();
    console.log(`Storage: MongoDB database "${databaseName}".`);
}

async function migrateJsonData() {
    const [orderCount, cartCount, helpCount] = await Promise.all([
        collections.orders.countDocuments(), collections.carts.countDocuments(), collections.help.countDocuments()
    ]);
    const store = readJson(commerceFile, { orders: [], carts: {} });
    if (!orderCount && store.orders?.length) await collections.orders.insertMany(store.orders, { ordered: false });
    if (!cartCount) {
        const carts = Object.entries(store.carts || {}).map(([visitorId, cart]) => ({ ...cart, visitorId }));
        if (carts.length) await collections.carts.insertMany(carts, { ordered: false });
    }
    if (!helpCount) {
        const help = readJson(helpFile, []);
        if (Array.isArray(help) && help.length) await collections.help.insertMany(help);
    }
}

async function listOrders() {
    if (!collections) return readJson(commerceFile, { orders: [], carts: {} }).orders;
    return collections.orders.find({}, { projection: { _id: 0 } }).sort({ created_at: 1 }).toArray();
}
async function listCarts() {
    if (!collections) return Object.values(readJson(commerceFile, { orders: [], carts: {} }).carts);
    return collections.carts.find({}, { projection: { _id: 0, visitorId: 0 } }).sort({ updated_at: 1 }).toArray();
}
async function listHelp() {
    if (!collections) return readJson(helpFile, []);
    return collections.help.find({}, { projection: { _id: 0 } }).sort({ submitted_at: 1 }).toArray();
}
async function addHelp(request) {
    if (collections) return collections.help.insertOne(request);
    const help = readJson(helpFile, []);
    if (!Array.isArray(help)) throw new Error('Invalid saved help requests');
    help.push(request); writeJson(helpFile, help);
}
async function saveCart(visitorId, cart) {
    if (collections) {
        if (!cart) await collections.carts.deleteOne({ visitorId });
        else await collections.carts.updateOne({ visitorId }, {
            $set: cart, $setOnInsert: { visitorId }
        }, { upsert: true });
        return;
    }
    const store = readJson(commerceFile, { orders: [], carts: {} });
    if (cart) store.carts[visitorId] = cart;
    else delete store.carts[visitorId];
    writeJson(commerceFile, store);
}
async function createOrder(order) {
    if (collections) {
        let result;
        try {
            result = await collections.orders.updateOne(
                { visitorId: order.visitorId, requestId: order.requestId },
                { $setOnInsert: order }, { upsert: true }
            );
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
        const saved = await collections.orders.findOne(
            { visitorId: order.visitorId, requestId: order.requestId }, { projection: { _id: 0 } }
        );
        if (result?.upsertedCount) await collections.carts.deleteOne({ visitorId: order.visitorId });
        return { order: saved, created: result?.upsertedCount === 1 };
    }
    const store = readJson(commerceFile, { orders: [], carts: {} });
    const existing = store.orders.find(item => item.visitorId === order.visitorId && item.requestId === order.requestId);
    if (existing) return { order: existing, created: false };
    store.orders.push(order); delete store.carts[order.visitorId]; writeJson(commerceFile, store);
    return { order, created: true };
}
async function updateOrder(id, update) {
    if (collections) {
        const result = await collections.orders.findOneAndUpdate({ id }, { $set: update }, {
            returnDocument: 'after', projection: { _id: 0 }
        });
        return result;
    }
    const store = readJson(commerceFile, { orders: [], carts: {} });
    const order = store.orders.find(item => item.id === id);
    if (order) { Object.assign(order, update); writeJson(commerceFile, store); }
    return order;
}

module.exports = { connect, addHelp, listOrders, listCarts, listHelp, saveCart, createOrder, updateOrder };
