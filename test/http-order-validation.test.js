const test = require('node:test');
const assert = require('node:assert/strict');
const { startHttpFixture } = require('./helpers/http');

test('checkout rejects an invalid request reference before storage is consulted', async t => {
    const request = await startHttpFixture(t);
    const response = await request('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: 'short-reference' })
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /order reference/i);
});

test('Help rejects incomplete details and reports the supported method', async t => {
    const request = await startHttpFixture(t);
    const invalid = await request('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test shopper', email: 'test@example.com', message: 'Short' })
    });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).message, /valid name, email and message/i);

    const unsupported = await request('/api/help');
    assert.equal(unsupported.status, 405);
    assert.equal(unsupported.headers.get('allow'), 'POST');
});
