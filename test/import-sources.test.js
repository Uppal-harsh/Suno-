const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareSources, importData } = require('../import-data');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'easykart-import-'));
    const data = path.join(root, 'data');
    const files = [];
    t.after(() => {
        for (const file of files) fs.rmSync(file, { force: true });
        if (fs.existsSync(data)) fs.rmdirSync(data);
        fs.rmdirSync(root);
    });
    fs.mkdirSync(data);
    const write = (file, value) => {
        const target = path.join(root, file);
        files.push(target);
        fs.writeFileSync(target, JSON.stringify(value));
    };
    write('catalog.json', [{ name: 'Fixture headphones', price: 850, category: 'electronics' }]);
    return { root, write };
}

test('legacy commerce and Help files are optional on a new checkout', t => {
    const { root } = fixture(t);
    const counts = Object.fromEntries(prepareSources(root).map(source => [source.name, source.documents.length]));
    assert.deepEqual(counts, { products: 1, orders: 0, carts: 0, help_requests: 0 });
});

test('saved carts recover the visitor ID from the commerce file key', t => {
    const { root, write } = fixture(t);
    const visitorId = 'a'.repeat(32);
    write('data/commerce.json', { orders: [], carts: { [visitorId]: { visitor: 'aaaaaaaa', items: [] } } });
    const { documents, key } = prepareSources(root).find(source => source.name === 'carts');
    assert.deepEqual(documents, [{ visitor: 'aaaaaaaa', visitorId, items: [] }]);
    assert.deepEqual(key(documents[0]), { visitorId });
});

test('an invalid Help record aborts the import before any database access', async t => {
    const { root, write } = fixture(t);
    write('data/help_requests.json', [{ name: 'Missing message', email: 'example@example.com' }]);
    let accessedDatabase = false;
    const database = { collection() { accessedDatabase = true; throw new Error('Unexpected database access'); } };
    await assert.rejects(importData(database, root), /Invalid saved Help request/);
    assert.equal(accessedDatabase, false);
});
