import { Router } from 'express';
import { q, parse, hydrateUser, userCard, hydrateCommunity } from '../db.js';
import { auth } from '../auth.js';
import { friendIds, hiddenIds } from '../services.js';
import { scorePerson, scoreBuddy, scoreCommunity, rank } from '../recommend.js';
import { OPTIONS, ICEBREAKERS, zoneOf } from '../constants.js';
import { listActivities } from './activities.js';
import { shapePost } from './posts.js';

const r = Router();
r.use(auth);

// Candidates for people recommendations: everyone except me, friends, pending requests, blocked and skipped.
function candidates(me, { includeFriends = false, excludeSkipped = true } = {}) {
  const hidden = hiddenIds(me.id);
  const friends = friendIds(me.id);
  const pending = new Set(q.all(`SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS id
    FROM friendships WHERE status = 'pending' AND (requester_id = ? OR addressee_id = ?)`, me.id, me.id, me.id).map((x) => x.id));
  const skipped = excludeSkipped ? new Set(q.all('SELECT skipped_id AS id FROM skips WHERE user_id = ?', me.id).map((x) => x.id)) : new Set();
  return q.all('SELECT * FROM users WHERE id != ?', me.id)
    .filter((u) => !hidden.has(u.id) && !skipped.has(u.id) && !pending.has(u.id) && (includeFriends || !friends.has(u.id)))
    .map(hydrateUser);
}

const personResult = (x) => ({
  user: { ...userCard({ ...x.item, interests: JSON.stringify(x.item.interests), hobbies: JSON.stringify(x.item.hobbies) }),
    languages: x.item.languages_spoken, skills: x.item.skills, courses: x.item.courses, cultural_interests: x.item.cultural_interests },
  percent: Math.round(x.score * 100),
  reasons: x.reasons,
});

/* ------------------------------------------------------ culture of the week */

function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 864e5 + 1) / 7);
}

r.get('/culture/week', (req, res) => {
  const cultures = q.all('SELECT * FROM cultures ORDER BY id');
  if (!cultures.length) return res.json({ culture: null });
  const offset = Number(req.query.offset) || 0;
  const week = isoWeek();
  const idx = (((week + offset) % cultures.length) + cultures.length) % cultures.length;
  const c = cultures[idx];
  const topics = parse(c.topics, {});
  const regions = topics.regions || [];
  const hidden = hiddenIds(req.user.id);
  // Student stories from people of that region
  const stories = regions.length ? q.all(`SELECT p.*, u.name AS author_name, u.handle AS author_handle, u.avatar AS author_avatar,
      u.department AS author_department, u.year AS author_year, u.region AS author_region, NULL AS community_name,
      (SELECT COUNT(*) FROM post_upvotes WHERE post_id = p.id) AS upvotes,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
      EXISTS (SELECT 1 FROM post_upvotes WHERE post_id = p.id AND user_id = ?) AS upvoted,
      EXISTS (SELECT 1 FROM post_saves WHERE post_id = p.id AND user_id = ?) AS saved
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.kind = 'story' AND p.visibility = 'public' AND u.region IN (${regions.map(() => '?').join(',')}) ORDER BY p.created_at DESC LIMIT 6`,
  req.user.id, req.user.id, ...regions).filter((p) => !hidden.has(p.user_id)).map(shapePost) : [];
  const people = regions.length ? q.all(`SELECT * FROM users WHERE id != ? AND region IN (${regions.map(() => '?').join(',')}) LIMIT 8`, req.user.id, ...regions)
    .filter((u) => !hidden.has(u.id)).map(userCard) : [];
  res.json({ culture: { ...c, topics, week: week + offset, index: idx, total: cultures.length }, stories, people });
});

/* --------------------------------------------------- step outside your circle */

r.get('/culture/outside', (req, res) => {
  const me = hydrateUser(req.user);
  const focus = String(req.query.focus || '').split(',').filter((f) => ['Interests', 'Hobbies', 'Department', 'Region', 'Language'].includes(f));
  const ranked = rank(candidates(req.user), (u) => scorePerson(me, u, { mode: 'outside', focus }), { limit: 12, minScore: 0.05 });
  res.json({ matches: ranked.map(personResult) });
});

r.post('/culture/skip/:id', (req, res) => {
  q.run('INSERT OR IGNORE INTO skips (user_id, skipped_id) VALUES (?, ?)', req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

r.delete('/culture/skips', (req, res) => {
  q.run('DELETE FROM skips WHERE user_id = ?', req.user.id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------ cultural buddy */

r.get('/culture/buddy', (req, res) => {
  res.json({ pref: q.get('SELECT mode, topic FROM buddy_prefs WHERE user_id = ?', req.user.id) || null });
});

r.post('/culture/buddy', (req, res) => {
  const { mode, topic } = req.body || {};
  if (!OPTIONS.buddyModes[mode]?.includes(topic)) return res.status(400).json({ error: 'Choose what you want to do' });
  q.run(`INSERT INTO buddy_prefs (user_id, mode, topic) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET mode = excluded.mode, topic = excluded.topic, updated_at = datetime('now')`, req.user.id, mode, topic);
  const me = hydrateUser(req.user);
  const prefs = new Map(q.all('SELECT * FROM buddy_prefs').map((p) => [p.user_id, p]));
  const ranked = rank(candidates(req.user, { includeFriends: true, excludeSkipped: false }),
    (u) => scoreBuddy(me, u, mode, topic, prefs.get(u.id)), { limit: 10, minScore: 0.1 });
  res.json({ matches: ranked.map(personResult) });
});

/* ----------------------------------------------------------- icebreakers */

r.get('/culture/icebreakers', (req, res) => {
  const me = hydrateUser(req.user);
  // Personalise: lead with topics tied to the user's cultural interests.
  const ci = new Set((me.cultural_interests || []).map((x) => x.toLowerCase()));
  const weight = (i) => (ci.has('food') && i.topic.includes('Food') ? 0 : ci.has('festivals') && i.topic.includes('Festival') ? 0 : ci.has('music') && i.topic.includes('Music') ? 0 : 1);
  const list = [...ICEBREAKERS].sort((a, b) => weight(a) - weight(b));
  // Suggested people to ask: friends from a different zone first.
  const friends = [...friendIds(me.id)];
  const people = friends.length ? q.all(`SELECT * FROM users WHERE id IN (${friends.map(() => '?').join(',')})`, ...friends)
    .map(userCard).sort((a, b) => (zoneOf(a.region) !== zoneOf(me.region) ? -1 : 1) - (zoneOf(b.region) !== zoneOf(me.region) ? -1 : 1)) : [];
  res.json({ icebreakers: list, people });
});

/* -------------------------------------------------------- recommendations */

r.get('/recommendations', (req, res) => {
  const me = hydrateUser(req.user);
  const peopleMode = ['friends', 'study', 'cultural', 'outside'].includes(req.query.mode) ? req.query.mode : 'friends';
  const pool = candidates(req.user);
  const people = rank(pool, (u) => scorePerson(me, u, { mode: peopleMode }), { limit: 8, minScore: 0.05 }).map(personResult);
  const studyPartners = rank(pool, (u) => scorePerson(me, u, { mode: 'study' }), { limit: 6, minScore: 0.1 }).map(personResult);
  const culturalBuddies = rank(pool, (u) => scorePerson(me, u, { mode: 'cultural' }), { limit: 6, minScore: 0.1 }).map(personResult);

  const acts = listActivities(req.user, { sort: 'recommended' }).filter((a) => !a.my_status && a.openings > 0 && a.creator_id !== me.id);
  const teams = acts.filter((a) => a.kind === 'project').slice(0, 6);
  const events = acts.filter((a) => a.kind !== 'project').slice(0, 8);

  const friends = friendIds(me.id);
  const groups = q.all(`SELECT c.*, (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) AS member_count FROM communities c
    WHERE NOT EXISTS (SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = ?)`, me.id)
    .map((c) => {
      const h = hydrateCommunity(c);
      const memberIds = q.all('SELECT user_id FROM community_members WHERE community_id = ?', c.id).map((m) => m.user_id);
      return { ...h, joined: false, ...scoreCommunity(me, h, { memberIds, friendIds: friends }) };
    })
    .sort((a, b) => b.score - a.score).slice(0, 6);

  res.json({ people, studyPartners, culturalBuddies, teams, events, groups });
});

export default r;
