const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nusalapak-dev-secret-ganti-di-produksi';
const JWT_EXPIRES = '7d';

function hashPassword(pw) { return bcrypt.hashSync(pw, 10); }
function verifyPassword(pw, hash) { return bcrypt.compareSync(pw, hash); }
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}
function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Belum login. Sertakan token.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { db } = require('./db');
    const user = db.prepare('SELECT id, name, email, role, phone, address, city, is_active FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Akun tidak ditemukan.' });
    if (!user.is_active) return res.status(403).json({ error: 'Akun dinonaktifkan. Hubungi admin.' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token tidak valid / kedaluwarsa.' });
  }
}
function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang boleh mengakses.' });
  next();
}

module.exports = { hashPassword, verifyPassword, signToken, authRequired, adminRequired };
