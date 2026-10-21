import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, ArrowRight, Building2, MapPin, Search, Users2, Plus, Snowflake, MessageCircle, Pencil, Globe2, RotateCcw,
  CalendarDays, GraduationCap, BookHeart,
} from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Avatar, Empty, Spinner, useApi } from '../components/ui.jsx';
import Row from '../components/Row.jsx';
import { ActivityCard, CommunityTile, useTilt } from '../components/cards.jsx';
import { StoryCard } from '../components/PostCard.jsx';
import CreatePostModal from '../components/CreatePostModal.jsx';
import AddEventModal from '../components/AddEventModal.jsx';
import { openDm } from './Profile.jsx';

const TOPIC_EMOJI = { Food: '🍲', Festivals: '🎉', Music: '🎶', Dance: '💃', Language: '🗣️', Languages: '🗣️', Traditions: '🪔', Art: '🎨', Arts: '🎨', Clothing: '🧣', Attire: '🧣', Sports: '🏏' };

/** Three topic cards fanned out in 3D; they spread on hover and the stack leans toward the cursor. */
function TopicFan({ topics }) {
  const tilt = useTilt(16);
  const cards = topics.slice(0, 3);
  return (
    <div className="fan" {...tilt} aria-hidden="true">
      <div className="fan-stage">
        {cards.map(([k, items], i) => (
          <div key={k} className="fan-card" style={{ '--i': i - (cards.length - 1) / 2, '--z': i === 1 ? 40 : 0, zIndex: i === 1 ? 2 : 1 }}>
            <span className="fan-emoji">{TOPIC_EMOJI[k] || '✨'}</span>
            <b>{k}</b>
            <small>{items.join(' · ')}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function CultureOfWeek() {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const { data, loading } = useApi(() => api.get(`/culture/week?offset=${offset}`), [offset]);
  const c = data?.culture;
  if (loading && !c) return <div className="billboard skeleton" />;
  if (!c) return null;
  const topics = Object.entries(c.topics).filter(([k]) => k !== 'regions');
  return (
    <section className="stack" style={{ gap: 0 }}>
      <div className="billboard" style={{ '--c': c.color }}>
        <span className="billboard-mark" aria-hidden="true">{c.emoji}</span>
        <div className="nav">
          <button onClick={() => setOffset(offset - 1)} aria-label="Previous culture"><ChevronLeft size={18} /></button>
          <button onClick={() => setOffset(offset + 1)} aria-label="Next culture"><ChevronRight size={18} /></button>
        </div>
        <div className="billboard-copy">
          <div className="row" style={{ gap: 8 }}><span className="pill sm">Culture of the Week</span><span className="pill sm">Week {c.week}</span></div>
          <h2>{c.emoji} {c.name}</h2>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{c.tagline}</div>
          <p>{c.description}</p>
          <div className="chips">{topics.map(([k]) => <span key={k} className="pill sm">{k}</span>)}<span className="pill sm">Student Stories</span></div>
          <div style={{ marginTop: 6 }}><button className="btn btn-white" onClick={() => setOpen(!open)}>{open ? 'Hide details' : 'Explore Culture'} <ArrowRight size={16} /></button></div>
        </div>
        <TopicFan topics={topics} />
      </div>
      {open ? (
        <div className="card card-pad stack" style={{ marginTop: 12 }}>
          <div className="grid-3">
            {topics.map(([k, items]) => (
              <div key={k}><div className="label" style={{ marginBottom: 6 }}>{TOPIC_EMOJI[k] || '✨'} {k}</div><div className="chips">{items.map((i) => <span key={i} className="pill grey">{i}</span>)}</div></div>
            ))}
          </div>
          {data.people.length ? (
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Students from {c.topics.regions.slice(0, 3).join(', ')}</div>
              <div className="row wrap" style={{ gap: 14 }}>
                {data.people.map((p) => <Link key={p.id} to={`/u/${p.handle}`} className="row" style={{ gap: 8 }}><Avatar user={p} size={34} /><span className="small bold">{p.name}</span></Link>)}
              </div>
            </div>
          ) : null}
          {data.stories.length ? (
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Student Stories</div>
              <div className="hscroll">{data.stories.map((s) => <StoryCard key={s.id} post={s} onChange={() => {}} />)}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const FOCUS = ['Interests', 'Hobbies', 'Department', 'Region', 'Language'];

function StepOutside() {
  const toast = useToast();
  const [focus, setFocus] = useState(['Interests']);
  const [i, setI] = useState(0);
  const { data, loading, reload, setData } = useApi(() => api.get(`/culture/outside${qs({ focus })}`), [focus.join()]);
  const matches = data?.matches || [];
  const m = matches[Math.min(i, matches.length - 1)];
  useEffect(() => setI(0), [focus.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const drop = (id) => { setData((d) => ({ ...d, matches: d.matches.filter((x) => x.user.id !== id) })); };
  const connect = async () => {
    try { await api.post(`/users/${m.user.id}/friend`); toast(`Request sent to ${m.user.name}`); drop(m.user.id); } catch (e) { toast(e.message, 'error'); }
  };
  const skip = async () => { await api.post(`/culture/skip/${m.user.id}`).catch(() => {}); drop(m.user.id); };
  const reset = async () => { await api.del('/culture/skips'); reload(); };

  return (
    <section className="card">
      <div className="card-head">
        <div><div className="card-title">Step Outside Your Circle</div><div className="card-sub">Meet someone different, expand your perspective.</div></div>
        <Link to="/discover" className="see-all">See more →</Link>
      </div>
      <div className="card-body stack" style={{ gap: 14 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="small bold">Match based on:</span>
          {FOCUS.map((f) => (
            <button key={f} className={`chip ${focus.includes(f) ? 'on' : ''}`} style={{ height: 30 }}
              onClick={() => setFocus((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))}>{f}</button>
          ))}
        </div>
        {loading ? <Spinner /> : !m ? (
          <Empty icon={Users2} title="No more suggestions" action={<button className="btn btn-outline btn-sm" onClick={reset}><RotateCcw size={14} />Show skipped people again</button>}>
            Try different “match based on” options.
          </Empty>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button className="icon-btn sm" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Previous"><ChevronLeft size={18} /></button>
            <div className="grow row" style={{ gap: 16, border: '1px solid var(--border)', borderRadius: 14, padding: 16, flexWrap: 'wrap' }}>
              <Link to={`/u/${m.user.handle}`}><Avatar user={m.user} size={78} /></Link>
              <div className="grow stack" style={{ gap: 4, minWidth: 180 }}>
                <Link to={`/u/${m.user.handle}`} className="bold" style={{ fontSize: 17 }}>{m.user.name}</Link>
                <div className="small muted row" style={{ gap: 6 }}><Building2 size={14} />{m.user.department} · {m.user.year} Year</div>
                <div className="small muted row" style={{ gap: 6 }}><MapPin size={14} />{m.user.region}</div>
                <div className="chips" style={{ gap: 6, marginTop: 2 }}>{[...m.user.interests, ...m.user.hobbies].slice(0, 4).map((t) => <span key={t} className="pill sm">{t}</span>)}</div>
                <div className="tiny" style={{ color: 'var(--primary-ink)' }}>{m.reasons.slice(0, 3).join(' · ')}</div>
                <div className="row" style={{ marginTop: 6 }}>
                  <button className="btn btn-primary btn-sm" style={{ minWidth: 110 }} onClick={connect}>Connect</button>
                  <button className="btn btn-outline btn-sm" style={{ minWidth: 90 }} onClick={skip}>Skip</button>
                </div>
              </div>
              <div className="match-ring" style={{ '--p': m.percent }}><div><b>{m.percent}%</b><span className="tiny muted">Match</span></div></div>
            </div>
            <button className="icon-btn sm" disabled={i >= matches.length - 1} onClick={() => setI(i + 1)} aria-label="Next"><ChevronRight size={18} /></button>
          </div>
        )}
        {m ? <div className="tiny faint" style={{ textAlign: 'center' }}>{Math.min(i, matches.length - 1) + 1} of {matches.length} suggested connections</div> : null}
      </div>
    </section>
  );
}

function CulturalBuddy() {
  const { options } = useAuth();
  const modes = options?.buddyModes || {};
  const [mode, setMode] = useState('Learn');
  const [topic, setTopic] = useState('Culture');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { api.get('/culture/buddy').then((r) => { if (r.pref) { setMode(r.pref.mode); setTopic(r.pref.topic); } }).catch(() => {}); }, []);
  const prompt = { Learn: 'Choose what you want to learn:', Teach: 'Choose what you can teach:', Experience: 'Choose what you want to experience:', Connect: 'Who do you want to connect with?' }[mode];
  const find = async () => {
    setBusy(true);
    try { const r = await api.post('/culture/buddy', { mode, topic }); setRes(r.matches); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <section className="card">
      <div className="card-head">
        <div><div className="card-title">Cultural Buddy</div><div className="card-sub">Find someone to exchange with.</div></div>
        <span className="section-icon"><Globe2 size={20} /></span>
      </div>
      <div className="card-body stack" style={{ gap: 14 }}>
        <div className="field"><span className="label">I want to…</span>
          <div className="chips">{Object.keys(modes).map((m) => <button key={m} className={`chip ${mode === m ? 'on' : ''}`} onClick={() => { setMode(m); setTopic(modes[m][0]); setRes(null); }}>{m}</button>)}</div>
        </div>
        <div className="field"><span className="label">{prompt}</span>
          <div className="chips">{(modes[mode] || []).map((t) => <button key={t} className={`chip ${topic === t ? 'on' : ''}`} onClick={() => { setTopic(t); setRes(null); }}>{t}</button>)}</div>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy} onClick={find}><Search size={16} />{busy ? 'Finding…' : 'Find Buddy'}</button>
        {res ? (res.length ? (
          <div className="stack" style={{ gap: 0 }}>
            <div className="small muted">{res.length} buddies to {mode.toLowerCase()} {topic.toLowerCase()} with</div>
            {res.slice(0, 4).map((m) => (
              <div key={m.user.id} className="list-row">
                <Link to={`/u/${m.user.handle}`}><Avatar user={m.user} size={40} /></Link>
                <div className="grow"><Link to={`/u/${m.user.handle}`} className="bold small">{m.user.name}</Link><div className="tiny muted">{m.user.region} · {m.reasons[0]}</div></div>
                <span className="pill sm green">{m.percent}%</span>
                <BuddyChat user={m.user} mode={mode} topic={topic} />
              </div>
            ))}
          </div>
        ) : <p className="small muted">No buddies match that yet — try another option.</p>) : null}
      </div>
    </section>
  );
}

function BuddyChat({ user, mode, topic }) {
  const nav = useNavigate();
  const toast = useToast();
  const draft = { Learn: `Hi ${user.name.split(' ')[0]}! I'd love to learn about ${topic.toLowerCase()} from you.`, Teach: `Hi ${user.name.split(' ')[0]}! Want to learn some ${topic.toLowerCase()}? Happy to teach.`,
    Experience: `Hi! Want to experience some ${topic.toLowerCase()} together?`, Connect: `Hi ${user.name.split(' ')[0]}! Found you through Cultural Buddy — would love to connect.` }[mode];
  return <button className="icon-btn sm" onClick={() => openDm(nav, toast, user.id, draft)} aria-label={`Message ${user.name}`}><MessageCircle size={17} /></button>;
}

function CultureProfile() {
  const { user } = useAuth();
  const nav = useNavigate();
  const rows = [['Region', user.region ? [user.region] : []], ['Languages', user.languages_spoken], ['Food', user.foods], ['Festivals', user.festivals], ['Interests', user.cultural_interests]];
  return (
    <section className="card">
      <div className="card-head"><div className="card-title">Your Culture Profile</div><button className="icon-btn sm" onClick={() => nav('/personal/edit#culture')} aria-label="Edit culture profile"><Pencil size={16} /></button></div>
      <div className="card-body stack" style={{ gap: 10 }}>
        {rows.map(([k, items]) => (
          <div key={k} className="row" style={{ alignItems: 'flex-start' }}>
            <span className="small muted" style={{ width: 80, flexShrink: 0, paddingTop: 3 }}>{k}</span>
            <div className="chips" style={{ gap: 6 }}>{items?.length ? items.map((i) => <span key={i} className="pill sm">{i}</span>) : <span className="small faint">Not added</span>}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function IcebreakerCard() {
  const nav = useNavigate();
  const toast = useToast();
  const { data } = useApi(() => api.get('/culture/icebreakers'));
  const [i, setI] = useState(0);
  const [to, setTo] = useState('');
  const list = data?.icebreakers || [];
  const people = data?.people || [];
  useEffect(() => { const first = data?.people?.[0]; if (first && !to) setTo(String(first.id)); }, [data, to]);
  if (!list.length) return null;
  const q = list[i % list.length];
  return (
    <section className="card">
      <div className="card-head">
        <div className="row" style={{ gap: 12 }}><span className="section-icon"><Snowflake size={20} /></span><div><div className="card-title">Cultural Icebreaker</div><div className="card-sub">Try asking…</div></div></div>
      </div>
      <div className="card-body stack" style={{ gap: 12 }}>
        <div className="bold" style={{ fontSize: 16, textAlign: 'center', padding: '6px 10px' }}>“{q.question}”</div>
        {people.length ? (
          <select className="select" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Ask whom">
            {people.map((p) => <option key={p.id} value={p.id}>Ask {p.name} ({p.region})</option>)}
          </select>
        ) : <p className="tiny muted">Connect with someone first to use icebreakers.</p>}
        <div className="row">
          <button className="btn btn-primary grow" disabled={!to} onClick={() => openDm(nav, toast, to, q.question)}><Search size={15} />Use Question</button>
          <button className="btn btn-outline" onClick={() => setI(i + 1)}>Skip</button>
        </div>
        <button className="btn btn-soft btn-sm" disabled={!to} onClick={() => openDm(nav, toast, to)}><MessageCircle size={15} />Start Chat</button>
        <p className="tiny faint" style={{ textAlign: 'center' }}>We'll suggest more questions based on your cultures when you connect.</p>
      </div>
    </section>
  );
}

export default function Culture() {
  const [storyCat, setStoryCat] = useState('');
  const [composer, setComposer] = useState(false);
  const [teach, setTeach] = useState(false);
  const { options } = useAuth();
  const events = useApi(() => api.get('/activities?cultural=1&kind=event'));
  const teachList = useApi(() => api.get('/activities?kind=teach'));
  const comms = useApi(() => api.get('/communities?cultural=1'));
  const stories = useApi(() => api.get(`/posts${qs({ kind: 'story', tab: 'latest', category: storyCat })}`), [storyCat]);
  const patch = (h) => (item) => h.setData((d) => {
    const key = Object.keys(d)[0];
    return { ...d, [key]: d[key].map((x) => (x.id === item.id ? { ...x, ...item } : x)) };
  });
  const rowEmpty = (h, list, text) => (h.loading ? <Spinner /> : list?.length ? null : text);

  return (
    <div className="page">
      <div className="stack" style={{ gap: 22 }}>
        <CultureOfWeek />
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <StepOutside />
          <CulturalBuddy />
        </div>
        <div>
          <Row title="Cultural Exchange Events" icon={CalendarDays} sub="Food swaps, language exchanges, music nights and more"
            action={<Link to="/discover?category=Culture" className="see-all">View all →</Link>}
            empty={rowEmpty(events, events.data?.activities, 'No cultural events scheduled.')}>
            {(events.data?.activities || []).map((a) => <ActivityCard key={a.id} activity={a} onChange={patch(events)} showReason={false} />)}
          </Row>
          <Row title="Teach Me Something" icon={GraduationCap} sub="Short sessions where students teach a language, dish, dance or tradition"
            action={<button className="btn btn-soft btn-sm" onClick={() => setTeach(true)}><Plus size={15} />Teach something</button>}
            empty={rowEmpty(teachList, teachList.data?.activities, 'No sessions yet — be the first to teach!')}>
            {(teachList.data?.activities || []).map((a) => <ActivityCard key={a.id} activity={a} onChange={patch(teachList)} showReason={false} />)}
          </Row>
          <Row title="Cultural Communities" icon={Users2} size="sm" action={<Link to="/discover?tab=communities" className="see-all">View all →</Link>}
            empty={rowEmpty(comms, comms.data?.communities, 'No cultural communities yet.')}>
            {(comms.data?.communities || []).map((c) => <CommunityTile key={c.id} community={c} onChange={patch(comms)} />)}
          </Row>
        </div>
        <div className="with-rail">
          <section className="card">
            <div className="card-head">
              <div className="row" style={{ gap: 12 }}><span className="section-icon"><BookHeart size={20} /></span><div className="card-title">Cultural Stories / Mini Cards</div></div>
              <button className="btn btn-primary btn-sm" onClick={() => setComposer(true)}><Plus size={15} />Share your story</button>
            </div>
            <div className="card-body stack" style={{ gap: 14 }}>
              <div className="chips">
                <button className={`chip ${!storyCat ? 'on' : ''}`} style={{ height: 30 }} onClick={() => setStoryCat('')}>All</button>
                {(options?.storyCategories || []).map((c) => <button key={c} className={`chip ${storyCat === c ? 'on' : ''}`} style={{ height: 30 }} onClick={() => setStoryCat(c)}>{c}</button>)}
              </div>
              {stories.loading ? <Spinner /> : stories.data?.posts.length ? (
                <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {stories.data.posts.map((p) => <StoryCard key={p.id} post={p} onChange={patch(stories)} />)}
                </div>
              ) : <Empty title="No stories here yet">Share something from your culture!</Empty>}
            </div>
          </section>
          <aside className="rail" style={{ position: 'static' }}>
            <IcebreakerCard />
            <CultureProfile />
          </aside>
        </div>
      </div>
      {composer ? <CreatePostModal kind="story" onClose={() => setComposer(false)} onCreated={(p) => stories.setData((d) => ({ ...d, posts: [p, ...d.posts] }))} /> : null}
      {teach ? <AddEventModal preset={{ kind: 'teach', type: 'Cultural' }} onClose={() => setTeach(false)} onCreated={(a) => teachList.setData((d) => ({ ...d, activities: [a, ...d.activities] }))} /> : null}
    </div>
  );
}
