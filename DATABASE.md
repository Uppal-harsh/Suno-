# EasyKart database guide

EasyKart serves the store at `http://127.0.0.1:8000`. Its Node server stores orders,
anonymous carts, and Help messages in MongoDB when `MONGODB_URI` is configured.
Without that variable it uses the ignored JSON files in `data/` for an offline demo.
`GET /api/health` identifies the active mode. A configured MongoDB connection that
fails never silently switches to JSON.

## Connect a new Atlas cluster

1. Open [MongoDB Atlas](https://cloud.mongodb.com/) and create a project for EasyKart.
   Select **Free**, choose a nearby region, and name the cluster `EasyKart`.
   Check that the final price is **$0/hour** before creating the deployment.
   Atlas permits one Free cluster per project; use a separate project if another
   Free cluster already exists. See the [official Free cluster guide](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).
2. Complete Atlas security setup. Create a database user for the application and
   allow your current IP address. Prefer a user with `readWrite` access to the
   `easykart` database. An Atlas account login and a database user are different.
3. Choose **Connect → Drivers → Node.js**, then copy the driver connection string.
4. In this project folder, copy `.env.example` to `.env` and fill it in privately:

   ```dotenv
   MONGODB_URI=mongodb+srv://<username>:<URL-encoded-password>@<cluster-host>/easykart?retryWrites=true&w=majority
   MONGODB_DB_NAME=easykart
   # Optional: keep the same local admin password after restarting the app.
   # ADMIN_PASSWORD=<your-private-admin-password>
   ```

   URL-encode special characters in the database username/password. Do not commit
   `.env`, put credentials in frontend JavaScript, or share screenshots containing
   the full URI. `MONGODB_DB_NAME` selects the database even if the URI has a
   different database path. The default is `easykart`.
5. Install the locked dependencies and check the connection:

   ```powershell
   npm.cmd ci
   npm.cmd run db:check
   npm.cmd start
   ```

   `db:check` only connects, pings, and counts records. It does not create indexes,
   import JSON, or write records. Starting the application creates its collections
   and indexes and performs the one-time import described below.
6. Open [the health endpoint](http://127.0.0.1:8000/api/health). A working MongoDB
   connection returns HTTP 200 with:

   ```json
   { "status": "ok", "storage": "mongodb" }
   ```

   `storage: "json"` means the app is using local files. An unavailable configured
   MongoDB returns HTTP 503. No credentials are returned by this endpoint.

The server reads `.env` from its own project folder, including when launched from
another directory. It binds to loopback only. Atlas stores the data remotely; it
does not host this website or make the local admin page public.

## Collections and indexes

| Collection | Stored data | Application indexes |
| --- | --- | --- |
| `orders` | Order reference, checkout retry reference, visitor ID, customer name/email/address, item snapshots, total in INR, status, demo payment note, timestamps | Unique `id`; unique `(visitorId, requestId)` |
| `carts` | Visitor ID, short guest label, item snapshots, last update time | Unique `visitorId` |
| `help_requests` | Name, email, message, submission time | `submitted_at` |
| `_migrations` | Internal checkpoints for the first JSON import | MongoDB's unique `_id` |

MongoDB also maintains its normal `_id` indexes. Public application records omit
MongoDB `_id` fields in responses. Timestamps are ISO strings. Order statuses are
`New`, `Confirmed`, `Packed`, `Delivered`, and `Cancelled`.

Products remain in the version-controlled `catalog.json`. Checkout looks up item
names there and calculates prices on the server; a browser cannot choose its own
unit price. Purchased items are stored as snapshots, so catalog changes do not
rewrite previous orders. Restart the server after editing the catalog.

There are no shopper accounts. A browser cookie identifies an anonymous cart;
the guest label is not a verified customer identity. Customer details are supplied
at checkout. Admin sessions are held in memory for eight hours and end when the
server restarts. `ADMIN_PASSWORD` controls the app's local admin login, not Atlas.

## One-time JSON import

The first MongoDB startup checks each collection independently. An empty collection
can receive its corresponding records from `data/commerce.json` or
`data/help_requests.json`. A collection with existing MongoDB records is preserved.

Each collection gets an internal `json-v1:*` checkpoint in `_migrations`. Import
uses upserts that insert missing records without replacing existing records. If
startup stops midway, the next startup resumes the incomplete import. Completed
imports do not run again, even if a collection later becomes empty. This prevents
old carts from returning after checkout or deleted Help records from reappearing.

The JSON source files remain unchanged. Keep them as a backup until you verify
Atlas. Invalid JSON or commerce structure stops an affected import rather than
overwriting the source. Restore a valid source backup and restart to resume.
Do not delete migration checkpoints to refresh a live database. Changes made in
offline JSON mode after an import require a deliberate migration; they are not
automatically merged into MongoDB.

## Verify the store

1. Add a product, open Cart, and place a demo order with test customer details.
2. Sign into `/admin.html` using the password from the terminal or `ADMIN_PASSWORD`.
3. Check the order's items and total, then change its status to `Packed`.
4. Submit a Help message and check the admin Help inbox.
5. Stop and restart the app using the same `.env`. Sign into admin again and verify
   that the order, status, and Help message remain.
6. In Atlas Data Explorer or MongoDB Compass, inspect the `easykart` collections.

Checkout retries reuse `(visitorId, requestId)` and return the same order. A retry
can finish interrupted cart cleanup without deleting a cart updated after the
order was created. Ctrl+C closes the HTTP listener and MongoDB client.

Orders are classroom demo records. No payment is taken and no email is sent.
Use test customer details for demonstrations.

## Automated verification

```powershell
npm.cmd test
```

This launches a real, disposable local MongoDB and an HTTP server on an available
port. Tests cover persistence, imports and interrupted imports, empty-collection
restarts, simultaneous checkout retries, ID collisions, cart cleanup, connection
failures, health reporting, protected admin routes, and read-only connection checks.
Offline JSON tests use temporary directories. Tests never load the Atlas target
from `.env` or write the store's real `data/` files. The first run downloads a
MongoDB binary and needs internet access.

For the optional [Postman demo collection](postman/EasyKart.postman_collection.json),
install the official Postman CLI, then run:

```powershell
npm.cmd run test:postman
```

This starts its own disposable database and server and runs the collection locally
with a public, temporary test password. It does not require Postman cloud login.
It leaves no demo records in Atlas. To run the imported collection manually against
your own local app, set `baseUrl` and supply `adminPassword` privately in Postman;
that manual workflow creates a demo order and Help message in the app's database.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `storage` is `json` | Put the URI in this project's `.env`, not the separate coursework `server/.env`; restart the app. |
| Connection check fails | Check the driver URI, database username/password, current IP access entry, and network. Campus networks may block MongoDB traffic. |
| A hotspot works but Wi-Fi does not | Use the working network and update the Atlas IP access entry when your public IP changes. |
| Database is not visible yet | The read-only checker creates nothing. Start the app to create indexes and import records. |
| Startup fails after importing old data | Check the source JSON structure and duplicate order IDs/retry references. Existing MongoDB records are preserved; do not reset the database to bypass errors. |
| Port 8000 is busy | Stop the earlier EasyKart server and start one copy. |
| Admin password changed | Set `ADMIN_PASSWORD` privately for a stable password, or use the new terminal password after each restart. |

This remains a single-process classroom application, not a production shop.
Cross-process coordination, shopper authentication, payment processing, and
production deployment are outside its current scope.
