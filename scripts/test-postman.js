// Optional Postman CLI regression run using disposable MongoDB data, never Atlas.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { removeTestData } = require('./test-data');

async function main() {
    let mongo, storage, server, dataDir;
    try {
        mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easykart-postman-'));
        process.env.MONGODB_URI = mongo.getUri();
        process.env.MONGODB_DB_NAME = 'easykart_postman_test';
        process.env.EASYKART_DATA_DIR = dataDir;
        // A public test fixture, valid only for this isolated temporary server.
        process.env.ADMIN_PASSWORD = 'isolated-test-password';
        const app = require('../server');
        storage = require('../storage');
        await storage.connect();
        await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
        const args = ['collection', 'run', path.join(__dirname, '..', 'postman', 'EasyKart.postman_collection.json'),
            '--env-var', 'baseUrl=http://127.0.0.1:' + server.address().port,
            '--env-var', 'adminPassword=isolated-test-password', '--no-report-events'];
        process.exitCode = await new Promise((resolve, reject) => {
            const child = spawn(process.platform === 'win32' ? 'postman.exe' : 'postman', args, { stdio: 'inherit' });
            child.once('error', reject);
            child.once('exit', code => resolve(code ?? 1));
        });
    } catch (error) {
        console.error(error.code === 'ENOENT' ? 'Install the official Postman CLI to run npm run test:postman.' : 'The isolated Postman check could not finish.');
        process.exitCode = 1;
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        await storage?.close();
        await mongo?.stop();
        if (dataDir) removeTestData(dataDir);
    }
}

main().catch(() => { process.exitCode = 1; });
