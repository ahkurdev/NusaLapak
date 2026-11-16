# NusaLapak — Pasar Nusantara

English version: [README.md](README.md)

Marketplace full-stack bertema Nusantara: katalog produk UMKM, keranjang, checkout dengan
stok otomatis, ulasan/rating, autentikasi JWT berbasis role, dan dashboard admin terpisah
(CRUD produk, kategori, pengguna, pesanan, plus laporan penjualan).

Brand, logo, dan tema visual dibuat orisinal untuk proyek ini — bukan meniru platform manapun.

## Tech Stack

| Lapisan  | Teknologi |
|----------|-----------|
| Backend  | Node.js 22+, Express 4 |
| Database | SQLite via `node:sqlite` (tanpa server DB eksternal) |
| Auth     | bcryptjs + JWT (`jsonwebtoken`) |
| Upload   | multer (gambar produk, max 2 MB) |
| Frontend | HTML + CSS + JS vanilla (tanpa build step, tanpa framework) |
| Grafik laporan | Canvas 2D bawaan browser |

## Fitur

### Publik / Pembeli
- Landing page: hero, kategori pilihan, produk unggulan, keunggulan toko
- Daftar produk: search, filter kategori, filter rentang harga, sorting
  (terbaru / terlaris / harga terendah / tertinggi), pagination
- Detail produk: galeri gambar, deskripsi, harga, stok real-time, rating rata-rata,
  daftar ulasan, tulis/ubah ulasan (login)
- Keranjang (localStorage): tambah, ubah qty, hapus, kosongkan
- Checkout: data penerima + metode bayar (transfer / e-wallet / COD),
  stok berkurang atomik per transaksi
- Riwayat pesanan dengan timeline status
- Auth: register, login, logout, edit profil (nama, HP, alamat, kota), ganti password
- Halaman profil: data diri + ringkasan total order dan total belanja

### Admin (`/admin.html`, khusus role `admin`)
- Ringkasan: total produk aktif, total pengguna, total order, revenue (non-batal),
  order terbaru, peringatan stok menipis
- CRUD Produk: tambah/ubah/hapus (soft delete) + upload gambar
- CRUD Kategori: tambah/ubah/hapus (produk yatim jadi tanpa kategori)
- Kelola Pengguna: aktif/nonaktif akun, ubah role user/admin
- Kelola Pesanan: filter per status, update
  `pending > diproses > dikirim > selesai`, batalkan order (stok dikembalikan otomatis)
- Laporan: revenue harian 14 hari (grafik canvas), revenue per kategori,
  produk terlaris

### Keamanan & Validasi
- Semua endpoint sensitif divalidasi di server (`src/validate.js`)
- Middleware `authRequired` (JWT) dan `adminRequired` (role) di setiap rute privat
- User biasa yang membuka `/admin.html` atau `/api/admin/*` ditolak (403 + pesan khusus)
- Akun nonaktif tidak bisa login; token lama ikut ditolak
- Password di-hash bcrypt; password minimal 6 karakter

## Struktur Proyek

```
.
├── src/
│   ├── server.js     # seluruh API + static hosting + upload
│   ├── db.js         # skema SQLite (users, categories, products, orders, order_items, reviews)
│   ├── auth.js       # hash/verify password, sign JWT, middleware auth + admin
│   ├── validate.js   # validasi input server-side
│   └── seed.js       # 6 kategori, 16 produk, 2 akun demo, 1 review
├── public/
│   ├── index.html products.html product.html cart.html checkout.html
│   ├── orders.html login.html register.html profile.html admin.html
│   ├── css/style.css # design system (cream/navy/terracotta/sage, tanpa neon)
│   └── js/app.js     # helper API, session JWT, keranjang localStorage, navbar/footer
├── scripts/e2e.js    # tes HTTP end-to-end (18 skenario)
└── uploads/          # hasil upload gambar produk (diabaikan git)
```

## Cara Menjalankan

Butuh Node.js 22+ (disarankan 24).

```bash
npm install
npm start
```

Buka http://localhost:3000 — admin di http://localhost:3000/admin.html

| Akun  | Email | Password |
|-------|-------|----------|
| Admin | admin@nusalapak.id | admin123 |
| Pembeli demo | demo@nusalapak.id | demo1234 |

Variabel opsional:

```bash
PORT=4000 npm start        # ganti port
BASE=http://localhost:4000 npm run test:e2e
```

Reset data demo: hentikan server, hapus `data.sqlite*`, jalankan `npm start` lagi
(seed berjalan otomatis saat database kosong).

## Alur Demo (5 menit)

1. Buka halaman utama, klik kategori atau cari "kopi".
2. Buka detail produk, tambah ke keranjang, buka keranjang, lanjut checkout.
   (Daftar akun baru dulu jika belum login.)
3. Isi alamat, buat pesanan — catat kode order (mis. `NL-XXXX`).
4. Login sebagai admin, buka Dashboard > Pesanan, geser status
   Menunggu > Diproses > Dikirim > Selesai.
5. Login lagi sebagai pembeli, buka Pesanan — status terbaru tampil di timeline.
6. Kembali ke produk yang dibeli, tulis ulasan bintang 5.

## Testing

```bash
npm run test:e2e   # butuh server jalan; 18 skenario HTTP, terakhir verified: 18/18 lolos
```

Cakupan: register, login admin, list produk, guard tanpa token (401),
guard user ke rute admin (403), checkout, pengurangan stok, transisi status order,
visibilitas status di sisi user, tulis review, stats admin, reports,
create/update/delete kategori dan produk.

## Desain

- Palet: cream `#FAF7F2`, navy `#1E3A5F`, terracotta `#C2703D`, sage `#5F7F60`
- Heading serif (Georgia) untuk nuansa lokal yang elegan, body sans-system
- Flat, tanpa neon, tanpa glow, tanpa gaya gamer/cyberpunk
- Responsive: grid adaptif + breakpoint 820px (sidebar admin jadi chip, nav ringkas)

## Lisensi

MIT — bebas dipakai sebagai portofolio maupun dikembangkan lebih lanjut.
