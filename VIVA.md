# EasyKart viva guide

## Run the project

1. Open the project folder in VS Code.
2. In Terminal, run `python3 server.py`.
3. Open http://127.0.0.1:8000.
4. Stop with Ctrl+C. If port 8000 is busy, stop the earlier server first.

The plain `python3 -m http.server` command serves pages but cannot save submitted forms.
Python uses only its standard library; no packages need installing.
In VS Code, **Terminal → Run Task → Start EasyKart** runs the same command.
Use port **8000**, not Live Server's **5500**. Error **405** means that the
server does not allow the POST method used by our form. The Help page detects
the wrong port, disables submission, and links to the Python-served form.
If a save fails, entered details remain in the form so they can be retried.

## Explain the project in your own words

“HTML creates the page structure, CSS styles it, and JavaScript handles clicks,
search, form submission and cart updates. Cart data stays in browser storage.
The Help form sends JSON to a small Python server, which saves it in a local file.”

## Where each requirement is implemented

| Visible evaluation requirement | Implementation |
| --- | --- |
| Additional linked pages | Home, Categories, Products, Cart and Help; links use `href`. |
| JavaScript interactions | Product filtering, suggestion buttons, cart quantities and totals. |
| Forms and validation | Help form: required name, valid email, message of 10–1000 characters. |
| Form submission | `submitHelp()` prevents reload and sends a POST request with `fetch()`. |
| Local JSON file saving | `server.py` writes each valid request to `data/help_requests.json`. |

Only the second-evaluation requirements were visible in the supplied screenshot.

## Viva: saving submitted form data to a local JSON file

This requirement is implemented by the Help form. Its flow is:

`Help form → JavaScript → POST /api/help → Python → data/help_requests.json`

Say this in your own words:

“Our Help form collects a name, email and message. JavaScript checks the input,
converts it into JSON text and sends it to our local Python server. Python checks
the data again, reads the saved requests, adds the new request and saves the list
back into help_requests.json. Then the page shows a success message.”

| Teacher may ask | Simple answer |
| --- | --- |
| What is JSON? | JavaScript Object Notation: a text format for storing and exchanging data using named fields and values. |
| Which form saves data? | The Help form in `help.html`. |
| What does JavaScript do? | `submitHelp()` collects the fields. `JSON.stringify(data)` makes JSON text; `fetch()` sends it using POST. |
| What is POST? | An HTTP request method used here to submit data to the server. |
| What is `/api/help`? | The address on our local server that receives Help submissions. It is not an external service. |
| Why use Python? | Ordinary browser code cannot silently write to our project folder. The local server performs that file-writing step. |
| What does `json.loads()` do? | Converts JSON text into Python data so we can read or update it. |
| What does `requests.append()` do? | Adds the new request to the list while keeping previous requests. |
| What does `json.dumps()` do? | Converts the list back into JSON text. `indent=2` makes the file easy to read. |
| Why write a temporary file? | The server finishes writing first, then replaces the saved file, reducing the risk of leaving a partly written file. |
| Does it create a file for every submission? | No. One JSON file holds a list of all requests. Each submission adds one record. |
| What is saved? | Name, email, message and submission time (`submitted_at`). |
| Is this the same as localStorage? | No. The cart uses browser localStorage; Help submissions use an actual file in the project folder. |
| Does refreshing delete the requests? | No. They remain on disk after refreshing or restarting the server. |
| Why validate twice? | Browser checks help the visitor; server checks also reject invalid requests sent directly. |

To demonstrate this point:

1. Run `python3 server.py` in the VS Code terminal. If it is already running, use it.
2. Open `http://127.0.0.1:8000/help.html`.
3. Enter a fictional name, a valid email such as `demo@example.test`, and a message of at least 10 characters.
4. Click Submit Request and show the success message.
5. In VS Code, open `data/help_requests.json` and show the new record.
6. Submit another message and show both records in the list.

Use this Python server for the demonstration. Opening the HTML directly or using
VS Code Live Server alone does not provide the POST handler needed to save the file.
The folder is created automatically on the first valid submission and is ignored
by Git so submitted contact details are not committed.

## Files to study

- `index.html`: homepage and assistant controls.
- `categories.html`: links with a category in the URL.
- `products.html`: twelve product cards; `addToCart(this)` passes the clicked button.
- `cart.html`: a reusable `<template>` for cart rows.
- `help.html`: labelled inputs and the Help form.
- `style.css`: colours, spacing, Grid, Flexbox and responsive media queries.
- `script.js`: seven numbered sections for cart, display, search, voice and form events.
- `server.py`: serves files, validates POST data and writes JSON.

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

## Python terms used in the server

- `HTTPServer`: listens for browser requests on the computer.
- `SimpleHTTPRequestHandler`: serves HTML, CSS, JS and images; our `Handler` adds POST support.
- `def`, `self`, `super()`: define a method, refer to its instance and call its parent class.
- `do_POST()`: receives a submitted form at `/api/help`.
- `json.loads` / `json.dumps`: read JSON text / produce JSON text.
- `Path`: represents a file or folder; `read_text` and `write_text` access it.
- `mkdir`: creates the data folder. `replace`: replaces the JSON file after writing.
- `200`, `400`, `404`, `500`: success, invalid input, unknown route, server failure.
- Server validation repeats browser checks because a request can bypass the form.

## Demonstration order

1. Navigate through all five pages.
2. Open Electronics: only its two products appear.
3. On Home, click “Headphones under ₹2000”: matching products appear.
4. Add a product twice, open Cart and show quantity, total and reload persistence.
5. Decrease a quantity to zero, review the demo order, then clear the cart.
6. In Help, try submitting empty fields or a bad email to show browser validation.
7. Submit a test name, email and message. Show the success text and open
   `data/help_requests.json` in VS Code. Submit again to show records append.

## Limits to explain honestly

- Product names, prices and ratings are sample project data.
- Search uses words and an optional “under ₹2000” limit; it is not an AI model.
- Voice uses the browser's speech recognition, requires permission and depends on browser support.
  You can demonstrate all search features by typing if voice is unavailable.
- Review Order is a demo; there is no payment service or order placement.
- Help requests are saved locally. They are not emailed or sent to a live support team.
- This server is intended for a single local classroom demonstration.
- `data/` is ignored by Git so real submitted contact details are not committed.
