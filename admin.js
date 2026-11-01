let dashboardData = { orders: [], carts: [], help: [], statuses: [] };
let view = 'orders';
let refreshBusy = false;
const el = id => document.getElementById(id);
const money = number => 'INR ' + number.toLocaleString('en-IN');
function node(tag, text, className) {
    const element = document.createElement(tag); element.textContent = text;
    if (className) element.className = className; return element;
}
async function api(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json' } });
    const result = await response.json();
    if (response.status === 401) setSignedIn(false);
    if (!response.ok) throw new Error(result.message || 'Request failed.');
    return result;
}
function setSignedIn(value) {
    el('loginPanel').hidden = value; el('dashboard').hidden = !value; el('adminActions').hidden = !value;
    if (!value) { dashboardData = { orders: [], carts: [], help: [], statuses: [] }; el('adminList').replaceChildren(); el('stats').replaceChildren(); }
}
async function refresh() {
    if (refreshBusy) return;
    refreshBusy = true; el('refreshButton').disabled = true;
    try {
        dashboardData = await api('/api/admin/dashboard'); setSignedIn(true);
        const selected = el('statusFilter').value;
        el('statusFilter').replaceChildren(new Option('All statuses', ''));
        dashboardData.statuses.forEach(status => el('statusFilter').append(new Option(status, status)));
        el('statusFilter').value = selected; render();
        el('updatedTime').textContent = 'Updated ' + new Date().toLocaleTimeString(); el('adminStatus').textContent = '';
    } catch (error) { el('adminStatus').textContent = error.message; }
    finally { refreshBusy = false; el('refreshButton').disabled = false; }
}
function render() {
    const { orders, carts, help } = dashboardData;
    el('stats').replaceChildren();
    const metrics = [['Orders', orders.length], ['Order value', money(orders.filter(o => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total, 0))], ['Active carts', carts.length], ['Help requests', help.length]];
    metrics.forEach(([label, value]) => { const card = node('div', '', 'stat-card'); card.append(node('span', label), node('strong', String(value))); el('stats').append(card); });
    const descriptions = { orders: 'Customer details are supplied at checkout. Order value excludes cancelled orders and is not collected revenue.', carts: 'Anonymous browser carts, saved on the server. Names become available only when a customer places an order.', help: 'Messages submitted through your Help page. No email is sent automatically.' };
    el('viewDescription').textContent = descriptions[view];
    el('statusFilterLabel').hidden = view !== 'orders';
    const query = el('adminSearch').value.trim().toLowerCase();
    let records = [...dashboardData[view]].reverse();
    if (view === 'orders' && el('statusFilter').value) records = records.filter(o => o.status === el('statusFilter').value);
    records = records.filter(record => JSON.stringify(record).toLowerCase().includes(query));
    const list = el('adminList'); list.replaceChildren();
    if (!records.length) { list.append(node('div', query ? 'No results. Try another search.' : 'Nothing here yet. Activity from your store will appear here.', 'empty-state panel')); return; }
    records.forEach(record => {
        const card = node('article', '', 'panel order-card');
        const top = node('div', '', 'order-card-top');
        const title = view === 'orders' ? `${record.customer.name} · #${record.id.slice(0, 8).toUpperCase()}` : view === 'carts' ? `Guest ${record.visitor}` : record.name;
        top.append(node('h2', title));
        const time = record.created_at || record.updated_at || record.submitted_at;
        top.append(node('span', time ? new Date(time).toLocaleString() : 'Time unavailable', 'muted')); card.append(top);
        if (view === 'orders') {
            card.append(node('p', record.customer.email, 'muted'), node('p', record.customer.address));
            const select = document.createElement('select'); select.setAttribute('aria-label', `Status for order ${record.id}`);
            dashboardData.statuses.forEach(status => select.append(new Option(status, status))); select.value = record.status;
            select.onchange = async () => {
                select.disabled = true;
                try { await api('/api/admin/orders/' + record.id, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); await refresh(); }
                catch (error) { el('adminStatus').textContent = error.message; select.value = record.status; }
                finally { select.disabled = false; }
            };
            const label = node('label', 'Order status ', 'order-status'); label.append(select); card.append(label);
        }
        if (record.items) {
            const items = node('ul', '', 'order-items');
            record.items.forEach(item => { const li = node('li', ''); li.append(node('span', `${item.name} × ${item.quantity}`), node('strong', money(item.price * item.quantity))); items.append(li); });
            card.append(items, node('p', 'Total: ' + money(record.total ?? record.items.reduce((sum, item) => sum + item.price * item.quantity, 0)), 'order-total'));
        } else { card.append(node('p', record.email, 'muted'), node('p', record.message, 'help-message')); }
        if (view === 'orders') card.append(node('p', record.payment, 'muted'));
        list.append(card);
    });
}
el('loginForm').onsubmit = async event => {
    event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
    try { await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: el('adminPassword').value }) }); el('adminPassword').value = ''; await refresh(); }
    catch (error) { el('adminStatus').textContent = error.message; }
    finally { button.disabled = false; }
};
el('logoutButton').onclick = async () => {
    try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); setSignedIn(false); el('adminStatus').textContent = 'Signed out.'; }
    catch (error) { el('adminStatus').textContent = error.message; }
};
el('refreshButton').onclick = refresh;
el('adminSearch').oninput = render; el('statusFilter').onchange = render;
document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => {
    view = button.dataset.view; el('adminSearch').value = '';
    document.querySelectorAll('[data-view]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button))); render();
}; });
refresh();
