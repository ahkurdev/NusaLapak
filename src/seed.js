const { db, slugify } = require('./db');
const { hashPassword } = require('./auth');

function ensureSeed() {
  const n = db.prepare('SELECT COUNT(*) c FROM categories').get().c;
  if (n > 0) { console.log('Seed: data sudah ada, dilewati.'); return; }
  console.log('Seed: mengisi data awal NusaLapak...');

  const cats = [
    ['Kuliner Nusantara', 'kuliner-nusantara', 'Makanan, minuman, dan oleh-oleh khas daerah.', 'K'],
    ['Fashion & Wastra', 'fashion-wastra', 'Pakaian, kain tenun, batik, dan aksesoris.', 'F'],
    ['Kerajinan Tangan', 'kerajinan-tangan', 'Anyaman, gerabah, ukiran, dan dekorasi rumah.', 'H'],
    ['Kecantikan Alami', 'kecantikan-alami', 'Skincare dan perawatan berbahan alami lokal.', 'C'],
    ['Elektronik & Gadget', 'elektronik-gadget', 'Gadget, audio, dan aksesori teknologi.', 'E'],
    ['Rumah & Dapur', 'rumah-dapur', 'Perabot, peralatan dapur, dan kebutuhan rumah.', 'R'],
  ];
  const catIds = {};
  for (const [name, slug, desc, icon] of cats) {
    const r = db.prepare('INSERT INTO categories (name, slug, description, icon) VALUES (?,?,?,?)').run(name, slug, desc, icon);
    catIds[slug] = Number(r.lastInsertRowid);
  }

  const P = (category, name, price, stock, desc, featured = 0, sold = 0) => ({
    category_id: catIds[category], name, slug: slugify(name), description: desc,
    price, stock, image_url: '', is_featured: featured, sold
  });
  const products = [
    P('kuliner-nusantara', 'Rendang Sapi Premium 500g', 129000, 40, 'Rendang sapi asli dimasak 8 jam dengan santan kelapa dan rempah pilihan. Kemasan vakum tahan 30 hari.', 1, 210),
    P('kuliner-nusantara', 'Kopi Arabika Gayo 200g', 89000, 60, 'Biji kopi arabika dataran tinggi Gayo, sangrai medium. Aroma cokelat dan rempah, gilingan kasar/halus.', 1, 340),
    P('kuliner-nusantara', 'Sambal Roa Manado 150g', 45000, 90, 'Sambal ikan roa asap khas Manado, pedas gurih. Cocok untuk teman nasi hangat dan mie.', 0, 120),
    P('fashion-wastra', 'Kemeja Batik Solo Slimfit', 249000, 25, 'Kemeja batik cap motif parang, katun primis adem. Potongan slimfit modern untuk kerja dan acara.', 1, 95),
    P('fashion-wastra', 'Kain Tenun Lombok 2m', 329000, 18, 'Kain tenun ikat khas Lombok, pewarna alam, lebar 110cm panjang 2m. Cocok untuk baju dan dekorasi.', 1, 60),
    P('fashion-wastra', 'Tas Anyam Pandan Jogja', 159000, 30, 'Tas anyaman pandan handmade dengan inner kain dan resleting. Ringan, kuat, motif etnik.', 0, 75),
    P('kerajinan-tangan', 'Gerabah Lombok Set 4pcs', 199000, 22, 'Set cangkir dan teko gerabah bakar tradisional. Setiap pcs punya corak unik buatan perajin.', 1, 48),
    P('kerajinan-tangan', 'Ukiran Kayu Jati Mini Garuda', 349000, 12, 'Patung ukiran kayu jati ukir tangan, tinggi 25cm, finishing natural. Hiasan meja premium.', 0, 20),
    P('kerajinan-tangan', 'Lampu Rotan Anyam Gantung', 179000, 28, 'Kap lampu rotan anyam diameter 35cm, cocok untuk ruang tamu dan kafe bernuansa hangat.', 0, 55),
    P('kecantikan-alami', 'Sabun Kopi & Kunyit 100g', 39000, 100, 'Sabun batang natural dengan kopi robusta dan kunyit. Eksfoliasi lembut, cocok semua jenis kulit.', 0, 260),
    P('kecantikan-alami', 'Minyak Kemiri Murni 60ml', 75000, 70, 'Minyak kemiri cold-pressed untuk rambut rontok dan alis. Tanpa pewangi buatan.', 1, 150),
    P('kecantikan-alami', 'Lulur Bengkoang Brightening', 65000, 80, 'Lulur bengkoang dan beras untuk mencerahkan kulit. Butiran halus, aroma lembut.', 0, 180),
    P('elektronik-gadget', 'Speaker Kayu Bluetooth 20W', 499000, 15, 'Speaker bluetooth dengan bodi kayu jati, bass hangat, baterai 12 jam, port USB-C dan AUX.', 1, 42),
    P('elektronik-gadget', 'Powerbank 20000mAh 22.5W', 329000, 35, 'Powerbank fast-charging 22.5W, 2x USB + Type-C, layar persen digital, proteksi panas.', 0, 88),
    P('rumah-dapur', 'Cobek Batu Asli 22cm', 99000, 45, 'Cobek batu gunung asli anti luntur, diameter 22cm + ulekan. Sambal lebih sedap dan autentik.', 0, 110),
    P('rumah-dapur', 'Set Pisau Dapur Baja 6pcs', 279000, 20, 'Set 6 pisau baja Jerman dengan blok kayu akasia. Tajam, seimbang, mudah diasah.', 1, 66),
  ];
  const ins = db.prepare(`INSERT INTO products (category_id, name, slug, description, price, stock, image_url, is_featured, sold) VALUES (@category_id, @name, @slug, @description, @price, @stock, @image_url, @is_featured, @sold)`);
  for (const p of products) {
    const r = ins.run(p);
    const id = Number(r.lastInsertRowid);
    db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(`/img/p-${id}.svg`, id);
  }

  db.prepare(`INSERT INTO users (name, email, password_hash, role, phone, address, city) VALUES (?,?,?,?,?,?,?)`)
    .run('Admin NusaLapak', 'admin@nusalapak.id', hashPassword('admin123'), 'admin', '081200000001', 'Jl. Merdeka No. 1, Yogyakarta', 'Yogyakarta');
  db.prepare(`INSERT INTO users (name, email, password_hash, role, phone, address, city) VALUES (?,?,?,?,?,?,?)`)
    .run('Demo Pembeli', 'demo@nusalapak.id', hashPassword('demo1234'), 'user', '081200000002', 'Jl. Kenanga No. 8, Bandung', 'Bandung');

  const demo = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@nusalapak.id');
  const prod1 = db.prepare('SELECT id, name, price FROM products LIMIT 1').get();
  db.prepare('INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?,?,?,?)')
    .run(prod1.id, demo.id, 5, 'Rasanya autentik, pengiriman cepat dan kemasan rapi. Langganan pasti.');
  console.log('Seed selesai.');
}

if (require.main === module) ensureSeed();
module.exports = { ensureSeed };
