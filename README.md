# NusaLapak — Nusantara Market

Bahasa Indonesia version: [readme.id.md](readme.id.md)

A Nusantara-themed full-stack marketplace: a catalogue of MSME products, cart, checkout with
automatic stock updates, reviews/ratings, role-based JWT authentication, and a separate admin dashboard
(CRUD for products, categories, users, and orders, plus sales reports).

The brand, logo, and visual theme were created originally for this project — they do not copy any platform.

## Tech Stack

| Layer  | Technology |
|----------|-----------|
| Backend  | Node.js 22+, Express 4 |
| Database | SQLite via `node:sqlite` (no external DB server) |
| Auth     | bcryptjs + JWT (`jsonwebtoken`) |
| Upload   | multer (product images, max 2 MB) |
| Frontend | HTML + CSS + vanilla JS (no build step, no framework) |
| Report charts | Built-in browser Canvas 2D |

## Features

### Public / Buyers
- Landing page: hero, featured categories, featured products, store highlights
- Product list: search, category filter, price-range filter, sorting
  (newest / best-selling / lowest / highest price), pagination
- Product details: image gallery, description, price, real-time stock, average rating,
  review list, write/edit a review (login required)
- Cart (localStorage): add, change quantity, remove, empty
- Checkout: recipient details + payment method (transfer / e-wallet / COD),
  stock reduced atomically per transaction
- Order history with a status timeline
- Auth: register, login, logout, edit profile (name, phone, address, city), change password
- Profile page: personal details + a summary of total orders and total spend

### Admin (`/admin.html`, `admin` role only)
- Summary: total active products, total users, total orders, revenue (non-cancelled),
  latest orders, low-stock warnings
- Product CRUD: add/edit/delete (soft delete) + image upload
- Category CRUD: add/edit/delete (orphaned products become uncategorised)
- User management: activate/deactivate accounts, change user/admin role
- Order management: filter by status, update
  `pending > diproses > dikirim > selesai`, cancel an order (stock returned automatically)
- Reports: daily revenue for 14 days (canvas chart), revenue per category,
  best-selling products

### Security & Validation
- All sensitive endpoints are validated on the server (`src/validate.js`)
- `authRequired` (JWT) and `adminRequired` (role) middleware on every private route
- Ordinary users opening `/admin.html` or `/api/admin/*` are rejected (403 + a specific message)
- Inactive accounts cannot log in; old tokens are rejected too
- Passwords are hashed with bcrypt; minimum password length is 6 characters

## Project Structure

```
.
├── src/
│   ├── server.js     # all API + static hosting + upload
│   ├── db.js         # SQLite schema (users, categories, products, orders, order_items, reviews)
│   ├── auth.js       # hash/verify password, sign JWT, auth + admin middleware
│   ├── validate.js   # server-side input validation
│   └── seed.js       # 6 categories, 16 products, 2 demo accounts, 1 review
├── public/
│   ├── index.html products.html product.html cart.html checkout.html
│   ├── orders.html login.html register.html profile.html admin.html
│   ├── css/style.css # design system (cream/navy/terracotta/sage, no neon)
│   └── js/app.js     # API helper, JWT session, localStorage cart, navbar/footer
├── scripts/e2e.js    # HTTP end-to-end tests (18 scenarios)
└── uploads/          # uploaded product images (ignored by git)
```

## How to Run

Requires Node.js 22+ (24 recommended).

```bash
npm install
npm start
```

Open http://localhost:3000 — admin at http://localhost:3000/admin.html

| Account  | Email | Password |
|-------|-------|----------|
| Admin | admin@nusalapak.id | admin123 |
| Demo buyer | demo@nusalapak.id | demo1234 |

Optional variables:

```bash
PORT=4000 npm start        # change port
BASE=http://localhost:4000 npm run test:e2e
```

Reset the demo data: stop the server, delete `data.sqlite*`, then run `npm start` again
(seeding runs automatically when the database is empty).

## Demo Flow (5 minutes)

1. Open the home page, click a category or search for "kopi".
2. Open a product detail page, add to cart, open the cart, proceed to checkout.
   (Register a new account first if you are not logged in.)
3. Fill in the address, create the order — note the order code (e.g. `NL-XXXX`).
4. Log in as admin, open Dashboard > Orders, move the status
   Menunggu > Diproses > Dikirim > Selesai.
5. Log in again as the buyer, open Orders — the latest status appears in the timeline.
6. Go back to the purchased product and write a 5-star review.

## Testing

```bash
npm run test:e2e   # needs the server running; 18 HTTP scenarios, last verified: 18/18 passed
```

Coverage: register, admin login, product list, guard without token (401),
user guard on admin routes (403), checkout, stock deduction, order status transitions,
status visibility on the user side, writing a review, admin stats, reports,
create/update/delete categories and products.

## Design

- Palette: cream `#FAF7F2`, navy `#1E3A5F`, terracotta `#C2703D`, sage `#5F7F60`
- Serif headings (Georgia) for an elegant local feel, system sans-serif body
- Flat, no neon, no glow, no gamer/cyberpunk style
- Responsive: adaptive grid + 820px breakpoint (admin sidebar becomes chips, compact nav)

## License

MIT — free to use as a portfolio piece or to develop further.
