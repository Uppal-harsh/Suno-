// Read-only connection check. This does not import files or create records/indexes.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { MongoClient } = require('mongodb');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri || /<[^>]+>/.test(uri)) {
        console.error('Set MONGODB_URI in the EasyKart .env file, then run npm run db:check again.');
        process.exitCode = 1;
        return;
    }
    let client;
    try {
        client = new MongoClient(uri, { family: 4, serverSelectionTimeoutMS: 10000 });
        await client.connect();
        const databaseName = process.env.MONGODB_DB_NAME || 'easykart';
        const db = client.db(databaseName);
        await db.command({ ping: 1 });
        console.log('MongoDB connected. Database: ' + databaseName);
        for (const name of ['orders', 'carts', 'help_requests']) {
            console.log(name + ': ' + await db.collection(name).countDocuments() + ' records');
        }
    } catch {
        // Driver messages can contain connection details; never print the URI/password.
        console.error('MongoDB check failed. Check the URI, database user, IP access list and network.');
        process.exitCode = 1;
    } finally {
        await client?.close();
    }
}

main().catch(() => { process.exitCode = 1; });
