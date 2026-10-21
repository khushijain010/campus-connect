import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q, hydrateUser } from '../db.js';
import { auth, signToken } from '../auth.js';
import { upload, fileUrl } from '../upload.js';
import { isCollegeEmail, OPTIONS, ICEBREAKERS, ALLOWED_EMAIL_SUFFIX, ALLOWED_EMAIL_SUFFIXES } from '../constants.js';
import { featuredTestimonials } from '../services.js';

const r = Router();

const HANDLE_RE = /^[a-z0-9_.]{3,20}$/i;
const LIST_FIELDS = ['courses', 'skills', 'hobbies', 'interests', 'clubs', 'languages_spoken', 'languages_interested',
  'cultural_interests', 'foods', 'festivals', 'music_art', 'availability'];
const TEXT_FIELDS = ['name', 'department', 'year', 'bio', 'region'];

export function cleanProfile(body) {
  const out = {};
  for (const k of TEXT_FIELDS) if (body[k] !== undefined) out[k] = String(body[k] ?? '').trim().slice(0, k === 'bio' ? 500 : 80);
  for (const k of LIST_FIELDS) {
    if (body[k] === undefined) continue;
    const arr = Array.isArray(body[k]) ? body[k] : [];
    out[k] = JSON.stringify([...new Set(arr.map((x) => String(x).trim()).filter(Boolean))].slice(0, 20));
  }
  return out;
}

// Registration fields arrive as multipart: avatar file + "profile" JSON string.
function readProfile(req) {
  if (req.body?.profile) {
    try { return JSON.parse(req.body.profile); } catch { return null; }
  }
  return req.body;
}

r.get('/meta', (_req, res) => res.json({ options: OPTIONS, icebreakers: ICEBREAKERS, emailSuffix: ALLOWED_EMAIL_SUFFIX, emailSuffixes: ALLOWED_EMAIL_SUFFIXES }));

// Public landing page: live platform numbers + anonymous post-event reviews. No personal data.
r.get('/landing', (_req, res) => {
  const count = (sql) => q.get(sql).n;
  const fb = q.get('SELECT COUNT(*) AS n, AVG(rating) AS rating, AVG(met_new) AS met, AVG(again) AS again, AVG(cultural) AS cultural FROM feedback');
  const pct = (v) => (fb.n ? Math.round(v * 100) : null);
  res.json({
    stats: {
      students: count('SELECT COUNT(*) AS n FROM users'),
      departments: count("SELECT COUNT(DISTINCT department) AS n FROM users WHERE department != ''"),
      regions: count("SELECT COUNT(DISTINCT region) AS n FROM users WHERE region != ''"),
      communities: count('SELECT COUNT(*) AS n FROM communities'),
      activities: count('SELECT COUNT(*) AS n FROM activities'),
      connections: count("SELECT COUNT(*) AS n FROM friendships WHERE status = 'accepted'"),
      rating: fb.n ? Math.round(fb.rating * 10) / 10 : null,
      metNew: pct(fb.met),
      again: pct(fb.again),
      cultural: pct(fb.cultural),
    },
    testimonials: featuredTestimonials(9),
  });
});

r.post('/auth/check', (req, res) => {
  const { email, handle } = req.body || {};
  const errors = {};
  if (email !== undefined) {
    if (!isCollegeEmail(email)) errors.email = `Use your college email, e.g. name@ece.${ALLOWED_EMAIL_SUFFIX}`;
    else if (q.get('SELECT 1 FROM users WHERE email = ?', email.trim())) errors.email = 'This email is already registered';
  }
  if (handle !== undefined) {
    if (!HANDLE_RE.test(handle || '')) errors.handle = '3–20 letters, numbers, _ or .';
    else if (q.get('SELECT 1 FROM users WHERE handle = ?', handle)) errors.handle = 'This handle is taken';
  }
  res.json({ ok: !Object.keys(errors).length, errors });
});

r.post('/auth/register', upload.single('avatar'), (req, res) => {
  const body = readProfile(req);
  if (!body) return res.status(400).json({ error: 'Invalid profile data' });
  const name = String(body.name || '').trim();
  const handle = String(body.handle || '').trim().replace(/^@/, '');
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!HANDLE_RE.test(handle)) return res.status(400).json({ error: 'Handle must be 3–20 letters, numbers, _ or .' });
  if (!isCollegeEmail(email)) return res.status(400).json({ error: `Only college emails ending with .${ALLOWED_EMAIL_SUFFIX} (e.g. name@ece.${ALLOWED_EMAIL_SUFFIX}) are allowed` });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (q.get('SELECT 1 FROM users WHERE email = ?', email)) return res.status(409).json({ error: 'This email is already registered' });
  if (q.get('SELECT 1 FROM users WHERE handle = ?', handle)) return res.status(409).json({ error: 'This handle is taken' });

  const profile = cleanProfile(body);
  const cols = ['name', 'handle', 'email', 'password_hash', 'avatar', ...Object.keys(profile).filter((k) => k !== 'name')];
  const vals = [name, handle, email, bcrypt.hashSync(password, 10), fileUrl(req.file), ...Object.entries(profile).filter(([k]) => k !== 'name').map(([, v]) => v)];
  const info = q.run(`INSERT INTO users (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...vals);
  const user = q.get('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
  res.status(201).json({ user: hydrateUser(user) });
});

r.post('/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!isCollegeEmail(email)) return res.status(400).json({ error: `Log in with your college email (e.g. name@ece.${ALLOWED_EMAIL_SUFFIX})` });
  const user = q.get('SELECT * FROM users WHERE email = ?', email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Incorrect email or password' });
  res.json({ token: signToken(user), user: hydrateUser(user) });
});

r.get('/auth/me', auth, (req, res) => res.json({ user: hydrateUser(req.user) }));

export default r;
