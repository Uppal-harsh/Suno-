const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStorage } = require('../storage');

describe('JSON storage in a temporary directory', () => {
    let dataDir;
    let storage;
    beforeEach(async () => {
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easykart-storage-'));
        storage = createStorage({ dataDir, uri: '' });
        await storage.connect();
    });
    afterEach(async () => {
        await storage.close();
        fs.rmSync(dataDir, { recursive: true, force: true });
    });

    it('starts with empty records without creating files', async () => {
        assert.deepEqual(await storage.listOrders(), []);
        assert.deepEqual(await storage.listCarts(), []);
        assert.deepEqual(await storage.listHelp(), []);
        assert.deepEqual(fs.readdirSync(dataDir), []);
    });

    it('persists help messages across storage instances', async () => {
        const message = { name: 'Demo shopper', email: 'demo@example.com', message: 'Please help with an order.', submitted_at: '2026-11-22T10:00:00Z' };
        await storage.addHelp(message);
        const reopened = createStorage({ dataDir, uri: '' });
        assert.deepEqual(await reopened.listHelp(), [message]);
    });

    it('replaces and removes an anonymous cart', async () => {
        await storage.saveCart('visitor-a', { visitor: 'visitor', items: [{ name: 'Jeans', quantity: 1 }] });
        const updated = { visitor: 'visitor', items: [{ name: 'Jeans', quantity: 2 }] };
        await storage.saveCart('visitor-a', updated);
        assert.deepEqual(await storage.listCarts(), [updated]);
        await storage.saveCart('visitor-a', null);
        assert.deepEqual(await storage.listCarts(), []);
    });

    it('saves an order once, clears its cart and preserves later carts on retries', async () => {
        const order = { id: 'order-a', visitorId: 'visitor-a', requestId: 'request-a', status: 'New', total: 799 };
        await storage.saveCart(order.visitorId, { items: [{ name: 'Jeans', quantity: 1 }] });
        assert.deepEqual(await storage.createOrder(order), { order, created: true });
        assert.deepEqual(await storage.listCarts(), []);
        await storage.saveCart(order.visitorId, { items: [{ name: 'Watch', quantity: 1 }] });
        assert.deepEqual(await storage.createOrder({ ...order, id: 'discarded-retry-id' }), { order, created: false });
        assert.equal((await storage.listOrders()).length, 1);
        assert.equal((await storage.listCarts()).length, 1);
    });

    it('persists order status changes and reports a missing order', async () => {
        await storage.createOrder({ id: 'order-a', visitorId: 'visitor-a', requestId: 'request-a', status: 'New' });
        const update = { status: 'Packed', updated_at: '2026-11-22T11:00:00Z' };
        assert.equal((await storage.updateOrder('order-a', update)).status, 'Packed');
        assert.equal((await storage.listOrders())[0].updated_at, update.updated_at);
        assert.equal(await storage.updateOrder('missing', update), undefined);
    });

    it('leaves malformed saved JSON intact', async () => {
        const file = path.join(dataDir, 'help_requests.json');
        fs.writeFileSync(file, '{broken');
        await assert.rejects(storage.addHelp({ message: 'Do not overwrite existing data.' }), SyntaxError);
        assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
    });

    it('refuses to overwrite JSON with an invalid commerce structure', async () => {
        const file = path.join(dataDir, 'commerce.json');
        const invalid = JSON.stringify({ orders: [], carts: [] });
        fs.writeFileSync(file, invalid);
        await assert.rejects(storage.saveCart('visitor-a', { items: [] }), /Invalid saved commerce data/);
        assert.equal(fs.readFileSync(file, 'utf8'), invalid);
    });
});
