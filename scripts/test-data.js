const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function removeTestData(directory) {
    const target = fs.realpathSync(directory);
    const allowed = fs.realpathSync(os.tmpdir());
    if (path.dirname(target) !== allowed || !path.basename(target).startsWith('easykart-')) {
        throw new Error('Refusing to remove a directory outside EasyKart temporary test data.');
    }
    fs.rmSync(target, { recursive: true, force: true });
}

module.exports = { removeTestData };
