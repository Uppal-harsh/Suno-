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
- **Node.js 22+ and Express** — local server and API routes
- **MongoDB** — products, carts, orders and Help request storage
- **Figma** — UI/UX design and prototyping
- **Git & GitHub** — version control

## Project Structure

```text
EasyKart/
├── index.html
├── style.css
├── script.js
├── server.js
├── commerce.js
├── storage.js
├── config.js
├── import-data.js
├── catalog.json
├── .env.example
├── docs/
├── test/
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
updates, and a validated Help form saved to MongoDB.
Voice uses the browser’s speech recognition and spoken prompts. Checkout saves a demo order for the admin.

## Run and prepare for viva

Use Node.js 22 or newer. Run `npm ci` from the project folder, configure MongoDB
as described below, run `npm run db:import`, then `npm start`.
Open [EasyKart locally](http://127.0.0.1:8000).
Use this server for shopping and form submission; it connects to MongoDB.

In VS Code you can also choose **Terminal → Run Task → Start EasyKart**.
Keep that terminal running and open **http://127.0.0.1:8000**.
The Live Server **Go Live** button opens port 5500, which only previews pages;
it rejects form POST requests with error 405. The Help page now explains this
before submission and provides a link to the working form.

See the [demo checklist](docs/demo-checklist.md) for presentation steps and
[data flow guide](docs/data-flow.md) for storage behavior. Project limitations
are listed below. Form data in `data/` is excluded from Git.

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
`commerce.js` registers the cart, checkout and admin routes. `storage.js` manages the
MongoDB connection and database operations using the official Node.js driver.
`config.js` loads the local `.env` file. The server connects before accepting requests
and closes the database connection on shutdown.


## Store and admin features

- Add-to-cart toast with View cart link, button feedback and a navigation item count.
- Checkout collects customer name, email and delivery address and saves purchased items.
- The server calculates totals using MongoDB product prices, ignoring client-supplied prices.
- Duplicate retries of the same checkout return the existing order.
- Admin dashboard shows orders, customer details, items, quantities, totals and statuses.
- Search and filter orders; update New, Confirmed, Packed, Delivered or Cancelled status.
- Active carts are shown as anonymous guests. Names are supplied only at checkout; there are no customer accounts or identity verification.
- Help inbox displays existing and new Help requests.

### Start and sign in

Run `npm start` (or `node server.js`) and keep the terminal open.
Open [the storefront](http://127.0.0.1:8000), add products, then proceed to checkout.
Open [Store Admin](http://127.0.0.1:8000/admin.html) or choose Store admin in the footer.
The terminal displays a random admin password on each server start. To choose a persistent password, set ADMIN_PASSWORD in your terminal environment before starting Node; do not put the password in Git.
Admin sessions expire after eight hours and are invalidated when the server restarts. Sign out on a shared computer.
Use Refresh in the dashboard to load the latest activity.

### MongoDB setup

1. Sign in at [MongoDB Atlas](https://cloud.mongodb.com/) and create an EasyKart project.
2. Create a **Free / M0** cluster and choose a nearby available region.
3. Under Database Access, create a database user with read/write access to the
   `easykart` database. This is separate from your Atlas account login.
4. Under Network Access, add the current public IP address of the computer running Node.
   Update this entry if the evaluation network changes.
5. Choose **Connect → Drivers → Node.js** and copy the connection string.
6. Copy `.env.example` to `.env` if `.env` does not already exist. Replace
   `MONGODB_URI` with your connection string and its password placeholder with your
   database user's password. Percent-encode special characters in the password.
   Keep the complete URI private. `.env` is ignored by Git and cannot be served by Express.
7. Run these commands in the project folder:

```bash
npm ci
npm run db:import
npm start
```

`.env` uses these settings:

```dotenv
MONGODB_URI=mongodb+srv://DATABASE_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=easykart
ADMIN_PASSWORD=your-local-admin-password
```

An empty `ADMIN_PASSWORD` uses a random password printed in the terminal.
For an existing local MongoDB server, use `mongodb://127.0.0.1:27017` as the URI.
There is no automatic JSON fallback: missing configuration or an unavailable database
stops startup after at most three connection attempts for transient network failures.
The connection uses IPv4; TLS and certificate verification remain enabled.
A connection failure while running returns a failed API response.
Check [database health](http://127.0.0.1:8000/api/health) after startup.

### Collections and import

| Collection | Document structure |
| --- | --- |
| `products` | Stable `id`, unique `name`, `price` in rupees, `category`, optional `image` and `rating` |
| `carts` | Unique full `visitorId`, abbreviated `visitor` for admin display, embedded `items`, `updated_at` |
| `orders` | Unique `id`, `visitorId`, `requestId`, embedded `customer` and `items`, `total`, `status`, `payment`, `created_at`, optional `updated_at` |
| `help_requests` | `name`, `email`, `message`, `submitted_at` |
| `_migrations` | Internal completion markers for the initial JSON import |

MongoDB also assigns each document an internal `_id`. API responses omit this field.
A unique compound index on `(visitorId, requestId)` prevents duplicate checkout retries.
Customer details and purchased product prices are embedded in each order to preserve
its checkout snapshot. The server reads product prices from MongoDB and calculates
totals itself, ignoring client-supplied prices.

`npm run db:import` imports the 100 products in `catalog.json`, plus any existing
orders/carts in `data/commerce.json` and messages in `data/help_requests.json`.
Missing optional data files are treated as empty sources. Original files are unchanged.
The import validates sources before writes and only inserts missing records. Interrupted
imports can be rerun. Completed sources are skipped on reruns, preserving database edits
and preventing cleared carts from reappearing. Run it before starting normal app use.
After import, edit products in MongoDB; editing `catalog.json` does not update the live catalog.
Both product listings and voice search load `/api/products`.

### Verification and evaluation

- [Demo checklist](docs/demo-checklist.md)
- [Atlas troubleshooting](docs/atlas-troubleshooting.md)
- [Data flow and storage](docs/data-flow.md)
- [Running the tests](docs/testing.md)

```bash
npm test
npm run test:integration
```

The first command checks configuration failure and import validation without connecting
to MongoDB. The integration command needs a working `MONGODB_URI`; it generates a
separate `easykart_test_<random>` database on the same cluster, uses synthetic records,
and drops that test database afterward. It never uses the configured application database.
The test database needs read/write and drop permissions; use an appropriate test user if
normal application credentials are scoped only to `easykart`.

The integration check covers import reruns, product loading, cart syncing, concurrent
checkout retries, trusted prices, newer-cart preservation, admin authentication and status
updates, Help submissions, and persistence after closing/reopening the database connection.

For the evaluation, open Products, add an item, checkout, then sign in to the admin page.
Show the order in Atlas Data Explorer under `easykart.orders`. Update its status in admin,
refresh Atlas, restart Node, sign back in, and demonstrate that the record remains saved.
Submit a Help request and show it in both the dashboard and `easykart.help_requests`.

### Limitations

The browser cart still uses localStorage and syncs to MongoDB. It is not restored to
another device, and visitor cookies are anonymous browser identifiers rather than customer
accounts. Admin sessions remain in server memory and require login after a restart.
This is a localhost classroom demo. Orders do not collect payments or trigger fulfilment.
Atlas needs an internet connection and an allowed IP address during the evaluation.

### API overview

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/products | List MongoDB products for browsing and search |
| GET | /api/health | Report MongoDB connectivity (200 or 503) |
| POST | /api/help | Submit Help message |
| GET | /api/cart | Start anonymous browser session |
| PUT | /api/cart | Sync current cart |
| POST | /api/orders | Save checkout order |
| POST | /api/admin/login | Sign in with admin password |
| GET | /api/admin/dashboard | Read orders, carts and Help messages (admin only) |
| PATCH | /api/admin/orders/:id | Change order status (admin only) |
| POST | /api/admin/logout | End admin session |
