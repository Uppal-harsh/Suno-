// Explicit, resumable import. Original JSON files are never modified.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const storage = require('./storage');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function readJson(file, fallback) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}
function records(value, name) {
    if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
        throw new Error('Invalid ' + name + ' source data.');
    }
    return value;
}
function prepareSources(root) {
    const products = records(readJson(path.join(root, 'catalog.json'), []), 'products').map(product => {
        if (typeof product.name !== 'string' || !product.name.trim() ||
            !Number.isFinite(product.price) || product.price < 0 || typeof product.category !== 'string') {
            throw new Error('Invalid product in catalog.json.');
        }
        return { ...product, id: 'product-' + hash(product.name).slice(0, 24) };
    });
    const store = readJson(path.join(root, 'data', 'commerce.json'), { orders: [], carts: {} });
    if (!store || !store.carts || typeof store.carts !== 'object' || Array.isArray(store.carts)) {
        throw new Error('Invalid commerce source data.');
    }
    const orders = records(store.orders, 'orders');
    for (const order of orders) {
        if (![order.id, order.requestId].every(value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value)) ||
            typeof order.visitorId !== 'string' || !/^[a-f0-9]{32}$/.test(order.visitorId) ||
            !order.customer || typeof order.customer.name !== 'string' || !Array.isArray(order.items) ||
            !Number.isFinite(order.total) || typeof order.created_at !== 'string') {
            throw new Error('Invalid saved order.');
        }
    }
    const carts = Object.entries(store.carts).map(([visitorId, cart]) => {
        if (!/^[a-f0-9]{32}$/.test(visitorId) || !cart || !Array.isArray(cart.items)) throw new Error('Invalid saved cart.');
        return { ...cart, visitorId };
    });
    const help = records(readJson(path.join(root, 'data', 'help_requests.json'), []), 'help requests');
    for (const request of help) {
        if (!['name', 'email', 'message', 'submitted_at'].every(key => typeof request[key] === 'string')) {
            throw new Error('Invalid saved Help request.');
        }
    }
    return [
        { name: 'products', documents: products, key: record => ({ id: record.id }) },
        { name: 'orders', documents: orders, key: record => ({ id: record.id }) },
        { name: 'carts', documents: carts, key: record => ({ visitorId: record.visitorId }) },
        { name: 'help_requests', documents: help, key: (record, index) => ({
            _id: 'json-help-' + hash(JSON.stringify([index, record]))
        }) }
    ];
}

async function importData(database, root = __dirname) {
    // Validate every source before writing any records.
    const sources = prepareSources(root);
    const migrations = database.collection('_migrations');
    for (const source of sources) {
        const marker = { _id: 'initial-json-v1:' + source.name };
        if ((await migrations.findOne(marker))?.complete) continue;
        const collection = database.collection(source.name);
        for (const [index, record] of source.documents.entries()) {
            const { _id, ...document } = record;
            await collection.updateOne(source.key(record, index), { $setOnInsert: document }, { upsert: true });
        }
        // Once completed, reruns cannot resurrect deleted carts or overwrite edits.
        await migrations.updateOne(marker, { $set: { complete: true, completed_at: new Date().toISOString() } }, { upsert: true });
    }
    return Object.fromEntries(await Promise.all(sources.map(async source => [
        source.name, await database.collection(source.name).countDocuments()
    ])));
}

if (require.main === module) {
    (async () => {
        try {
            await storage.connect();
            console.log('Import complete. Collection counts:', await importData(storage.db()));
        } catch {
            console.error('Import failed. Check the MongoDB connection and JSON source data. Original files are unchanged; rerunning safely resumes an incomplete import.');
            process.exitCode = 1;
        } finally {
            await storage.close();
        }
    })();
}

module.exports = { importData, prepareSources };
