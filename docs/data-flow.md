# EasyKart data flow

For the ordered shopping process, decision points and sequence diagrams, see the
[complete project workflow](project-workflow.md).

| Action | Browser and API | MongoDB |
| --- | --- | --- |
| Browse and search | Products and voice search request `GET /api/products`. | The list comes from `products`. |
| Start a cart session | `GET /api/cart` establishes an anonymous visitor cookie and returns an abbreviated visitor ID. | This endpoint does not read or restore a saved cart. |
| Edit the cart | The browser updates localStorage and syncs through `PUT /api/cart`. | The visitor cookie's ID identifies a document in `carts`. |
| Place an order | The browser sends product names, quantities, customer details, and a request ID. | The server looks up prices, saves an order with item snapshots, and clears the checked-out cart when appropriate. |
| Retry a checkout | The same browser resends the original request ID. | A unique visitor-and-request index keeps retries tied to the original order. |
| Send a Help message | The Help form sends `POST /api/help`. | The server validates and saves the message to `help_requests`. |
| Update a status | A signed-in admin sends `PATCH /api/admin/orders/:id`. | The saved order receives the new status and update timestamp. |

## Connection health

`GET /api/health` pings MongoDB. HTTP 200 confirms connectivity, but does not
confirm that products have been imported. Check `GET /api/products` separately
when preparing a fresh database.

## Checkout validation

Cart and checkout payloads accept at most 50 item entries, with integer quantities
from 1 to 99. Duplicate product names are combined, with the same maximum of 99
per product. Checkout also requires a customer name, email and delivery address.

## Where to make edits

- On a fresh database, `npm run db:import` seeds products from `catalog.json` and can import previous carts, orders, and Help requests from the local JSON sources.
- Each completed source is recorded in `_migrations`. An import rerun resumes incomplete sources and skips completed ones.
- After the product import completes, edit catalog entries in MongoDB. Existing orders keep their checkout snapshots.
- Admin sessions are held in server memory. Sign in again after restarting the app. A restart does not clear saved MongoDB records.
