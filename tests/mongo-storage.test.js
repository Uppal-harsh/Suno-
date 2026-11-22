const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const { createStorage } = require('../storage');

describe('Storage backed by an isolated real MongoDB', { timeout: 180000 }, () => {
    let mongo;
    let inspector;
    let db;
    let storage;
    let dataDir;
    let options;
    before(async () => {
        // These tests never read .env or connect to Atlas.
        mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
        inspector = new MongoClient(mongo.getUri());
        await inspector.connect();
    });
    after(async () => {
        await inspector?.close();
        await mongo?.stop();
    });
    beforeEach(async () => {
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easykart-mongo-'));
        options = { dataDir, uri: mongo.getUri(), databaseName: 'test_' + crypto.randomUUID().replaceAll('-', '') };
        db = inspector.db(options.databaseName);
        storage = createStorage(options);
    });
    afterEach(async () => {
        await storage.close();
        await db.dropDatabase();
        fs.rmSync(dataDir, { recursive: true, force: true });
    });

    it('connects once for concurrent callers, persists records and reconnects after close', async () => {
        await Promise.all([storage.connect(), storage.connect()]);
        const message = { name: 'Demo shopper', email: 'demo@example.com', message: 'Test persistence', submitted_at: new Date().toISOString() };
        await storage.addHelp({ ...message });
        await storage.close();
        await assert.rejects(storage.listHelp(), /not connected/);
        await storage.connect();
        assert.deepEqual(await storage.listHelp(), [message]);
        assert.equal(await db.collection('help_requests').countDocuments(), 1);
    });

    it('closes the connection when startup indexes cannot be created', async () => {
        await db.collection('orders').insertMany([
            { id: 'duplicate', visitorId: 'a', requestId: 'a' },
            { id: 'duplicate', visitorId: 'b', requestId: 'b' }
        ]);
        await assert.rejects(storage.connect(), error => error.code === 11000);
        await assert.rejects(storage.listOrders(), /not connected/);
    });

    it('persists carts, creates one order on retries and updates its status', async () => {
        await storage.connect();
        const cart = { visitor: 'guest', items: [{ name: 'Jeans', price: 799, quantity: 1 }], updated_at: new Date().toISOString() };
        const order = { id: crypto.randomUUID(), visitorId: 'visitor-a', requestId: crypto.randomUUID(), items: cart.items, total: 799, status: 'New' };
        await storage.saveCart(order.visitorId, cart);
        assert.deepEqual(await storage.listCarts(), [cart]);
        const first = await storage.createOrder(order);
        const retry = await storage.createOrder({ ...order, id: crypto.randomUUID() });
        assert.equal(first.created, true);
        assert.equal(retry.created, false);
        assert.equal(retry.order.id, first.order.id);
        assert.equal((await storage.listOrders()).length, 1);
        assert.deepEqual(await storage.listCarts(), []);
        assert.equal((await storage.updateOrder(order.id, { status: 'Packed' })).status, 'Packed');
        assert.equal(await storage.updateOrder('missing', { status: 'Packed' }), null);
    });

    it('imports JSON once and never resurrects deleted carts or help messages', async () => {
        const order = { id: 'legacy-order', visitorId: 'legacy-visitor', requestId: 'legacy-request', status: 'New' };
        const cart = { visitor: 'legacy', items: [{ name: 'Jeans', price: 799, quantity: 1 }] };
        const help = [{ name: 'Demo shopper', email: 'demo@example.com', message: 'Legacy help', submitted_at: '2026-11-22T10:00:00Z' }];
        fs.writeFileSync(path.join(dataDir, 'commerce.json'), JSON.stringify({ orders: [order], carts: { 'legacy-visitor': cart } }));
        fs.writeFileSync(path.join(dataDir, 'help_requests.json'), JSON.stringify(help));
        await storage.connect();
        assert.deepEqual(await storage.listOrders(), [order]);
        assert.deepEqual(await storage.listCarts(), [cart]);
        assert.deepEqual(await storage.listHelp(), help);
        await storage.saveCart('legacy-visitor', null);
        await db.collection('help_requests').deleteMany({});
        await storage.close();
        await storage.connect();
        assert.deepEqual(await storage.listCarts(), []);
        assert.deepEqual(await storage.listHelp(), []);
        assert.equal(await db.collection('_migrations').countDocuments({ complete: true }), 3);
    });

    it('resumes a partially completed import without duplicates or overwriting orders', async () => {
        const orders = [
            { id: 'legacy-a', visitorId: 'a', requestId: 'a', status: 'New' },
            { id: 'legacy-b', visitorId: 'b', requestId: 'b', status: 'New' }
        ];
        fs.writeFileSync(path.join(dataDir, 'commerce.json'), JSON.stringify({ orders, carts: {} }));
        await db.collection('_migrations').insertOne({ _id: 'json-v1:orders', import: true, complete: false });
        await db.collection('orders').insertOne({ ...orders[0], status: 'Packed' });
        await storage.connect();
        assert.equal(await db.collection('orders').countDocuments(), 2);
        assert.equal((await db.collection('orders').findOne({ id: 'legacy-a' })).status, 'Packed');
        assert.equal((await db.collection('_migrations').findOne({ _id: 'json-v1:orders' })).complete, true);
    });

    it('preserves pre-existing MongoDB records instead of mixing in old JSON', async () => {
        await db.collection('orders').insertOne({ id: 'current', visitorId: 'current', requestId: 'current', status: 'Delivered' });
        fs.writeFileSync(path.join(dataDir, 'commerce.json'), JSON.stringify({ orders: [{ id: 'old', visitorId: 'old', requestId: 'old' }], carts: {} }));
        await storage.connect();
        assert.equal((await storage.listOrders()).length, 1);
        assert.equal((await storage.listOrders())[0].id, 'current');
    });

    it('stores exactly one order when simultaneous retries race', async () => {
        await storage.connect();
        const order = { id: crypto.randomUUID(), visitorId: 'visitor-a', requestId: crypto.randomUUID(), created_at: new Date().toISOString() };
        const results = await Promise.all(Array.from({ length: 6 }, () => storage.createOrder({ ...order, id: crypto.randomUUID() })));
        assert.equal(results.filter(result => result.created).length, 1);
        assert.equal(new Set(results.map(result => result.order.id)).size, 1);
        assert.equal(await db.collection('orders').countDocuments(), 1);
    });

    it('rejects an unrelated order ID collision instead of returning a null order', async () => {
        await storage.connect();
        await storage.createOrder({ id: 'same-id', visitorId: 'first-visitor', requestId: 'first-request' });
        await assert.rejects(storage.createOrder({ id: 'same-id', visitorId: 'other-visitor', requestId: 'other-request' }), error => error.code === 11000);
        assert.equal(await db.collection('orders').countDocuments(), 1);
    });

    it('retries incomplete cart cleanup without deleting a newer cart', async () => {
        await storage.connect();
        const order = { id: 'saved-order', visitorId: 'visitor-a', requestId: 'request-a', created_at: '2026-11-22T11:00:00.000Z' };
        // Simulate an order saved immediately before the cleanup connection failed.
        await db.collection('orders').insertOne({ ...order });
        await storage.saveCart(order.visitorId, { items: [{ name: 'Jeans', quantity: 1 }], updated_at: '2026-11-22T10:59:00.000Z' });
        assert.equal((await storage.createOrder(order)).created, false);
        assert.deepEqual(await storage.listCarts(), []);
        const newerCart = { items: [{ name: 'Watch', quantity: 1 }], updated_at: '2026-11-22T11:01:00.000Z' };
        await storage.saveCart(order.visitorId, newerCart);
        await storage.createOrder(order);
        assert.deepEqual(await storage.listCarts(), [newerCart]);
    });
});
