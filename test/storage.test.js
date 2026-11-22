const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStorage } = require('../storage');
const { prepareSources } = require('../import-data');

test('missing MongoDB configuration fails without using JSON storage', async () => {
    const storage = createStorage({ uri: '' });
    await assert.rejects(storage.connect(), /Set MONGODB_URI/);
    assert.deepEqual(await storage.health(), { mode: 'mongodb', connected: false });
    assert.throws(() => storage.listProducts(), /not connected/);
    await storage.close();
});

test('catalog import produces stable unique identifiers', () => {
    const first = prepareSources(path.join(__dirname, '..'))[0].documents;
    const second = prepareSources(path.join(__dirname, '..'))[0].documents;
    assert.equal(first.length, 100);
    assert.equal(new Set(first.map(product => product.id)).size, first.length);
    assert.deepEqual(first, second);
});

test('import rejects malformed source data before database writes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'easykart-unit-'));
    try {
        fs.mkdirSync(path.join(root, 'data'));
        fs.writeFileSync(path.join(root, 'catalog.json'), JSON.stringify([{ name: 'Test', price: -1, category: 'home' }]));
        assert.throws(() => prepareSources(root), /Invalid product/);
        fs.writeFileSync(path.join(root, 'catalog.json'), '[]');
        fs.writeFileSync(path.join(root, 'data', 'commerce.json'), JSON.stringify({ orders: [], carts: [] }));
        assert.throws(() => prepareSources(root), /Invalid commerce/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
