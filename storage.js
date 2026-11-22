// MongoDB is used when MONGODB_URI is configured; JSON files remain a local fallback.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { MongoClient } = require('mongodb');

function createStorage({
    dataDir = path.join(__dirname, 'data'),
    uri = process.env.MONGODB_URI,
    databaseName = process.env.MONGODB_DB_NAME || 'easykart',
    clientFactory = connectionUri => new MongoClient(connectionUri, { family: 4, serverSelectionTimeoutMS: 10000 })
} = {}) {
const commerceFile = path.join(dataDir, 'commerce.json');
const helpFile = path.join(dataDir, 'help_requests.json');
let client;
let collections;
let connecting;

function requireConnection() {
    if (uri && !collections) throw new Error('MongoDB storage is not connected.');
}

function readJson(file, fallback) {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function readCommerce() {
    const store = readJson(commerceFile, { orders: [], carts: {} });
    if (!store || typeof store !== 'object' || Array.isArray(store) ||
        !Array.isArray(store.orders) || !store.carts || typeof store.carts !== 'object' || Array.isArray(store.carts)) {
        throw new Error('Invalid saved commerce data. Restore a valid backup before starting.');
    }
    return store;
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
    if (collections) return;
    if (!connecting) connecting = openMongo().finally(() => { connecting = undefined; });
    return connecting;
}

async function openMongo() {
    const nextClient = clientFactory(uri);
    try {
    await nextClient.connect();
    const db = nextClient.db(databaseName);
    const nextCollections = {
        orders: db.collection('orders'),
        carts: db.collection('carts'),
        help: db.collection('help_requests')
    };
    await Promise.all([
        nextCollections.orders.createIndex({ id: 1 }, { unique: true }),
        nextCollections.orders.createIndex({ visitorId: 1, requestId: 1 }, { unique: true }),
        nextCollections.carts.createIndex({ visitorId: 1 }, { unique: true }),
        nextCollections.help.createIndex({ submitted_at: -1 })
    ]);
    await migrateJsonData(nextCollections, db.collection('_migrations'));
    client = nextClient;
    collections = nextCollections;
    console.log(`Storage: MongoDB database "${databaseName}".`);
    } catch (error) {
        await nextClient.close().catch(() => {});
        throw error;
    }
}

async function migrateJsonData(collections, migrations) {
    const sources = [
        { name: 'orders', collection: collections.orders, read: () => readCommerce().orders, key: record => ({ id: record.id }) },
        { name: 'carts', collection: collections.carts, read: () => Object.entries(readCommerce().carts).map(([visitorId, cart]) => ({ ...cart, visitorId })), key: record => ({ visitorId: record.visitorId }) },
        { name: 'help', collection: collections.help, read: () => readJson(helpFile, []), key: (record, index) => ({
            _id: 'json-help-' + crypto.createHash('sha256').update(JSON.stringify([index, record])).digest('hex')
        }) }
    ];
    for (const source of sources) {
        const filter = { _id: 'json-v1:' + source.name };
        let state = await migrations.findOne(filter);
        if (state?.complete) continue;
        if (!state) {
            const hasRecords = Boolean(await source.collection.findOne({}, { projection: { _id: 1 } }));
            await migrations.updateOne(filter, { $setOnInsert: { import: !hasRecords, complete: false } }, { upsert: true });
            state = await migrations.findOne(filter);
        }
        if (state.import) {
            const records = source.read();
            if (!Array.isArray(records) || records.some(record => !record || typeof record !== 'object' || Array.isArray(record))) {
                throw new Error('Invalid saved ' + source.name + ' data. Restore a valid backup before starting.');
            }
            const operations = records.map((record, index) => {
                const key = source.key(record, index);
                if (Object.values(key).some(value => typeof value !== 'string' || !value)) {
                    throw new Error('Invalid saved ' + source.name + ' identifier.');
                }
                const { _id, ...document } = record;
                return { updateOne: { filter: key, update: { $setOnInsert: document }, upsert: true } };
            });
            if (operations.length) await source.collection.bulkWrite(operations, { ordered: false });
        }
        await migrations.updateOne(filter, { $set: { complete: true, completed_at: new Date().toISOString() } });
    }
}

async function listOrders() {
    requireConnection();
    if (!collections) return readCommerce().orders;
    return collections.orders.find({}, { projection: { _id: 0 } }).sort({ created_at: 1 }).toArray();
}
async function listCarts() {
    requireConnection();
    if (!collections) return Object.values(readCommerce().carts);
    return collections.carts.find({}, { projection: { _id: 0, visitorId: 0 } }).sort({ updated_at: 1 }).toArray();
}
async function listHelp() {
    requireConnection();
    if (!collections) return readJson(helpFile, []);
    return collections.help.find({}, { projection: { _id: 0 } }).sort({ submitted_at: 1 }).toArray();
}
async function addHelp(request) {
    requireConnection();
    if (collections) return collections.help.insertOne(request);
    const help = readJson(helpFile, []);
    if (!Array.isArray(help)) throw new Error('Invalid saved help requests');
    help.push(request); writeJson(helpFile, help);
}
async function saveCart(visitorId, cart) {
    requireConnection();
    if (collections) {
        if (!cart) await collections.carts.deleteOne({ visitorId });
        else await collections.carts.updateOne({ visitorId }, {
            $set: cart, $setOnInsert: { visitorId }
        }, { upsert: true });
        return;
    }
    const store = readCommerce();
    if (cart) store.carts[visitorId] = cart;
    else delete store.carts[visitorId];
    writeJson(commerceFile, store);
}
async function createOrder(order) {
    requireConnection();
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
    const store = readCommerce();
    const existing = store.orders.find(item => item.visitorId === order.visitorId && item.requestId === order.requestId);
    if (existing) return { order: existing, created: false };
    store.orders.push(order); delete store.carts[order.visitorId]; writeJson(commerceFile, store);
    return { order, created: true };
}
async function updateOrder(id, update) {
    requireConnection();
    if (collections) {
        const result = await collections.orders.findOneAndUpdate({ id }, { $set: update }, {
            returnDocument: 'after', projection: { _id: 0 }
        });
        return result;
    }
    const store = readCommerce();
    const order = store.orders.find(item => item.id === id);
    if (order) { Object.assign(order, update); writeJson(commerceFile, store); }
    return order;
}

async function close() {
    if (connecting) await connecting.catch(() => {});
    const currentClient = client;
    client = undefined;
    collections = undefined;
    await currentClient?.close();
}

return { connect, close, addHelp, listOrders, listCarts, listHelp, saveCart, createOrder, updateOrder };
}

module.exports = { ...createStorage(), createStorage };
