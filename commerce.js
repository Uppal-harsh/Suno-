// Local classroom demo: plain Node.js, JSON files, and cookie sessions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const catalog = require('./catalog.json');
const file = path.join(__dirname, 'data', 'commerce.json');
const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
const digest = value => crypto.createHash('sha256').update(value).digest();
const sessions = new Map();
const attempts = new Map();
const statuses = ['New', 'Confirmed', 'Packed', 'Delivered', 'Cancelled'];

function send(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
}
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function readStore() {
    if (!fs.existsSync(file)) return { orders: [], carts: {} };
    const store = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(store.orders) || !store.carts || typeof store.carts !== 'object' || Array.isArray(store.carts)) {
        throw new Error('Invalid saved store');
    }
    return store;
}
function writeStore(store) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(store, null, 2));
    fs.renameSync(file + '.tmp', file);
}
function cookie(req, name) {
    const pair = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
    return pair ? pair.slice(name.length + 1) : '';
}
function visitor(req, res) {
    let id = cookie(req, 'ek_visitor');
    if (!/^[a-f0-9]{32}$/.test(id)) {
        id = crypto.randomBytes(16).toString('hex');
        res.setHeader('Set-Cookie', `ek_visitor=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);
    }
    return id;
}
function authenticated(req) {
    const token = cookie(req, 'ek_admin');
    const expires = sessions.get(token);
    if (!expires || expires < Date.now()) { sessions.delete(token); fail(401, 'Please sign in to the admin portal.'); }
    return token;
}
async function json(req) {
    if ((req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') fail(415, 'Send application/json.');
    const chunks = []; let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 16000) fail(413, 'Request too large.');
        chunks.push(chunk);
    }
    try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
        return data;
    } catch { fail(400, 'Enter a valid JSON object.'); }
}
function itemsFrom(input, allowEmpty = false) {
    if (!Array.isArray(input) || input.length > 50 || (!allowEmpty && !input.length)) fail(400, 'Please add products before ordering.');
    const items = new Map();
    for (const item of input) {
        const product = catalog.find(p => p.name === item?.name);
        if (!product || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) fail(400, 'A product or quantity is invalid.');
        const quantity = (items.get(product.name)?.quantity || 0) + item.quantity;
        if (quantity > 99) fail(400, 'Maximum 99 of each product.');
        items.set(product.name, { ...product, quantity });
    }
    return [...items.values()];
}
function text(value, min, max, label) {
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `Please enter a valid ${label}.`);
    return value.trim();
}

async function handle(req, res, url) {
    try {
        if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) fail(403, 'Use this website to submit the request.');
        if (url === '/api/admin/login' && req.method === 'POST') {
            const ip = req.socket?.remoteAddress || 'local';
            const attempt = attempts.get(ip) || { count: 0, until: Date.now() + 60000 };
            if (attempt.until < Date.now()) { attempt.count = 0; attempt.until = Date.now() + 60000; }
            if (attempt.count >= 5) fail(429, 'Too many attempts. Wait one minute.');
            const data = await json(req);
            if (typeof data.password !== 'string' || !crypto.timingSafeEqual(digest(data.password), digest(password))) {
                attempt.count++; attempts.set(ip, attempt); fail(401, 'Incorrect password.');
            }
            attempts.delete(ip);
            for (const [token, expiry] of sessions) if (expiry < Date.now()) sessions.delete(token);
            const token = crypto.randomBytes(32).toString('hex');
            sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
            res.setHeader('Set-Cookie', `ek_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
            return send(res, 200, { message: 'Signed in.' });
        }
        if (url.startsWith('/api/admin/')) {
            const token = authenticated(req);
            if (url === '/api/admin/logout' && req.method === 'POST') {
                sessions.delete(token);
                res.setHeader('Set-Cookie', 'ek_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
                return send(res, 200, { message: 'Signed out.' });
            }
            if (url === '/api/admin/dashboard' && req.method === 'GET') {
                const store = readStore();
                const helpFile = path.join(__dirname, 'data', 'help_requests.json');
                const help = fs.existsSync(helpFile) ? JSON.parse(fs.readFileSync(helpFile, 'utf8')) : [];
                if (!Array.isArray(help)) throw new Error('Invalid help data');
                return send(res, 200, { orders: store.orders, carts: Object.values(store.carts), help, statuses });
            }
            const match = url.match(/^\/api\/admin\/orders\/([a-f0-9-]{36})$/);
            if (match && req.method === 'PATCH') {
                const data = await json(req);
                if (!statuses.includes(data.status)) fail(400, 'Invalid order status.');
                const store = readStore(); const order = store.orders.find(o => o.id === match[1]);
                if (!order) fail(404, 'Order not found.');
                order.status = data.status; order.updated_at = new Date().toISOString(); writeStore(store);
                return send(res, 200, { order });
            }
            fail(404, 'Admin API not found.');
        }
        if (url === '/api/cart' && req.method === 'GET') {
            const id = visitor(req, res);
            return send(res, 200, { visitor: id.slice(0, 8) });
        }
        if (url === '/api/cart' && req.method === 'PUT') {
            const data = await json(req); const items = itemsFrom(data.items, true);
            const id = visitor(req, res); const store = readStore();
            if (items.length) store.carts[id] = { visitor: id.slice(0, 8), items, updated_at: new Date().toISOString() };
            else delete store.carts[id];
            writeStore(store); return send(res, 200, { message: 'Cart synced.' });
        }
        if (url === '/api/orders' && req.method === 'POST') {
            const data = await json(req);
            const requestId = text(data.requestId, 36, 36, 'order reference');
            if (!/^[a-f0-9-]{36}$/.test(requestId)) fail(400, 'Invalid order reference.');
            const id = visitor(req, res); const store = readStore();
            const existing = store.orders.find(o => o.visitorId === id && o.requestId === requestId);
            if (existing) return send(res, 200, { order: existing });
            const customer = { name: text(data.customer?.name, 2, 80, 'name'),
                email: text(data.customer?.email, 3, 120, 'email'),
                address: text(data.customer?.address, 10, 300, 'delivery address') };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) fail(400, 'Please enter a valid email.');
            const items = itemsFrom(data.items);
            const order = { id: crypto.randomUUID(), requestId, visitorId: id, customer, items,
                total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
                status: 'New', payment: 'Demo - no payment collected', created_at: new Date().toISOString() };
            store.orders.push(order); delete store.carts[id]; writeStore(store);
            return send(res, 201, { order });
        }
        fail(404, 'API not found.');
    } catch (error) {
        send(res, error.status || 500, { message: error.status ? error.message : 'Could not save or load data. Please try again.' });
    }
}
module.exports = { handle, password };
