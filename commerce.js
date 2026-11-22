// Express commerce routes backed by MongoDB and cookie sessions.
require('./config');
const storage = require('./storage');
const crypto = require('node:crypto');
const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
const digest = value => crypto.createHash('sha256').update(value).digest();
const sessions = new Map();
const attempts = new Map();
const statuses = ['New', 'Confirmed', 'Packed', 'Delivered', 'Cancelled'];

function send(res, status, body) {
    res.set('Cache-Control', 'no-store').status(status).json(body);
}
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
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
async function itemsFrom(input, allowEmpty = false) {
    if (!Array.isArray(input) || input.length > 50 || (!allowEmpty && !input.length)) fail(400, 'Please add products before ordering.');
    const catalog = await storage.listProducts();
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

function registerRoutes(app, parseJson) {
    app.use('/api', (req, res, next) => {
        if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin &&
            req.headers.origin !== `http://${req.headers.host}`) {
            fail(403, 'Use this website to submit the request.');
        }
        next();
    });

    app.post('/api/admin/login', parseJson, (req, res) => {
        const ip = req.socket?.remoteAddress || 'local';
        const attempt = attempts.get(ip) || { count: 0, until: Date.now() + 60000 };
        if (attempt.until < Date.now()) { attempt.count = 0; attempt.until = Date.now() + 60000; }
        if (attempt.count >= 5) fail(429, 'Too many attempts. Wait one minute.');
        const data = req.body;
        if (typeof data.password !== 'string' || !crypto.timingSafeEqual(digest(data.password), digest(password))) {
            attempt.count++; attempts.set(ip, attempt); fail(401, 'Incorrect password.');
        }
        attempts.delete(ip);
        for (const [token, expiry] of sessions) if (expiry < Date.now()) sessions.delete(token);
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
        res.setHeader('Set-Cookie', `ek_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
        return send(res, 200, { message: 'Signed in.' });
    });

    app.use('/api/admin', (req, res, next) => {
        req.adminToken = authenticated(req);
        next();
    });

    app.post('/api/admin/logout', (req, res) => {
        sessions.delete(req.adminToken);
        res.setHeader('Set-Cookie', 'ek_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        return send(res, 200, { message: 'Signed out.' });
    });

    app.get('/api/admin/dashboard', async (req, res) => {
        const [orders, carts, help] = await Promise.all([
            storage.listOrders(), storage.listCarts(), storage.listHelp()
        ]);
        return send(res, 200, { orders, carts, help, statuses });
    });

    app.patch(/^\/api\/admin\/orders\/([a-f0-9-]{36})$/, parseJson, async (req, res) => {
        const data = req.body;
        if (!statuses.includes(data.status)) fail(400, 'Invalid order status.');
        const order = await storage.updateOrder(req.params[0], {
            status: data.status, updated_at: new Date().toISOString()
        });
        if (!order) fail(404, 'Order not found.');
        return send(res, 200, { order });
    });

    app.get('/api/cart', (req, res) => {
        const id = visitor(req, res);
        return send(res, 200, { visitor: id.slice(0, 8) });
    });

    app.put('/api/cart', parseJson, async (req, res) => {
        const data = req.body; const items = await itemsFrom(data.items, true);
        const id = visitor(req, res);
        await storage.saveCart(id, items.length ? {
            visitor: id.slice(0, 8), items, updated_at: new Date().toISOString()
        } : null);
        return send(res, 200, { message: 'Cart synced.' });
    });

    app.post('/api/orders', parseJson, async (req, res) => {
        const data = req.body;
        const requestId = text(data.requestId, 36, 36, 'order reference');
        if (!/^[a-f0-9-]{36}$/.test(requestId)) fail(400, 'Invalid order reference.');
        const id = visitor(req, res);
        const existing = await storage.findOrder(id, requestId);
        if (existing) {
            await storage.finishCheckout(existing);
            return send(res, 200, { order: existing });
        }
        const customer = { name: text(data.customer?.name, 2, 80, 'name'),
            email: text(data.customer?.email, 3, 120, 'email'),
            address: text(data.customer?.address, 10, 300, 'delivery address') };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) fail(400, 'Please enter a valid email.');
        const items = await itemsFrom(data.items);
        const order = { id: crypto.randomUUID(), requestId, visitorId: id, customer, items,
            total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
            status: 'New', payment: 'Demo - no payment collected', created_at: new Date().toISOString() };
        const saved = await storage.createOrder(order);
        return send(res, saved.created ? 201 : 200, { order: saved.order });
    });

    app.use('/api/admin', (req, res) => send(res, 404, { message: 'Admin API not found.' }));
    app.use('/api', (req, res) => send(res, 404, { message: 'API not found.' }));
    app.use('/api', (error, req, res, next) => {
        if (res.headersSent) return next(error);
        send(res, error.status || 500, {
            message: error.status ? error.message : 'Could not save or load data. Please try again.'
        });
    });
}

module.exports = { registerRoutes, password };
