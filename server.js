// Express server: run node server.js, then open http://127.0.0.1:8000.
require('dotenv').config();
const express = require('express');
const path = require('node:path');

const ROOT = __dirname;
const commerce = require('./commerce');
const storage = require('./storage');
const pages = new Set(['index.html', 'categories.html', 'products.html',
    'cart.html', 'help.html', 'style.css', 'script.js', 'tomato.png', 'admin.html', 'admin.js', 'shop.js', 'voice.js', 'catalog.json']);
const app = express();
app.disable('x-powered-by');

function reply(res, status, message) {
    res.status(status).json({ message });
}

app.use((req, res, next) => {
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) {
        return reply(res, 403, 'Use localhost or 127.0.0.1.');
    }
    next();
});

function jsonBody(limit, invalidMessage) {
    const parse = express.json({ limit, inflate: false });
    return (req, res, next) => {
        if (!req.is('application/json')) return reply(res, 415, 'Send the request as application/json.');
        parse(req, res, error => {
            if (error?.status === 413) return reply(res, 413, 'Request is too large.');
            if (error?.status === 415) return reply(res, 415, 'Unsupported request encoding.');
            if (error || !req.body || Array.isArray(req.body)) return reply(res, 400, invalidMessage);
            next();
        });
    };
}

async function saveHelp(req, res) {
    let name, email, message;
    try {
        const data = req.body;
        if (!data || Array.isArray(data) ||
            !['name', 'email', 'message'].every(key => typeof data[key] === 'string')) {
            throw new Error('Expected text fields');
        }
        ({ name, email, message } = data);
        name = name.trim(); email = email.trim(); message = message.trim();
        if (name.length < 2 || name.length > 80 || message.length < 10 ||
            message.length > 1000 || email.length > 120 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
            throw new Error('Invalid fields');
        }
    } catch {
        return reply(res, 400, 'Please enter a valid name, email and message.');
    }
    try {
        await storage.addHelp({ name, email, message, submitted_at: new Date().toISOString() });
    } catch {
        return reply(res, 500, 'Could not save the request. Please try again.');
    }
    reply(res, 200, 'Request saved successfully. Thank you!');
}

app.post('/api/help', jsonBody(10000, 'Please enter a valid name, email and message.'), saveHelp);
app.all('/api/help', (req, res) => {
    res.set('Allow', 'POST');
    reply(res, 405, 'Use POST to submit a help request.');
});
commerce.registerRoutes(app, jsonBody(16000, 'Enter a valid JSON object.'));

app.use((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD');
        return reply(res, 405, 'Method not allowed.');
    }
    let pathname;
    try { pathname = decodeURIComponent(req.path); }
    catch { return reply(res, 400, 'Invalid URL.'); }
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    // Serve only public assets, never saved contact details or repository files.
    if (!pages.has(file) && !/^images\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|svg)$/.test(file)) {
        return reply(res, 404, 'Page not found.');
    }
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(file, { root: ROOT }, error => {
        if (error && !res.headersSent) reply(res, error.status === 404 ? 404 : 500, 'Could not load the file.');
    });
});

if (require.main === module) {
    storage.connect().then(() => {
        const server = app.listen(8000, '127.0.0.1', () => {
            console.log('Open http://127.0.0.1:8000 - press Ctrl+C to stop.');
            console.log('Admin: http://127.0.0.1:8000/admin.html');
            console.log('Admin password: ' + commerce.password);
        });
        server.on('error', error => {
            console.error(error.code === 'EADDRINUSE'
                ? 'Port 8000 is busy. Stop the earlier server, then try again.' : error.message);
            process.exitCode = 1;
            storage.close().catch(() => { process.exitCode = 1; });
        });
        const shutdown = () => {
            process.removeListener('SIGINT', shutdown);
            process.removeListener('SIGTERM', shutdown);
            server.close(() => {
                storage.close().catch(() => { process.exitCode = 1; });
            });
        };
        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);
    }).catch(error => {
        console.error('Database connection failed. Check MONGODB_URI and network access.');
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = app;
