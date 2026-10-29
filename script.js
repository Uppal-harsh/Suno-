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
    document.getElementById("cartStatus").textContent = message;
}

function saveCart() {
    try {
        localStorage.setItem("easykartCart", JSON.stringify(cart));
        renderCart();
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
        item.quantity += 1;
    } else {
        cart.push({ name: name, price: price, quantity: 1,
            image: card.querySelector("img").getAttribute("src") });
    }
    if (saveCart()) cartMessage(name + " added to your cart.");
}

function calculateTotal() {
    let total = 0;
    for (const item of cart) total += item.price * item.quantity;
    return total;
}

function changeQuantity(index, amount) {
    cart[index].quantity += amount;
    if (cart[index].quantity === 0) cart.splice(index, 1);
    if (saveCart()) cartMessage("Cart updated.");
}

function clearCart() {
    cart = [];
    if (saveCart()) cartMessage("Your cart is now empty.");
}

function checkout() {
    cartMessage(cart.length ? "Order total: ₹" + calculateTotal() +
        ". This is a demo; payment is not connected." : "Please add a product first.");
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

// 4. Read category/search values from the URL and show matching cards.
function filterProducts() {
    const grid = document.querySelector("[data-product-grid]");
    if (!grid) return;
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    const query = (params.get("q") || "").replace(/(\d),(?=\d{3}\b)/g, "$1");
    const labels = { clothing: "Clothing", electronics: "Electronics",
        home: "Home & Kitchen", accessories: "Accessories", footwear: "Footwear" };
    const limit = query.match(/under\s*₹?\s*(\d+)/i);
    const words = query.toLowerCase().replace(/under\s*₹?\s*\d+/g, "")
        .replace(/\b(show|me|i|need|a|an|the|please|find)\b/g, "").trim().split(/\s+/);
    let count = 0;
    for (const card of grid.querySelectorAll(".card")) {
        const name = card.querySelector(".product-title").textContent.toLowerCase();
        const price = Number(card.querySelector(".price").textContent.replace("₹", ""));
        const matches = words.every(function(word) {
            const singular = word.replace(/watches$/, "watch").replace(/s$/, "");
            return name.includes(word) || (singular.length > 0 && name.includes(singular));
        });
        card.hidden = (Boolean(labels[category]) && card.dataset.category !== category) ||
            !matches || (Boolean(limit) && price > Number(limit[1]));
        if (!card.hidden) card.querySelector(".badge-num").textContent = ++count;
    }
    document.querySelector(".results-header h2").textContent = query ? "Search: " + query : labels[category] || "All Products";
    document.querySelector(".results-header p").textContent = count + " products available";
    document.querySelector(".filter-tag").textContent = "Category: " + (labels[category] || "All");
    if (!count) cartMessage("No matching products. Try another category or search.");
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

function startVoice() {
    const status = document.getElementById("voiceStatus");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        status.textContent = "Voice is unavailable here. Please type your search.";
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.onstart = function() { status.textContent = "Listening..."; };
    recognition.onresult = function(event) {
        document.getElementById("chatInput").value = event.results[0][0].transcript;
        status.textContent = "Voice captured. Choose Find it to search.";
    };
    recognition.onerror = function(event) { status.textContent = "Voice error: " + event.error; };
    recognition.onend = function() { document.getElementById("micBtn").disabled = false; };
    document.getElementById("micBtn").disabled = true;
    try { recognition.start(); }
    catch (error) {
        document.getElementById("micBtn").disabled = false;
        status.textContent = "Could not start voice search. Please try again.";
    }
}

// 6. Prevent page reload, validate the form, then POST JSON to the Python server.
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
        status.textContent = "Saving was not confirmed. Keep this page open, run python3 server.py, and try again. Your entries are still here.";
    }
    button.disabled = false;
}

// 7. Attach events after the browser has created the page elements.
document.addEventListener("DOMContentLoaded", function() {
    renderCart();
    filterProducts();
    const helpForm = document.getElementById("helpForm");
    if (helpForm) {
        helpForm.onsubmit = submitHelp;
        // Live Server displays pages, but only our Python server saves JSON.
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
    document.getElementById("micBtn").onclick = startVoice;
});

window.addEventListener("storage", function(event) {
    if (event.key === "easykartCart" || event.key === null) { cart = loadCart(); renderCart(); }
});
