import jwt from 'jsonwebtoken';
import { q } from './db.js';

const SECRET = process.env.JWT_SECRET || 'campus-connect-dev-secret';

export const signToken = (user) => jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' });

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Please log in' });
  const user = q.get('SELECT * FROM users WHERE id = ?', payload.id);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  q.run("UPDATE users SET last_seen = datetime('now') WHERE id = ?", user.id);
  req.user = user;
  next();
}
