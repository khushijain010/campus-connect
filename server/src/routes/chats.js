import { Router } from 'express';
import { q, userCard, hydrateCommunity, hydrateActivity, hydrateUser } from '../db.js';
import { auth } from '../auth.js';
import { upload, fileUrl } from '../upload.js';
import { ensureDm, isBlockedBetween, hiddenIds, friendshipStatus } from '../services.js';
import { emitToConversation, emitToUser } from '../realtime.js';

const r = Router();
r.use(auth);

const membership = (convId, userId) => q.get('SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?', convId, userId);

function dmPartner(convId, me) {
  return q.get(`SELECT u.* FROM conversation_members m JOIN users u ON u.id = m.user_id
    WHERE m.conversation_id = ? AND m.user_id != ?`, convId, me);
}

function summarize(c, me) {
  const last = q.get(`SELECT m.*, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ? ORDER BY m.id DESC LIMIT 1`, c.id);
  const unread = q.get('SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND id > ? AND sender_id != ?', c.id, c.last_read_id, me).n;
  const out = {
    id: c.id, type: c.type, name: c.name, unread,
    member_count: q.get('SELECT COUNT(*) AS n FROM conversation_members WHERE conversation_id = ?', c.id).n,
    last_message: last ? { content: last.content || (last.image ? '📷 Photo' : ''), sender_name: last.sender_name, sender_id: last.sender_id, created_at: last.created_at } : null,
    updated_at: last?.created_at || c.created_at,
  };
  if (c.type === 'dm') {
    const p = dmPartner(c.id, me);
    out.partner = p ? userCard(p) : null;
    out.name = p?.name || 'Unknown';
  } else if (c.type === 'community') {
    const cm = q.get('SELECT * FROM communities WHERE id = ?', c.community_id);
    out.community = hydrateCommunity(cm);
  } else {
    const a = q.get('SELECT * FROM activities WHERE id = ?', c.activity_id);
    out.activity = a && { id: a.id, emoji: a.emoji, kind: a.kind, status: a.status };
  }
  return out;
}

r.get('/chats', (req, res) => {
  const me = req.user.id;
  const type = ['dm', 'group', 'community'].includes(req.query.type) ? req.query.type : null;
  const hidden = hiddenIds(me);
  let convs = q.all(`SELECT c.*, m.last_read_id FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = ?
    ${type ? 'WHERE c.type = ?' : ''}`, ...(type ? [me, type] : [me])).map((c) => summarize(c, me));
  // Hide DMs with blocked users and empty DMs nobody has written in yet (except freshly opened ones are fetched directly).
  convs = convs.filter((c) => c.type !== 'dm' || (c.partner && !hidden.has(c.partner.id) && c.last_message));
  convs.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  res.json({ conversations: convs });
});

r.get('/chats/unread', (req, res) => {
  const row = q.get(`SELECT COUNT(*) AS n FROM messages msg JOIN conversation_members m ON m.conversation_id = msg.conversation_id AND m.user_id = ?
    WHERE msg.id > m.last_read_id AND msg.sender_id != ?`, req.user.id, req.user.id);
  res.json({ unread: row.n });
});

r.post('/chats/dm/:userId', (req, res) => {
  const other = Number(req.params.userId);
  if (other === req.user.id) return res.status(400).json({ error: "You can't message yourself" });
  if (!q.get('SELECT 1 FROM users WHERE id = ?', other)) return res.status(404).json({ error: 'User not found' });
  if (isBlockedBetween(req.user.id, other)) return res.status(403).json({ error: 'You cannot message this user' });
  res.json({ conversation_id: ensureDm(req.user.id, other) });
});

r.get('/chats/:id', (req, res) => {
  const id = Number(req.params.id);
  const mem = membership(id, req.user.id);
  if (!mem) return res.status(404).json({ error: 'Conversation not found' });
  const c = q.get('SELECT * FROM conversations WHERE id = ?', id);
  const info = summarize({ ...c, last_read_id: mem.last_read_id }, req.user.id);
  const hidden = hiddenIds(req.user.id);
  const members = q.all(`SELECT u.* FROM conversation_members m JOIN users u ON u.id = m.user_id WHERE m.conversation_id = ? LIMIT 100`, id)
    .filter((u) => !hidden.has(u.id)).map(userCard);
  const media = q.all('SELECT image FROM messages WHERE conversation_id = ? AND image IS NOT NULL ORDER BY id DESC LIMIT 8', id).map((m) => m.image);

  if (c.type === 'dm' && info.partner) {
    const p = hydrateUser(q.get('SELECT * FROM users WHERE id = ?', info.partner.id));
    info.profile = { bio: p.bio, interests: [...p.interests, ...p.hobbies].slice(0, 6) };
    info.friendship = friendshipStatus(req.user.id, p.id);
    info.partner_last_read_id = membership(id, p.id)?.last_read_id || 0;
    info.blocked = isBlockedBetween(req.user.id, p.id);
    info.sharedEvents = q.all(`SELECT a.* FROM activities a
      JOIN activity_members x ON x.activity_id = a.id AND x.user_id = ? AND x.status = 'accepted'
      JOIN activity_members y ON y.activity_id = a.id AND y.user_id = ? AND y.status = 'accepted' ORDER BY a.date DESC LIMIT 4`, req.user.id, p.id).map(hydrateActivity);
    info.sharedGroups = q.all(`SELECT c.*, (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) AS member_count FROM communities c
      JOIN community_members x ON x.community_id = c.id AND x.user_id = ?
      JOIN community_members y ON y.community_id = c.id AND y.user_id = ? LIMIT 4`, req.user.id, p.id).map(hydrateCommunity);
  } else if (c.type === 'community') {
    const roles = new Map(q.all('SELECT user_id, role FROM community_members WHERE community_id = ?', c.community_id).map((m) => [m.user_id, m.role]));
    members.forEach((m) => { m.role = roles.get(m.id) || 'member'; });
    members.sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1));
  } else if (c.type === 'group') {
    const a = q.get('SELECT * FROM activities WHERE id = ?', c.activity_id);
    info.activity = hydrateActivity(a);
    members.forEach((m) => { m.role = m.id === a.creator_id ? 'admin' : 'member'; });
    members.sort((x, y) => (x.role === 'admin' ? -1 : 1) - (y.role === 'admin' ? -1 : 1));
  }
  res.json({ conversation: { ...info, members, media } });
});

function shapeMessage(m, me) {
  const reactions = q.all('SELECT emoji, COUNT(*) AS count, MAX(user_id = ?) AS mine FROM message_reactions WHERE message_id = ? GROUP BY emoji', me, m.id)
    .map((x) => ({ emoji: x.emoji, count: x.count, mine: !!x.mine }));
  return {
    id: m.id, conversation_id: m.conversation_id, content: m.content, image: m.image, created_at: m.created_at, reactions,
    sender: { id: m.sender_id, name: m.name, handle: m.handle, avatar: m.avatar },
  };
}

r.get('/chats/:id/messages', (req, res) => {
  const id = Number(req.params.id);
  if (!membership(id, req.user.id)) return res.status(404).json({ error: 'Conversation not found' });
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
  const hidden = hiddenIds(req.user.id);
  const rows = q.all(`SELECT m.*, u.name, u.handle, u.avatar FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT 50`, id, before).reverse()
    .filter((m) => !hidden.has(m.sender_id));
  const lastId = rows.length ? rows[rows.length - 1].id : 0;
  if (before === Number.MAX_SAFE_INTEGER && lastId) {
    q.run('UPDATE conversation_members SET last_read_id = MAX(last_read_id, ?) WHERE conversation_id = ? AND user_id = ?', lastId, id, req.user.id);
  }
  res.json({ messages: rows.map((m) => shapeMessage(m, req.user.id)), hasMore: rows.length === 50 });
});

r.post('/chats/:id/messages', upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  if (!membership(id, req.user.id)) return res.status(404).json({ error: 'Conversation not found' });
  const c = q.get('SELECT * FROM conversations WHERE id = ?', id);
  if (c.type === 'dm') {
    const p = dmPartner(id, req.user.id);
    if (p && isBlockedBetween(req.user.id, p.id)) return res.status(403).json({ error: 'You cannot message this user' });
  }
  const content = String(req.body?.content || '').trim().slice(0, 4000);
  const image = fileUrl(req.file);
  if (!content && !image) return res.status(400).json({ error: 'Message cannot be empty' });
  const info = q.run('INSERT INTO messages (conversation_id, sender_id, content, image) VALUES (?, ?, ?, ?)', id, req.user.id, content, image);
  const msgId = Number(info.lastInsertRowid);
  q.run('UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?', msgId, id, req.user.id);
  const row = q.get('SELECT m.*, u.name, u.handle, u.avatar FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?', msgId);
  const message = shapeMessage(row, req.user.id);
  emitToConversation(id, 'message', message);
  // Ping members individually too, so their unread badges update even if the conversation isn't open.
  q.all('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?', id, req.user.id)
    .forEach((m) => emitToUser(m.user_id, 'unread', { conversation_id: id }));
  res.status(201).json({ message });
});

r.post('/chats/:id/read', (req, res) => {
  const id = Number(req.params.id);
  const last = q.get('SELECT MAX(id) AS m FROM messages WHERE conversation_id = ?', id)?.m || 0;
  q.run('UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?', last, id, req.user.id);
  res.json({ ok: true });
});

r.post('/messages/:id/react', (req, res) => {
  const m = q.get('SELECT m.*, u.name, u.handle, u.avatar FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?', Number(req.params.id));
  if (!m || !membership(m.conversation_id, req.user.id)) return res.status(404).json({ error: 'Message not found' });
  const emoji = String(req.body?.emoji || '').slice(0, 8);
  if (!emoji) return res.status(400).json({ error: 'Pick an emoji' });
  const had = q.get('SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?', m.id, req.user.id, emoji);
  if (had) q.run('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?', m.id, req.user.id, emoji);
  else q.run('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)', m.id, req.user.id, emoji);
  const message = shapeMessage(m, req.user.id);
  emitToConversation(m.conversation_id, 'reaction', { id: m.id, conversation_id: m.conversation_id });
  res.json({ message });
});

export default r;

