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
});
