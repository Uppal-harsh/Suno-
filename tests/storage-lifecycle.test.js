const { it } = require('node:test');
const assert = require('node:assert/strict');
const { createStorage } = require('../storage');

it('closes a failed MongoDB client and never falls back to local JSON', async () => {
    let closes = 0;
    const storage = createStorage({ uri: 'mongodb://test-only', clientFactory: () => ({
        connect: async () => { throw new Error('Simulated connection failure'); },
        close: async () => { closes++; }
    }) });
    await assert.rejects(storage.connect(), /Simulated connection failure/);
    assert.deepEqual(await storage.health(), { mode: 'mongodb', connected: false });
    assert.equal(closes, 1);
    await assert.rejects(storage.listOrders(), /not connected/);
    await assert.rejects(storage.addHelp({ message: 'Must not write locally' }), /not connected/);
    await storage.close();
    assert.equal(closes, 1);
});

it('refuses writes before configured MongoDB has connected', async () => {
    const storage = createStorage({ uri: 'mongodb://test-only' });
    await assert.rejects(storage.saveCart('visitor', { items: [] }), /not connected/);
    await assert.rejects(storage.createOrder({ id: 'order' }), /not connected/);
    await assert.rejects(storage.updateOrder('order', {}), /not connected/);
    await assert.rejects(storage.listCarts(), /not connected/);
    await assert.rejects(storage.listHelp(), /not connected/);
    await storage.close();
});

it('identifies the offline JSON storage mode', async () => {
    const storage = createStorage({ uri: '' });
    assert.deepEqual(await storage.health(), { mode: 'json', connected: true });
    await storage.close();
});
