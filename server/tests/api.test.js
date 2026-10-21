import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { openDb, q, migrateLegacyEmails } from '../src/db.js';
import { seed, DEMO_PASSWORD } from '../src/seed.js';
import { createApp } from '../src/app.js';

let app;
const tokens = {};

async function login(email, password = DEMO_PASSWORD) {
  const r = await request(app).post('/api/auth/login').send({ email, password });
  expect(r.status).toBe(200);
  return r.body.token;
}
const as = (who) => ({
  get: (p) => request(app).get(`/api${p}`).set('Authorization', `Bearer ${tokens[who]}`),
  post: (p, b = {}) => request(app).post(`/api${p}`).set('Authorization', `Bearer ${tokens[who]}`).send(b),
  put: (p, b = {}) => request(app).put(`/api${p}`).set('Authorization', `Bearer ${tokens[who]}`).send(b),
  del: (p) => request(app).delete(`/api${p}`).set('Authorization', `Bearer ${tokens[who]}`),
});
const idOf = (handle) => q.get('SELECT id FROM users WHERE handle = ?', handle).id;

beforeAll(async () => {
  openDb(':memory:');
  seed();
  app = createApp();
  tokens.arjun = await login('arjunm@cse.iitr.ac.in');
  tokens.riya = await login('riyas@ece.iitr.ac.in');
  tokens.aiko = await login('aikot@ece.iitr.ac.in');
  tokens.rahul = await login('rahulnair@cse.iitr.ac.in');
});

describe('public landing page', () => {
  it('serves live stats and anonymous reviews without logging in', async () => {
    const r = await request(app).get('/api/landing');
    expect(r.status).toBe(200);
    expect(r.body.stats).toMatchObject({ students: expect.any(Number), communities: expect.any(Number), activities: expect.any(Number) });
    expect(r.body.stats.students).toBeGreaterThanOrEqual(20);
    expect(r.body.stats.rating).toBeGreaterThanOrEqual(4);
    expect(r.body.stats.metNew).toBeGreaterThan(50);
    expect(r.body.testimonials.length).toBeGreaterThan(3);
    const json = JSON.stringify(r.body);
    expect(json).not.toMatch(/@iit\.ac\.in|password|handle/);
  });
});

describe('auth & onboarding', () => {
  const profile = {
    name: 'Test Student', handle: 'tester', email: 'tester@cse.iitr.ac.in', password: 'supersecret',
    department: 'CSE', year: '1st', courses: ['DSA'], skills: ['Python'], hobbies: ['Music'], interests: ['AI/ML'],
    clubs: ['Programming'], bio: 'hi', region: 'Kerala', languages_spoken: ['Malayalam'], languages_interested: ['Japanese'],
    cultural_interests: ['Food'], foods: ['Dosa'], festivals: ['Onam'], music_art: ['Anime'], availability: ['Evening'],
  };

  it('rejects non-college emails', async () => {
    const r = await request(app).post('/api/auth/register').field('profile', JSON.stringify({ ...profile, email: 'x@gmail.com' }));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/iitr\.ac\.in/);
    for (const bad of ['x@iit.ac.in', 'x@cse.iit.ac.in', 'x@fakeiitr.ac.in', 'x@iitr.ac.in.evil.com']) {
      const r2 = await request(app).post('/api/auth/register').field('profile', JSON.stringify({ ...profile, email: bad }));
      expect(r2.status).toBe(400);
    }
  });

  it('accepts IIT Roorkee addresses with any department subdomain', async () => {
    const c = await request(app).post('/api/auth/check').send({ email: 'khushi@ece.iitr.ac.in' });
    expect(c.body.errors.email).toBeUndefined();
    const r = await request(app).post('/api/auth/register')
      .field('profile', JSON.stringify({ ...profile, handle: 'khushi.j', email: 'khushi@ece.iitr.ac.in', department: 'ECE' }));
    expect(r.status).toBe(201);
    expect((await request(app).post('/api/auth/login').send({ email: 'khushi@ece.iitr.ac.in', password: 'supersecret' })).status).toBe(200);
    expect((await request(app).post('/api/auth/check').send({ email: 'someone@hyd.iitr.ac.in' })).body.errors.email).toBeUndefined();
  });

  it('seeds demo accounts in the IITR format and migrates old iit.ac.in accounts', async () => {
    expect(q.get('SELECT email FROM users WHERE handle = ?', 'arjunm').email).toBe('arjunm@cse.iitr.ac.in');
    expect(q.get("SELECT COUNT(*) AS n FROM users WHERE email NOT LIKE '%iitr.ac.in'").n).toBe(0);
    q.run("UPDATE users SET email = 'legacy@iit.ac.in' WHERE handle = 'kabirk'");
    q.run("UPDATE users SET email = 'legacy2@ce.iit.ac.in' WHERE handle = 'riya.s'");
    expect(migrateLegacyEmails()).toBe(2);
    expect(q.get('SELECT email FROM users WHERE handle = ?', 'kabirk').email).toBe('legacy@me.iitr.ac.in');
    expect(q.get('SELECT email FROM users WHERE handle = ?', 'riya.s').email).toBe('legacy2@ce.iitr.ac.in');
    expect(migrateLegacyEmails()).toBe(0);
    q.run("UPDATE users SET email = 'kabirk@me.iitr.ac.in' WHERE handle = 'kabirk'");
    q.run("UPDATE users SET email = 'riyas@ece.iitr.ac.in' WHERE handle = 'riya.s'");
  });

  it('lists all 23 IIT Roorkee departments', async () => {
    const meta = await request(app).get('/api/meta');
    expect(meta.body.options.departments).toHaveLength(23);
    expect(meta.body.options.departments).toEqual(expect.arrayContaining(['CSE', 'ECE', 'Electrical', 'Mechanical', 'Civil', 'Design', 'Hydrology']));
    expect(meta.body.emailSuffix).toBe('iitr.ac.in');
  });

  it('registers a full 4-page profile with avatar, then logs in', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
    const r = await request(app).post('/api/auth/register').field('profile', JSON.stringify(profile)).attach('avatar', png, { filename: 'a.png', contentType: 'image/png' });
    expect(r.status).toBe(201);
    expect(r.body.user.avatar).toMatch(/^\/uploads\//);
    expect(r.body.user.languages_interested).toEqual(['Japanese']);
    expect(r.body.user.password_hash).toBeUndefined();
    tokens.tester = await login('tester@cse.iitr.ac.in', 'supersecret');
    const me = await as('tester').get('/auth/me');
    expect(me.body.user.handle).toBe('tester');
  });

  it('prevents duplicate emails/handles and checks availability', async () => {
    const r = await request(app).post('/api/auth/register').field('profile', JSON.stringify(profile));
    expect(r.status).toBe(409);
    const c = await request(app).post('/api/auth/check').send({ email: 'tester@cse.iitr.ac.in', handle: 'tester' });
    expect(c.body.errors.email).toBeTruthy();
    expect(c.body.errors.handle).toBeTruthy();
  });

  it('rejects wrong passwords and unauthenticated requests', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: 'arjunm@cse.iitr.ac.in', password: 'nope' })).status).toBe(401);
    expect((await request(app).get('/api/posts')).status).toBe(401);
  });

  it('updates the profile', async () => {
    const r = await as('tester').put('/users/me', { bio: 'Updated bio', hobbies: ['Music', 'Cycling'] });
    expect(r.body.user.bio).toBe('Updated bio');
    expect(r.body.user.hobbies).toContain('Cycling');
  });
});

describe('feed, posts, upvotes, trending and search', () => {
  let postId;
  it('creates posts of each type and validates them', async () => {
    const t = await as('riya').post('/posts', { type: 'text', content: 'Anyone up for a #Hackathon this weekend?', topic: 'Tech' });
    expect(t.status).toBe(201);
    expect(t.body.post.tags).toContain('Hackathon');
    postId = t.body.post.id;
    expect((await as('riya').post('/posts', { type: 'link', content: 'x', link_url: 'notaurl' })).status).toBe(400);
    expect((await as('riya').post('/posts', { type: 'event', content: 'x' })).status).toBe(400);
    const ev = await as('riya').post('/posts', { type: 'event', content: 'Join!', meta: JSON.stringify({ title: 'Jam', date: '2030-01-01', time: '18:00', location: 'OAT' }) });
    expect(ev.body.post.meta.title).toBe('Jam');
    const pr = await as('riya').post('/posts', { type: 'project', content: 'Team up', meta: JSON.stringify({ title: 'Bot', lookingFor: ['ML'], skills: ['Python'] }) });
    expect(pr.body.post.tags).toEqual(expect.arrayContaining(['ML', 'Python']));
  });

  it('upvote toggles and notifies the author', async () => {
    const a = await as('arjun').post(`/posts/${postId}/upvote`);
    expect(a.body).toMatchObject({ upvoted: true, upvotes: 1 });
    const b = await as('arjun').post(`/posts/${postId}/upvote`);
    expect(b.body).toMatchObject({ upvoted: false, upvotes: 0 });
    const n = await as('riya').get('/notifications');
    expect(n.body.items.some((x) => x.type === 'upvote')).toBe(true);
  });

  it('comments and views are recorded on the detail view', async () => {
    await as('arjun').post(`/posts/${postId}/comments`, { content: 'Count me in!' });
    const d = await as('arjun').get(`/posts/${postId}`);
    expect(d.body.comments).toHaveLength(1);
    expect(d.body.post.views).toBe(1);
  });

  it('saved tab returns bookmarked posts', async () => {
    await as('arjun').post(`/posts/${postId}/save`);
    const s = await as('arjun').get('/posts?tab=saved');
    expect(s.body.posts.map((p) => p.id)).toContain(postId);
  });

  it('personalised feed reflects searches; trending and topic tabs work', async () => {
    await as('arjun').get('/search?q=umbrella');
    const post = await as('aiko').post('/posts', { type: 'text', content: 'Found an umbrella near the library', topic: 'Life@Campus' });
    const pages = [...(await as('arjun').get('/posts?tab=foryou&page=0')).body.posts, ...(await as('arjun').get('/posts?tab=foryou&page=1')).body.posts];
    const found = pages.find((p) => p.id === post.body.post.id);
    expect(found?.reasons.join(' ')).toMatch(/umbrella/);
    const trending = await as('arjun').get('/posts?tab=trending');
    expect(trending.body.posts.length).toBeGreaterThan(0);
    const tech = await as('arjun').get('/posts?tab=Tech');
    expect(tech.body.posts.every((p) => p.topic === 'Tech')).toBe(true);
  });

  it('friends-only posts are hidden from non-friends', async () => {
    const p = await as('riya').post('/posts', { type: 'text', content: 'friends only secret', visibility: 'friends' });
    expect((await as('arjun').get(`/posts/${p.body.post.id}`)).status).toBe(200); // Arjun & Riya are friends
    expect((await as('aiko').get(`/posts/${p.body.post.id}`)).status).toBe(404);
  });

  it('global search finds people, posts, communities and events', async () => {
    const r = await as('arjun').get('/search?q=photo');
    expect(r.body.posts.length + r.body.communities.length + r.body.activities.length).toBeGreaterThan(0);
    const people = await as('arjun').get('/search?q=Mechanical&type=people');
    expect(people.body.people.every((u) => u.department === 'Mechanical')).toBe(true);
  });

  it('testimonials are anonymous', async () => {
    const r = await as('arjun').get('/testimonials');
    expect(r.body.testimonials.length).toBeGreaterThan(0);
    expect(r.body.testimonials[0]).not.toHaveProperty('user_id');
    expect(r.body.testimonials[0].who).toMatch(/student/);
  });
});

describe('connections, block and report', () => {
  it('friend request → accept → friends', async () => {
    const rahul = idOf('rahul.nair');
    expect((await as('aiko').post(`/users/${rahul}/friend`)).body.friendship).toBe('requested');
    const prof = await as('rahul').get('/users/aiko.t');
    expect(prof.body.friendship).toBe('incoming');
    expect(prof.body.icebreakers.length).toBeGreaterThan(0); // different background
    expect((await as('rahul').post(`/users/${idOf('aiko.t')}/friend/accept`)).body.friendship).toBe('friends');
    const f = await as('rahul').get('/users/me/friends');
    expect(f.body.friends.map((x) => x.handle)).toContain('aiko.t');
  });

  it('blocking hides profiles, posts and DMs; report requires a valid reason', async () => {
    const aiko = idOf('aiko.t');
    await as('rahul').post(`/users/${aiko}/block`);
    expect((await as('aiko').get('/users/rahul.nair')).status).toBe(404);
    expect((await as('rahul').post(`/chats/dm/${aiko}`)).status).toBe(403);
    const feed = await as('rahul').get('/posts?tab=latest');
    expect(feed.body.posts.some((p) => p.author.id === aiko)).toBe(false);
    expect((await as('rahul').get('/users/me/friends')).body.friends.some((x) => x.id === aiko)).toBe(false);
    expect((await as('rahul').post('/reports', { target_type: 'user', target_id: aiko, reason: 'Bad' })).status).toBe(400);
    expect((await as('rahul').post('/reports', { target_type: 'user', target_id: aiko, reason: 'Spam' })).status).toBe(201);
    await as('rahul').del(`/users/${aiko}/block`);
    expect((await as('aiko').get('/users/rahul.nair')).status).toBe(200);
  });
});

describe('discover: activities, applications, survey', () => {
  let projectId;
  it('validates and creates an event from the template (creator auto-joins + group chat)', async () => {
    expect((await as('riya').post('/activities', { title: 'X', type: 'Hobby', date: '2000-01-01', time: '10:00' })).status).toBe(400);
    const r = await as('riya').post('/activities', {
      title: 'Robot Arm', type: 'Project', date: '2099-05-01', time: '18:00', location: 'Campus', capacity: 2,
      looking_for: ['ML'], skills: ['Python'], description: 'Build it',
    });
    expect(r.status).toBe(201);
    expect(r.body.activity.kind).toBe('project');
    expect(r.body.activity.participants).toBe(1);
    projectId = r.body.activity.id;
    const chats = await as('riya').get('/chats?type=group');
    expect(chats.body.conversations.some((c) => c.activity?.id === projectId)).toBe(true);
  });

  it('projects need approval; accepting adds the member to the group chat; capacity is enforced', async () => {
    expect((await as('arjun').post(`/activities/${projectId}/apply`, { message: 'I know Python' })).body.status).toBe('pending');
    expect((await as('aiko').post(`/activities/${projectId}/apply`)).body.status).toBe('pending');
    const mine = await as('arjun').get('/me/activities');
    expect(mine.body.applications.find((a) => a.id === projectId).my_status).toBe('pending');
    const acc = await as('riya').post(`/activities/${projectId}/applications/${idOf('arjunm')}`, { status: 'accepted' });
    expect(acc.body.status).toBe('accepted');
    const full = await as('riya').post(`/activities/${projectId}/applications/${idOf('aiko.t')}`, { status: 'accepted' });
    expect(full.status).toBe(400); // capacity 2 reached
    expect((await as('arjun').get(`/activities/${projectId}`)).body.activity.conversation_id).toBeTruthy();
    expect((await as('aiko').post(`/activities/${projectId}/applications/${idOf('arjunm')}`, { status: 'rejected' })).status).toBe(404);
  });

  it('sports/events are open-join', async () => {
    const list = await as('rahul').get('/activities?kind=sports');
    const open = list.body.activities.find((a) => !a.my_status && a.openings > 0);
    expect((await as('rahul').post(`/activities/${open.id}/apply`)).body.status).toBe('accepted');
  });

  it('filters by time, level, location and category; recommended sort adds reasons', async () => {
    const ev = await as('arjun').get('/activities?time=Evening');
    expect(ev.body.activities.every((a) => a.slot === 'Evening')).toBe(true);
    const lv = await as('arjun').get('/activities?level=Advanced');
    expect(lv.body.activities.every((a) => a.level === 'Advanced')).toBe(true);
    const loc = await as('arjun').get('/activities?location=Online');
    expect(loc.body.activities.every((a) => a.location === 'Online')).toBe(true);
    const cat = await as('arjun').get('/activities?category=Study&sort=recommended');
    expect(cat.body.activities.every((a) => a.category === 'Study')).toBe(true);
    expect(cat.body.activities[0].score).toBeGreaterThanOrEqual(cat.body.activities.at(-1).score);
  });

  it('completion triggers the post-event survey; good feedback becomes an anonymous testimonial', async () => {
    expect((await as('arjun').post(`/activities/${projectId}/feedback`, { rating: 5 })).status).toBe(400); // not completed yet
    await as('riya').post(`/activities/${projectId}/complete`);
    const n = await as('arjun').get('/notifications');
    expect(n.body.items.some((x) => x.type === 'feedback')).toBe(true);
    expect((await as('aiko').post(`/activities/${projectId}/feedback`, { rating: 5 })).status).toBe(403); // never accepted
    const fb = await as('arjun').post(`/activities/${projectId}/feedback`, {
      rating: 5, met_new: 'yes', learned_new: 'yes', cultural: 'no', again: 'yes', comment: 'Loved building the robot arm with new people!', allow_public: true,
    });
    expect(fb.body.featured).toBe(true);
    expect((await as('arjun').post(`/activities/${projectId}/feedback`, { rating: 4 })).status).toBe(409);
    const t = await as('arjun').get('/testimonials');
    expect(t.body.testimonials.some((x) => x.activity === 'Robot Arm')).toBe(true);
    const past = await as('arjun').get('/me/activities');
    expect(past.body.past.find((a) => a.id === projectId).feedback_given).toBe(true);
  });
});

describe('communities and chats', () => {
  it('joining a community adds you to its chat; leaving removes you', async () => {
    const list = await as('rahul').get('/communities?cultural=1');
    const c = list.body.communities.find((x) => !x.joined);
    const j = await as('rahul').post(`/communities/${c.id}/join`);
    const chats = await as('rahul').get('/chats?type=community');
    expect(chats.body.conversations.some((x) => x.id === j.body.conversation_id)).toBe(true);
    await as('rahul').del(`/communities/${c.id}/join`);
    expect((await as('rahul').get(`/chats/${j.body.conversation_id}`)).status).toBe(404);
  });

  it('direct messages: send, unread counts, read, reactions', async () => {
    const conv = (await as('aiko').post(`/chats/dm/${idOf('riya.s')}`)).body.conversation_id;
    const before = (await as('riya').get('/chats/unread')).body.unread;
    const m = await as('aiko').post(`/chats/${conv}/messages`, { content: 'Konnichiwa!' });
    expect(m.status).toBe(201);
    expect((await as('riya').get('/chats/unread')).body.unread).toBe(before + 1);
    const msgs = await as('riya').get(`/chats/${conv}/messages`);
    expect(msgs.body.messages.at(-1).content).toBe('Konnichiwa!');
    expect((await as('riya').get('/chats/unread')).body.unread).toBe(before);
    const r = await as('riya').post(`/messages/${m.body.message.id}/react`, { emoji: '🎉' });
    expect(r.body.message.reactions[0]).toMatchObject({ emoji: '🎉', count: 1, mine: true });
    expect((await as('arjun').get(`/chats/${conv}/messages`)).status).toBe(404); // not a member
    expect((await as('aiko').post(`/chats/${conv}/messages`, { content: '' })).status).toBe(400);
  });
});

describe('culture page', () => {
  it('culture of the week rotates with offset', async () => {
    const a = await as('arjun').get('/culture/week');
    const b = await as('arjun').get('/culture/week?offset=1');
    expect(a.body.culture.name).not.toBe(b.body.culture.name);
  });

  it('step outside your circle excludes friends and skipped people', async () => {
    const r = await as('arjun').get('/culture/outside?focus=Region');
    const handles = r.body.matches.map((m) => m.user.handle);
    expect(handles).not.toContain('riya.s'); // friend
    expect(r.body.matches.every((m) => m.user.region !== 'Rajasthan')).toBe(true); // Arjun is from Rajasthan
    const first = r.body.matches[0].user.id;
    await as('arjun').post(`/culture/skip/${first}`);
    const r2 = await as('arjun').get('/culture/outside?focus=Region');
    expect(r2.body.matches.some((m) => m.user.id === first)).toBe(false);
  });

  it('cultural buddy matches by mode/topic and stores the preference', async () => {
    const r = await as('arjun').post('/culture/buddy', { mode: 'Learn', topic: 'Language' });
    expect(r.body.matches.length).toBeGreaterThan(0);
    expect(r.body.matches[0].reasons[0]).toMatch(/teach you (Japanese|Tamil)/);
    expect((await as('arjun').get('/culture/buddy')).body.pref).toEqual({ mode: 'Learn', topic: 'Language' });
    expect((await as('arjun').post('/culture/buddy', { mode: 'Learn', topic: 'Nope' })).status).toBe(400);
  });

  it('cultural stories can be posted and filtered by category', async () => {
    expect((await as('aiko').post('/posts', { kind: 'story', type: 'text', content: 'x' })).status).toBe(400);
    const s = await as('aiko').post('/posts', { kind: 'story', type: 'text', content: 'Onigiri is the ultimate snack', story_category: 'Food From My Home' });
    expect(s.status).toBe(201);
    const list = await as('arjun').get('/posts?kind=story&tab=latest&category=Food%20From%20My%20Home');
    expect(list.body.posts.every((p) => p.story_category === 'Food From My Home')).toBe(true);
    expect(list.body.posts.some((p) => p.id === s.body.post.id)).toBe(true);
  });

  it('recommendations return people, teams, groups and events', async () => {
    const r = await as('arjun').get('/recommendations');
    for (const k of ['people', 'studyPartners', 'culturalBuddies', 'teams', 'events', 'groups']) expect(Array.isArray(r.body[k])).toBe(true);
    expect(r.body.people.length).toBeGreaterThan(0);
    expect(r.body.events.every((e) => !e.my_status)).toBe(true);
    expect(r.body.groups.every((g) => !g.joined)).toBe(true);
  });
});
