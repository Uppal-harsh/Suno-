# EasyKart

## Voice Shopping for Everyone

EasyKart is an accessibility-focused e-commerce frontend designed to make online shopping simpler through a voice-first experience. Instead of relying entirely on traditional search and navigation, the interface places a conversational shopping assistant at the center of the experience.

## Core Idea

**Speak → Understand → Discover → Add to Cart → Checkout**

The interface is designed around a simple shopping flow where users can communicate what they need, view relevant products, manage their cart, and request human assistance.

## Features

- Voice-first shopping interface
- Conversational shopping assistant UI
- Product discovery and filtering interface
- Product cards with pricing and ratings
- Shopping cart interface
- Quantity management
- Checkout flow
- Human assistance option
- Accessibility-focused layout
- Responsive web design

## Technology Stack

- **HTML5** — semantic page structure
- **CSS3** — layout, styling and responsive design
- **JavaScript** — frontend interactions
- **Figma** — UI/UX design and prototyping
- **Git & GitHub** — version control

## Project Structure

```text
EasyKart/
├── index.html
├── style.css
├── script.js
├── progress.md
├── README.md
└── images/
```

## Design

The current design contains three primary screens:

1. **Home** — voice-first shopping assistant
2. **Voice Results** — product results based on a shopping request
3. **Cart** — selected products and order summary

The design prioritizes readable typography, strong contrast, large controls, clear navigation and simple interaction patterns.

## Current Status

The frontend design and core page structure are under development.

Completed:
- Basic project structure
- Navigation
- Categories
- Product listing
- Cart Section
- Voice assistant UI
- Product card styling
- Figma prototype

The local demo supports category and keyword filtering, a persistent cart, quantity
updates, and a validated Help form saved to `data/help_requests.json`.
Voice uses the browser’s speech recognition and spoken prompts. Checkout saves a demo order for the admin.

## Run and prepare for viva

Use Node.js 22 or newer. Run `npm ci` from the project folder, then `npm start`.
Open [EasyKart locally](http://127.0.0.1:8000).
Use this server for form submission; a static server cannot write the JSON file.

In VS Code you can also choose **Terminal → Run Task → Start EasyKart**.
Keep that terminal running and open **http://127.0.0.1:8000**.
The Live Server **Go Live** button opens port 5500, which only previews pages;
it rejects form POST requests with error 405. The Help page now explains this
before submission and provides a link to the working form.

See [VIVA.md](VIVA.md) for the requirement mapping, code terms, demonstration steps
and project limitations. Form data in `data/` is excluded from Git.

## Try voice shopping

1. Click **Try voice shopping** and allow the microphone in a browser that supports speech recognition.
2. Say “I want jeans under one thousand.” The ₹799 and ₹999 jeans appear on the home page.
3. After the spoken question, say “yes” and give another search, or say “no” to turn the microphone off.

Use the typed search if your browser cannot recognize speech. The same filter understands
“under” as a strict limit and “up to” as an inclusive limit.

## Team

**Group 4**

- Harsh Uppal
- Ishan Singh
- Ishank Chauhan
- Om Sharma
- Divyam Kumar

## Project Objective

To create a simple and accessible shopping interface that reduces the complexity of conventional e-commerce navigation and demonstrates how voice-first interaction can make online shopping easier for a wider range of users.

## Academic Project

**Course Code:** CSE2022  
**Course:** Web Programming  
**Batch:** 2025, 3rd Semester  
**Academic Year:** 2026–27

## Backend

`server.js` uses Express for page serving, JSON request parsing and Help submissions.
`commerce.js` registers the cart, checkout and admin routes. Node’s file-system module
continues to read and write the existing local JSON files.


## Store and admin features

- Add-to-cart toast with View cart link, button feedback and a navigation item count.
- Checkout collects customer name, email and delivery address and saves purchased items.
- The server calculates totals using catalog.json, ignoring client-supplied prices.
- Duplicate retries of the same checkout return the existing order.
- Admin dashboard shows orders, customer details, items, quantities, totals and statuses.
- Search and filter orders; update New, Confirmed, Packed, Delivered or Cancelled status.
- Active carts are shown as anonymous guests. Names are supplied only at checkout; there are no customer accounts or identity verification.
- Help inbox displays existing and new Help requests.

### Start and sign in

Run npm start (or node server.js) and keep the terminal open.
Open http://127.0.0.1:8000, add products, then proceed to checkout.
Open http://127.0.0.1:8000/admin.html or choose Store admin in the footer.
The terminal displays a random admin password on each server start. To choose a persistent password, set ADMIN_PASSWORD in your terminal environment before starting Node; do not put the password in Git.
Admin sessions expire after eight hours and are invalidated when the server restarts. Sign out on a shared computer.
Use Refresh in the dashboard to load the latest activity.

### Storage and limitations

Help messages remain in data/help_requests.json. Orders and active carts are in data/commerce.json.
Both files are private and excluded from Git; the upgrade does not replace existing data.
The cart also remains in browser localStorage. Server syncing requires the Node server, not Live Server.
Saved carts are not restored to another device and are not verified customer identities.
Orders are classroom demo records, not actual payments or fulfilment requests. Order value is not collected revenue.
This remains a single-process, localhost-only demo with JSON storage, not a production shop.
`catalog.json` holds 100 demo products across five categories. Product records have a name,
price in rupees and category, with optional local image paths and ratings. Edit this file to
update the Products page, voice search and checkout. Restart the server after changing the catalog.

### API overview

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/help | Submit Help message |
| GET | /api/cart | Start anonymous browser session |
| PUT | /api/cart | Sync current cart |
| POST | /api/orders | Save checkout order |
| POST | /api/admin/login | Sign in with admin password |
| GET | /api/admin/dashboard | Read orders, carts and Help messages (admin only) |
| PATCH | /api/admin/orders/:id | Change order status (admin only) |
| POST | /api/admin/logout | End admin session |
