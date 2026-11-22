const fs = require('node:fs');
const path = require('node:path');

// Resolve relative to the project even when Node is launched from another folder.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
