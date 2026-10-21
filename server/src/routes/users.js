import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q, hydrateUser, userCard, hydrateCommunity } from '../db.js';
import { auth } from '../auth.js';
import { upload, fileUrl } from '../upload.js';
import { cleanProfile } from './auth.js';
import { friendIds, friendshipStatus, notify, isBlockedBetween } from '../services.js';
import { scorePerson } from '../recommend.js';
import { ICEBREAKERS, OPTIONS, zoneOf } from '../constants.js';

const r = Router();
r.use(auth);

r.put('/users/me', upload.single('avatar'), (req, res) => {
  let body = req.body;
  if (body?.profile) { try { body = JSON.parse(body.profile); } catch { return res.status(400).json({ error: 'Invalid profile data' }); } }
  const profile = cleanProfile(body);
  if (profile.name === '') return res.status(400).json({ error: 'Name is required' });
  if (req.file) profile.avatar = fileUrl(req.file);
  if (body.removeAvatar) profile.avatar = null;
  if (body.password) {
    if (String(body.password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    profile.password_hash = bcrypt.hashSync(String(body.password), 10);
  }
  const keys = Object.keys(profile);
  if (keys.length) q.run(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...Object.values(profile), req.user.id);
  res.json({ user: hydrateUser(q.get('SELECT * FROM users WHERE id = ?', req.user.id)) });
});

r.get('/users/me/friends', (req, res) => {
  const ids = [...friendIds(req.user.id)];
  const rows = ids.length ? q.all(`SELECT * FROM users WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY name`, ...ids) : [];
  res.json({ friends: rows.map(userCard) });
});

r.get('/users/me/requests', (req, res) => {
  const incoming = q.all(`SELECT u.* FROM friendships f JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`, req.user.id).map(userCard);
  const outgoing = q.all(`SELECT u.* FROM friendships f JOIN users u ON u.id = f.addressee_id
    WHERE f.requester_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC`, req.user.id).map(userCard);
  res.json({ incoming, outgoing });
});

r.get('/users/me/blocked', (req, res) => {
  res.json({ blocked: q.all('SELECT u.* FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ?', req.user.id).map(userCard) });
});

r.get('/users/:handle', (req, res) => {
  const row = q.get('SELECT * FROM users WHERE handle = ? OR id = ?', req.params.handle, Number(req.params.handle) || -1);
  if (!row) return res.status(404).json({ error: 'User not found' });
  const me = req.user;
  const blockedByThem = !!q.get('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', row.id, me.id);
  if (blockedByThem) return res.status(404).json({ error: 'User not found' });
  const blockedByMe = !!q.get('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', me.id, row.id);

  const user = hydrateUser(row);
  if (row.id !== me.id) delete user.email;
  user.online = userCard(row).online;
  const isSelf = row.id === me.id;
  const meH = hydrateUser(me);
  const match = isSelf ? null : scorePerson(meH, user, { mode: 'friends' });
  const differentBackground = !isSelf && (user.department !== meH.department || zoneOf(user.region) !== zoneOf(meH.region));

  const communities = q.all(`SELECT c.*, (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) AS member_count
    FROM community_members m JOIN communities c ON c.id = m.community_id WHERE m.user_id = ?`, row.id).map(hydrateCommunity);
  const theirFriends = friendIds(row.id);
  const myFriends = friendIds(me.id);
  const mutual = [...theirFriends].filter((id) => myFriends.has(id)).length;

  res.json({
    user,
    isSelf,
    friendship: isSelf ? 'self' : friendshipStatus(me.id, row.id),
    blockedByMe,
    match: match && { percent: Math.round(match.score * 100), reasons: match.reasons },
    stats: {
      friends: theirFriends.size,
      mutual,
      posts: q.get("SELECT COUNT(*) AS n FROM posts WHERE user_id = ?", row.id).n,
      events: q.get("SELECT COUNT(*) AS n FROM activity_members WHERE user_id = ? AND status = 'accepted'", row.id).n,
    },
    communities,
    icebreakers: differentBackground ? ICEBREAKERS.slice(0, 6) : [],
  });
});

r.post('/users/:id/friend', (req, res) => {
  const other = Number(req.params.id);
  const me = req.user.id;
  if (other === me) return res.status(400).json({ error: "You can't add yourself" });
  if (!q.get('SELECT 1 FROM users WHERE id = ?', other)) return res.status(404).json({ error: 'User not found' });
  if (isBlockedBetween(me, other)) return res.status(403).json({ error: 'You cannot connect with this user' });
  const status = friendshipStatus(me, other);
  if (status === 'friends') return res.json({ friendship: 'friends' });
  if (status === 'incoming') {
    q.run("UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ?", other, me);
    notify(other, 'friend', `${req.user.name} accepted your friend request`, `/u/${req.user.handle}`);
    return res.json({ friendship: 'friends' });
  }
  if (status === 'none') {
    q.run('INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?)', me, other);
    notify(other, 'friend_request', `${req.user.name} sent you a friend request`, `/personal?tab=requests`);
  }
  res.json({ friendship: 'requested' });
});

r.post('/users/:id/friend/accept', (req, res) => {
  const other = Number(req.params.id);
  const info = q.run("UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'", other, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'No pending request' });
  notify(other, 'friend', `${req.user.name} accepted your friend request`, `/u/${req.user.handle}`);
  res.json({ friendship: 'friends' });
});

// Remove friend / cancel request / decline request
r.delete('/users/:id/friend', (req, res) => {
  const other = Number(req.params.id), me = req.user.id;
  q.run('DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)', me, other, other, me);
  res.json({ friendship: 'none' });
});

r.post('/users/:id/block', (req, res) => {
  const other = Number(req.params.id), me = req.user.id;
  if (other === me) return res.status(400).json({ error: "You can't block yourself" });
  q.run('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)', me, other);
  q.run('DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)', me, other, other, me);
  res.json({ blocked: true });
});

r.delete('/users/:id/block', (req, res) => {
  q.run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', req.user.id, Number(req.params.id));
  res.json({ blocked: false });
});

const REPORT_TARGETS = { user: 'users', post: 'posts', comment: 'comments', activity: 'activities', community: 'communities', message: 'messages' };

r.post('/reports', (req, res) => {
  const { target_type, target_id, reason, details } = req.body || {};
  if (!REPORT_TARGETS[target_type]) return res.status(400).json({ error: 'Invalid report target' });
  if (!OPTIONS.reportReasons.includes(reason)) return res.status(400).json({ error: 'Choose a reason' });
  if (!q.get(`SELECT 1 FROM ${REPORT_TARGETS[target_type]} WHERE id = ?`, Number(target_id))) return res.status(404).json({ error: 'Not found' });
  q.run('INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES (?, ?, ?, ?, ?)',
    req.user.id, target_type, Number(target_id), reason, String(details || '').slice(0, 1000));
  res.status(201).json({ ok: true });
});

r.get('/notifications', (req, res) => {
  const items = q.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30', req.user.id);
  const unread = q.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', req.user.id).n;
  res.json({ items, unread });
});

r.post('/notifications/read', (req, res) => {
  q.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', req.user.id);
  res.json({ ok: true });
});

export default r;
