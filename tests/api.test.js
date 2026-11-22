const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { MongoClient } = require('mongodb');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { removeTestData } = require('../scripts/test-data');

describe('HTTP API with an isolated real MongoDB', { timeout: 180000 }, () => {
    let mongo, storage, server, baseUrl, dataDir;
    before(async () => {
        mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easykart-api-'));
        // Set every target explicitly before loading the server; never use Atlas or real JSON.
        process.env.MONGODB_URI = mongo.getUri();
        process.env.MONGODB_DB_NAME = 'easykart_api_test';
        process.env.EASYKART_DATA_DIR = dataDir;
        process.env.ADMIN_PASSWORD = 'isolated-test-password';
        const app = require('../server');
        storage = require('../storage');
        await storage.connect();
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
        baseUrl = 'http://127.0.0.1:' + server.address().port;
    });
    after(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        await storage?.close();
        await mongo?.stop();
        if (dataDir) removeTestData(dataDir);
    });
    async function request(url, { method = 'GET', body, cookie } = {}) {
        const headers = {};
        if (body) headers['Content-Type'] = 'application/json';
        if (cookie) headers.Cookie = cookie;
        const response = await fetch(baseUrl + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
        return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }

    it('reports the active storage mode and detects a closed database', async () => {
        assert.deepEqual((await request('/api/health')).body, { status: 'ok', storage: 'mongodb' });
        await storage.close();
        assert.equal((await request('/api/health')).status, 503);
        await storage.connect();
        assert.equal((await request('/api/health')).status, 200);
    });

    it('persists checkout, retry, help and admin status changes across a database reconnect', async () => {
        assert.equal((await request('/api/admin/dashboard')).status, 401);
        const guest = await request('/api/cart');
        const product = require('../catalog.json')[0];
        const items = [{ name: product.name, quantity: 2, price: 1 }];
        assert.equal((await request('/api/cart', { method: 'PUT', cookie: guest.cookie, body: { items } })).status, 200);
        const checkout = { requestId: crypto.randomUUID(), items, customer: { name: 'Test Shopper', email: 'shopper@example.com', address: 'Demo address for isolated tests' } };
        const first = await request('/api/orders', { method: 'POST', cookie: guest.cookie, body: checkout });
        assert.equal(first.status, 201);
        assert.equal(first.body.order.total, product.price * 2);
        const retry = await request('/api/orders', { method: 'POST', cookie: guest.cookie, body: checkout });
        assert.equal(retry.status, 200);
        assert.equal(retry.body.order.id, first.body.order.id);
        assert.equal((await request('/api/help', { method: 'POST', body: { name: 'Test Shopper', email: 'shopper@example.com', message: 'Please help with this demo order.' } })).status, 200);
        const login = await request('/api/admin/login', { method: 'POST', body: { password: process.env.ADMIN_PASSWORD } });
        assert.equal(login.status, 200);
        const patch = await request('/api/admin/orders/' + first.body.order.id, { method: 'PATCH', cookie: login.cookie, body: { status: 'Packed' } });
        assert.equal(patch.status, 200);
        await storage.close();
        await storage.connect();
        const dashboard = await request('/api/admin/dashboard', { cookie: login.cookie });
        assert.equal(dashboard.status, 200);
        assert.equal(dashboard.body.orders.length, 1);
        assert.equal(dashboard.body.orders[0].status, 'Packed');
        assert.equal(dashboard.body.help.length, 1);
        assert.equal(dashboard.body.carts.length, 0);
        assert.equal(fs.readdirSync(dataDir).length, 0, 'MongoDB mode must not write fallback files');
        assert.equal((await request('/api/admin/logout', { method: 'POST', cookie: login.cookie })).status, 200);
        assert.equal((await request('/api/admin/dashboard', { cookie: login.cookie })).status, 401);
    });

    it('rejects invalid products and keeps database configuration private', async () => {
        const invalid = await request('/api/cart', { method: 'PUT', body: { items: [{ name: 'Unknown product', quantity: 1 }] } });
        assert.equal(invalid.status, 400);
        assert.equal((await request('/.env')).status, 404);
        assert.equal((await request('/storage.js')).status, 404);
        assert.equal((await request('/data/commerce.json')).status, 404);
    });

    it('checks a connection without creating collections or exposing invalid credentials', async () => {
        const run = promisify(execFile);
        const script = path.join(__dirname, '..', 'scripts', 'check-db.js');
        const result = await run(process.execPath, [script], { env: { ...process.env, MONGODB_DB_NAME: 'read_only_check' } });
        assert.match(result.stdout, /MongoDB connected/);
        const inspector = new MongoClient(mongo.getUri());
        try {
            await inspector.connect();
            assert.deepEqual(await inspector.db('read_only_check').listCollections().toArray(), []);
        } finally { await inspector.close(); }
        await assert.rejects(run(process.execPath, [script], { env: { ...process.env, MONGODB_URI: 'mongodb://user:private-test-password@invalid host/' } }), error => {
            assert.equal(error.code, 1);
            assert.doesNotMatch(error.stderr, /private-test-password/);
            assert.match(error.stderr, /MongoDB check failed/);
            return true;
        });
    });
});
