const test = require('node:test');
const assert = require('node:assert/strict');
const { startHttpFixture } = require('./helpers/http');

test('storefront pages and their checked-in scripts are served from loopback', async t => {
    const request = await startHttpFixture(t);
    for (const path of ['/', '/categories.html', '/products.html', '/cart.html', '/help.html', '/admin.html']) {
        const response = await request(path);
        assert.equal(response.status, 200, path);
        assert.match(response.headers.get('content-type'), /^text\/html/, path);
        const html = await response.text();
        for (const [, script] of html.matchAll(/<script\s+src="([^"]+)"/g)) {
            const scriptResponse = await request('/' + script);
            assert.equal(scriptResponse.status, 200, script);
            assert.match(scriptResponse.headers.get('content-type'), /javascript/, script);
            await scriptResponse.text();
        }
    }
    const css = await request('/style.css', { method: 'HEAD' });
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /^text\/css/);
});

test('health reports unavailable before a database is connected', async t => {
    const request = await startHttpFixture(t);
    const response = await request('/api/health');
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { mode: 'mongodb', connected: false });
});
