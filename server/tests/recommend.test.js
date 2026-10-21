import { describe, it, expect } from 'vitest';
import { scorePerson, scoreBuddy, scoreActivity, scorePost, trendingScore, expandTags } from '../src/recommend.js';

const base = {
  courses: [], skills: [], hobbies: [], interests: [], clubs: [], cultural_interests: [], music_art: [],
  languages_spoken: ['English'], languages_interested: [], foods: [], festivals: [], availability: [],
};
const user = (o) => ({ ...base, ...o });

// The example from the spec.
const me = user({ id: 1, department: 'ECE', region: 'Kerala', interests: ['AI/ML'], hobbies: ['Photography'], languages_spoken: ['Malayalam', 'English'] });
const ideal = user({ id: 2, department: 'Mechanical', region: 'Rajasthan', interests: ['AI/ML'], hobbies: ['Photography'], languages_spoken: ['Hindi', 'English'] });
const sameBubble = user({ id: 3, department: 'ECE', region: 'Kerala', interests: ['AI/ML'], hobbies: ['Photography'], languages_spoken: ['Malayalam', 'English'] });
const nothingInCommon = user({ id: 4, department: 'Civil', region: 'Assam', interests: ['Finance'], hobbies: ['Gaming'], languages_spoken: ['Assamese'] });

describe('scorePerson – common interests + compatible preferences + different backgrounds', () => {
  it('ranks the spec example (ECE+AI/ML+Photography+Kerala ↔ Mech+AI/ML+Photography+Rajasthan) above same-bubble and no-common-ground matches', () => {
    const a = scorePerson(me, ideal, { mode: 'outside' }).score;
    const b = scorePerson(me, sameBubble, { mode: 'outside' }).score;
    const c = scorePerson(me, nothingInCommon, { mode: 'outside' }).score;
    expect(a).toBeGreaterThan(b);
    expect(a).toBeGreaterThan(c);
  });

  it('explains matches with human-readable reasons', () => {
    const { reasons } = scorePerson(me, ideal, { mode: 'outside' });
    expect(reasons.join(' ')).toMatch(/AI\/ML/);
    expect(reasons.join(' ')).toMatch(/Rajasthan/);
    expect(reasons.join(' ')).toMatch(/Mechanical/);
  });

  it('focus=Region requires a different region', () => {
    expect(scorePerson(me, sameBubble, { mode: 'outside', focus: ['Region'] }).score).toBe(0);
    expect(scorePerson(me, ideal, { mode: 'outside', focus: ['Region'] }).score).toBeGreaterThan(0);
  });

  it('study mode prioritises shared courses and availability', () => {
    const s = user({ id: 9, department: 'ECE', courses: ['DSP', 'OS'], availability: ['Evening'] });
    const p1 = user({ id: 10, department: 'CSE', courses: ['DSP', 'OS'], availability: ['Evening'] });
    const p2 = user({ id: 11, department: 'CSE', courses: ['DBMS'], availability: ['Morning'] });
    expect(scorePerson(s, p1, { mode: 'study' }).score).toBeGreaterThan(scorePerson(s, p2, { mode: 'study' }).score);
  });
});

describe('scoreBuddy', () => {
  it('Learn Language matches people who speak a language I want to learn', () => {
    const learner = user({ id: 1, region: 'Delhi', languages_spoken: ['Hindi'], languages_interested: ['Japanese'] });
    const teacher = user({ id: 2, region: 'Japan', languages_spoken: ['Japanese', 'English'] });
    const other = user({ id: 3, region: 'Punjab', languages_spoken: ['Hindi'] });
    expect(scoreBuddy(learner, teacher, 'Learn', 'Language').score).toBeGreaterThan(0.5);
    expect(scoreBuddy(learner, other, 'Learn', 'Language').score).toBe(0);
  });

  it('Connect International only matches across countries', () => {
    const a = user({ id: 1, region: 'Kerala' });
    expect(scoreBuddy(a, user({ id: 2, region: 'Japan' }), 'Connect', 'International').score).toBeGreaterThan(0);
    expect(scoreBuddy(a, user({ id: 3, region: 'Punjab' }), 'Connect', 'International').score).toBe(0);
    expect(scoreBuddy(a, user({ id: 3, region: 'Punjab' }), 'Connect', 'National').score).toBeGreaterThan(0);
  });
});

describe('scoreActivity', () => {
  const student = user({ id: 1, interests: ['AI/ML'], courses: ['ML'], skills: ['Python'], availability: ['Evening'] });
  it('prefers activities matching interests, courses, skills and availability', () => {
    const ml = { title: 'ML Paper Reading', tags: ['ML'], skills: ['Python'], course: 'ML', time: '18:00', category: 'Study', type: 'Study' };
    const cricket = { title: 'Cricket nets', tags: ['Cricket'], skills: [], time: '07:00', category: 'Sports', type: 'Sports' };
    const a = scoreActivity(student, ml);
    expect(a.score).toBeGreaterThan(scoreActivity(student, cricket).score);
    expect(a.reasons.join(' ')).toMatch(/evening/);
  });
  it('boosts activities friends are attending', () => {
    const ev = { title: 'Board games', tags: ['Games'], time: '20:00', category: 'Games', type: 'Hobby' };
    const without = scoreActivity(student, ev, { friendIds: new Set([5]), participantIds: [] }).score;
    const withF = scoreActivity(student, ev, { friendIds: new Set([5]), participantIds: [5] }).score;
    expect(withF).toBeGreaterThan(without);
  });
});

describe('feed scoring', () => {
  const now = Date.now();
  const iso = (hAgo) => new Date(now - hAgo * 3.6e6).toISOString().slice(0, 19).replace('T', ' ');
  it('trending favours engagement and recency', () => {
    const hot = { upvotes: 30, comment_count: 10, views: 200, created_at: iso(2) };
    const old = { upvotes: 30, comment_count: 10, views: 200, created_at: iso(200) };
    const quiet = { upvotes: 0, comment_count: 0, views: 1, created_at: iso(2) };
    expect(trendingScore(hot, now)).toBeGreaterThan(trendingScore(old, now));
    expect(trendingScore(hot, now)).toBeGreaterThan(trendingScore(quiet, now));
  });
  it('personalised score uses interests, searches and communities', () => {
    const u = user({ id: 1, interests: ['AI/ML'] });
    const relevant = { content: 'New machine learning reading group', tags: [], topic: 'Tech', created_at: iso(5), user_id: 2 };
    const irrelevant = { content: 'Lost my umbrella', tags: [], topic: 'Life@Campus', created_at: iso(5), user_id: 2 };
    expect(scorePost(u, relevant, { now }).score).toBeGreaterThan(scorePost(u, irrelevant, { now }).score);
    const searched = scorePost(u, irrelevant, { now, searchTerms: ['umbrella'] });
    expect(searched.reasons[0]).toMatch(/umbrella/);
  });
  it('expands related tags', () => {
    expect(expandTags(['AI/ML']).has('machine learning')).toBe(true);
  });
});
