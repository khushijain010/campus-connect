import { Router } from 'express';
import { q, parse, hydrateUser, userCard, hydrateCommunity, hydrateActivity } from '../db.js';
import { auth } from '../auth.js';
import { postUpload, fileUrl } from '../upload.js';
import { friendIds, hiddenIds, notify, featuredTestimonials } from '../services.js';
import { scorePost, trendingScore } from '../recommend.js';
import { OPTIONS } from '../constants.js';

const r = Router();
r.use(auth);

const POST_SELECT = `
  SELECT p.*, u.name AS author_name, u.handle AS author_handle, u.avatar AS author_avatar,
         u.department AS author_department, u.year AS author_year, u.region AS author_region,
         c.name AS community_name,
         (SELECT COUNT(*) FROM post_upvotes WHERE post_id = p.id) AS upvotes,
         (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
         EXISTS (SELECT 1 FROM post_upvotes WHERE post_id = p.id AND user_id = :me) AS upvoted,
         EXISTS (SELECT 1 FROM post_saves WHERE post_id = p.id AND user_id = :me) AS saved,
         (SELECT option FROM poll_votes WHERE post_id = p.id AND user_id = :me) AS my_vote
  FROM posts p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN communities c ON c.id = p.community_id`;

function pollResults(row) {
  const options = parse(row.meta, {}).poll?.options || [];
  const counts = options.map(() => 0);
  for (const v of q.all('SELECT option, COUNT(*) AS n FROM poll_votes WHERE post_id = ? GROUP BY option', row.id)) {
    if (v.option < counts.length) counts[v.option] = v.n;
  }
  return { options, counts, total: counts.reduce((a, b) => a + b, 0), my_vote: row.my_vote ?? null };
}

export function shapePost(row) {
  return {
    poll: row.type === 'poll' ? pollResults(row) : null,
    id: row.id, kind: row.kind, type: row.type, topic: row.topic, story_category: row.story_category,
    content: row.content, images: parse(row.images), link_url: row.link_url, meta: parse(row.meta, {}),
    tags: parse(row.tags), visibility: row.visibility, views: row.views, created_at: row.created_at,
    community: row.community_id ? { id: row.community_id, name: row.community_name } : null,
    upvotes: row.upvotes, comment_count: row.comment_count, upvoted: !!row.upvoted, saved: !!row.saved,
    author: {
      id: row.user_id, name: row.author_name, handle: row.author_handle, avatar: row.author_avatar,
      department: row.author_department, year: row.author_year, region: row.author_region,
    },
  };
}

// Visibility + block filtering shared by every post listing.
function visibleTo(me, friends, hidden) {
  return (row) => {
    if (hidden.has(row.user_id)) return false;
    if (row.user_id === me.id || row.visibility === 'public') return true;
    if (row.visibility === 'friends') return friends.has(row.user_id);
    if (row.visibility === 'department') return row.author_department === me.department;
    return false;
  };
}

function feedContext(me) {
  const searchTerms = q.all('SELECT query FROM searches WHERE user_id = ? ORDER BY id DESC LIMIT 10', me.id).map((s) => s.query);
  const likedTags = new Set(q.all(`SELECT p.tags FROM post_upvotes v JOIN posts p ON p.id = v.post_id
    WHERE v.user_id = ? ORDER BY v.created_at DESC LIMIT 40`, me.id).flatMap((r) => parse(r.tags).map((t) => t.toLowerCase())));
  const comms = q.all('SELECT c.id, c.tags FROM community_members m JOIN communities c ON c.id = m.community_id WHERE m.user_id = ?', me.id);
  const communityIds = new Set(comms.map((c) => c.id));
  const communityTags = new Set(comms.flatMap((c) => parse(c.tags).map((t) => t.toLowerCase())));
  // Groups the user joined also say something about their interests.
  q.all(`SELECT a.tags FROM activity_members m JOIN activities a ON a.id = m.activity_id
    WHERE m.user_id = ? AND m.status = 'accepted'`, me.id).forEach((a) => parse(a.tags).forEach((t) => communityTags.add(t.toLowerCase())));
  return { searchTerms, likedTags, communityIds, communityTags, friendIds: friendIds(me.id), now: Date.now(), meId: me.id };
}

const PAGE = 12;

r.get('/posts', (req, res) => {
  const me = req.user;
  const meH = hydrateUser(me);
  const tab = String(req.query.tab || 'foryou');
  const page = Math.max(0, Number(req.query.page) || 0);
  const kind = req.query.kind === 'story' ? 'story' : 'post';
  const friends = friendIds(me.id);
  const filter = visibleTo(me, friends, hiddenIds(me.id));

  let rows;
  if (req.query.user) {
    rows = q.all(`${POST_SELECT} WHERE u.handle = :h AND p.kind = :kind ORDER BY p.created_at DESC`, { me: me.id, h: String(req.query.user), kind });
  } else if (tab === 'saved') {
    rows = q.all(`${POST_SELECT} JOIN post_saves s ON s.post_id = p.id AND s.user_id = :me ORDER BY p.created_at DESC`, { me: me.id });
  } else {
    rows = q.all(`${POST_SELECT} WHERE p.kind = :kind ORDER BY p.created_at DESC LIMIT 400`, { me: me.id, kind });
  }
  rows = rows.filter(filter);

  if (req.query.category) rows = rows.filter((p) => p.story_category === req.query.category);
  if (req.query.community) rows = rows.filter((p) => p.community_id === Number(req.query.community));

  let posts;
  if (tab === 'foryou' && !req.query.user) {
    const ctx = feedContext(me);
    posts = rows.map((p) => {
      const shaped = shapePost(p);
      const s = scorePost(meH, { ...shaped, user_id: p.user_id, community_id: p.community_id }, ctx);
      return { ...shaped, score: s.score, reasons: s.reasons };
    }).sort((a, b) => b.score - a.score);
  } else if (tab === 'trending') {
    const now = Date.now();
    posts = rows.map((p) => ({ ...shapePost(p), score: trendingScore(p, now) })).sort((a, b) => b.score - a.score);
  } else {
    if (OPTIONS.topics.includes(tab)) rows = rows.filter((p) => p.topic === tab);
    posts = rows.map(shapePost);
  }
  const slice = posts.slice(page * PAGE, page * PAGE + PAGE);
  res.json({ posts: slice, hasMore: posts.length > (page + 1) * PAGE });
});

r.post('/posts', postUpload.fields([{ name: 'images', maxCount: 6 }, { name: 'file', maxCount: 1 }]), (req, res) => {
  const b = req.body || {};
  const kind = b.kind === 'story' ? 'story' : 'post';
  const type = String(b.type || 'text').toLowerCase();
  if (!OPTIONS.postTypes.map((t) => t.toLowerCase()).includes(type)) return res.status(400).json({ error: 'Invalid post type' });
  const content = String(b.content || '').trim().slice(0, 5000);
  const images = (req.files?.images || []).map(fileUrl);
  const doc = req.files?.file?.[0];
  let meta = {};
  try { meta = b.meta ? JSON.parse(b.meta) : {}; } catch { /* ignore malformed meta */ }
  if (doc) meta.file = { url: fileUrl(doc), name: doc.originalname.slice(0, 120), size: doc.size, type: doc.originalname.split('.').pop().toUpperCase() };
  else delete meta.file;
  if (type === 'poll') {
    const options = (Array.isArray(meta.poll?.options) ? meta.poll.options : []).map((o) => String(o).trim().slice(0, 80)).filter(Boolean);
    if (!content) return res.status(400).json({ error: 'Ask a question for your poll' });
    if (options.length < 2 || options.length > 6) return res.status(400).json({ error: 'A poll needs 2–6 options' });
    meta.poll = { options };
  } else delete meta.poll;
  if (!content && !images.length && !meta.title && !doc) return res.status(400).json({ error: 'Write something or add an image' });
  if (type === 'image' && !images.length) return res.status(400).json({ error: 'Add at least one image' });
  if (type === 'link' && !/^https?:\/\//i.test(b.link_url || '')) return res.status(400).json({ error: 'Add a valid link (http/https)' });
  if ((type === 'event' || type === 'project') && !meta.title) return res.status(400).json({ error: `Give your ${type} a title` });
  if (kind === 'story' && !OPTIONS.storyCategories.includes(b.story_category)) return res.status(400).json({ error: 'Pick a story category' });

  const topic = OPTIONS.topics.includes(b.topic) ? b.topic : (kind === 'story' ? 'Culture' : 'General');
  const hashtags = [...content.matchAll(/#([\p{L}\p{N}_/+-]+)/gu)].map((m) => m[1]);
  let tags = [];
  try { tags = b.tags ? JSON.parse(b.tags) : []; } catch { tags = []; }
  tags = [...new Set([...tags, ...hashtags, ...(meta.skills || []), ...(meta.lookingFor || [])].map(String))].slice(0, 12);
  const visibility = ['public', 'friends', 'department'].includes(b.visibility) ? b.visibility : 'public';
  const communityId = b.community_id ? Number(b.community_id) : null;
  if (communityId && !q.get('SELECT 1 FROM community_members WHERE community_id = ? AND user_id = ?', communityId, req.user.id)) {
    return res.status(403).json({ error: 'Join the community to post in it' });
  }

  const info = q.run(`INSERT INTO posts (user_id, kind, type, topic, story_category, content, images, link_url, meta, tags, community_id, visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  req.user.id, kind, type, topic, kind === 'story' ? b.story_category : null, content, JSON.stringify(images),
  type === 'link' ? b.link_url : null, JSON.stringify(meta), JSON.stringify(tags), communityId, visibility);
  const row = q.get(`${POST_SELECT} WHERE p.id = :id`, { me: req.user.id, id: info.lastInsertRowid });
  res.status(201).json({ post: shapePost(row) });
});

function loadVisiblePost(req, res) {
  const row = q.get(`${POST_SELECT} WHERE p.id = :id`, { me: req.user.id, id: Number(req.params.id) });
  if (!row || !visibleTo(req.user, friendIds(req.user.id), hiddenIds(req.user.id))(row)) {
    res.status(404).json({ error: 'Post not found' });
    return null;
  }
  return row;
}

r.get('/posts/:id', (req, res) => {
  const row = loadVisiblePost(req, res);
  if (!row) return;
  q.run('UPDATE posts SET views = views + 1 WHERE id = ?', row.id);
  res.json({ post: { ...shapePost(row), views: row.views + 1 }, comments: loadComments(row.id, req.user.id, req.query.sort) });
});

r.delete('/posts/:id', (req, res) => {
  const info = q.run('DELETE FROM posts WHERE id = ? AND user_id = ?', Number(req.params.id), req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Post not found' });
  res.json({ ok: true });
});

r.post('/posts/:id/upvote', (req, res) => {
  const row = loadVisiblePost(req, res);
  if (!row) return;
  const had = q.get('SELECT 1 FROM post_upvotes WHERE post_id = ? AND user_id = ?', row.id, req.user.id);
  if (had) q.run('DELETE FROM post_upvotes WHERE post_id = ? AND user_id = ?', row.id, req.user.id);
  else {
    q.run('INSERT INTO post_upvotes (post_id, user_id) VALUES (?, ?)', row.id, req.user.id);
    if (row.user_id !== req.user.id) notify(row.user_id, 'upvote', `${req.user.name} upvoted your post`, `/post/${row.id}`);
  }
  const upvotes = q.get('SELECT COUNT(*) AS n FROM post_upvotes WHERE post_id = ?', row.id).n;
  res.json({ upvoted: !had, upvotes });
});

r.post('/posts/:id/save', (req, res) => {
  const row = loadVisiblePost(req, res);
  if (!row) return;
  const had = q.get('SELECT 1 FROM post_saves WHERE post_id = ? AND user_id = ?', row.id, req.user.id);
  if (had) q.run('DELETE FROM post_saves WHERE post_id = ? AND user_id = ?', row.id, req.user.id);
  else q.run('INSERT INTO post_saves (post_id, user_id) VALUES (?, ?)', row.id, req.user.id);
  res.json({ saved: !had });
});

// Top-level comments with one level of replies. sort = relevant (likes, then replies, then newest) | newest | oldest
function loadComments(postId, me, sort = 'relevant') {
  const hidden = hiddenIds(me);
  const rows = q.all(`SELECT c.*, u.name, u.handle, u.avatar, u.department, u.year,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) AS likes,
      EXISTS (SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = ?) AS liked
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`, me, postId)
    .filter((c) => !hidden.has(c.user_id))
    .map((c) => ({ id: c.id, parent_id: c.parent_id, content: c.content, created_at: c.created_at, likes: c.likes, liked: !!c.liked, replies: [],
      author: { id: c.user_id, name: c.name, handle: c.handle, avatar: c.avatar, department: c.department, year: c.year } }));
  const byId = new Map(rows.map((c) => [c.id, c]));
  const top = [];
  for (const c of rows) {
    const parent = c.parent_id && byId.get(c.parent_id);
    if (parent) parent.replies.push(c); else if (!c.parent_id) top.push(c);
  }
  if (sort === 'newest') top.sort((a, b) => b.id - a.id);
  else if (sort !== 'oldest') top.sort((a, b) => b.likes - a.likes || b.replies.length - a.replies.length || b.id - a.id);
  return top;
}

r.get('/posts/:id/comments', (req, res) => {
  const row = loadVisiblePost(req, res);
  if (!row) return;
  res.json({ comments: loadComments(row.id, req.user.id, req.query.sort) });
});

r.post('/posts/:id/comments', (req, res) => {
  const row = loadVisiblePost(req, res);
  if (!row) return;
  const content = String(req.body?.content || '').trim().slice(0, 1000);
  if (!content) return res.status(400).json({ error: 'Comment cannot be empty' });
  let parentId = req.body?.parent_id ? Number(req.body.parent_id) : null;
  if (parentId) {
    const parent = q.get('SELECT * FROM comments WHERE id = ? AND post_id = ?', parentId, row.id);
    if (!parent) return res.status(404).json({ error: 'Comment not found' });
    parentId = parent.parent_id || parent.id; // keep threads one level deep
    if (parent.user_id !== req.user.id) notify(parent.user_id, 'comment', `${req.user.name} replied to your comment`, `/post/${row.id}`);
  }
  const info = q.run('INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)', row.id, req.user.id, parentId, content);
  if (row.user_id !== req.user.id && !parentId) notify(row.user_id, 'comment', `${req.user.name} commented on your post`, `/post/${row.id}`);
  const u = req.user;
  res.status(201).json({ comment: { id: Number(info.lastInsertRowid), parent_id: parentId, content, likes: 0, liked: false, replies: [],
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    author: { id: u.id, name: u.name, handle: u.handle, avatar: u.avatar, department: u.department, year: u.year } } });
});

r.post('/comments/:id/like', (req, res) => {
  const c = q.get('SELECT * FROM comments WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Comment not found' });
  req.params.id = c.post_id;
  if (!loadVisiblePost(req, res)) return;
  const had = q.get('SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?', c.id, req.user.id);
  if (had) q.run('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', c.id, req.user.id);
  else q.run('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)', c.id, req.user.id);
  res.json({ liked: !had, likes: q.get('SELECT COUNT(*) AS n FROM comment_likes WHERE comment_id = ?', c.id).n });
});

r.delete('/comments/:id', (req, res) => {
  const c = q.get('SELECT c.*, p.user_id AS post_owner FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ?', Number(req.params.id));
  // Authors can delete their own comments; post owners can moderate their thread.
  if (!c || (c.user_id !== req.user.id && c.post_owner !== req.user.id)) return res.status(404).json({ error: 'Comment not found' });
  q.run('DELETE FROM comments WHERE id = ? OR parent_id = ?', c.id, c.id);
  res.json({ ok: true });
});

r.post('/posts/:id/vote', (req, res) => {
  const row = loadVisiblePost(req, res);
  if (!row) return;
  if (row.type !== 'poll') return res.status(400).json({ error: 'This post is not a poll' });
  const options = parse(row.meta, {}).poll?.options || [];
  const option = Number(req.body?.option);
  if (!Number.isInteger(option) || option < 0 || option >= options.length) return res.status(400).json({ error: 'Pick a valid option' });
  q.run(`INSERT INTO poll_votes (post_id, user_id, option) VALUES (?, ?, ?)
    ON CONFLICT(post_id, user_id) DO UPDATE SET option = excluded.option`, row.id, req.user.id, option);
  res.json({ poll: pollResults({ ...row, my_vote: option }) });
});

// Reviews / testimonials: featured post-event feedback, shown anonymously.
r.get('/testimonials', (_req, res) => res.json({ testimonials: featuredTestimonials(12) }));

/* ------------------------------------------------------------------ search */

r.get('/search', (req, res) => {
  const me = req.user;
  const term = String(req.query.q || '').trim();
  const type = String(req.query.type || 'all');
  if (!term) return res.json({ people: [], posts: [], communities: [], activities: [] });
  if (term.length >= 2 && req.query.log !== '0') {
    const last = q.get('SELECT query FROM searches WHERE user_id = ? ORDER BY id DESC LIMIT 1', me.id);
    if (!last || last.query.toLowerCase() !== term.toLowerCase()) q.run('INSERT INTO searches (user_id, query) VALUES (?, ?)', me.id, term.slice(0, 100));
  }
  const like = `%${term.replace(/^[@#]/, '')}%`;
  const hidden = hiddenIds(me.id);
  const limit = type === 'all' ? 5 : 30;
  const out = { people: [], posts: [], communities: [], activities: [] };

  if (type === 'all' || type === 'people') {
    out.people = q.all(`SELECT * FROM users WHERE id != ? AND (name LIKE ? OR handle LIKE ? OR department LIKE ? OR region LIKE ?)
      ORDER BY name LIMIT ?`, me.id, like, like, like, like, limit + hidden.size).filter((u) => !hidden.has(u.id)).slice(0, limit).map(userCard);
  }
  if (type === 'all' || type === 'posts') {
    const filter = visibleTo(me, friendIds(me.id), hidden);
    out.posts = q.all(`${POST_SELECT} WHERE p.content LIKE :t OR p.tags LIKE :t OR p.topic LIKE :t OR p.meta LIKE :t
      ORDER BY p.created_at DESC LIMIT 100`, { me: me.id, t: like }).filter(filter).slice(0, limit).map(shapePost);
  }
  if (type === 'all' || type === 'communities') {
    out.communities = q.all(`SELECT c.*, (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) AS member_count,
      EXISTS (SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = ?) AS joined
      FROM communities c WHERE c.name LIKE ? OR c.description LIKE ? OR c.tags LIKE ? OR c.category LIKE ? LIMIT ?`,
    me.id, like, like, like, like, limit).map((c) => ({ ...hydrateCommunity(c), joined: !!c.joined }));
  }
  if (type === 'all' || type === 'activities') {
    out.activities = q.all(`SELECT a.*, (SELECT COUNT(*) FROM activity_members WHERE activity_id = a.id AND status = 'accepted') AS participants
      FROM activities a WHERE a.status = 'open' AND (a.title LIKE ? OR a.description LIKE ? OR a.tags LIKE ? OR a.category LIKE ? OR a.course LIKE ?)
      ORDER BY a.date LIMIT ?`, like, like, like, like, like, limit).filter((a) => !hidden.has(a.creator_id)).map(hydrateActivity);
  }
  res.json(out);
});

r.get('/search/recent', (req, res) => {
  const rows = q.all('SELECT query, MAX(id) AS id FROM searches WHERE user_id = ? GROUP BY lower(query) ORDER BY id DESC LIMIT 6', req.user.id);
  res.json({ recent: rows.map((r) => r.query) });
});

export default r;
