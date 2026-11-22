const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('configuration loads the project .env from another working directory and respects overrides', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'easykart-config-'));
    const project = path.join(root, 'project');
    const modulePath = path.join(project, 'config.js');
    const projectEnv = path.join(project, '.env');
    const otherEnv = path.join(root, '.env');
    t.after(() => {
        for (const file of [modulePath, projectEnv, otherEnv]) fs.rmSync(file, { force: true });
        if (fs.existsSync(project)) fs.rmdirSync(project);
        fs.rmdirSync(root);
    });
    fs.mkdirSync(project);
    fs.copyFileSync(path.join(__dirname, '..', 'config.js'), modulePath);
    fs.writeFileSync(projectEnv, 'MONGODB_DB_NAME=fixture_project\n');
    fs.writeFileSync(otherEnv, 'MONGODB_DB_NAME=wrong_directory\n');

    const env = { ...process.env };
    delete env.MONGODB_DB_NAME;
    const args = ['-e', 'require(process.argv[1]); console.log(process.env.MONGODB_DB_NAME)', modulePath];
    const readName = testEnv => execFileSync(process.execPath, args, {
        cwd: root, env: testEnv, encoding: 'utf8', timeout: 5000
    }).trim();
    assert.equal(readName(env), 'fixture_project');
    assert.equal(readName({ ...env, MONGODB_DB_NAME: 'fixture_override' }), 'fixture_override');
});
