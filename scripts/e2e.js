const BASE = process.env.BASE || 'http://localhost:3000';
const j = (m, p, body, token) => fetch(BASE + p, {
  method: m, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: body ? JSON.stringify(body) : undefined
}).then(async (r) => ({ s: r.status, d: await r.json().catch(() => ({})) }));

(async () => {
  const log = [];
  const step = (n, ok, info = '') => { log.push(`${ok ? 'OK  ' : 'FAIL'} ${n} ${info}`); if (!ok) { console.log(log.join('\n')); process.exit(1); } };
  const email = `e2e${Date.now()}@test.id`;

  let r = await j('POST', '/api/auth/register', { name: 'E2E User', email, password: 'pass1234' });
  step('register', r.s === 200, email);
  const userToken = r.d.token;

  r = await j('POST', '/api/auth/login', { email: 'admin@nusalapak.id', password: 'admin123' });
  step('admin-login', r.s === 200 && r.d.user.role === 'admin');
  const adminToken = r.d.token;

  r = await j('GET', '/api/products?limit=3', null);
  step('list-products', r.s === 200 && r.d.products.length > 0, `${r.d.total} produk`);
  const p1 = r.d.products[0], p2 = r.d.products[1] || r.d.products[0];
  const stockBefore = (await j('GET', `/api/products/${p1.id}`, null)).d.product.stock;

  r = await j('GET', '/api/orders/my', null, 'token-salah');
  step('guard-tanpa-token', r.s === 401);
  r = await j('GET', '/api/admin/stats', null, userToken);
  step('guard-user-ke-admin', r.s === 403);

  r = await j('POST', '/api/orders/checkout', {
    items: [{ product_id: p1.id, qty: 2 }, { product_id: p2.id, qty: 1 }],
    recipient_name: 'E2E User', phone: '0812000111222', address: 'Jl. E2E Test No. 99, Bandung', city: 'Bandung', payment_method: 'transfer'
  }, userToken);
  step('checkout', r.s === 200 && r.d.order.code, r.d.order ? r.d.order.code : JSON.stringify(r.d));
  const orderId = r.d.order.id;

  const after = (await j('GET', `/api/products/${p1.id}`, null)).d.product.stock;
  step('stok-berkurang', after === stockBefore - 2, `${stockBefore} -> ${after}`);

  for (const st of ['diproses', 'dikirim', 'selesai']) {
    r = await j('PUT', `/api/admin/orders/${orderId}/status`, { status: st }, adminToken);
    step(`admin-set-${st}`, r.s === 200 && r.d.order.status === st);
  }
  r = await j('GET', '/api/orders/my', null, userToken);
  step('user-lihat-status', r.d.orders.find((o) => o.id === orderId)?.status === 'selesai');

  r = await j('POST', `/api/products/${p1.id}/reviews`, { rating: 5, comment: 'E2E review otomatis' }, userToken);
  step('tulis-review', r.s === 200);

  r = await j('GET', '/api/admin/stats', null, adminToken);
  step('admin-stats', r.s === 200 && r.d.totalOrders >= 1, `orders=${r.d.totalOrders} revenue=${r.d.revenue}`);
  r = await j('GET', '/api/admin/reports/sales', null, adminToken);
  step('admin-reports', r.s === 200 && Array.isArray(r.d.daily));

  r = await j('POST', '/api/categories', { name: 'E2E Kat ' + Date.now() }, adminToken);
  step('admin-create-category', r.s === 200);
  const catId = r.d.category.id;
  r = await j('POST', '/api/products', { name: 'E2E Produk ' + Date.now(), price: 10000, stock: 5, category_id: catId, description: 'produk tes e2e' }, adminToken);
  step('admin-create-product', r.s === 200);
  const newPid = r.d.product.id;
  r = await j('PUT', `/api/products/${newPid}`, { name: r.d.product.name, price: 12000, stock: 7 }, adminToken);
  step('admin-update-product', r.s === 200 && r.d.product.price === 12000);
  r = await j('DELETE', `/api/products/${newPid}`, null, adminToken);
  step('admin-delete-product', r.s === 200);

  console.log(log.join('\n'));
  console.log('E2E SEMUA LOLOS');
})().catch((e) => { console.error('E2E ERROR:', e.message); process.exit(1); });
