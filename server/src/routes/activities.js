import { Router } from 'express';
import { q, tx, parse, hydrateUser, hydrateActivity, hydrateCommunity, userCard } from '../db.js';
import { auth } from '../auth.js';
import {
  friendIds, hiddenIds, notify, activityConversation, communityConversation, addConvMember, removeConvMember,
  completePastActivities, markCompleted, today,
} from '../services.js';
import { scoreActivity, scoreCommunity } from '../recommend.js';
import { OPTIONS, slotOf } from '../constants.js';

const r = Router();
r.use(auth);

/* ------------------------------------------------------------- communities */

const COMMUNITY_SELECT = `SELECT c.*, (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) AS member_count,
  EXISTS (SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = :me) AS joined FROM communities c`;

r.get('/communities', (req, res) => {
  const me = req.user;
  let rows = q.all(`${COMMUNITY_SELECT} ORDER BY member_count DESC`, { me: me.id });
  if (req.query.cultural === '1') rows = rows.filter((c) => c.is_cultural || c.category === 'Culture');
  if (req.query.category) rows = rows.filter((c) => c.category === req.query.category);
  if (req.query.joined === '1') rows = rows.filter((c) => c.joined);
  const friends = friendIds(me.id);
  const meH = hydrateUser(me);
  const communities = rows.map((c) => {
    const memberIds = q.all('SELECT user_id FROM community_members WHERE community_id = ?', c.id).map((m) => m.user_id);
    const s = scoreCommunity(meH, hydrateCommunity(c), { memberIds, friendIds: friends });
    return { ...hydrateCommunity(c), joined: !!c.joined, score: s.score, reasons: s.reasons };
  });
  res.json({ communities });
});

r.get('/communities/:id', (req, res) => {
  const c = q.get(`${COMMUNITY_SELECT} WHERE c.id = :id`, { me: req.user.id, id: Number(req.params.id) });
  if (!c) return res.status(404).json({ error: 'Community not found' });
  const hidden = hiddenIds(req.user.id);
  const members = q.all(`SELECT u.*, m.role FROM community_members m JOIN users u ON u.id = m.user_id
    WHERE m.community_id = ? ORDER BY m.role = 'admin' DESC, m.joined_at LIMIT 60`, c.id)
    .filter((u) => !hidden.has(u.id)).map((u) => ({ ...userCard(u), role: u.role }));
  const tags = parse(c.tags).map((t) => t.toLowerCase());
  const events = q.all("SELECT * FROM activities WHERE status = 'open' AND date >= ? ORDER BY date LIMIT 50", today())
    .map(hydrateActivity)
    .filter((a) => a.tags.some((t) => tags.includes(t.toLowerCase())) || (c.is_cultural && a.is_cultural_exchange))
    .slice(0, 5);
  const conv = communityConversation(c.id);
  res.json({ community: { ...hydrateCommunity(c), joined: !!c.joined }, members, events, conversation_id: conv });
});

r.post('/communities/:id/join', (req, res) => {
  const c = q.get('SELECT * FROM communities WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Community not found' });
  q.run('INSERT OR IGNORE INTO community_members (community_id, user_id) VALUES (?, ?)', c.id, req.user.id);
  const conv = communityConversation(c.id);
  addConvMember(conv, req.user.id);
  res.json({ joined: true, conversation_id: conv });
});

r.delete('/communities/:id/join', (req, res) => {
  const id = Number(req.params.id);
  q.run('DELETE FROM community_members WHERE community_id = ? AND user_id = ?', id, req.user.id);
  removeConvMember(communityConversation(id), req.user.id);
  res.json({ joined: false });
});

/* -------------------------------------------------------------- activities */

const ACT_SELECT = `SELECT a.*, u.name AS creator_name, u.handle AS creator_handle, u.avatar AS creator_avatar,
  (SELECT COUNT(*) FROM activity_members WHERE activity_id = a.id AND status = 'accepted') AS participants,
  (SELECT COUNT(*) FROM activity_members WHERE activity_id = a.id AND status = 'pending') AS pending,
  (SELECT status FROM activity_members WHERE activity_id = a.id AND user_id = :me) AS my_status
  FROM activities a JOIN users u ON u.id = a.creator_id`;

function shapeActivity(row) {
  const a = hydrateActivity(row);
  a.creator = { id: row.creator_id, name: row.creator_name, handle: row.creator_handle, avatar: row.creator_avatar };
  delete a.creator_name; delete a.creator_handle; delete a.creator_avatar;
  a.openings = Math.max(0, (a.capacity || 0) - (a.participants || 0));
  a.slot = slotOf(a.time);
  return a;
}

// Join flow per kind: projects & study groups need approval, others are open-join.
const needsApproval = (a) => a.kind === 'project' || a.kind === 'study';

function sizeBucket(cap) {
  if (cap <= 4) return '2–4';
  if (cap <= 8) return '5–8';
  return '8+';
}

function matchesDate(date, filter) {
  if (!date) return false;
  const d = new Date(date + 'T00:00:00');
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((d - t) / 864e5);
  if (filter === 'Today') return diff === 0;
  if (filter === 'Tomorrow') return diff === 1;
  if (filter === 'Weekend') { const day = d.getDay(); return diff >= 0 && diff <= 7 && (day === 0 || day === 6); }
  return true;
}

function activityContext(me) {
  const joinedCategories = new Set(q.all(`SELECT DISTINCT a.category FROM activity_members m JOIN activities a ON a.id = m.activity_id
    WHERE m.user_id = ? AND m.status = 'accepted'`, me.id).map((r) => r.category));
  const communityTags = new Set(q.all('SELECT c.tags FROM community_members m JOIN communities c ON c.id = m.community_id WHERE m.user_id = ?', me.id)
    .flatMap((c) => parse(c.tags).map((t) => t.toLowerCase())));
  return { joinedCategories, communityTags, friendIds: friendIds(me.id) };
}

export function listActivities(me, query = {}) {
  completePastActivities();
  const hidden = hiddenIds(me.id);
  let rows = q.all(`${ACT_SELECT} WHERE a.status = 'open' ORDER BY a.date, a.time`, { me: me.id })
    .filter((a) => !hidden.has(a.creator_id)).map(shapeActivity);

  const list = (v) => (v ? String(v).split(',').filter(Boolean) : []);
  if (query.kind) rows = rows.filter((a) => list(query.kind).includes(a.kind));
  if (query.category) rows = rows.filter((a) => list(query.category).includes(a.category));
  if (query.cultural === '1') rows = rows.filter((a) => a.is_cultural_exchange);
  if (query.time) rows = rows.filter((a) => list(query.time).includes(a.slot));
  if (query.date) rows = rows.filter((a) => list(query.date).some((f) => matchesDate(a.date, f)));
  if (query.location) rows = rows.filter((a) => list(query.location).some((l) => a.location.toLowerCase().includes(l.toLowerCase())));
  if (query.size) rows = rows.filter((a) => list(query.size).includes(sizeBucket(a.capacity)));
  if (query.level) rows = rows.filter((a) => list(query.level).includes(a.level));
  if (query.department) rows = rows.filter((a) => !a.department || list(query.department).includes(a.department));
  if (query.q) {
    const t = String(query.q).toLowerCase();
    rows = rows.filter((a) => [a.title, a.description, a.course, a.location, ...a.tags, ...a.skills].join(' ').toLowerCase().includes(t));
  }

  const meH = hydrateUser(me);
  const ctx = activityContext(me);
  rows = rows.map((a) => {
    const participantIds = q.all("SELECT user_id FROM activity_members WHERE activity_id = ? AND status = 'accepted'", a.id).map((m) => m.user_id);
    const s = scoreActivity(meH, a, { ...ctx, participantIds });
    return { ...a, score: s.score, reasons: s.reasons };
  });
  if (query.sort === 'recommended') rows.sort((a, b) => b.score - a.score);
  return rows;
}

r.get('/activities', (req, res) => res.json({ activities: listActivities(req.user, req.query) }));

r.get('/activities/:id', (req, res) => {
  const row = q.get(`${ACT_SELECT} WHERE a.id = :id`, { me: req.user.id, id: Number(req.params.id) });
  if (!row) return res.status(404).json({ error: 'Activity not found' });
  const a = shapeActivity(row);
  const hidden = hiddenIds(req.user.id);
  a.members = q.all(`SELECT u.*, m.status FROM activity_members m JOIN users u ON u.id = m.user_id
    WHERE m.activity_id = ? AND m.status = 'accepted'`, a.id).filter((u) => !hidden.has(u.id)).map(userCard);
  if (a.creator_id === req.user.id) {
    a.applications = q.all(`SELECT u.*, m.status, m.message, m.applied_at FROM activity_members m JOIN users u ON u.id = m.user_id
      WHERE m.activity_id = ? AND m.user_id != ? ORDER BY m.applied_at DESC`, a.id, req.user.id)
      .map((u) => ({ ...userCard(u), status: u.status, message: u.message, applied_at: u.applied_at, skills: parse(u.skills) }));
  }
  a.feedback_given = !!q.get('SELECT 1 FROM feedback WHERE activity_id = ? AND user_id = ?', a.id, req.user.id);
  a.conversation_id = a.my_status === 'accepted' ? activityConversation(a.id) : null;
  res.json({ activity: a });
});

const KIND_BY_TYPE = { Study: 'study', Project: 'project', Sports: 'sports', Cultural: 'event', Hobby: 'event' };
const CATEGORY_BY_TYPE = { Study: 'Study', Project: 'Projects', Sports: 'Sports', Cultural: 'Culture', Hobby: 'Hobbies' };
const EMOJI_BY_TYPE = { Study: '📚', Project: '🛠️', Sports: '⚽', Cultural: '🎎', Hobby: '📷' };

r.post('/activities', (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const type = OPTIONS.eventTypes.includes(b.type) ? b.type : null;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!type) return res.status(400).json({ error: 'Choose an event type' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Pick a date' });
  if (b.date < today()) return res.status(400).json({ error: 'Date cannot be in the past' });
  if (!/^\d{2}:\d{2}$/.test(b.time || '')) return res.status(400).json({ error: 'Pick a time' });
  const capacity = Math.max(2, Math.min(200, Number(b.capacity) || 8));
  const kind = b.kind && ['event', 'study', 'project', 'sports', 'teach'].includes(b.kind) ? b.kind : KIND_BY_TYPE[type];
  const category = OPTIONS.discoverCategories.includes(b.category) ? b.category : CATEGORY_BY_TYPE[type];
  const arr = (v) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 12) : []);
  const tags = [...new Set([...arr(b.tags), ...(b.course ? [b.course] : [])])];

  const id = tx(() => {
    const info = q.run(`INSERT INTO activities (creator_id, kind, type, category, title, description, date, time, location, capacity,
      requirements, level, department, course, looking_for, skills, tags, is_cultural_exchange, emoji)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    req.user.id, kind, type, category, title.slice(0, 120), String(b.description || '').slice(0, 2000), b.date, b.time,
    String(b.location || 'Campus').slice(0, 80), capacity, JSON.stringify(arr(b.requirements)),
    OPTIONS.levels.includes(b.level) ? b.level : 'Beginner', OPTIONS.departments.includes(b.department) ? b.department : null,
    b.course ? String(b.course).slice(0, 40) : null, JSON.stringify(arr(b.looking_for)), JSON.stringify(arr(b.skills)),
    JSON.stringify(tags), type === 'Cultural' || b.is_cultural_exchange ? 1 : 0, b.emoji || EMOJI_BY_TYPE[type]);
    const newId = Number(info.lastInsertRowid);
    q.run("INSERT INTO activity_members (activity_id, user_id, status) VALUES (?, ?, 'accepted')", newId, req.user.id);
    addConvMember(activityConversation(newId), req.user.id);
    return newId;
  });
  const row = q.get(`${ACT_SELECT} WHERE a.id = :id`, { me: req.user.id, id });
  res.status(201).json({ activity: shapeActivity(row) });
});

r.post('/activities/:id/apply', (req, res) => {
  const a = q.get('SELECT * FROM activities WHERE id = ?', Number(req.params.id));
  if (!a) return res.status(404).json({ error: 'Activity not found' });
  if (a.status !== 'open') return res.status(400).json({ error: 'This activity is no longer open' });
  if (hiddenIds(req.user.id).has(a.creator_id)) return res.status(403).json({ error: 'You cannot join this activity' });
  const existing = q.get('SELECT status FROM activity_members WHERE activity_id = ? AND user_id = ?', a.id, req.user.id);
  if (existing && existing.status !== 'rejected') return res.json({ status: existing.status });
  if (existing?.status === 'rejected') return res.status(400).json({ error: 'Your application was declined' });
  const accepted = q.get("SELECT COUNT(*) AS n FROM activity_members WHERE activity_id = ? AND status = 'accepted'", a.id).n;
  if (accepted >= a.capacity) return res.status(400).json({ error: 'This activity is full' });

  const status = needsApproval(a) ? 'pending' : 'accepted';
  q.run('INSERT INTO activity_members (activity_id, user_id, status, message) VALUES (?, ?, ?, ?)',
    a.id, req.user.id, status, String(req.body?.message || '').slice(0, 500));
  if (status === 'accepted') {
    addConvMember(activityConversation(a.id), req.user.id);
    notify(a.creator_id, 'join', `${req.user.name} joined “${a.title}”`, `/activity/${a.id}`);
  } else {
    notify(a.creator_id, 'application', `${req.user.name} applied to “${a.title}”`, `/personal?manage=${a.id}`);
  }
  res.json({ status });
});

r.delete('/activities/:id/apply', (req, res) => {
  const a = q.get('SELECT * FROM activities WHERE id = ?', Number(req.params.id));
  if (!a) return res.status(404).json({ error: 'Activity not found' });
  if (a.creator_id === req.user.id) return res.status(400).json({ error: 'Organisers cannot leave their own activity' });
  q.run('DELETE FROM activity_members WHERE activity_id = ? AND user_id = ?', a.id, req.user.id);
  removeConvMember(activityConversation(a.id), req.user.id);
  res.json({ status: null });
});

r.post('/activities/:id/applications/:userId', (req, res) => {
  const a = q.get('SELECT * FROM activities WHERE id = ?', Number(req.params.id));
  if (!a || a.creator_id !== req.user.id) return res.status(404).json({ error: 'Activity not found' });
  const status = req.body?.status;
  if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const userId = Number(req.params.userId);
  if (!q.get('SELECT 1 FROM activity_members WHERE activity_id = ? AND user_id = ?', a.id, userId)) return res.status(404).json({ error: 'Application not found' });
  if (status === 'accepted') {
    const accepted = q.get("SELECT COUNT(*) AS n FROM activity_members WHERE activity_id = ? AND status = 'accepted'", a.id).n;
    if (accepted >= a.capacity) return res.status(400).json({ error: 'No openings left' });
  }
  q.run('UPDATE activity_members SET status = ? WHERE activity_id = ? AND user_id = ?', status, a.id, userId);
  const conv = activityConversation(a.id);
  if (status === 'accepted') addConvMember(conv, userId); else removeConvMember(conv, userId);
  notify(userId, 'application', `Your application to “${a.title}” was ${status}`, `/activity/${a.id}`);
  res.json({ status });
});

r.post('/activities/:id/complete', (req, res) => {
  const a = q.get('SELECT * FROM activities WHERE id = ?', Number(req.params.id));
  if (!a || a.creator_id !== req.user.id) return res.status(404).json({ error: 'Activity not found' });
  if (a.status === 'completed') return res.json({ status: 'completed' });
  markCompleted(a.id, a.title);
  res.json({ status: 'completed' });
});

r.post('/activities/:id/feedback', (req, res) => {
  const a = q.get('SELECT * FROM activities WHERE id = ?', Number(req.params.id));
  if (!a) return res.status(404).json({ error: 'Activity not found' });
  if (a.status !== 'completed') return res.status(400).json({ error: 'Feedback opens after the activity is completed' });
  if (!q.get("SELECT 1 FROM activity_members WHERE activity_id = ? AND user_id = ? AND status = 'accepted'", a.id, req.user.id)) {
    return res.status(403).json({ error: 'Only participants can give feedback' });
  }
  const b = req.body || {};
  const rating = Number(b.rating);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Rate your experience from 1 to 5' });
  const yn = (v) => (v === true || v === 'yes' ? 1 : v === false || v === 'no' ? 0 : null);
  const comment = String(b.comment || '').trim().slice(0, 1000);
  // Only consenting, positive, substantive feedback becomes an anonymous testimonial.
  const featured = b.allow_public !== false && rating >= 4 && comment.length >= 15 ? 1 : 0;
  try {
    q.run(`INSERT INTO feedback (activity_id, user_id, rating, met_new, learned_new, cultural, again, comment, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, a.id, req.user.id, rating, yn(b.met_new), yn(b.learned_new), yn(b.cultural), yn(b.again), comment, featured);
  } catch {
    return res.status(409).json({ error: 'You already submitted feedback for this activity' });
  }
  res.status(201).json({ ok: true, featured: !!featured });
});

// Everything for the Personal page in one call.
r.get('/me/activities', (req, res) => {
  completePastActivities();
  const me = req.user.id;
  const t = today();
  const created = q.all(`${ACT_SELECT} WHERE a.creator_id = :me ORDER BY a.status = 'completed', a.date`, { me }).map((row) => {
    const a = shapeActivity(row);
    a.applications_count = q.get('SELECT COUNT(*) AS n FROM activity_members WHERE activity_id = ? AND user_id != ?', a.id, me).n;
    a.accepted_count = a.participants - 1;
    return a;
  });
  const applications = q.all(`${ACT_SELECT} JOIN activity_members m ON m.activity_id = a.id AND m.user_id = :me
    WHERE a.creator_id != :me AND a.status = 'open' ORDER BY m.applied_at DESC`, { me }).map(shapeActivity);
  const upcoming = q.all(`${ACT_SELECT} JOIN activity_members m ON m.activity_id = a.id AND m.user_id = :me AND m.status = 'accepted'
    WHERE a.status = 'open' AND a.date >= :t ORDER BY a.date, a.time`, { me, t }).map(shapeActivity);
  const past = q.all(`${ACT_SELECT} JOIN activity_members m ON m.activity_id = a.id AND m.user_id = :me AND m.status = 'accepted'
    WHERE a.status = 'completed' ORDER BY a.date DESC`, { me }).map((row) => {
    const a = shapeActivity(row);
    const f = q.get('SELECT rating FROM feedback WHERE activity_id = ? AND user_id = ?', a.id, me);
    a.feedback_given = !!f;
    a.my_rating = f?.rating ?? null;
    a.avg_rating = q.get('SELECT ROUND(AVG(rating), 1) AS r FROM feedback WHERE activity_id = ?', a.id).r;
    return a;
  });
  res.json({ created, applications, upcoming, past });
});

export default r;
