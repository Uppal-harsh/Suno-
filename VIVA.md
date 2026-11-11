# EasyKart viva guide

## Run the project

1. Open the project folder in VS Code.
2. In Terminal, run `npm ci` once, then `npm start`.
3. Open http://127.0.0.1:8000.
4. Stop with Ctrl+C. If port 8000 is busy, stop the earlier server first.

A static preview server serves pages but cannot save submitted forms.
In VS Code, **Terminal → Run Task → Start EasyKart** starts the server after dependencies are installed.
Use port **8000**, not Live Server's **5500**. Error **405** means that the
server does not allow the POST method used by our form. The Help page detects
the wrong port, disables submission, and links to the Node.js-served form.
If a save fails, entered details remain in the form so they can be retried.

## Explain the project in your own words

“HTML creates the page structure, CSS styles it, and JavaScript handles clicks,
search, form submission and cart updates. Cart data stays in browser storage.
The Help form sends JSON to a small Node.js server, which saves it in a local file.”

## Where each requirement is implemented

| Visible evaluation requirement | Implementation |
| --- | --- |
| Additional linked pages | Home, Categories, Products, Cart and Help; links use `href`. |
| JavaScript interactions | Product filtering, suggestion buttons, cart quantities and totals. |
| Forms and validation | Help form: required name, valid email, message of 10–1000 characters. |
| Form submission | `submitHelp()` prevents reload and sends a POST request with `fetch()`. |
| Local JSON file saving | `server.js` writes each valid request to `data/help_requests.json`. |

Only the second-evaluation requirements were visible in the supplied screenshot.

## Viva: saving submitted form data to a local JSON file

This requirement is implemented by the Help form. Its flow is:

`Help form → JavaScript → POST /api/help → Node.js → data/help_requests.json`

Say this in your own words:

“Our Help form collects a name, email and message. JavaScript checks the input,
converts it into JSON text and sends it to our local Node.js server. Node.js checks
the data again, reads the saved requests, adds the new request and saves the list
back into help_requests.json. Then the page shows a success message.”

| Teacher may ask | Simple answer |
| --- | --- |
| What is JSON? | JavaScript Object Notation: a text format for storing and exchanging data using named fields and values. |
| Which form saves data? | The Help form in `help.html`. |
| What does JavaScript do? | `submitHelp()` collects the fields. `JSON.stringify(data)` makes JSON text; `fetch()` sends it using POST. |
| What is POST? | An HTTP request method used here to submit data to the server. |
| What is `/api/help`? | The address on our local server that receives Help submissions. It is not an external service. |
| Why use Node.js? | Ordinary browser code cannot silently write to our project folder. The local server performs that file-writing step. |
| What does `JSON.parse()` do? | Converts JSON text into JavaScript objects so we can read or update it. |
| What does `requests.push()` do? | Adds the new request to the list while keeping previous requests. |
| What does `JSON.stringify()` do? | Converts the list back into JSON text. The third argument `2` makes the file easy to read. |
| Why write a temporary file? | The server finishes writing first, then replaces the saved file, reducing the risk of leaving a partly written file. |
| Does it create a file for every submission? | No. One JSON file holds a list of all requests. Each submission adds one record. |
| What is saved? | Name, email, message and submission time (`submitted_at`). |
| Is this the same as localStorage? | No. The cart uses browser localStorage; Help submissions use an actual file in the project folder. |
| Does refreshing delete the requests? | No. They remain on disk after refreshing or restarting the server. |
| Why validate twice? | Browser checks help the visitor; server checks also reject invalid requests sent directly. |

To demonstrate this point:

1. Run `npm start` in the VS Code terminal. If it is already running, use it.
2. Open `http://127.0.0.1:8000/help.html`.
3. Enter a fictional name, a valid email such as `demo@example.test`, and a message of at least 10 characters.
4. Click Submit Request and show the success message.
5. In VS Code, open `data/help_requests.json` and show the new record.
6. Submit another message and show both records in the list.

Use this Node.js server for the demonstration. Opening the HTML directly or using
VS Code Live Server alone does not provide the POST handler needed to save the file.
The folder is created automatically on the first valid submission and is ignored
by Git so submitted contact details are not committed.

## Files to study

- `index.html`: homepage and assistant controls.
- `categories.html`: links with a category in the URL.
- `products.html`: grid for the product cards rendered by `script.js`.
- `catalog.json`: 100 local products shared by search, voice results and checkout.
- `cart.html`: a reusable `<template>` for cart rows.
- `help.html`: labelled inputs and the Help form.
- `style.css`: colours, spacing, Grid, Flexbox and responsive media queries.
- `script.js`: cart, product filtering, results rendering and form events.
- `voice.js`: waits for recognition to end, shows results, speaks the follow-up and listens for yes or no.
- `server.js`: Express serves files, parses JSON and handles Help submissions.
- `commerce.js`: Express routes for cart, orders and admin.

## Explain the shared Warm storefront theme

All five pages use the same CSS colours, header and footer. The design uses ordinary HTML and CSS; no framework or extra library is needed.

- `.home-hero` uses CSS Grid to put the introduction and photos in two columns.
- `display: flex` arranges buttons and navigation links in a row. `flex-wrap` lets them move to a new row on a small screen.
- `position: relative` on `.hero-photos` makes it the reference for the small photo's `position: absolute`.
- `transform: rotate(5deg)` slightly tilts the small photo. `border-radius` rounds its corners.
- `object-fit: cover` fills each photo box without stretching the image.
- Colour variables in `:root`, such as `--bg`, store values for every page. `var(--bg)` reads one.
- `@media (max-width: 900px)` stacks the hero on smaller screens. At 600px, the navigation and category grid become more compact.
- `@media (prefers-color-scheme: dark)` changes every page’s colours to match the device's appearance.
- The search form's `onsubmit` calls `preventDefault()` and the existing `sendMessage()` function. Pressing Enter or choosing “Find it” searches the products.
- Product photos and category tiles are normal `<a href="...">` links. The microphone still uses `startVoice()`.

- The homepage has categories, featured products and a three-step guide, so it scrolls naturally.
- An anchor such as `href="#categories"` jumps to the element with `id="categories"`. `scroll-behavior: smooth` makes that movement smooth without JavaScript.
- `prefers-reduced-motion` turns off smooth scrolling when a visitor requests less motion.
- Featured product buttons reuse `addToCart(this)`. There is no separate cart or slider code.
- Each page includes the same `<footer>` with ordinary links and a `#top` link back to its header.

## JavaScript terms used in this project

| Term | Meaning here |
| --- | --- |
| `const` / `let` | Declare a variable; `let` allows reassignment. |
| Function | A named block of code, such as `calculateTotal()`. |
| Array / object | The cart is a list; each product contains named values. |
| DOM | The browser's representation of HTML elements. |
| `getElementById` / `querySelector` | Find an element by ID or a CSS selector. |
| `closest('.card')` | Find the clicked button's containing product card. |
| `textContent` | Read or set plain text without interpreting it as HTML. |
| `for...of` / `forEach` | Repeat work for the items in a list. |
| Callback | A function passed to another method, such as `forEach`. |
| `find` / `filter` / `every` | Find one item, select matching items, or check all words. |
| `push` / `splice` | Add a cart item or remove an item at an index. |
| `cloneNode(true)` | Copy a template element and its children. |
| `onclick` / `onsubmit` | Functions run when the user clicks or submits. |
| `DOMContentLoaded` | Runs setup after the HTML elements have been created. |
| `preventDefault()` | Stop the form's normal page reload. |
| `JSON.stringify` / `JSON.parse` | Convert objects to JSON text / JSON text to objects. |
| `localStorage` | Browser storage that survives a reload; it is not a JSON file. |
| `URLSearchParams` | Read values such as `?category=clothing` or `?q=shirts`. |
| `encodeURIComponent` | Safely include spaces and special characters in a URL value. |
| Regular expression | A text pattern used to recognise a price limit or validate email. |
| `async` / `await` | Wait for the server response without blocking the page. |
| `fetch` / POST | Send the form data to the server. |
| `try` / `catch` | Handle failures such as blocked storage or a stopped server. |
| `Boolean` / `Number` | Convert a value to true/false or a number. |
| `===`, `&&`, `||`, `!` | Equal with matching type, AND, OR, NOT. |

## Node.js terms used in the server

- `require('node:http')`: loads the built-in HTTP module.
- `http.createServer`: receives requests and sends responses.
- `req.method` and the URL path select the request handler.
- `req.on('data')` / `req.on('end')`: collect the submitted JSON body.
- `JSON.parse` / `JSON.stringify`: read JSON text / produce JSON text.
- `fs.readFileSync` / `fs.writeFileSync`: read and write local files.
- `fs.mkdirSync`: creates the data folder; `fs.renameSync` replaces the file after writing.
- `200`, `400`, `404`, `405`, `413`, `415`, `500`: success, invalid input, missing route, wrong method, oversized body, wrong content type, server failure.
- Server validation repeats browser checks because a request can bypass the form.
- Synchronous saving processes one write at a time; this is suitable for a small local demo.
- Static files are allowlisted so private JSON data and source files cannot be downloaded.

## Demonstration order

1. Navigate through all five pages.
2. Open Electronics: its 20 products appear.
3. On Home, click “Headphones under ₹2000”: matching products appear.
4. Add a product twice, open Cart and show quantity, total and reload persistence.
5. Decrease a quantity to zero, open checkout, then demonstrate Clear Cart.
6. In Help, try submitting empty fields or a bad email to show browser validation.
7. Submit a test name, email and message. Show the success text and open
   `data/help_requests.json` in VS Code. Submit again to show records append.

## Limits to explain honestly

- Product names, prices and ratings are sample project data.
- Search uses words and an optional “under ₹2000” limit; it is not an AI model.
- Voice uses the browser's speech recognition, requires permission and depends on browser support.
  You can demonstrate all search features by typing if voice is unavailable.
- Checkout saves a demo order; no payment service is connected.
- Help requests are saved locally. They are not emailed or sent to a live support team.
- This server is intended for a single local classroom demonstration.
- `data/` is ignored by Git so real submitted contact details are not committed.

## New checkout and admin demonstration

1. Run `npm start` and note the admin password printed in the terminal.
2. Add a product: show the toast, Added button and cart count.
3. Open Store admin in another tab, sign in, and open Active carts to see an anonymous guest cart.
4. Return to Cart, choose Proceed to checkout, and submit fictional customer details.
5. In admin, choose Refresh and Orders. Show customer name/email/address, items and the server-calculated total.
6. Change the order from New to Packed and refresh to demonstrate persistence.
7. Search by name or product and filter by status. Open Help inbox to view saved requests.
8. Sign out: customer/order data must no longer be accessible through the admin APIs.

### How to explain the new code

shop.js displays notifications, syncs carts using fetch, and submits checkout JSON.
commerce.js validates requests and uses JSON.parse / JSON.stringify with the fs module to store records.
The server chooses prices from catalog.json; it does not trust a price sent by the browser.
A random HttpOnly cookie identifies an anonymous browser; this is not a verified user account.
At checkout, the customer provides their details, which are saved on the order.
A separate HttpOnly admin cookie identifies a signed-in administrator. The server checks it before returning data or accepting a status update.
A requestId makes retries return the same order instead of creating duplicates.
The order and cart change are saved together in commerce.json using a temporary file and rename.
Admin pages insert customer text with textContent so it is displayed as text instead of executable HTML.
There is no payment processing, customer login or automatic delivery integration.
