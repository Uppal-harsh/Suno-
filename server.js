// Plain Node.js server: run node server.js, then open http://127.0.0.1:8000.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const commerce = require('./commerce');
const DATA_FILE = path.join(ROOT, 'data', 'help_requests.json');
const pages = new Set(['index.html', 'categories.html', 'products.html',
    'cart.html', 'help.html', 'style.css', 'script.js', 'tomato.png', 'admin.html', 'admin.js', 'shop.js']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function reply(res, status, message) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message }));
}

function saveHelp(req, res) {
    if ((req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') {
        req.resume();
        return reply(res, 415, 'Send the request as application/json.');
    }
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
        size += chunk.length;
        if (size <= 10000) chunks.push(chunk);
        else if (!res.writableEnded) reply(res, 413, 'Request is too large.');
    });
    req.on('error', () => {
        if (!res.writableEnded) reply(res, 400, 'Could not read the request.');
    });
    req.on('end', () => {
        if (res.writableEnded) return;
        let name, email, message;
        try {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
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
            fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
            const requests = fs.existsSync(DATA_FILE)
                ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : [];
            if (!Array.isArray(requests)) throw new Error('Saved data must be a list');
            requests.push({ name, email, message, submitted_at: new Date().toISOString() });
            // Synchronous read/write keeps submissions sequential in this small local demo.
            // Rename only after writing, preserving the old file if the write fails.
            const temporary = DATA_FILE + '.tmp';
            fs.writeFileSync(temporary, JSON.stringify(requests, null, 2), 'utf8');
            fs.renameSync(temporary, DATA_FILE);
        } catch {
            return reply(res, 500, 'Could not save the request. Please try again.');
        }
        reply(res, 200, 'Request saved successfully. Thank you!');
    });
}

const server = http.createServer((req, res) => {
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return reply(res, 403, 'Use localhost or 127.0.0.1.');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { return reply(res, 400, 'Invalid URL.'); }
    if (pathname === '/api/help') {
        if (req.method === 'POST') return saveHelp(req, res);
        res.setHeader('Allow', 'POST');
        return reply(res, 405, 'Use POST to submit a help request.');
    }
    if (pathname.startsWith('/api/')) return commerce.handle(req, res, pathname);
    if (!['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD');
        return reply(res, 405, 'Method not allowed.');
    }
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    // Serve only public assets, never saved contact details or repository files.
    if (!pages.has(file) && !/^images\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|svg)$/.test(file)) {
        return reply(res, 404, 'Page not found.');
    }
    fs.readFile(path.join(ROOT, file), (error, body) => {
        if (error) return reply(res, error.code === 'ENOENT' ? 404 : 500, 'Could not load the file.');
        res.writeHead(200, { 'Content-Type': types[path.extname(file)],
            'Content-Length': body.length, 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : body);
    });
});

if (require.main === module) {
    server.on('error', error => {
        console.error(error.code === 'EADDRINUSE'
            ? 'Port 8000 is busy. Stop the earlier server, then try again.' : error.message);
        process.exitCode = 1;
    });
    server.listen(8000, '127.0.0.1', () => {
        console.log('Open http://127.0.0.1:8000 - press Ctrl+C to stop.');
        console.log('Admin: http://127.0.0.1:8000/admin.html');
        console.log('Admin password: ' + commerce.password);
    });
}

module.exports = server;
