import { q, tx } from './db.js';
import { emitToUser, joinConversation, leaveConversation } from './realtime.js';

export function notify(userId, type, text, link = null) {
  const r = q.run('INSERT INTO notifications (user_id, type, text, link) VALUES (?, ?, ?, ?)', userId, type, text, link);
  emitToUser(userId, 'notification', { id: Number(r.lastInsertRowid), type, text, link });
}

export const friendIds = (uid) => new Set(q.all(
  `SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS id
   FROM friendships WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`, uid, uid, uid,
).map((r) => r.id));

// Users hidden from `uid` – blocked by them or blocking them.
export const hiddenIds = (uid) => new Set(q.all(
  'SELECT blocked_id AS id FROM blocks WHERE blocker_id = ? UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?', uid, uid,
).map((r) => r.id));

export const isBlockedBetween = (a, b) => !!q.get(
  'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)', a, b, b, a,
);

export function friendshipStatus(me, other) {
  const f = q.get('SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)', me, other, other, me);
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friends';
  return f.requester_id === me ? 'requested' : 'incoming';
}

export function addConvMember(convId, userId) {
  const last = q.get('SELECT MAX(id) AS m FROM messages WHERE conversation_id = ?', convId)?.m || 0;
  q.run('INSERT OR IGNORE INTO conversation_members (conversation_id, user_id, last_read_id) VALUES (?, ?, ?)', convId, userId, last);
  joinConversation(userId, convId);
}

export function removeConvMember(convId, userId) {
  q.run('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?', convId, userId);
  leaveConversation(userId, convId);
}

export function ensureDm(a, b) {
  const existing = q.get(
    `SELECT c.id FROM conversations c
     JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
     JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
     WHERE c.type = 'dm'`, a, b,
  );
  if (existing) return existing.id;
  return tx(() => {
    const id = Number(q.run("INSERT INTO conversations (type) VALUES ('dm')").lastInsertRowid);
    addConvMember(id, a);
    addConvMember(id, b);
    return id;
  });
}

export function activityConversation(activityId) {
  const c = q.get("SELECT id FROM conversations WHERE type = 'group' AND activity_id = ?", activityId);
  if (c) return c.id;
  const a = q.get('SELECT title FROM activities WHERE id = ?', activityId);
  return Number(q.run("INSERT INTO conversations (type, name, activity_id) VALUES ('group', ?, ?)", a.title, activityId).lastInsertRowid);
}

export function communityConversation(communityId) {
  const c = q.get("SELECT id FROM conversations WHERE type = 'community' AND community_id = ?", communityId);
  if (c) return c.id;
  const cm = q.get('SELECT name FROM communities WHERE id = ?', communityId);
  return Number(q.run("INSERT INTO conversations (type, name, community_id) VALUES ('community', ?, ?)", cm.name, communityId).lastInsertRowid);
}

export const today = () => new Date().toISOString().slice(0, 10);

// Activities whose date has passed become "completed" and their participants are asked for feedback.
export function completePastActivities() {
  const due = q.all("SELECT id, title FROM activities WHERE status = 'open' AND date IS NOT NULL AND date < ?", today());
  for (const a of due) markCompleted(a.id, a.title);
  return due.length;
}

export function markCompleted(activityId, title) {
  q.run("UPDATE activities SET status = 'completed' WHERE id = ?", activityId);
  const members = q.all("SELECT user_id FROM activity_members WHERE activity_id = ? AND status = 'accepted'", activityId);
  for (const m of members) notify(m.user_id, 'feedback', `“${title}” is complete – tell us how it went!`, `/personal?feedback=${activityId}`);
}

// Featured post-event feedback, shown anonymously (Home testimonials + landing page reviews).
export function featuredTestimonials(limit = 12) {
  const rows = q.all(`SELECT f.rating, f.comment, f.created_at, f.met_new, f.cultural, a.title, a.type, a.category, u.year, u.department
    FROM feedback f JOIN activities a ON a.id = f.activity_id JOIN users u ON u.id = f.user_id
    WHERE f.featured = 1 ORDER BY f.created_at DESC, f.id DESC LIMIT ?`, limit);
  return rows.map((t) => ({
    rating: t.rating, comment: t.comment, activity: t.title, type: t.type, created_at: t.created_at,
    who: `A ${t.year || ''} year ${t.department || ''} student`.replace(/\s+/g, ' '),
    highlights: [t.met_new ? 'Met someone new' : null, t.cultural ? 'Cultural exchange' : null].filter(Boolean),
  }));
}
