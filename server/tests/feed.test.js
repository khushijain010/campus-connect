import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db.js';
import { seed, DEMO_PASSWORD } from '../src/seed.js';
import { createApp } from '../src/app.js';

let app;
const tokens = {};
const as = (who) => ({
  get: (p) => request(app).get(`/api${p}`).set('Authorization', `Bearer ${tokens[who]}`),
  post: (p, b = {}) => request(app).post(`/api${p}`).set('Authorization', `Bearer ${tokens[who]}`).send(b),
  del: (p) => request(app).delete(`/api${p}`).set('Authorization', `Bearer ${tokens[who]}`),
  upload: (p) => request(app).post(`/api${p}`).set('Authorization', `Bearer ${tokens[who]}`),
});

beforeAll(async () => {
  openDb(':memory:');
  seed();
  app = createApp();
  for (const [k, email] of [['arjun', 'arjunm@cse.iitr.ac.in'], ['riya', 'riyas@ece.iitr.ac.in'], ['aiko', 'aikot@ece.iitr.ac.in']]) {
    tokens[k] = (await request(app).post('/api/auth/login').send({ email, password: DEMO_PASSWORD })).body.token;
  }
});

describe('polls', () => {
  let id;
  it('validates and creates a poll', async () => {
    expect((await as('riya').post('/posts', { type: 'poll', content: 'Q?', meta: JSON.stringify({ poll: { options: ['Only one'] } }) })).status).toBe(400);
    const r = await as('riya').post('/posts', { type: 'poll', content: 'Best study spot?', topic: 'Life@Campus', meta: JSON.stringify({ poll: { options: ['Library', 'Hostel', 'Café'] } }) });
    expect(r.status).toBe(201);
    expect(r.body.post.poll).toMatchObject({ options: ['Library', 'Hostel', 'Café'], total: 0, my_vote: null });
    id = r.body.post.id;
  });
  it('votes, changes vote, rejects invalid options', async () => {
    expect((await as('arjun').post(`/posts/${id}/vote`, { option: 1 })).body.poll).toMatchObject({ counts: [0, 1, 0], my_vote: 1 });
    await as('aiko').post(`/posts/${id}/vote`, { option: 1 });
    const changed = await as('arjun').post(`/posts/${id}/vote`, { option: 0 });
    expect(changed.body.poll).toMatchObject({ counts: [1, 1, 0], total: 2, my_vote: 0 });
    expect((await as('arjun').post(`/posts/${id}/vote`, { option: 9 })).status).toBe(400);
    const feed = await as('arjun').get('/posts?tab=Life@Campus');
    expect(feed.body.posts.find((p) => p.id === id).poll.my_vote).toBe(0);
  });
});

describe('file attachments', () => {
  it('attaches a PDF to a post and rejects unsupported files', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');
    const r = await as('riya').upload('/posts').field('type', 'text').field('content', 'Notes for DSP').attach('file', pdf, { filename: 'dsp-notes.pdf', contentType: 'application/pdf' });
    expect(r.status).toBe(201);
    expect(r.body.post.meta.file).toMatchObject({ name: 'dsp-notes.pdf', type: 'PDF' });
    expect(r.body.post.meta.file.url).toMatch(/^\/uploads\/.+\.pdf$/);
    const bad = await as('riya').upload('/posts').field('type', 'text').field('content', 'x').attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });
    expect(bad.status).toBe(400);
  });
  it('seeded system-design notes come with a real PDF', async () => {
    const r = await as('arjun').get('/search?q=system design&type=posts');
    const p = r.body.posts.find((x) => x.meta.file);
    expect(p.meta.file.name).toBe('systems-design-notes.pdf');
  });
});

describe('comments: replies, likes, sorting, deletion', () => {
  let postId;
  let top;
  it('replies nest one level deep', async () => {
    postId = (await as('riya').post('/posts', { type: 'text', content: 'Comment test post' })).body.post.id;
    top = (await as('arjun').post(`/posts/${postId}/comments`, { content: 'First!' })).body.comment;
    const reply = (await as('riya').post(`/posts/${postId}/comments`, { content: 'Thanks', parent_id: top.id })).body.comment;
    expect(reply.parent_id).toBe(top.id);
    const nested = (await as('aiko').post(`/posts/${postId}/comments`, { content: 'Me too', parent_id: reply.id })).body.comment;
    expect(nested.parent_id).toBe(top.id); // flattened to the top-level thread
    const d = await as('arjun').get(`/posts/${postId}`);
    expect(d.body.comments).toHaveLength(1);
    expect(d.body.comments[0].replies).toHaveLength(2);
    const n = await as('arjun').get('/notifications');
    expect(n.body.items.some((x) => /replied to your comment/.test(x.text))).toBe(true);
  });
  it('likes toggle and drive "Most Relevant" ordering', async () => {
    const second = (await as('aiko').post(`/posts/${postId}/comments`, { content: 'Second' })).body.comment;
    expect((await as('riya').post(`/comments/${second.id}/like`)).body).toMatchObject({ liked: true, likes: 1 });
    await as('arjun').post(`/comments/${second.id}/like`);
    const rel = await as('arjun').get(`/posts/${postId}/comments?sort=relevant`);
    expect(rel.body.comments[0].id).toBe(second.id);
    expect(rel.body.comments[0]).toMatchObject({ likes: 2, liked: true });
    const old = await as('arjun').get(`/posts/${postId}/comments?sort=oldest`);
    expect(old.body.comments[0].id).toBe(top.id);
    expect((await as('arjun').post(`/comments/${second.id}/like`)).body).toMatchObject({ liked: false, likes: 1 });
  });
  it('only authors or the post owner can delete; deleting removes replies', async () => {
    expect((await as('aiko').del(`/comments/${top.id}`)).status).toBe(404);
    expect((await as('riya').del(`/comments/${top.id}`)).status).toBe(200); // post owner moderates
    const d = await as('arjun').get(`/posts/${postId}`);
    expect(d.body.comments.some((c) => c.id === top.id)).toBe(false);
    expect(d.body.post.comment_count).toBe(1);
  });
  it('comments can be reported', async () => {
    const c = (await as('aiko').post(`/posts/${postId}/comments`, { content: 'spammy' })).body.comment;
    expect((await as('arjun').post('/reports', { target_type: 'comment', target_id: c.id, reason: 'Spam' })).status).toBe(201);
  });
});

describe('feed topics', () => {
  it('serves the mockup tabs including Politics and Memes', async () => {
    const meta = await request(app).get('/api/meta');
    expect(meta.body.options.topics).toEqual(expect.arrayContaining(['Tech', 'Culture', 'Politics', 'Sports', 'Arts', 'Memes', 'Other']));
    const pol = await as('arjun').get('/posts?tab=Politics');
    expect(pol.body.posts.length).toBeGreaterThan(0);
    expect(pol.body.posts.every((p) => p.topic === 'Politics')).toBe(true);
  });
});
