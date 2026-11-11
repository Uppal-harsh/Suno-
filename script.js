// 1. JSON converts cart objects to text for browser storage and back again.
function loadCart() {
    try {
        const items = JSON.parse(localStorage.getItem("easykartCart") || "[]");
        if (!Array.isArray(items)) return [];
        return items.filter(function(item) {
            return item && typeof item.name === "string" && Number.isFinite(item.price) &&
                item.price >= 0 && Number.isSafeInteger(item.quantity) && item.quantity > 0;
        });
    } catch (error) {
        return [];
    }
}
let cart = loadCart();

function cartMessage(message) {
    const status = document.getElementById("cartStatus");
    if (status) status.textContent = message;
    if (typeof showToast === "function") showToast(message);
}

function saveCart() {
    try {
        localStorage.setItem("easykartCart", JSON.stringify(cart));
        renderCart();
        if (typeof updateCartBadge === "function") updateCartBadge();
        if (typeof syncCart === "function") syncCart();
        return true;
    } catch (error) {
        cart = loadCart();
        renderCart();
        cartMessage("Could not save. Please allow browser storage and try again.");
        return false;
    }
}

// 2. 'this' in the HTML passes the clicked button to this function.
function addToCart(button) {
    const card = button.closest(".card");
    const name = card.querySelector(".product-title").textContent;
    const price = Number(card.querySelector(".price").textContent.replace("₹", ""));
    cart = loadCart();
    const item = cart.find(function(product) { return product.name === name; });
    if (item) {
        if (item.quantity >= 99) { cartMessage("Maximum 99 of each product."); return; }
        item.quantity += 1;
    } else {
        cart.push({ name: name, price: price, quantity: 1,
            image: card.querySelector("img")?.getAttribute("src") });
    }
    if (saveCart()) {
        cartMessage(name + " added to your cart.");
        button.textContent = "Added!";
        clearTimeout(button.feedbackTimer);
        button.feedbackTimer = setTimeout(() => { button.textContent = "Add to Cart"; }, 1500);
    }
}

function calculateTotal() {
    let total = 0;
    for (const item of cart) total += item.price * item.quantity;
    return total;
}

function changeQuantity(index, amount) {
    if (cart[index].quantity + amount > 99) { cartMessage("Maximum 99 of each product."); return; }
    cart[index].quantity += amount;
    if (cart[index].quantity === 0) cart.splice(index, 1);
    if (saveCart()) cartMessage("Cart updated.");
}

function clearCart() {
    cart = [];
    if (saveCart()) cartMessage("Your cart is now empty.");
}

function checkout() {
    openCheckout();
}

// 3. Clone the HTML template and fill its text. textContent treats names as text.
function renderCart() {
    const list = document.getElementById("cartItems");
    if (!list) return;
    list.replaceChildren();
    if (!cart.length) list.textContent = "Your cart is empty. Visit Products to add an item.";
    cart.forEach(function(item, index) {
        const row = document.getElementById("cartTemplate").content.firstElementChild.cloneNode(true);
        row.querySelector(".item-num").textContent = index + 1;
        const image = row.querySelector("img");
        image.hidden = !item.image || !/^(images\/|https?:\/\/)/.test(item.image);
        if (!image.hidden) image.src = item.image;
        image.alt = item.name;
        row.querySelector("h4").textContent = item.name;
        row.querySelector(".item-details p").textContent = "₹" + item.price + " each";
        row.querySelector(".qty-control span").textContent = item.quantity;
        const buttons = row.querySelectorAll("button");
        buttons[0].setAttribute("aria-label", "Decrease quantity of " + item.name);
        buttons[1].setAttribute("aria-label", "Increase quantity of " + item.name);
        buttons[0].onclick = function() { changeQuantity(index, -1); };
        buttons[1].onclick = function() { changeQuantity(index, 1); };
        row.querySelector(".item-price").textContent = "₹" + item.price * item.quantity;
        list.appendChild(row);
    });
    document.getElementById("subtotal").textContent = "₹" + calculateTotal();
    document.getElementById("deliveryFee").textContent = "₹0";
    document.getElementById("totalPrice").textContent = "₹" + calculateTotal();
}

// Read the product words and an optional rupee ceiling.
function parseProductSearch(query) {
    const smallNumbers = {
        one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9
    };
    const normalized = query.toLowerCase().replace(/(\d),(?=\d)/g, "$1")
        .replace(/\b(one|two|three|four|five|six|seven|eight|nine)[ -]+(hundred|thousand)\b/g,
            (_, number, scale) => smallNumbers[number] * (scale === "thousand" ? 1000 : 100));
    const budget = /\b(under|below|less than|up to|at most)\s*(?:₹|rs\.?\s*|inr\s*)?\s*(\d+(?:\.\d+)?)(\s*k\b)?(?:\s+rupees?)?/;
    const limit = normalized.match(budget);
    const words = normalized.replace(budget, "").replace(/[^a-z0-9]+/g, " ")
        .replace(/\b(show|me|i|want|would|like|need|for|a|an|the|please|find|some|can|you|all|pair|of|get|looking|priced)\b/g, "")
        .trim().split(/\s+/).filter(Boolean);
    return {
        words,
        maxPrice: limit ? Number(limit[2]) * (limit[3] ? 1000 : 1) : Infinity,
        inclusive: Boolean(limit && ["up to", "at most"].includes(limit[1]))
    };
}

function productCard(product, position) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <div class="img-wrap"><span class="badge-num"></span><img loading="lazy"></div>
        <div class="card-meta"><span class="price"></span><span class="rating"></span></div>
        <p class="product-title"></p>
        <button class="btn-orange" type="button">Add to Cart</button>`;
    if (product.image) {
        const image = card.querySelector("img");
        image.src = product.image;
        image.alt = product.name;
        card.querySelector(".badge-num").textContent = position;
    } else {
        card.querySelector(".img-wrap").remove();
    }
    card.querySelector(".price").textContent = "₹" + product.price;
    if (product.rating) card.querySelector(".rating").textContent = "★ " + product.rating;
    card.querySelector(".product-title").textContent = product.name;
    const button = card.querySelector("button");
    button.addEventListener("click", () => addToCart(button));
    return card;
}

async function showProducts(root, params, signal) {
    const response = await fetch("catalog.json", { signal });
    if (!response.ok) throw new Error("Could not load the catalog.");
    const catalog = await response.json();
    signal?.throwIfAborted();
    const category = params.get("category");
    const query = params.get("q") || "";
    const labels = new Map([
        ["clothing", "Clothing"], ["electronics", "Electronics"], ["home", "Home & Kitchen"],
        ["accessories", "Accessories"], ["footwear", "Footwear"]
    ]);
    const { words, maxPrice, inclusive } = parseProductSearch(query);
    const matches = catalog.filter(product => {
        if (labels.has(category) && product.category !== category) return false;
        if (inclusive ? product.price > maxPrice : product.price >= maxPrice) return false;
        const name = product.name.toLowerCase();
        return words.every(word => {
            const singular = word.replace(/watches$/, "watch").replace(/s$/, "");
            return name.includes(word) || (singular.length > 0 && name.includes(singular));
        });
    });

    root.querySelector("[data-product-grid]").replaceChildren(
        ...matches.map((product, index) => productCard(product, index + 1))
    );
    const label = labels.get(category);
    root.querySelector(".results-header h2").textContent = query ? "Search: " + query : label || "All Products";
    root.querySelector(".results-header p").textContent = matches.length + " products available";
    root.querySelector(".filter-tag").textContent = "Category: " + (label || "All");
    root.querySelector("#cartStatus").textContent = matches.length ? "" : "No matching products. Try another search.";
}

async function showVoiceProducts(query, signal) {
    const results = document.getElementById("voiceResults");
    await showProducts(results, new URLSearchParams({ q: query }), signal);
    results.hidden = false;
    results.scrollIntoView({ block: "start" });
}

// 5. The homepage uses simple keywords, not an AI service.
function sendMessage() {
    const input = document.getElementById("chatInput");
    const message = input.value.trim();
    if (!message) return;
    const command = message.toLowerCase();
    if (command.includes("cart")) window.location.href = "cart.html";
    else if (command.includes("categor")) window.location.href = "categories.html";
    else if (command.includes("help")) window.location.href = "help.html";
    else window.location.href = "products.html?q=" + encodeURIComponent(message);
}

// 6. Prevent page reload, validate the form, then POST JSON to the Node.js server.
async function submitHelp(event) {
    event.preventDefault();
    if (!document.getElementById("serverNotice").hidden) return;
    const form = event.target;
    const status = document.getElementById("formStatus");
    const data = { name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(), message: form.elements.message.value.trim() };
    if (data.name.length < 2 || data.message.length < 10) {
        status.textContent = "Enter a name of at least 2 characters and a message of at least 10 characters.";
        return;
    }
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Saving your request...";
    try {
        const response = await fetch("/api/help", { method: "POST",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        if (response.status === 405 || response.status === 501) {
            document.getElementById("serverNotice").hidden = false;
            status.textContent = "This server cannot save forms. Use the link above.";
            return;
        }
        const result = await response.json();
        status.textContent = result.message;
        if (response.ok) form.reset();
    } catch (error) {
        status.textContent = "Saving was not confirmed. Keep this page open, run node server.js, and try again. Your entries are still here.";
    }
    button.disabled = false;
}

// 7. Attach events after the browser has created the page elements.
document.addEventListener("DOMContentLoaded", function() {
    renderCart();
    const productGrid = document.querySelector("main > [data-product-grid]");
    if (productGrid) {
        showProducts(productGrid.parentElement, new URLSearchParams(window.location.search)).catch(() => {
            document.querySelector(".results-header p").textContent = "Could not load products. Open EasyKart through the local server.";
        });
    }
    const helpForm = document.getElementById("helpForm");
    if (helpForm) {
        helpForm.onsubmit = submitHelp;
        // Live Server displays pages, but only our Node.js server saves JSON.
        if (window.location.protocol === "file:" || window.location.port !== "8000") {
            document.getElementById("serverNotice").hidden = false;
            helpForm.querySelector("button").disabled = true;
        }
    }
    if (!document.getElementById("chatInput")) return;
    document.getElementById("searchForm").onsubmit = function(event) {
        event.preventDefault();
        sendMessage();
    };
    for (const chip of document.querySelectorAll(".suggestion-chip")) {
        chip.onclick = function() { document.getElementById("chatInput").value = chip.dataset.query; sendMessage(); };
    }
});

window.addEventListener("storage", function(event) {
    if (event.key === "easykartCart" || event.key === null) { cart = loadCart(); renderCart(); }
});
