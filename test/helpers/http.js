const { once } = require('node:events');

async function startHttpFixture(t) {
    // Test the HTTP layer without calling the production startup or connecting to MongoDB.
    const app = require('../../server');
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
    }));
    await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;
    return (path, options = {}) => fetch(origin + path, {
        ...options, signal: AbortSignal.timeout(5000)
    });
}

module.exports = { startHttpFixture };
