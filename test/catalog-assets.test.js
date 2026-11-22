const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../catalog.json');

test('catalog names are unique across the categories the storefront can filter', () => {
    const categories = new Set(['clothing', 'electronics', 'home', 'accessories', 'footwear']);
    const seenNames = new Set();
    for (const product of catalog) {
        const name = product.name.trim().toLowerCase();
        assert.ok(name, 'Products need a display name');
        assert.ok(!seenNames.has(name), 'Duplicate catalog name: ' + product.name);
        seenNames.add(name);
        assert.ok(categories.has(product.category), 'Unrecognized category for ' + product.name);
    }
    assert.deepEqual(new Set(catalog.map(product => product.category)), categories);
});

test('local catalog photos exist and use a path the storefront serves', () => {
    const localPhotos = catalog.filter(product => product.image?.startsWith('images/'));
    assert.ok(localPhotos.length > 0, 'Expected local product photos');
    for (const { image, name } of localPhotos) {
        assert.match(image, /^images\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|svg)$/, name);
        assert.ok(fs.statSync(path.resolve(__dirname, '..', image)).isFile(), image);
    }
});
