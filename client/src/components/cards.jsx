import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Users, Sparkles, Check, UserPlus, MessageCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { useAuth } from '../lib/auth.jsx';
import { eventDate, eventTime, compact } from '../lib/format.js';
import { Avatar, Cover } from './ui.jsx';

const KIND_COLOR = { study: '#4f46e5', project: '#0891b2', sports: '#16a34a', event: '#ea580c', teach: '#db2777' };
export const kindColor = (a) => (a.is_cultural_exchange && a.kind === 'event' ? '#f97316' : KIND_COLOR[a.kind] || '#1f6feb');

const JOIN_LABEL = { study: 'Request to Join', project: 'Apply to Join', sports: 'Join Group', teach: 'Learn', event: 'Join Event' };

/**
 * 3D tilt for cards: the card leans toward the cursor, a glare follows it and inner layers
 * (the emoji "art") shift for parallax. Sets CSS variables only — no re-renders.
 */
export function useTilt(max = 12) {
  const ref = useRef(null);
  const onPointerMove = (e) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - y) * max}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * max}deg`);
    el.style.setProperty('--px', (x - 0.5).toFixed(3));
    el.style.setProperty('--py', (y - 0.5).toFixed(3));
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
  };
  const onPointerLeave = () => {
    const el = ref.current;
    if (!el) return;
    for (const [k, v] of [['--rx', '0deg'], ['--ry', '0deg'], ['--px', 0], ['--py', 0]]) el.style.setProperty(k, v);
  };
  return { ref, onPointerMove, onPointerLeave };
}

/** Join / apply button that understands every membership state. */
export function JoinButton({ activity, onChange, size = 'sm', block, tone = 'primary' }) {
  const toast = useToast();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const a = activity;
  const cls = `btn btn-${size} ${block ? 'btn-block' : ''}`;
  if (a.status === 'completed') return <button className={`${cls} btn-outline`} disabled>Completed</button>;
  if (a.creator_id === user?.id) return <Link to={`/activity/${a.id}`} className={`${cls} btn-soft`}>Manage</Link>;

  const join = async (e) => {
    e?.stopPropagation();
    setBusy(true);
    try {
      const r = await api.post(`/activities/${a.id}/apply`);
      onChange?.({ ...a, my_status: r.status, participants: a.participants + (r.status === 'accepted' ? 1 : 0), openings: a.openings - (r.status === 'accepted' ? 1 : 0) });
      toast(r.status === 'accepted' ? `You're in! Group chat unlocked for “${a.title}”.` : 'Request sent — the organiser will review it.');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const leave = async (e) => {
    e?.stopPropagation();
    if (!window.confirm(a.my_status === 'pending' ? 'Withdraw your request?' : `Leave “${a.title}”?`)) return;
    setBusy(true);
    try {
      await api.del(`/activities/${a.id}/apply`);
      onChange?.({ ...a, my_status: null, participants: a.participants - (a.my_status === 'accepted' ? 1 : 0), openings: a.openings + (a.my_status === 'accepted' ? 1 : 0) });
      toast('Done');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  if (a.my_status === 'accepted') return <button className={`${cls} btn-success-soft`} disabled={busy} onClick={leave} title="Click to leave"><Check size={15} />Joined</button>;
  if (a.my_status === 'pending') return <button className={`${cls} btn-soft`} disabled={busy} onClick={leave} title="Click to withdraw">Requested</button>;
  if (a.my_status === 'rejected') return <button className={`${cls} btn-outline`} disabled>Not selected</button>;
  if (a.openings <= 0) return <button className={`${cls} btn-outline`} disabled>Full</button>;
  return <button className={`${cls} btn-${tone}`} disabled={busy} onClick={join}>{JOIN_LABEL[a.kind] || 'Join'}</button>;
}

export function ActivityMeta({ a, people = true }) {
  return (
    <>
      <div className="meta-line"><CalendarDays size={13} />{eventDate(a.date)}<span className="dot-sep" style={{ marginLeft: -2 }} /><Clock size={13} />{eventTime(a.time)}</div>
      <div className="meta-line"><MapPin size={13} />{a.location}{people ? <><span className="dot-sep" /><Users size={13} />{a.participants}/{a.capacity}</> : null}</div>
    </>
  );
}

/**
 * Poster card for an activity (study group, project, sports group, event, teach session).
 * Hover/focus: the card tilts in 3D, the emoji lifts with parallax, and the details drawer
 * (reason, spots left, Join) slides up. On touch screens the drawer is always open.
 */
export function ActivityCard({ activity, onChange, showReason = true }) {
  const a = activity;
  const nav = useNavigate();
  const tilt = useTilt();
  const status = a.my_status === 'accepted' ? 'Joined' : a.my_status === 'pending' ? 'Requested' : null;
  const fill = a.capacity ? Math.min(100, Math.round((a.participants / a.capacity) * 100)) : 0;
  return (
    <article className="poster" style={{ '--c': kindColor(a) }} {...tilt}>
      <div className="poster-inner" onClick={() => nav(`/activity/${a.id}`)}>
        <div className="poster-art" aria-hidden="true"><span className="poster-emoji">{a.emoji}</span></div>
        <span className="poster-glare" aria-hidden="true" />
        <span className="tile-tag">{a.category}</span>
        {status ? <span className="tile-tag right ok"><Check size={12} />{status}</span>
          : a.level && a.kind !== 'event' ? <span className="tile-tag right">{a.level}</span> : null}
        <div className="poster-panel">
          <Link to={`/activity/${a.id}`} className="poster-title" onClick={(e) => e.stopPropagation()}>{a.title}</Link>
          <div className="meta-line"><CalendarDays size={13} />{eventDate(a.date)}<span className="dot-sep" style={{ marginLeft: -2 }} />{eventTime(a.time)}</div>
          <div className="poster-more">
            <div>
              <div className="meta-line"><MapPin size={13} />{a.location}</div>
              {a.kind === 'teach' && a.creator ? <div className="tiny muted">By {a.creator.name}</div> : null}
              {a.kind === 'project' && a.looking_for?.length ? <div className="tiny"><span className="muted">Looking for </span>{a.looking_for.join(', ')}</div> : null}
              {showReason && a.reasons?.length ? <span className="reason"><Sparkles size={11} /><span className="ellipsis">{a.reasons[0]}</span></span> : null}
              <div className="cap-bar" title={`${a.participants} of ${a.capacity} spots taken`}><i style={{ width: `${fill}%` }} /></div>
              <div className="tiny muted">{a.participants}/{a.capacity} going{a.openings > 0 ? ` · ${a.openings} spots left` : ''}</div>
              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }}><JoinButton activity={a} onChange={onChange} block /></div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Row variant used in sidebars / lists. */
export function ActivityRow({ activity: a, right, onClick }) {
  const nav = useNavigate();
  return (
    <div className="list-row clickable" onClick={onClick || (() => nav(`/activity/${a.id}`))} style={{ padding: '10px 6px' }}>
      <Cover emoji={a.emoji} color={kindColor(a)} size={48} radius={12} />
      <div className="grow">
        <div className="bold ellipsis">{a.title}</div>
        <div className="small muted ellipsis">{eventDate(a.date)}{a.time ? ` · ${eventTime(a.time)}` : ''} · {a.location}</div>
      </div>
      {right}
    </div>
  );
}

/** Community poster with Join / Leave. */
export function CommunityTile({ community: c, onChange }) {
  const toast = useToast();
  const nav = useNavigate();
  const tilt = useTilt();
  const [busy, setBusy] = useState(false);
  const toggle = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      if (c.joined) { await api.del(`/communities/${c.id}/join`); toast(`Left ${c.name}`); }
      else { await api.post(`/communities/${c.id}/join`); toast(`Joined ${c.name} — say hi in the community chat!`); }
      onChange?.({ ...c, joined: !c.joined, member_count: c.member_count + (c.joined ? -1 : 1) });
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <article className="poster poster-sm" style={{ '--c': c.color }} {...tilt}>
      <div className="poster-inner" onClick={() => nav(`/community/${c.id}`)}>
        <div className="poster-art" aria-hidden="true"><span className="poster-emoji">{c.emoji}</span></div>
        <span className="poster-glare" aria-hidden="true" />
        {c.category ? <span className="tile-tag">{c.category}</span> : null}
        {c.joined ? <span className="tile-tag right ok"><Check size={12} />Joined</span> : null}
        <div className="poster-panel">
          <div className="poster-title ellipsis">{c.name}</div>
          <div className="tiny muted ellipsis">{compact(c.member_count)} members{c.reasons?.[0] ? ` · ${c.reasons[0]}` : ''}</div>
          <div className="poster-more">
            <div>
              <button className={`btn btn-sm btn-block ${c.joined ? 'btn-outline' : 'btn-primary'}`} style={{ marginTop: 4 }} disabled={busy} onClick={toggle}>
                {c.joined ? 'Leave community' : 'Join community'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Person suggestion: profile-style card with match ring, reasons, Connect / Message. */
export function PersonCard({ match, onConnected, compactView }) {
  const toast = useToast();
  const nav = useNavigate();
  const tilt = useTilt(8);
  const [state, setState] = useState('none');
  const u = match.user;
  const connect = async () => {
    try { const r = await api.post(`/users/${u.id}/friend`); setState(r.friendship); toast(r.friendship === 'friends' ? `You and ${u.name} are now friends` : 'Friend request sent'); onConnected?.(u); } catch (e) { toast(e.message, 'error'); }
  };
  const message = async () => {
    try { const r = await api.post(`/chats/dm/${u.id}`); nav(`/chats?c=${r.conversation_id}`); } catch (e) { toast(e.message, 'error'); }
  };
  if (compactView) {
    return (
      <div className="list-row">
        <Link to={`/u/${u.handle}`}><Avatar user={u} size={40} /></Link>
        <div className="grow"><Link to={`/u/${u.handle}`} className="bold">{u.name}</Link><div className="tiny muted">{u.year} Yr · {u.department} · {u.region}</div></div>
        {typeof match.percent === 'number' ? <span className="pill sm green">{match.percent}%</span> : null}
      </div>
    );
  }
  return (
    <article className="person-card" {...tilt}>
      <div className="person-inner">
        <span className="poster-glare" aria-hidden="true" />
        <div className="person-band" />
        <div className="person-top">
          <Link to={`/u/${u.handle}`} className="person-avatar"><Avatar user={u} size={68} online={u.online} /></Link>
          {typeof match.percent === 'number' ? (
            <div className="match-ring sm" style={{ '--p': match.percent }} title={`${match.percent}% match`}><div><b>{match.percent}%</b></div></div>
          ) : null}
        </div>
        <Link to={`/u/${u.handle}`} className="person-name">{u.name}</Link>
        <div className="tiny muted">{[u.year && `${u.year} Yr`, u.department, u.region].filter(Boolean).join(' · ')}</div>
        {match.reasons?.length ? <div className="person-reasons">{match.reasons.slice(0, 2).map((r) => <span key={r}>{r}</span>)}</div> : null}
        <div className="row" style={{ marginTop: 'auto', paddingTop: 10, gap: 8 }}>
          <button className="btn btn-sm btn-primary grow" disabled={state !== 'none'} onClick={connect}><UserPlus size={15} />{state === 'none' ? 'Connect' : state === 'friends' ? 'Friends' : 'Requested'}</button>
          <button className="btn btn-sm btn-outline" onClick={message} aria-label={`Message ${u.name}`}><MessageCircle size={15} /></button>
        </div>
      </div>
    </article>
  );
}
