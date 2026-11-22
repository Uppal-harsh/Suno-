// Uses a newly generated test database, never the configured application database.
require('../config');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let stage = 'configuration';

async function main() {
    assert.ok(process.env.MONGODB_URI, 'Configure MONGODB_URI in .env before running the integration check.');
    process.env.MONGODB_DB_NAME = 'easykart_test_' + crypto.randomBytes(8).toString('hex');
    const storage = require('../storage');
    const { importData } = require('../import-data');
    const app = require('../server');
    const { password } = require('../commerce');
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'easykart-integration-'));
    let server;
    try {
        fs.mkdirSync(path.join(fixture, 'data'));
        fs.copyFileSync(path.join(__dirname, '..', 'catalog.json'), path.join(fixture, 'catalog.json'));
        const legacyVisitor = 'a'.repeat(32);
        fs.writeFileSync(path.join(fixture, 'data', 'commerce.json'), JSON.stringify({ orders: [], carts: {
            [legacyVisitor]: { visitor: legacyVisitor.slice(0, 8), items: [], updated_at: new Date(0).toISOString() }
        } }));
        fs.writeFileSync(path.join(fixture, 'data', 'help_requests.json'), JSON.stringify([
            { name: 'Import Test', email: 'test@example.com', message: 'Imported test request', submitted_at: new Date(0).toISOString() }
        ]));
        stage = 'database connection';
        await storage.connect();
        stage = 'import and rerun';
        let counts = await importData(storage.db(), fixture);
        assert.equal(counts.products, 100);
        assert.equal(counts.help_requests, 1);
        await storage.saveCart(legacyVisitor, null);
        counts = await importData(storage.db(), fixture);
        assert.equal(counts.carts, 0, 'completed imports must not resurrect deleted carts');
        assert.equal(counts.help_requests, 1, 'reruns must not duplicate Help records');
        stage = 'HTTP server';
        server = await new Promise((resolve, reject) => {
            const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
            instance.once('error', reject);
        });
        const base = 'http://127.0.0.1:' + server.address().port;
        async function api(url, { method = 'GET', body, cookie } = {}) {
            const response = await fetch(base + url, { method,
                headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
            return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
        }
        stage = 'health, products, and cart';
        assert.equal((await api('/api/health')).status, 200);
        const products = (await api('/api/products')).data;
        assert.equal(products.length, 100);
        const product = products[0];
        const visitor = await api('/api/cart');
        const cookie = visitor.cookie;
        const visitorId = cookie.split('=')[1];
        const items = [{ name: product.name, quantity: 2, price: 1 }];
        assert.equal((await api('/api/cart', { method: 'PUT', cookie, body: { items } })).status, 200);
        const orderBody = { requestId: crypto.randomUUID(), items,
            customer: { name: 'Evaluation Test', email: 'test@example.com', address: '123 Test Street, Test City' } };
        stage = 'concurrent checkout';
        const attempts = await Promise.all(Array.from({ length: 4 }, () => api('/api/orders', { method: 'POST', cookie, body: orderBody })));
        assert.equal(attempts.filter(result => result.status === 201).length, 1);
        for (const result of attempts) assert.ok([200, 201].includes(result.status));
        const order = attempts[0].data.order;
        assert.ok(attempts.every(result => result.data.order.id === order.id));
        assert.equal(order.total, product.price * 2, 'client prices must be ignored');
        assert.equal(await storage.db().collection('orders').countDocuments(), 1);
        assert.equal(await storage.db().collection('carts').countDocuments({ visitorId }), 0);
        stage = 'newer cart preservation';
        await storage.saveCart(visitorId, { visitor: visitorId.slice(0, 8), items: [], updated_at: '9999-01-01T00:00:00.000Z' });
        assert.equal((await api('/api/orders', { method: 'POST', cookie, body: orderBody })).status, 200);
        assert.equal(await storage.db().collection('carts').countDocuments({ visitorId }), 1, 'retry must preserve newer carts');
        stage = 'Help and admin';
        assert.equal((await api('/api/help', { method: 'POST', body: {
            name: 'Help Test', email: 'help@example.com', message: 'Please help with this test order.'
        } })).status, 200);
        assert.equal((await api('/api/admin/dashboard')).status, 401);
        const login = await api('/api/admin/login', { method: 'POST', body: { password } });
        assert.equal(login.status, 200);
        const admin = login.cookie;
        assert.equal((await api('/api/admin/orders/' + order.id, { method: 'PATCH', cookie: admin, body: { status: 'Packed' } })).data.order.status, 'Packed');
        assert.equal((await api('/api/admin/orders/' + order.id, { method: 'PATCH', cookie: admin, body: { status: 'Invalid' } })).status, 400);
        assert.equal((await api('/api/cart', { method: 'PUT', cookie, body: { items: [{ name: product.name, quantity: 0 }] } })).status, 400);
        const dashboard = (await api('/api/admin/dashboard', { cookie: admin })).data;
        assert.equal(dashboard.orders.length, 1);
        assert.equal(dashboard.help.length, 2);
        assert.ok(dashboard.carts.every(cart => !('visitorId' in cart)));
        await new Promise(resolve => server.close(resolve));
        server = undefined;
        stage = 'reconnect persistence';
        await storage.close();
        await storage.connect();
        assert.equal((await storage.findOrder(visitorId, orderBody.requestId)).status, 'Packed');
        assert.equal((await storage.listHelp()).length, 2);
        console.log('PASS: real MongoDB import/rerun, products, cart, concurrent checkout retries, trusted totals, admin status, Help, and reconnect persistence.');
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        // This name is generated above, independently of all user configuration.
        try {
            if ((await storage.health()).connected) await storage.db().dropDatabase();
        } finally {
            await storage.close();
            fs.rmSync(fixture, { recursive: true, force: true });
        }
    }
}

main().catch(error => {
    console.error('Integration check failed at:', stage, '|', error.name, '|', error.cause?.code || error.code || 'no error code');
    if (error.name === 'AssertionError') console.error(error.message);
    process.exitCode = 1;
});
