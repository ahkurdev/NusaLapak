function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim()); }
function str(v, max = 255) { return String(v ?? '').trim().slice(0, max); }
function int(v, def = 0) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; }

function validateRegister(b) {
  const e = [];
  if (str(b.name, 80).length < 3) e.push('Nama minimal 3 karakter.');
  if (!isEmail(b.email)) e.push('Email tidak valid.');
  if (String(b.password || '').length < 6) e.push('Password minimal 6 karakter.');
  return e;
}
function validateProduct(b) {
  const e = [];
  if (str(b.name, 160).length < 3) e.push('Nama produk minimal 3 karakter.');
  if (int(b.price) < 0) e.push('Harga tidak boleh negatif.');
  if (int(b.stock) < 0) e.push('Stok tidak boleh negatif.');
  if (b.category_id !== undefined && b.category_id !== null && b.category_id !== '' && int(b.category_id, -1) < 1) e.push('Kategori tidak valid.');
  return e;
}
function validateCheckout(b) {
  const e = [];
  if (!Array.isArray(b.items) || b.items.length === 0) e.push('Keranjang kosong.');
  if (Array.isArray(b.items)) {
    if (b.items.length > 50) e.push('Maksimal 50 jenis item per order.');
    for (const it of b.items) {
      if (int(it.product_id, -1) < 1) e.push('Item mengandung product_id tidak valid.');
      if (int(it.qty, 0) < 1 || int(it.qty, 0) > 100) e.push('Qty tiap item 1-100.');
    }
  }
  if (str(b.recipient_name, 80).length < 3) e.push('Nama penerima minimal 3 karakter.');
  if (str(b.phone, 20).length < 9) e.push('Nomor HP minimal 9 digit.');
  if (str(b.address, 500).length < 10) e.push('Alamat minimal 10 karakter.');
  if (!['transfer', 'cod', 'ewallet'].includes(b.payment_method)) e.push('Metode pembayaran tidak valid.');
  return e;
}

module.exports = { isEmail, str, int, validateRegister, validateProduct, validateCheckout };
