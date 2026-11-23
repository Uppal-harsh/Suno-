# Verify EasyKart

Use Node.js 22 or newer (`node --version`) and install the locked dependencies
with `npm ci` before the first run. These commands should run from the folder
containing `package.json`.

Run `npm test` from `Suno-` for the offline suite. It checks source validation, configuration, the catalog, and selected HTTP contracts without opening a MongoDB connection. The HTTP tests bind only to loopback and use a temporary port.

To investigate environment loading separately, run
`node --test test/config.test.js`. This check uses temporary fixture files and
does not need a MongoDB server.

For the persistence flow, run `npm run test:integration` with a reachable MongoDB server. The runner generates its own database name, seeds it with fixture data, and drops that database after the run. Its database user must be able to create and drop the generated database. Prefer a local MongoDB process or a non-production cluster for this run.

In PowerShell, use a fresh terminal for an isolated local run:

```powershell
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017'
npm.cmd test
npm.cmd run test:integration
```

Start the local MongoDB process separately first. Close that terminal afterward so the URI override does not carry over to an Atlas demo.

A successful integration run prints a line beginning `PASS: real MongoDB`.
It checks persistence after closing and reopening the connection. Passing
`npm test` alone does not establish that a live MongoDB connection works.

When an integration check fails, record the stage printed by the runner. A connection-stage failure says the driver could not reach the configured database. A checkout assertion after a successful connection points to app behavior or stored test data.
