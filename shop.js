// Shopping feedback, anonymous cart sync, and checkout.
let toastTimer;
function showToast(message) {
    let toast = document.getElementById('shopToast');
    if (!toast) {
        toast = document.createElement('div'); toast.id = 'shopToast';
        toast.className = 'shop-toast'; toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite'); document.body.append(toast);
    }
    toast.replaceChildren();
    const text = document.createElement('span'); text.textContent = message;
    const link = document.createElement('a'); link.href = 'cart.html'; link.textContent = 'View cart';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '\u00d7';
    close.setAttribute('aria-label', 'Dismiss notification'); close.onclick = () => { toast.hidden = true; };
    toast.append(text, link, close); toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 5000);
}
function updateCartBadge() {
    const count = loadCart().reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('.nav-links a[href="cart.html"]').forEach(link => {
        link.textContent = `Cart (${count})`;
        link.setAttribute('aria-label', `Cart, ${count} items`);
    });
}
let syncQueue = Promise.resolve();
let sessionReady;
function ensureSession() {
    if (!sessionReady) sessionReady = fetch('/api/cart').then(response => {
        if (!response.ok) throw new Error('Start the Node server to place orders.');
        return response.json();
    }).catch(error => { sessionReady = null; throw error; });
    return sessionReady;
}
function syncCart() {
    if (location.protocol === 'file:') return;
    const items = loadCart();
    syncQueue = syncQueue.catch(() => {}).then(async () => {
        await ensureSession();
        const response = await fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
        if (!response.ok) throw new Error('Cart sync unavailable');
    }).catch(() => {
        const status = document.getElementById('checkoutStatus');
        if (status) status.textContent = 'Your cart is saved in this browser. Start node server.js to place an order.';
    });
}
function openCheckout() {
    if (!loadCart().length) return showToast('Add a product before checkout.');
    const panel = document.getElementById('checkoutPanel');
    panel.hidden = false; panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    panel.querySelector('input').focus();
}
let checkoutBusy = false;
let pendingOrder = null;
async function placeOrder(event) {
    event.preventDefault();
    if (checkoutBusy) return;
    const form = event.target;
    if (!form.reportValidity()) return;
    const status = document.getElementById('checkoutStatus');
    const customer = { name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), address: form.elements.address.value.trim() };
    const items = loadCart();
    if (!items.length && !pendingOrder) { status.textContent = 'Your cart is empty.'; return; }
    // Retain exactly the same request after a network failure to avoid duplicate orders.
    if (!pendingOrder) pendingOrder = { customer, items, requestId: crypto.randomUUID() };
    checkoutBusy = true;
    const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    status.textContent = 'Placing your order...';
    try {
        await syncQueue; await ensureSession();
        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pendingOrder) });
        const result = await response.json();
        if (!response.ok) {
            if (response.status < 500) pendingOrder = null;
            throw new Error(result.message || 'Could not place your order.');
        }
        const ordered = pendingOrder.items;
        pendingOrder = null;
        // Keep any additional quantities added in another tab while checkout was running.
        cart = loadCart().map(item => ({ ...item, quantity: item.quantity - (ordered.find(x => x.name === item.name)?.quantity || 0) })).filter(item => item.quantity > 0);
        saveCart();
        const receipt = document.getElementById('orderReceipt'); receipt.hidden = false;
        receipt.textContent = `Order placed! Reference ${result.order.id.slice(0, 8).toUpperCase()}. Total: INR ${result.order.total.toLocaleString('en-IN')}. Status: ${result.order.status}. No payment has been collected.`;
        status.textContent = 'Your order is saved and visible to the store admin.';
        showToast('Order placed successfully!'); form.reset();
    } catch (error) {
        status.textContent = `${error.message} ${pendingOrder ? 'Click Place order again to safely retry the same order.' : 'Please check your details and try again.'}`;
    } finally { checkoutBusy = false; button.disabled = false; }
}
document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge(); syncCart();
    const form = document.getElementById('checkoutForm');
    if (form) form.addEventListener('submit', placeOrder);
});
window.addEventListener('storage', event => {
    if (event.key === 'easykartCart' || event.key === null) { updateCartBadge(); syncCart(); }
});
