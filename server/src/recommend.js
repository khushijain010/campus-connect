// Campus Connect recommendation engine.
//
// Matching principle: Common Interests + Compatible Preferences + Different Backgrounds.
//   common      – overlap in interests, hobbies, courses/skills, cultural interests
//   compatible  – shared availability slots and a shared language to talk in
//   different   – different department, region/zone and language background
//
// Every scorer returns { score (0..1), reasons: string[] } so the UI can explain recommendations.
// All functions are pure (no DB access) so they are easy to unit test.

import { zoneOf, slotOf } from './constants.js';

const norm = (s) => String(s ?? '').toLowerCase().trim();
const set = (arr) => new Set((arr || []).map(norm).filter(Boolean));

// Words/phrases that indicate the same area. Used to match free-text content against profile tags.
const RELATED = {
  'ai/ml': ['ai', 'ml', 'machine learning', 'deep learning', 'python', 'opencv', 'neural', 'data', 'ai/ml'],
  ml: ['ml', 'machine learning', 'ai/ml', 'ai'],
  cp: ['cp', 'dsa', 'competitive programming', 'coding', 'algorithms', 'hackathon', 'leetcode', 'codeforces'],
  dsa: ['dsa', 'algorithms', 'cp', 'coding', 'interview'],
  electronics: ['electronics', 'dsp', 'verilog', 'arduino', 'circuits', 'sdr', 'hardware', 'vlsi', 'ofdm'],
  robotics: ['robotics', 'robot', 'arduino', 'hardware', 'drone'],
  research: ['research', 'paper', 'publication', 'thesis'],
  finance: ['finance', 'trading', 'investing', 'stocks', 'quant'],
  photography: ['photography', 'photo', 'camera', 'photowalk', 'shots'],
  sports: ['sports', 'football', 'cricket', 'basketball', 'badminton', 'cycling', 'running', 'match'],
  football: ['football', 'soccer', 'match'],
  cycling: ['cycling', 'cycle', 'ride'],
  music: ['music', 'jam', 'guitar', 'singing', 'concert', 'band'],
  reading: ['reading', 'books', 'book club', 'novel'],
  gaming: ['gaming', 'games', 'esports', 'game'],
  dsp: ['dsp', 'signal', 'signals', 'sdr', 'filter'],
  os: ['os', 'operating systems', 'kernel'],
  dbms: ['dbms', 'database', 'sql'],
  networks: ['networks', 'networking', 'tcp'],
  mathematics: ['mathematics', 'maths', 'math', 'calculus'],
  food: ['food', 'cooking', 'cuisine', 'dish', 'recipe'],
  festivals: ['festival', 'festivals', 'celebration', 'diwali', 'onam', 'bihu', 'pongal', 'holi'],
  dance: ['dance', 'garba', 'bhangra', 'kathak'],
  art: ['art', 'painting', 'sketch', 'craft'],
  react: ['react', 'frontend', 'web', 'webdev'],
  python: ['python'],
  'c++': ['c++', 'cpp'],
};

export function expandTags(tags) {
  const out = new Set();
  for (const t of tags) {
    const k = norm(t);
    if (!k) continue;
    out.add(k);
    for (const r of RELATED[k] || []) out.add(r);
  }
  return out;
}

export function textTokens(...parts) {
  const text = parts.flat().filter(Boolean).map(String).join(' ').toLowerCase();
  return text;
}

// Count how many of the expanded profile tags appear in a piece of content.
function contentMatches(expanded, itemTags, text) {
  const hits = new Set();
  const tagSet = set(itemTags);
  for (const t of expanded) {
    if (tagSet.has(t)) { hits.add(t); continue; }
    if (t.length >= 3 && text) {
      const re = new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}([^a-z0-9]|$)`);
      if (re.test(text)) hits.add(t);
    }
  }
  return hits;
}

// Overlap coefficient |A∩B| / min(|A|,|B|) – kinder than Jaccard for short tag lists.
function overlap(a, b) {
  const A = set(a), B = set(b);
  if (!A.size || !B.size) return { value: 0, common: [] };
  const common = (a || []).filter((x) => B.has(norm(x)));
  const uniq = [...new Set(common)];
  return { value: uniq.length / Math.min(A.size, B.size), common: uniq };
}

export function profileOf(u) {
  return {
    id: u.id,
    department: u.department,
    year: u.year,
    region: u.region,
    zone: zoneOf(u.region),
    interests: u.interests || [],
    hobbies: [...(u.hobbies || []), ...(u.clubs || [])],
    academic: [...(u.courses || []), ...(u.skills || [])],
    courses: u.courses || [],
    skills: u.skills || [],
    culture: [...(u.cultural_interests || []), ...(u.music_art || [])],
    culturalInterests: u.cultural_interests || [],
    languages: u.languages_spoken || [],
    langWant: u.languages_interested || [],
    foods: u.foods || [],
    festivals: u.festivals || [],
    availability: u.availability || [],
  };
}

const allTags = (p) => [...p.interests, ...p.hobbies, ...p.academic, ...p.culturalInterests];

/* ------------------------------------------------------------------ people */

const PEOPLE_WEIGHTS = {
  //            common  compatible  different
  friends:   [0.55, 0.25, 0.20],
  outside:   [0.45, 0.15, 0.40],
  study:     [0.65, 0.30, 0.05],
  cultural:  [0.35, 0.20, 0.45],
};

/**
 * Score how well `other` fits `me`.
 * mode: friends | outside | study | cultural
 * focus: subset of ['Interests','Hobbies','Department','Region','Language'] – emphasises those dimensions.
 *        Department/Region/Language mean "must differ" on that dimension.
 */
export function scorePerson(meU, otherU, { mode = 'friends', focus = [] } = {}) {
  const me = profileOf(meU), other = profileOf(otherU);
  const reasons = [];
  const f = new Set(focus.map(norm));

  // common ground
  const oi = overlap(me.interests, other.interests);
  const oh = overlap(me.hobbies, other.hobbies);
  const oa = overlap(mode === 'study' ? me.courses : me.academic, mode === 'study' ? other.courses : other.academic);
  const oc = overlap(me.culture, other.culture);
  let wI = 0.35, wH = 0.3, wA = 0.15, wC = 0.2;
  if (mode === 'study') { wI = 0.25; wH = 0.05; wA = 0.65; wC = 0.05; }
  if (mode === 'cultural') { wI = 0.2; wH = 0.2; wA = 0.05; wC = 0.55; }
  if (f.has('interests')) wI *= 2.5;
  if (f.has('hobbies')) wH *= 2.5;
  const wSum = wI + wH + wA + wC;
  const common = (oi.value * wI + oh.value * wH + oa.value * wA + oc.value * wC) / wSum;
  if (oi.common.length) reasons.push(`Both into ${oi.common.slice(0, 2).join(' & ')}`);
  if (oh.common.length) reasons.push(`Shared hobby: ${oh.common.slice(0, 2).join(', ')}`);
  if (oa.common.length) reasons.push(`${mode === 'study' ? 'Same courses' : 'Common courses/skills'}: ${oa.common.slice(0, 3).join(', ')}`);
  if (mode === 'cultural' && oc.common.length) reasons.push(`Loves ${oc.common.slice(0, 2).join(' & ')}`);

  // compatible preferences
  const oav = overlap(me.availability, other.availability);
  const ol = overlap(me.languages, other.languages);
  const compatible = 0.5 * (me.availability.length && other.availability.length ? oav.value : 0.5)
    + 0.5 * (ol.common.length ? 1 : 0);
  if (oav.common.length && mode === 'study') reasons.push(`Both free in the ${oav.common[0].toLowerCase()}`);

  // different backgrounds
  const deptDiff = me.department && other.department && me.department !== other.department ? 1 : 0;
  let regionDiff = 0;
  if (me.region && other.region && me.region !== other.region) regionDiff = me.zone !== other.zone ? 1 : 0.5;
  const newLangs = other.languages.filter((l) => !set(me.languages).has(norm(l)));
  const wantedLangs = newLangs.filter((l) => set(me.langWant).has(norm(l)));
  const langDiff = Math.min(1, newLangs.length * 0.35 + wantedLangs.length * 0.5);
  let dD = 1, dR = 1.2, dL = 0.8;
  if (f.has('department')) dD *= 3;
  if (f.has('region')) dR *= 3;
  if (f.has('language')) dL *= 3;
  const different = (deptDiff * dD + regionDiff * dR + langDiff * dL) / (dD + dR + dL);
  if (deptDiff && mode !== 'study') reasons.push(`Different department: ${other.department}`);
  if (regionDiff) reasons.push(`From ${other.region}`);
  if (wantedLangs.length) reasons.push(`Speaks ${wantedLangs[0]} – which you want to learn`);

  // hard constraints from focus chips
  if (f.has('department') && !deptDiff) return { score: 0, reasons };
  if (f.has('region') && !regionDiff) return { score: 0, reasons };
  if (f.has('language') && !newLangs.length) return { score: 0, reasons };

  const [wc, wp, wd] = PEOPLE_WEIGHTS[mode] || PEOPLE_WEIGHTS.friends;
  let score = wc * common + wp * compatible + wd * different;
  if (mode === 'study' && me.year && me.year === other.year) { score += 0.05; reasons.push('Same year'); }
  // Without any common ground a "different" match is not useful – damp it.
  if (common === 0) score *= 0.45;
  return { score: Math.max(0, Math.min(0.99, score)), reasons: [...new Set(reasons)].slice(0, 4) };
}

/* ---------------------------------------------------------- cultural buddy */

// What `other` can offer to `me` for a given mode/topic, and how strongly (0..1).
export function scoreBuddy(meU, otherU, mode, topic, otherPref = null) {
  const me = profileOf(meU), other = profileOf(otherU);
  const T = norm(topic);
  const reasons = [];
  let fit = 0;
  const differentRegion = me.region && other.region && me.region !== other.region;
  const lacks = (mine, theirs) => theirs.filter((x) => !set(mine).has(norm(x)));

  if (mode === 'Learn') {
    if (T === 'language') {
      const can = other.languages.filter((l) => set(me.langWant).has(norm(l)));
      if (can.length) { fit = 1; reasons.push(`Can teach you ${can[0]}`); }
      else if (lacks(me.languages, other.languages).length) { fit = 0.4; reasons.push(`Speaks ${lacks(me.languages, other.languages)[0]}`); }
    } else if (T === 'food') {
      const dishes = lacks(me.foods, other.foods);
      if (dishes.length && differentRegion) { fit = 0.6 + Math.min(0.4, dishes.length * 0.15); reasons.push(`Knows ${dishes.slice(0, 2).join(', ')}`); }
    } else if (T === 'festivals') {
      const fests = lacks(me.festivals, other.festivals);
      if (fests.length) { fit = 0.6 + Math.min(0.4, fests.length * 0.15); reasons.push(`Celebrates ${fests.slice(0, 2).join(', ')}`); }
    } else { // culture
      if (differentRegion) { fit = me.zone !== other.zone ? 1 : 0.6; reasons.push(`Shares ${other.region} culture`); }
    }
  } else if (mode === 'Teach') {
    if (T === 'language') {
      const wants = other.langWant.filter((l) => set(me.languages).has(norm(l)));
      if (wants.length) { fit = 1; reasons.push(`Wants to learn ${wants[0]}`); }
    } else if (T === 'food') {
      if (set(other.culturalInterests).has('food') && differentRegion) { fit = 0.9; reasons.push('Curious about regional food'); }
    } else if (T === 'music') {
      if (set(other.culturalInterests).has('music')) { fit = 0.8; reasons.push('Into music'); }
      if (overlap(me.culture, other.culture).common.length) fit = Math.min(1, fit + 0.2);
    } else { // traditions
      const ci = set(other.culturalInterests);
      if (differentRegion && (ci.has('festivals') || ci.has('art') || ci.has('dance'))) { fit = 0.85; reasons.push('Loves learning traditions'); }
    }
  } else if (mode === 'Experience') {
    const ci = set(other.culturalInterests);
    if (T === 'games') {
      if (set(other.hobbies).has('gaming') || set(other.hobbies).has('sports')) { fit = 0.8; reasons.push('Up for games'); }
    } else if (ci.has(T)) { fit = 0.8; reasons.push(`Also wants to experience ${topic.toLowerCase()}`); }
    if (fit && differentRegion) { fit = Math.min(1, fit + 0.2); reasons.push(`From ${other.region}`); }
  } else if (mode === 'Connect') {
    const intl = me.zone === 'International' || other.zone === 'International';
    if (T === 'regional' && me.zone && me.zone === other.zone) { fit = me.region === other.region ? 1 : 0.8; reasons.push(`Also from ${other.zone === 'International' ? other.region : other.zone + ' India'}`); }
    if (T === 'national' && !intl && me.zone !== other.zone) { fit = 1; reasons.push(`From ${other.region}`); }
    if (T === 'international' && intl && me.region !== other.region) { fit = 1; reasons.push(`From ${other.region}`); }
  }

  // Complementary buddy preference (I learn X, they teach X) is a strong signal.
  if (otherPref && norm(otherPref.topic) === T) {
    const complement = { Learn: 'Teach', Teach: 'Learn', Experience: 'Experience', Connect: 'Connect' }[mode];
    if (otherPref.mode === complement) { fit = Math.min(1, fit + 0.5); reasons.unshift(`Looking to ${complement.toLowerCase()} ${topic.toLowerCase()}`); }
  }

  if (!fit) return { score: 0, reasons };
  const base = scorePerson(meU, otherU, { mode: 'cultural' });
  const score = Math.min(0.99, 0.65 * fit + 0.35 * base.score);
  return { score, reasons: [...new Set([...reasons, ...base.reasons])].slice(0, 4) };
}

/* -------------------------------------------------------------- activities */

/**
 * ctx: { now: Date, joinedCategories: Set, friendIds: Set, communityTags: Set, participantIds: number[] }
 */
export function scoreActivity(meU, act, ctx = {}) {
  const me = profileOf(meU);
  const reasons = [];
  const expanded = expandTags(allTags(me));
  const text = textTokens(act.title, act.description, act.course);
  const itemTags = [...(act.tags || []), ...(act.skills || []), ...(act.looking_for || []), act.course, act.category, act.type].filter(Boolean);
  const hits = contentMatches(expanded, itemTags, text);
  let relevance = Math.min(1, hits.size / 3);
  if (hits.size) {
    const pretty = [...new Set(allTags(me).filter((t) => hits.has(norm(t))))];
    reasons.push(`Matches your ${pretty.length ? pretty.slice(0, 2).join(' & ') : 'interests'}`);
  }

  if (act.course && set(me.courses).has(norm(act.course))) { relevance += 0.3; reasons.push(`You take ${act.course}`); }
  const skillHit = (act.skills || []).filter((s) => set(me.skills).has(norm(s)));
  if (skillHit.length) { relevance += 0.2 * Math.min(2, skillHit.length); reasons.push(`Needs your ${skillHit.slice(0, 2).join(', ')}`); }

  let bonus = 0;
  const slot = slotOf(act.time);
  if (slot && set(me.availability).has(norm(slot))) { bonus += 0.1; reasons.push(`Fits your ${slot.toLowerCase()} availability`); }
  if (act.is_cultural_exchange && me.culturalInterests.length) { bonus += 0.15; if (!reasons.length) reasons.push('Cultural exchange for you'); }
  if (ctx.joinedCategories?.has(act.category)) { bonus += 0.1; reasons.push(`You joined ${act.category.toLowerCase()} activities before`); }
  if (ctx.communityTags && itemTags.some((t) => ctx.communityTags.has(norm(t)))) bonus += 0.1;
  const friendsIn = (ctx.participantIds || []).filter((id) => ctx.friendIds?.has(id)).length;
  if (friendsIn) { bonus += Math.min(0.2, friendsIn * 0.07); reasons.push(`${friendsIn} friend${friendsIn > 1 ? 's' : ''} going`); }
  if (act.department && act.department === me.department) bonus += 0.05;

  const score = Math.min(0.97, 0.55 * Math.min(1, relevance) + Math.min(0.4, bonus));
  return { score, reasons: [...new Set(reasons)].slice(0, 4) };
}

/* ------------------------------------------------------------- communities */

export function scoreCommunity(meU, c, ctx = {}) {
  const me = profileOf(meU);
  const expanded = expandTags(allTags(me));
  const hits = contentMatches(expanded, [...(c.tags || []), c.name], textTokens(c.name, c.description));
  const reasons = [];
  let score = Math.min(1, hits.size / 2) * 0.7;
  if (hits.size) {
    const pretty = [...new Set(allTags(me).filter((t) => hits.has(norm(t))))];
    reasons.push(`For your ${pretty.length ? pretty[0] : 'interests'}`);
  }
  if (c.is_cultural && me.culturalInterests.length) { score += 0.15; if (!reasons.length) reasons.push('Matches your cultural interests'); }
  const friendsIn = (ctx.memberIds || []).filter((id) => ctx.friendIds?.has(id)).length;
  if (friendsIn) { score += Math.min(0.2, friendsIn * 0.05); reasons.push(`${friendsIn} friend${friendsIn > 1 ? 's' : ''} joined`); }
  return { score: Math.min(0.99, score), reasons };
}

/* -------------------------------------------------------------------- feed */

export function ageHours(createdAt, now = Date.now()) {
  const t = new Date(String(createdAt).replace(' ', 'T') + (String(createdAt).endsWith('Z') ? '' : 'Z')).getTime();
  return Math.max(0, (now - t) / 3.6e6);
}

export function trendingScore(p, now = Date.now()) {
  const h = ageHours(p.created_at, now);
  const engagement = (p.upvotes || 0) * 3 + (p.comment_count || 0) * 2 + (p.views || 0) * 0.1 + 1;
  return engagement / Math.pow(h + 2, 1.3);
}

/**
 * Personalised feed score.
 * ctx: { searchTerms: string[], likedTags: Set, communityIds: Set, communityTags: Set, friendIds: Set, now }
 */
export function scorePost(meU, p, ctx = {}) {
  const me = profileOf(meU);
  const reasons = [];
  const expanded = expandTags([...me.interests, ...me.hobbies, ...me.courses, ...me.skills, ...me.culturalInterests]);
  const text = textTokens(p.content, p.meta?.title, p.topic);
  const hits = contentMatches(expanded, [...(p.tags || []), p.topic], text);
  let relevance = Math.min(1, hits.size / 2);
  if (hits.size) {
    const pretty = [...me.interests, ...me.courses, ...me.hobbies].filter((t) => hits.has(norm(t)));
    if (pretty.length) reasons.push(`Because you follow ${pretty[0]}`);
  }
  if (p.community_id && ctx.communityIds?.has(p.community_id)) { relevance += 0.4; reasons.push('From your community'); }
  else if (ctx.communityTags && (p.tags || []).some((t) => ctx.communityTags.has(norm(t)))) relevance += 0.2;
  // Recent searches are a strong but short-lived intent signal: the newest ones weigh the most.
  const terms = ctx.searchTerms || [];
  const hitIdx = terms.findIndex((t) => t.length >= 3 && text.includes(norm(t)));
  if (hitIdx >= 0) { relevance += hitIdx < 3 ? 1.0 : 0.4; reasons.unshift(`You searched “${terms[hitIdx]}”`); }
  if (ctx.likedTags && (p.tags || []).some((t) => ctx.likedTags.has(norm(t)))) { relevance += 0.2; }
  if (ctx.friendIds?.has(p.user_id)) { relevance += 0.35; reasons.push('From a friend'); }

  const h = ageHours(p.created_at, ctx.now);
  const recency = Math.exp(-h / 72);
  const engagement = Math.log1p((p.upvotes || 0) * 2 + (p.comment_count || 0) * 3 + (p.views || 0) * 0.1) / 6;
  const score = (0.35 + Math.min(1.5, relevance)) * (0.35 + 0.65 * recency) + 0.25 * engagement;
  // Your own post stays on top of your feed for a short while after posting.
  if (ctx.meId === p.user_id && h < 1) return { score: score + 3, reasons: ['Your new post'] };
  return { score, reasons: reasons.slice(0, 2) };
}

/* ----------------------------------------------------------------- helpers */

export function rank(items, scorer, { limit = 20, minScore = 0 } = {}) {
  return items
    .map((it) => { const r = scorer(it); return { item: it, ...r }; })
    .filter((r) => r.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
