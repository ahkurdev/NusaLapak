const API = '';
const store = {
  get token() { return localStorage.getItem('nl_token') || ''; },
  set token(v) { v ? localStorage.setItem('nl_token', v) : localStorage.removeItem('nl_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('nl_user') || 'null'); } catch { return null; } },
  set user(v) { v ? localStorage.setItem('nl_user', JSON.stringify(v)) : localStorage.removeItem('nl_user'); },
};

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (store.token) headers.Authorization = 'Bearer ' + store.token;
  let body = opts.body;
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm && typeof body !== 'string') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  } else if (typeof body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API + path, { ...opts, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('Request gagal (' + res.status + ')'));
  return data;
}

const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function getCart() {
  try { return JSON.parse(localStorage.getItem('nl_cart') || '[]'); } catch { return []; }
}
function setCart(c) {
  localStorage.setItem('nl_cart', JSON.stringify(c));
  renderCartBadge();
}
function addToCart(id, qty = 1) {
  const cart = getCart();
  const f = cart.find((x) => x.product_id === id);
  if (f) f.qty = Math.min(100, f.qty + qty);
  else cart.push({ product_id: id, qty });
  setCart(cart);
}
function renderCartBadge() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = getCart().reduce((a, x) => a + x.qty, 0);
}

function navbar(active = '') {
  const u = store.user;
  const adminLink = u && u.role === 'admin' ? `<a href="/admin.html">Dashboard</a>` : '';
  return `
  <nav class="navbar"><div class="nav-inner">
    <a class="brand" href="/index.html"><span class="brand-mark">N</span>
      <span><span class="brand-name">NusaLapak</span><span class="brand-sub">PASAR NUSANTARA</span></span></a>
    <div class="nav-links">
      <a href="/index.html" class="${active === 'home' ? 'active' : ''}">Beranda</a>
      <a href="/products.html" class="${active === 'products' ? 'active' : ''}">Belanja</a>
      <a href="/orders.html" class="${active === 'orders' ? 'active' : ''}">Pesanan</a>
      ${adminLink}
    </div>
    <div class="nav-actions">
      <a class="btn btn-ghost btn-small" href="/cart.html">Keranjang<span class="cart-badge" id="cartCount">0</span></a>
      ${u ? `<a class="btn btn-ghost btn-small" href="/profile.html">${esc(u.name.split(' ')[0])}</a><button class="btn btn-small" id="btnLogout">Keluar</button>`
          : `<a class="btn btn-ghost btn-small" href="/login.html">Masuk</a><a class="btn btn-small" href="/register.html">Daftar</a>`}
    </div>
  </div></nav>`;
}
function footer() {
  return `<footer class="footer"><div class="footer-inner">
    <div><div class="brand" style="margin-bottom:8px"><span class="brand-mark">N</span><span><span class="brand-name">NusaLapak</span><span class="brand-sub">PASAR NUSANTARA</span></span></div>
    <small>Marketplace karya anak bangsa. Kuliner, wastra, kerajinan, dan kebutuhan harian dari UMKM seluruh Indonesia. Harga jelas, transaksi aman, pengiriman terpercaya.</small></div>
    <div><strong>Jelajah</strong><br><a href="/products.html">Semua produk</a><br><a href="/cart.html">Keranjang</a><br><a href="/orders.html">Lacak pesanan</a></div>
    <div><strong>Bantuan</strong><br><small>Admin: admin@nusalapak.id / admin123<br>Demo user: demo@nusalapak.id / demo1234<br>Jam layanan 08.00-21.00 WIB</small></div>
  </div></footer>`;
}
function mount(active, content) {
  document.body.innerHTML = navbar(active) + `<main class="container" style="min-height:60vh;padding-top:20px">${content}</main>` + footer();
  renderCartBadge();
  const lo = document.getElementById('btnLogout');
  if (lo) lo.onclick = () => { store.token = ''; store.user = null; setCart([]); location.href = '/index.html'; };
}
function alertBox(msg, ok = false) {
  return msg ? `<div class="alert ${ok ? 'alert-ok' : 'alert-err'}">${esc(msg)}</div>` : '';
}
