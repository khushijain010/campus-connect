import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collegeEmail } from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '..', 'data');

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  department TEXT,
  year TEXT,
  courses TEXT DEFAULT '[]',
  skills TEXT DEFAULT '[]',
  hobbies TEXT DEFAULT '[]',
  interests TEXT DEFAULT '[]',
  clubs TEXT DEFAULT '[]',
  bio TEXT DEFAULT '',
  region TEXT,
  languages_spoken TEXT DEFAULT '[]',
  languages_interested TEXT DEFAULT '[]',
  cultural_interests TEXT DEFAULT '[]',
  foods TEXT DEFAULT '[]',
  festivals TEXT DEFAULT '[]',
  music_art TEXT DEFAULT '[]',
  availability TEXT DEFAULT '[]',
  last_seen TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'post',          -- post | story (cultural card)
  type TEXT NOT NULL DEFAULT 'text',          -- text | image | link | event | project | discussion
  topic TEXT DEFAULT 'General',
  story_category TEXT,
  content TEXT NOT NULL DEFAULT '',
  images TEXT DEFAULT '[]',
  link_url TEXT,
  meta TEXT DEFAULT '{}',
  tags TEXT DEFAULT '[]',
  community_id INTEGER REFERENCES communities(id) ON DELETE SET NULL,
  visibility TEXT DEFAULT 'public',
  views INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_upvotes (
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_saves (
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  option INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | accepted
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,                  -- user | post | activity | community | message
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skips (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  skipped_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, skipped_id)
);

CREATE TABLE IF NOT EXISTS communities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,                     -- Academic | Hobbies | Entertainment | Sports | Culture
  is_cultural INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  emoji TEXT DEFAULT '✨',
  color TEXT DEFAULT '#2563eb',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS community_members (
  community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'event',         -- event | study | project | sports | teach
  type TEXT NOT NULL DEFAULT 'Hobby',         -- Hobby | Sports | Study | Cultural | Project
  category TEXT NOT NULL DEFAULT 'Events',    -- Study | Projects | Sports | Events | Hobbies | Games | Culture
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  date TEXT,                                  -- YYYY-MM-DD
  time TEXT,                                  -- HH:MM
  location TEXT DEFAULT 'Campus',
  capacity INTEGER DEFAULT 8,
  requirements TEXT DEFAULT '[]',
  level TEXT DEFAULT 'Beginner',
  department TEXT,
  course TEXT,
  looking_for TEXT DEFAULT '[]',
  skills TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  is_cultural_exchange INTEGER DEFAULT 0,
  emoji TEXT DEFAULT '📅',
  status TEXT DEFAULT 'open',                 -- open | completed | cancelled
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_members (
  activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | accepted | rejected
  message TEXT,
  applied_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                         -- dm | group | community
  name TEXT,
  activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
  community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  last_read_id INTEGER DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT DEFAULT '',
  image TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  met_new INTEGER,
  learned_new INTEGER,
  cultural INTEGER,
  again INTEGER,
  comment TEXT,
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS buddy_prefs (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  topic TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cultures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  topics TEXT DEFAULT '{}',
  emoji TEXT,
  color TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
`;

let db;

export function openDb(file = process.env.DB_PATH) {
  const target = file || path.join(DATA_DIR, 'campus.db');
  if (target !== ':memory:') fs.mkdirSync(path.dirname(target), { recursive: true });
  db = new DatabaseSync(target);
  db.exec(SCHEMA);
  // Lightweight migrations for databases created by earlier versions.
  const cols = db.prepare('PRAGMA table_info(comments)').all().map((c) => c.name);
  if (!cols.includes('parent_id')) db.exec('ALTER TABLE comments ADD COLUMN parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE');
  migrateLegacyEmails();
  return db;
}

/**
 * Accounts created before the switch to IIT Roorkee emails keep working:
 * x@iit.ac.in → x@<dept>.iitr.ac.in and x@cse.iit.ac.in → x@cse.iitr.ac.in. Idempotent; skips clashes.
 */
export function migrateLegacyEmails() {
  const legacy = db.prepare("SELECT id, email, department FROM users WHERE email LIKE '%@iit.ac.in' OR email LIKE '%.iit.ac.in'").all();
  for (const u of legacy) {
    const [local, domain] = u.email.split('@');
    const next = domain === 'iit.ac.in' ? collegeEmail(local, u.department) : `${local}@${domain.replace(/iit\.ac\.in$/, 'iitr.ac.in')}`;
    if (!db.prepare('SELECT 1 FROM users WHERE email = ?').get(next)) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(next, u.id);
  }
  return legacy.length;
}

export function getDb() {
  if (!db) openDb();
  return db;
}

// Small helpers so route code stays terse.
export const q = {
  get: (sql, ...p) => getDb().prepare(sql).get(...p),
  all: (sql, ...p) => getDb().prepare(sql).all(...p),
  run: (sql, ...p) => getDb().prepare(sql).run(...p),
};

export function tx(fn) {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const r = fn();
    d.exec('COMMIT');
    return r;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

export const parse = (v, fallback = []) => {
  if (v == null) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
};

const USER_JSON = ['courses', 'skills', 'hobbies', 'interests', 'clubs', 'languages_spoken',
  'languages_interested', 'cultural_interests', 'foods', 'festivals', 'music_art', 'availability'];

export function hydrateUser(row) {
  if (!row) return null;
  const u = { ...row };
  delete u.password_hash;
  for (const k of USER_JSON) u[k] = parse(u[k]);
  return u;
}

// Compact public card used in lists.
export function userCard(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, handle: row.handle, avatar: row.avatar,
    department: row.department, year: row.year, region: row.region,
    interests: parse(row.interests), hobbies: parse(row.hobbies),
    online: isOnline(row.last_seen),
  };
}

export function isOnline(lastSeen) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen + 'Z').getTime() < 5 * 60 * 1000;
}

export function hydrateActivity(row) {
  if (!row) return null;
  const a = { ...row };
  for (const k of ['requirements', 'looking_for', 'skills', 'tags']) a[k] = parse(a[k]);
  a.is_cultural_exchange = !!a.is_cultural_exchange;
  return a;
}

export function hydrateCommunity(row) {
  if (!row) return null;
  return { ...row, tags: parse(row.tags), is_cultural: !!row.is_cultural };
}
