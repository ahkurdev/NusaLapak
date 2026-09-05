const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, slugify } = require('./db');
const { hashPassword, verifyPassword, signToken, authRequired, adminRequired } = require('./auth');
const { isEmail, str, int, validateRegister, validateProduct, validateCheckout } = require('./validate');
const { ensureSeed } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;
ensureSeed();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// uploads
fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 5) || '.jpg';
    cb(null, 'p-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('File harus gambar (jpg/png/webp/gif).'));
  }
});
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// SVG placeholder generator (offline-safe product images)
const PALETTES = [
  ['#F1E9DC', '#1E3A5F'], ['#E9EFE7', '#2F4A3C'], ['#F7E8DC', '#8A4B2A'],
  ['#E7ECF2', '#1E3A5F'], ['#EFE7DA', '#5B4A36'], ['#E5EBE4', '#43604A'],
];
app.get('/img/p-:id.svg', (req, res) => {
  const id = int(req.params.id, 1);
  const row = db.prepare('SELECT name FROM products WHERE id = ?').get(id);
  const name = row ? row.name : 'NusaLapak';
  const [bg, fg] = PALETTES[id % PALETTES.length];
  const initial = str(name).slice(0, 1).toUpperCase() || 'N';
  const words = str(name, 40).split(' ').slice(0, 3).join(' ');
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" rx="24" fill="${bg}"/><circle cx="300" cy="180" r="78" fill="${fg}" opacity="0.92"/><text x="300" y="205" font-family="Georgia,serif" font-size="72" fill="#FAF7F2" text-anchor="middle">${initial}</text><text x="300" y="320" font-family="Georgia,serif" font-size="30" fill="${fg}" text-anchor="middle">${words.replace(/&/g, '&amp;')}</text><text x="300" y="352" font-family="Arial" font-size="18" letter-spacing="3" fill="${fg}" opacity="0.65" text-anchor="middle">NUSALAPAK</text></svg>`);
});

function productRow(p) {
  if (!p) return null;
  const cat = p.category_id ? db.prepare('SELECT id, name, slug FROM categories WHERE id = ?').get(p.category_id) : null;
  const agg = db.prepare('SELECT COUNT(*) c, COALESCE(AVG(rating),0) avg FROM reviews WHERE product_id = ?').get(p.id);
  return { ...p, category: cat, review_count: agg.c, rating: Math.round(agg.avg * 10) / 10 };
}
function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}
const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');

// ---------- AUTH ----------
app.post('/api/auth/register', (req, res) => {
  const errs = validateRegister(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join(' ') });
  const name = str(req.body.name, 80), email = str(req.body.email, 120).toLowerCase();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(400).json({ error: 'Email sudah terdaftar. Silakan login.' });
  const r = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)')
    .run(name, email, hashPassword(String(req.body.password)), 'user');
  const user = db.prepare('SELECT id, name, email, role, phone, address, city, is_active FROM users WHERE id = ?').get(Number(r.lastInsertRowid));
  res.json({ token: signToken(user), user });
});
app.post('/api/auth/login', (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const pw = String(req.body.password || '');
  if (!isEmail(email) || !pw) return res.status(400).json({ error: 'Email dan password wajib diisi.' });
  const full = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!full || !verifyPassword(pw, full.password_hash)) return res.status(401).json({ error: 'Email atau password salah.' });
  if (!full.is_active) return res.status(403).json({ error: 'Akun dinonaktifkan. Hubungi admin.' });
  const user = publicUser(full);
  delete user.password_hash;
  res.json({ token: signToken(full), user });
});
app.get('/api/auth/me', authRequired, (req, res) => res.json({ user: req.user }));
app.put('/api/auth/profile', authRequired, (req, res) => {
  const name = str(req.body.name, 80), phone = str(req.body.phone, 20);
  const address = str(req.body.address, 500), city = str(req.body.city, 80);
  if (name.length < 3) return res.status(400).json({ error: 'Nama minimal 3 karakter.' });
  db.prepare('UPDATE users SET name=?, phone=?, address=?, city=? WHERE id=?').run(name, phone, address, city, req.user.id);
  const user = db.prepare('SELECT id, name, email, role, phone, address, city, is_active FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});
app.put('/api/auth/password', authRequired, (req, res) => {
  const { old_password, new_password } = req.body;
  if (String(new_password || '').length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
  const full = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(String(old_password || ''), full.password_hash)) return res.status(400).json({ error: 'Password lama salah.' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(String(new_password)), req.user.id);
  res.json({ ok: true });
});

// ---------- CATEGORIES ----------
app.get('/api/categories', (req, res) => {
  const cats = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) product_count FROM categories c ORDER BY name`).all();
  res.json({ categories: cats });
});
app.post('/api/categories', authRequired, adminRequired, (req, res) => {
  const name = str(req.body.name, 80);
  if (name.length < 3) return res.status(400).json({ error: 'Nama kategori minimal 3 karakter.' });
  const slug = slugify(name);
  try {
    const r = db.prepare('INSERT INTO categories (name, slug, description, icon) VALUES (?,?,?,?)')
      .run(name, slug, str(req.body.description, 300), str(req.body.icon, 5) || name.slice(0, 1).toUpperCase());
    res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(r.lastInsertRowid)) });
  } catch { return res.status(400).json({ error: 'Kategori sudah ada.' }); }
});
app.put('/api/categories/:id', authRequired, adminRequired, (req, res) => {
  const name = str(req.body.name, 80);
  if (name.length < 3) return res.status(400).json({ error: 'Nama kategori minimal 3 karakter.' });
  db.prepare('UPDATE categories SET name=?, description=?, icon=? WHERE id=?')
    .run(name, str(req.body.description, 300), str(req.body.icon, 5), int(req.params.id));
  res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(int(req.params.id)) });
});
app.delete('/api/categories/:id', authRequired, adminRequired, (req, res) => {
  db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(int(req.params.id));
  db.prepare('DELETE FROM categories WHERE id = ?').run(int(req.params.id));
  res.json({ ok: true });
});

// ---------- PRODUCTS ----------
app.get('/api/products', (req, res) => {
  const q = str(req.query.q, 80), catSlug = str(req.query.category, 60);
  const sort = str(req.query.sort, 20) || 'newest';
  const minPrice = int(req.query.min_price, 0), maxPrice = int(req.query.max_price, 0);
  const featured = req.query.featured === '1';
  const page = Math.max(1, int(req.query.page, 1)), limit = Math.min(24, Math.max(1, int(req.query.limit, 12)));
  const where = ['p.is_active = 1'];
  const params = [];
  if (q) { where.push('(p.name LIKE ? OR p.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (catSlug) { where.push('c.slug = ?'); params.push(catSlug); }
  if (minPrice > 0) { where.push('p.price >= ?'); params.push(minPrice); }
  if (maxPrice > 0) { where.push('p.price <= ?'); params.push(maxPrice); }
  if (featured) where.push('p.is_featured = 1');
  const orderBy = sort === 'price_asc' ? 'p.price ASC' : sort === 'price_desc' ? 'p.price DESC' : sort === 'popular' ? 'p.sold DESC' : 'p.id DESC';
  const total = db.prepare(`SELECT COUNT(*) c FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where.join(' AND ')}`).get(...params).c;
  const rows = db.prepare(`SELECT p.* FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, (page - 1) * limit);
  res.json({ products: rows.map(productRow), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});
app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(int(req.params.id));
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  res.json({ product: productRow(p) });
});
app.post('/api/products', authRequired, adminRequired, upload.single('image'), (req, res) => {
  const b = req.body;
  const errs = validateProduct(b);
  if (errs.length) return res.status(400).json({ error: errs.join(' ') });
  const slug = slugify(b.name) + '-' + Date.now().toString(36);
  const image_url = req.file ? '/uploads/' + req.file.filename : (str(b.image_url, 300) || '');
  const r = db.prepare(`INSERT INTO products (category_id, name, slug, description, price, stock, image_url, is_featured) VALUES (?,?,?,?,?,?,?,?)`)
    .run(b.category_id ? int(b.category_id) : null, str(b.name, 160), slug, str(b.description, 2000), int(b.price), int(b.stock), image_url, b.is_featured ? 1 : 0);
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(r.lastInsertRowid));
  if (!p.image_url) db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(`/img/p-${p.id}.svg`, p.id);
  res.json({ product: productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(p.id)) });
});
app.put('/api/products/:id', authRequired, adminRequired, upload.single('image'), (req, res) => {
  const id = int(req.params.id);
  const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  const b = req.body;
  const errs = validateProduct({ ...cur, ...b });
  if (errs.length) return res.status(400).json({ error: errs.join(' ') });
  let image_url = b.image_url !== undefined ? str(b.image_url, 300) : cur.image_url;
  if (req.file) image_url = '/uploads/' + req.file.filename;
  db.prepare(`UPDATE products SET category_id=?, name=?, description=?, price=?, stock=?, image_url=?, is_featured=?, is_active=? WHERE id=?`)
    .run(b.category_id ? int(b.category_id) : null, str(b.name ?? cur.name, 160), str(b.description ?? cur.description, 2000),
      b.price !== undefined ? int(b.price) : cur.price, b.stock !== undefined ? int(b.stock) : cur.stock,
      image_url, b.is_featured !== undefined ? (b.is_featured ? 1 : 0) : cur.is_featured,
      b.is_active !== undefined ? (Number(b.is_active) ? 1 : 0) : cur.is_active, id);
  res.json({ product: productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
});
app.delete('/api/products/:id', authRequired, adminRequired, (req, res) => {
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(int(req.params.id));
  res.json({ ok: true });
});

// ---------- REVIEWS ----------
app.get('/api/products/:id/reviews', (req, res) => {
  const rows = db.prepare(`SELECT r.*, u.name user_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.id DESC`).all(int(req.params.id));
  res.json({ reviews: rows });
});
app.post('/api/products/:id/reviews', authRequired, (req, res) => {
  const pid = int(req.params.id), rating = int(req.body.rating, 0);
  const comment = str(req.body.comment, 500);
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5.' });
  if (!db.prepare('SELECT id FROM products WHERE id = ?').get(pid)) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  try {
    db.prepare('INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?,?,?,?)').run(pid, req.user.id, rating, comment);
  } catch {
    db.prepare('UPDATE reviews SET rating=?, comment=? WHERE product_id=? AND user_id=?').run(rating, comment, pid, req.user.id);
  }
  res.json({ ok: true });
});

// ---------- ORDERS ----------
function orderWithItems(o) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  return { ...o, items };
}
app.post('/api/orders/checkout', authRequired, (req, res) => {
  const errs = validateCheckout(req.body);
  if (errs.length) return res.status(400).json({ error: errs.join(' ') });
  const items = req.body.items;
  let total = 0;
  const lines = [];
  for (const it of items) {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(int(it.product_id));
    if (!p) return res.status(400).json({ error: `Produk ID ${it.product_id} tidak tersedia.` });
    if (p.stock < int(it.qty)) return res.status(400).json({ error: `Stok "${p.name}" kurang (sisa ${p.stock}).` });
    const qty = int(it.qty);
    total += p.price * qty;
    lines.push({ p, qty });
  }
  const code = 'NL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const tx = db.prepare('SELECT 1');
  try {
    db.exec('BEGIN');
    const r = db.prepare(`INSERT INTO orders (code, user_id, total, status, recipient_name, phone, address, city, payment_method, note) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(code, req.user.id, total, 'pending', str(req.body.recipient_name, 80), str(req.body.phone, 20), str(req.body.address, 500), str(req.body.city, 80), str(req.body.payment_method, 20), str(req.body.note, 300));
    const oid = Number(r.lastInsertRowid);
    const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, price, qty, subtotal) VALUES (?,?,?,?,?,?)');
    for (const { p, qty } of lines) {
      insItem.run(oid, p.id, p.name, p.price, qty, p.price * qty);
      db.prepare('UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ?').run(qty, qty, p.id);
    }
    db.exec('COMMIT');
    res.json({ order: orderWithItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(oid)) });
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    res.status(500).json({ error: 'Checkout gagal: ' + e.message });
  }
});
app.get('/api/orders/my', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json({ orders: rows.map(orderWithItems) });
});
app.get('/api/orders/:id', authRequired, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(int(req.params.id));
  if (!o) return res.status(404).json({ error: 'Order tidak ditemukan.' });
  if (req.user.role !== 'admin' && o.user_id !== req.user.id) return res.status(403).json({ error: 'Bukan order milikmu.' });
  res.json({ order: orderWithItems(o) });
});

// ---------- ADMIN ----------
app.get('/api/admin/stats', authRequired, adminRequired, (req, res) => {
  const totalProducts = db.prepare('SELECT COUNT(*) c FROM products WHERE is_active = 1').get().c;
  const totalUsers = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'user'").get().c;
  const totalOrders = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'batal'").get().s;
  const lowStock = db.prepare('SELECT id, name, stock FROM products WHERE is_active = 1 AND stock <= 5 ORDER BY stock LIMIT 8').all();
  const recent = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 8').all().map(orderWithItems);
  const byStatus = db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all();
  res.json({ totalProducts, totalUsers, totalOrders, revenue, lowStock, recent, byStatus });
});
app.get('/api/admin/orders', authRequired, adminRequired, (req, res) => {
  const status = str(req.query.status, 15);
  const rows = (status ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC').all(status)
    : db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all()).map(orderWithItems);
  res.json({ orders: rows });
});
const FLOW = ['pending', 'diproses', 'dikirim', 'selesai'];
app.put('/api/admin/orders/:id/status', authRequired, adminRequired, (req, res) => {
  const status = str(req.body.status, 15);
  if (![...FLOW, 'batal'].includes(status)) return res.status(400).json({ error: 'Status tidak valid.' });
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(int(req.params.id));
  if (!o) return res.status(404).json({ error: 'Order tidak ditemukan.' });
  if (status === 'batal' && o.status !== 'pending') return res.status(400).json({ error: 'Hanya order pending yang bisa dibatalkan (stok dikembalikan).' });
  if (status === 'batal') {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
    db.exec('BEGIN');
    try {
      for (const it of items) db.prepare('UPDATE products SET stock = stock + ?, sold = sold - ? WHERE id = ?').run(it.qty, it.qty, it.product_id);
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('batal', o.id);
      db.exec('COMMIT');
    } catch (e) { try { db.exec('ROLLBACK'); } catch {}; return res.status(500).json({ error: e.message }); }
  } else {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, o.id);
  }
  res.json({ order: orderWithItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id)) });
});
app.get('/api/admin/users', authRequired, adminRequired, (req, res) => {
  const rows = db.prepare('SELECT id, name, email, role, phone, city, is_active, created_at FROM users ORDER BY id DESC').all();
  res.json({ users: rows });
});
app.put('/api/admin/users/:id', authRequired, adminRequired, (req, res) => {
  const id = int(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri.' });
  if (req.body.is_active !== undefined) db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(req.body.is_active ? 1 : 0, id);
  if (req.body.role && ['user', 'admin'].includes(req.body.role)) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.body.role, id);
  res.json({ user: db.prepare('SELECT id, name, email, role, phone, city, is_active, created_at FROM users WHERE id = ?').get(id) });
});
app.get('/api/admin/reports/sales', authRequired, adminRequired, (req, res) => {
  const daily = db.prepare(`SELECT substr(created_at,1,10) day, COUNT(*) orders, COALESCE(SUM(CASE WHEN status != 'batal' THEN total ELSE 0 END),0) revenue FROM orders GROUP BY day ORDER BY day DESC LIMIT 14`).all().reverse();
  const byCat = db.prepare(`SELECT COALESCE(c.name,'Tanpa kategori') category, SUM(oi.subtotal) revenue, SUM(oi.qty) qty FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id LEFT JOIN categories c ON c.id = p.category_id GROUP BY category ORDER BY revenue DESC`).all();
  const top = db.prepare(`SELECT product_name, SUM(qty) qty, SUM(subtotal) revenue FROM order_items GROUP BY product_name ORDER BY qty DESC LIMIT 8`).all();
  res.json({ daily, byCat, top });
});

// static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.listen(PORT, () => console.log(`NusaLapak jalan di http://localhost:${PORT} | admin: admin@nusalapak.id / admin123`));
