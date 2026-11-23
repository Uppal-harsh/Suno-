# EasyKart evaluation checklist

## Before presenting

1. In the `Suno-` terminal, run `npm ci` after pulling changes to the lockfile.
2. Confirm your private `.env` points to the intended database. If the network changed, check the current IP in Atlas Network Access.
3. Run `npm run db:import` if this is a fresh database.
4. Run `npm start`, then open [database health](http://127.0.0.1:8000/api/health). Confirm HTTP 200 and `{"mode":"mongodb","connected":true}`.
5. Open [Store Admin](http://127.0.0.1:8000/admin.html) and sign in using the password from your terminal. Keep the terminal off the presentation screen.

Before starting the shopping demonstration, open
[the product API](http://127.0.0.1:8000/api/products) and confirm it returns a
non-empty JSON array. A healthy connection with an empty array still needs
catalog setup; review the import instructions before presenting.

## Show a saved order

1. Open [Products](http://127.0.0.1:8000/products.html), add a product, and check the quantity and displayed total in Cart.
2. Check out with sample delivery details and note the order reference.
3. In Store Admin, find that reference and change the status to **Packed**.
4. In Atlas Data Explorer, refresh the configured database's `orders` collection. Find that order and show its items, total, and updated status.
5. Submit a sample Help request and show the same message in both the admin inbox and `help_requests`.

For screenshots or a recording, use sample customer data and keep database credentials and the admin password out of view. If your project requires evidence from Atlas, show the Atlas collection itself. The health endpoint also reports MongoDB when the app is connected to a local MongoDB instance.
