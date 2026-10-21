import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  MessagesSquare, Users2, UsersRound, Search, MoreVertical, Plus, Smile, Image as ImageIcon, Send, CheckCheck, Flag, UserRound, ArrowLeft,
  SmilePlus, ChevronRight, Info, CalendarDays, X, LogOut, Ban,
} from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { getSocket, onSocket } from '../lib/socket.js';
import { chatStamp, clock, dayLabel, eventDate, toDate } from '../lib/format.js';
import { Avatar, Cover, Dropdown, Empty, Img, Spinner } from '../components/ui.jsx';
import Scene3D from '../components/Scene3D.jsx';
import { kindColor } from '../components/cards.jsx';
import ReportModal from '../components/ReportModal.jsx';

const TABS = [
  { value: 'dm', label: 'Direct Messages', icon: MessagesSquare },
  { value: 'community', label: 'Communities', icon: Users2 },
  { value: 'group', label: 'Groups', icon: UsersRound },
];
const QUICK = ['👍', '❤️', '😂', '🎉', '😮', '🙏'];
const EMOJIS = ['😀', '😂', '😊', '😍', '🥳', '😎', '🤔', '😅', '👍', '🙏', '👏', '🙌', '🔥', '✨', '🎉', '❤️', '💯', '📚', '💻', '⚽', '🎶', '🍛', '📷', '🌏'];

function ConvAvatar({ c, size = 48 }) {
  if (c.type === 'dm') return <Avatar user={c.partner} size={size} />;
  if (c.type === 'community') return <Cover emoji={c.community?.emoji} color={c.community?.color} size={size} radius={12} />;
  return <Cover emoji={c.activity?.emoji || '👥'} color={c.activity ? kindColor(c.activity) : '#1f6feb'} size={size} radius={12} />;
}

function ConversationList({ type, activeId, onOpen, refreshKey }) {
  const [list, setList] = useState(null);
  const [term, setTerm] = useState('');
  useEffect(() => {
    let alive = true;
    api.get(`/chats${qs({ type })}`).then((r) => alive && setList(r.conversations));
    return () => { alive = false; };
  }, [type, refreshKey]);
  const shown = (list || []).filter((c) => c.name?.toLowerCase().includes(term.toLowerCase()) || c.last_message?.content?.toLowerCase().includes(term.toLowerCase()));
  const label = { dm: 'messages', community: 'communities', group: 'groups' }[type];
  return (
    <div className="chat-list">
      <div style={{ padding: 14 }}>
        <div className="input-icon"><Search size={17} /><input className="input" style={{ background: 'var(--surface-2)', borderColor: 'transparent' }} placeholder={`Search ${label}…`} value={term} onChange={(e) => setTerm(e.target.value)} /></div>
      </div>
      <div className="chat-list-items">
        {!list ? <Spinner /> : !shown.length ? (
          <Empty icon={MessagesSquare} title={term ? 'No matches' : `No ${label} yet`}>
            {type === 'dm' ? 'Start a chat from someone’s profile.' : type === 'community' ? 'Join a community to chat with members.' : 'Join an event or group to unlock its chat.'}
          </Empty>
        ) : shown.map((c) => (
          <div key={c.id} className={`chat-item ${c.id === activeId ? 'on' : ''}`} onClick={() => onOpen(c.id)}>
            <ConvAvatar c={c} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row between"><span className="bold ellipsis">{c.name}</span><span className="tiny faint" style={{ flexShrink: 0 }}>{c.last_message ? chatStamp(c.last_message.created_at) : ''}</span></div>
              <div className="row between" style={{ gap: 8 }}>
                <span className="small muted ellipsis">{c.last_message ? `${c.type !== 'dm' ? `${c.last_message.sender_name.split(' ')[0]}: ` : ''}${c.last_message.content}` : `${c.member_count} members`}</span>
                {c.unread && c.id !== activeId ? <span className="badge">{c.unread}</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Message({ m, mine, showSender, isGroup, partnerReadAll, onReact, onReport }) {
  const [picker, setPicker] = useState(false);
  return (
    <div className={`msg ${mine ? 'mine' : ''}`}>
      {!mine ? <Link to={`/u/${m.sender.handle}`} style={{ visibility: showSender ? 'visible' : 'hidden' }}><Avatar user={m.sender} size={34} /></Link> : null}
      <div style={{ minWidth: 0 }}>
        {!mine && isGroup && showSender ? <div className="tiny bold" style={{ marginBottom: 2 }}>{m.sender.name.split(' ')[0]} <span className="faint" style={{ fontWeight: 400 }}>{clock(m.created_at)}</span></div> : null}
        <div className="bubble">
          {m.content}
          {m.image ? <a href={m.image} target="_blank" rel="noreferrer"><Img src={m.image} /></a> : null}
        </div>
        {m.reactions.length ? (
          <div className="reactions">{m.reactions.map((r) => <button key={r.emoji} className={`reaction ${r.mine ? 'mine' : ''}`} onClick={() => onReact(m, r.emoji)}>{r.emoji} {r.count}</button>)}</div>
        ) : null}
        {!(isGroup && !mine) ? <div className="msg-meta">{clock(m.created_at)}{mine ? <CheckCheck size={14} color={partnerReadAll ? 'var(--primary)' : 'var(--text-3)'} /> : null}</div> : null}
      </div>
      <div className="msg-tools" style={{ position: 'relative' }}>
        <button className="icon-btn sm" onClick={() => setPicker((p) => !p)} aria-label="React"><SmilePlus size={16} /></button>
        {!mine ? <button className="icon-btn sm" onClick={() => onReport(m)} aria-label="Report message"><Flag size={15} /></button> : null}
        {picker ? (
          <div className="emoji-pop" style={{ gridTemplateColumns: 'repeat(6, 32px)', bottom: 36, right: mine ? 'auto' : 0, left: mine ? 0 : 'auto' }} onMouseLeave={() => setPicker(false)}>
            {QUICK.map((e) => <button key={e} onClick={() => { onReact(m, e); setPicker(false); }}>{e}</button>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Composer({ convId, disabled, initial, onSent }) {
  const toast = useToast();
  const { user } = useAuth();
  const [text, setText] = useState(initial || '');
  const [file, setFile] = useState(null);
  const [emoji, setEmoji] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const lastTyping = useRef(0);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => setText(initial || ''), [convId, initial]);

  const send = async (e) => {
    e?.preventDefault();
    if ((!text.trim() && !file) || busy) return;
    const fd = new FormData();
    fd.append('content', text.trim());
    if (file) fd.append('image', file);
    setBusy(true);
    try { const r = await api.post(`/chats/${convId}/messages`, fd); setText(''); setFile(null); onSent(r.message); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const typing = (v) => {
    setText(v);
    if (Date.now() - lastTyping.current > 2000) { lastTyping.current = Date.now(); getSocket()?.emit('typing', { conversation_id: convId, name: user.name.split(' ')[0] }); }
  };

  if (disabled) return <div className="composer muted small" style={{ justifyContent: 'center' }}><Ban size={16} />You can't message this user.</div>;
  return (
    <form className="composer" onSubmit={send} style={{ flexWrap: 'wrap' }}>
      {preview ? (
        <div className="row" style={{ width: '100%' }}>
          <img src={preview} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFile(null)}><X size={14} />Remove</button>
        </div>
      ) : null}
      <button type="button" className="icon-btn" style={{ border: '1px solid var(--border)', borderRadius: '50%' }} onClick={() => fileRef.current.click()} aria-label="Attach"><Plus size={20} /></button>
      <div className="grow" style={{ position: 'relative' }}>
        <input className="input" placeholder="Type a message…" value={text} onChange={(e) => typing(e.target.value)} style={{ paddingRight: 90 }} />
        <div className="row" style={{ position: 'absolute', right: 6, top: 7, gap: 0 }}>
          <button type="button" className="icon-btn sm" onClick={() => setEmoji((x) => !x)} aria-label="Emoji"><Smile size={19} /></button>
          <button type="button" className="icon-btn sm" onClick={() => fileRef.current.click()} aria-label="Send image"><ImageIcon size={19} /></button>
        </div>
        {emoji ? (
          <div className="emoji-pop" onMouseLeave={() => setEmoji(false)}>
            {EMOJIS.map((x) => <button type="button" key={x} onClick={() => setText((t) => t + x)}>{x}</button>)}
          </div>
        ) : null}
      </div>
      <button className="btn btn-primary" style={{ height: 46, width: 46, padding: 0, borderRadius: 14 }} disabled={busy || (!text.trim() && !file)} aria-label="Send"><Send size={18} /></button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]); e.target.value = ''; }} />
    </form>
  );
}

function InfoPanel({ conv, onLeft, onChanged }) {
  const nav = useNavigate();
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const [comm, setComm] = useState(null);
  const [allMembers, setAllMembers] = useState(false);
  useEffect(() => {
    setComm(null);
    if (conv.type === 'community') api.get(`/communities/${conv.community.id}`).then(setComm).catch(() => {});
  }, [conv.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const members = allMembers ? conv.members : conv.members.slice(0, 5);
  const MemberList = (
    <div className="card">
      <div className="card-head"><div className="card-title">Members ({conv.member_count})</div>{conv.members.length > 5 ? <button className="see-all" onClick={() => setAllMembers(!allMembers)}>{allMembers ? 'Less' : 'See all'}</button> : null}</div>
      <div className="card-body" style={{ paddingTop: 0 }}>
        {members.map((m) => (
          <Link key={m.id} to={`/u/${m.handle}`} className="list-row clickable" style={{ padding: '8px 4px' }}>
            <Avatar user={m} size={38} />
            <div className="grow"><div className="small bold">{m.name}</div><div className="tiny muted">{m.year} Yr · {m.department}</div></div>
            {m.role === 'admin' ? <span className="pill sm">Admin</span> : null}
          </Link>
        ))}
      </div>
    </div>
  );
  const Media = conv.media.length ? (
    <div className="card">
      <div className="card-head"><div className="card-title">Media, Links and Files</div></div>
      <div className="card-body"><div className="media-grid">{conv.media.slice(0, 4).map((src) => <a key={src} href={src} target="_blank" rel="noreferrer"><Img src={src} /></a>)}</div></div>
    </div>
  ) : null;

  if (conv.type === 'dm') {
    const p = conv.partner;
    return (
      <div className="stack chat-side" style={{ overflowY: 'auto', minHeight: 0 }}>
        <div className="card card-pad stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 14 }}>
            <Avatar user={p} size={80} online={false} />
            <div><div className="bold" style={{ fontSize: 19 }}>{p.name}</div><div className="muted small">{p.year} Year · {p.department}</div>
              <div className="small row" style={{ gap: 6, color: p.online ? 'var(--success)' : 'var(--text-3)' }}><span style={{ width: 8, height: 8, borderRadius: 9, background: p.online ? 'var(--online)' : 'var(--text-3)' }} />{p.online ? 'Online' : 'Offline'}</div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'space-around' }}>
            <button className="stack btn-ghost" style={{ border: 0, background: 'none', alignItems: 'center', gap: 4 }} onClick={() => nav(`/u/${p.handle}`)}><span className="section-icon" style={{ borderRadius: '50%' }}><UserRound size={19} /></span><span className="small muted">Profile</span></button>
            <button className="stack" style={{ border: 0, background: 'none', alignItems: 'center', gap: 4 }} onClick={() => document.getElementById('chat-search-toggle')?.click()}><span className="section-icon" style={{ borderRadius: '50%' }}><Search size={19} /></span><span className="small muted">Search</span></button>
            <button className="stack" style={{ border: 0, background: 'none', alignItems: 'center', gap: 4 }} onClick={() => setReporting(true)}><span className="section-icon" style={{ borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-2)' }}><MoreVertical size={19} /></span><span className="small muted">Block / Report</span></button>
          </div>
          {conv.profile?.bio ? <div><div className="bold" style={{ marginBottom: 4 }}>About</div><p className="small muted">{conv.profile.bio}</p></div> : null}
          {conv.profile?.interests?.length ? <div className="chips">{conv.profile.interests.map((t) => <span key={t} className="pill sm">{t}</span>)}</div> : null}
        </div>
        {Media}
        {conv.sharedEvents?.length ? (
          <div className="card"><div className="card-head"><div className="card-title">Shared Events</div></div>
            <div className="card-body" style={{ paddingTop: 0 }}>
              {conv.sharedEvents.map((a) => (
                <Link key={a.id} to={`/activity/${a.id}`} className="list-row clickable" style={{ padding: '8px 4px' }}>
                  <Cover emoji={a.emoji} color={kindColor(a)} size={42} radius={10} />
                  <div className="grow"><div className="small bold ellipsis">{a.title}</div><div className="tiny muted">{eventDate(a.date)} · {a.location}</div></div><ChevronRight size={16} className="faint" />
                </Link>
              ))}
            </div></div>
        ) : null}
        {conv.sharedGroups?.length ? (
          <div className="card"><div className="card-head"><div className="card-title">Shared Groups</div></div>
            <div className="card-body" style={{ paddingTop: 0 }}>
              {conv.sharedGroups.map((c) => (
                <Link key={c.id} to={`/community/${c.id}`} className="list-row clickable" style={{ padding: '8px 4px' }}>
                  <Cover emoji={c.emoji} color={c.color} size={42} radius={10} />
                  <div className="grow"><div className="small bold">{c.name}</div><div className="tiny muted">{c.member_count} members</div></div><ChevronRight size={16} className="faint" />
                </Link>
              ))}
            </div></div>
        ) : null}
        {reporting ? <ReportModal type="user" id={p.id} blockUser={p} onClose={() => setReporting(false)} onBlocked={onChanged} /> : null}
      </div>
    );
  }

  const isComm = conv.type === 'community';
  const c = isComm ? conv.community : null;
  const a = conv.activity;
  const leave = async () => {
    if (!window.confirm(`Leave ${conv.name}?`)) return;
    try {
      if (isComm) await api.del(`/communities/${c.id}/join`); else await api.del(`/activities/${a.id}/apply`);
      toast(`Left ${conv.name}`); onLeft();
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <div className="stack chat-side" style={{ overflowY: 'auto', minHeight: 0 }}>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ height: 90, background: `linear-gradient(120deg, ${isComm ? c.color : kindColor(a)}, ${isComm ? c.color : kindColor(a)}88)`, display: 'grid', placeItems: 'center', fontSize: 44 }}>{isComm ? c.emoji : a.emoji}</div>
        <div className="card-pad stack" style={{ gap: 12 }}>
          <div className="row between">
            <div><div className="bold" style={{ fontSize: 18 }}>{conv.name}</div><div className="small muted">{conv.member_count} members · {isComm ? 'Public community' : eventDate(a.date)}</div></div>
            <Dropdown trigger={({ toggle }) => <button className="btn btn-soft btn-sm" onClick={toggle}>Joined</button>}>
              <button className="menu-item danger" onClick={leave}><LogOut size={16} />Leave {isComm ? 'community' : 'group'}</button>
              <button className="menu-item" onClick={() => setReporting(true)}><Flag size={16} />Report {isComm ? 'community' : 'group'}</button>
            </Dropdown>
          </div>
          {isComm ? <p className="small muted">{c.description}</p> : <p className="small muted">{a.description}</p>}
          {isComm ? <div className="chips">{c.tags.map((t) => <span key={t} className="pill sm">{t}</span>)}</div> : null}
          <div>
            <div className="info-row" onClick={() => nav(isComm ? `/community/${c.id}` : `/activity/${a.id}`)}><Info size={18} />{isComm ? 'About' : 'Group Info'}<ChevronRight size={16} /></div>
            <div className="info-row" onClick={() => setAllMembers(true)}><Users2 size={18} />Members ({conv.member_count})<ChevronRight size={16} /></div>
            <div className="info-row" onClick={() => nav(isComm ? `/community/${c.id}` : `/activity/${a.id}`)}><CalendarDays size={18} />Events<ChevronRight size={16} /></div>
          </div>
        </div>
      </div>
      {isComm && comm?.events?.length ? (
        <div className="card"><div className="card-head"><div className="card-title">Upcoming Events</div></div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            {comm.events.slice(0, 3).map((e) => (
              <Link key={e.id} to={`/activity/${e.id}`} className="list-row clickable" style={{ padding: '8px 4px' }}>
                <Cover emoji={e.emoji} color={kindColor(e)} size={42} radius={10} />
                <div className="grow"><div className="small bold ellipsis">{e.title}</div><div className="tiny muted">{eventDate(e.date)} · {e.location}</div></div><ChevronRight size={16} className="faint" />
              </Link>
            ))}
          </div></div>
      ) : null}
      {Media}
      {MemberList}
      {reporting ? <ReportModal type={isComm ? 'community' : 'activity'} id={isComm ? c.id : a.id} onClose={() => setReporting(false)} /> : null}
    </div>
  );
}

function ChatWindow({ convId, draft, onBack, onActivity, onLeft, onInfo }) {
  const { user, refreshUnread } = useAuth();
  const [conv, setConv] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [typingName, setTypingName] = useState('');
  const [reportMsg, setReportMsg] = useState(null);
  const [search, setSearch] = useState(null);
  const scroller = useRef(null);
  const stick = useRef(true);

  const loadConv = () => api.get(`/chats/${convId}`).then((r) => setConv(r.conversation));
  const loadMsgs = () => api.get(`/chats/${convId}/messages`).then((r) => { setMsgs(r.messages); setHasMore(r.hasMore); refreshUnread(); });

  useEffect(() => {
    setConv(null); setMsgs(null); setSearch(null); stick.current = true;
    loadConv(); loadMsgs();
  }, [convId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const offMsg = onSocket('message', (m) => {
      if (m.conversation_id !== convId) return;
      setMsgs((x) => (x && !x.some((y) => y.id === m.id) ? [...x, m] : x));
      setTypingName('');
      api.post(`/chats/${convId}/read`).then(refreshUnread);
    });
    const offReact = onSocket('reaction', (r) => { if (r.conversation_id === convId) loadMsgs(); });
    let t;
    const offTyping = onSocket('typing', (e) => {
      if (e.conversation_id !== convId || e.user_id === user.id) return;
      setTypingName(e.name); clearTimeout(t); t = setTimeout(() => setTypingName(''), 3000);
    });
    return () => { offMsg(); offReact(); offTyping(); clearTimeout(t); };
  }, [convId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, typingName]);

  const older = async () => {
    const el = scroller.current;
    const h = el.scrollHeight;
    const r = await api.get(`/chats/${convId}/messages?before=${msgs[0].id}`);
    stick.current = false;
    setMsgs((x) => [...r.messages, ...x]);
    setHasMore(r.hasMore);
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - h; });
  };
  const react = async (m, emoji) => {
    const r = await api.post(`/messages/${m.id}/react`, { emoji });
    setMsgs((x) => x.map((y) => (y.id === m.id ? r.message : y)));
  };

  useEffect(() => { onInfo(conv ? { conv, onLeft, onChanged: () => { loadConv(); loadMsgs(); } } : null); }, [conv]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!conv || !msgs) return <div className="chat-main"><Spinner /></div>;
  const isGroup = conv.type !== 'dm';
  const shown = search ? msgs.filter((m) => m.content.toLowerCase().includes(search.toLowerCase())) : msgs;

  return (
    <>
      <div className="chat-main">
        <div className="chat-head">
          <button className="icon-btn sm mobile-only" onClick={onBack} aria-label="Back"><ArrowLeft size={18} /></button>
          <ConvAvatar c={conv} size={46} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold ellipsis" style={{ fontSize: 16 }}>{conv.name}</div>
            <div className="small muted">
              {typingName ? <span style={{ color: 'var(--primary)' }}>{typingName} is typing…</span>
                : conv.type === 'dm' ? (conv.partner?.online ? 'Online' : 'Offline') : `${conv.member_count} members${conv.type === 'community' ? ' · Public Community' : ''}`}
            </div>
          </div>
          <button className="icon-btn" id="chat-search-toggle" onClick={() => setSearch(search === null ? '' : null)} aria-label="Search in chat"><Search size={20} /></button>
          <Dropdown trigger={({ toggle }) => <button className="icon-btn" onClick={toggle} aria-label="Chat options"><MoreVertical size={20} /></button>}>
            {conv.type === 'dm' ? <Link to={`/u/${conv.partner.handle}`} className="menu-item"><UserRound size={16} />View profile</Link> : null}
            {conv.type === 'community' ? <Link to={`/community/${conv.community.id}`} className="menu-item"><Info size={16} />Community page</Link> : null}
            {conv.type === 'group' ? <Link to={`/activity/${conv.activity.id}`} className="menu-item"><Info size={16} />Group info</Link> : null}
          </Dropdown>
        </div>
        {search !== null ? (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
            <div className="input-icon"><Search size={16} /><input className="input" autoFocus placeholder="Search in conversation…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
        ) : null}
        <div className="chat-msgs" ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
          {hasMore && !search ? <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={older}>Load earlier messages</button> : null}
          {!shown.length ? <Empty icon={MessagesSquare} title={search ? 'No messages match' : 'No messages yet'}>{search ? '' : 'Say hello 👋'}</Empty> : null}
          {shown.map((m, i) => {
            const prev = shown[i - 1];
            const newDay = !prev || toDate(prev.created_at).toDateString() !== toDate(m.created_at).toDateString();
            const showSender = !prev || prev.sender.id !== m.sender.id || newDay;
            return (
              <Fragment key={m.id}>
                {newDay ? <div className="day-sep">{dayLabel(m.created_at)}</div> : null}
                <div style={{ marginTop: showSender && i ? 8 : 0, display: 'flex', flexDirection: 'column' }}>
                  <Message m={m} mine={m.sender.id === user.id} showSender={showSender} isGroup={isGroup} partnerReadAll={conv.type === 'dm' && m.id <= (conv.partner_last_read_id || 0)} onReact={react} onReport={setReportMsg} />
                </div>
              </Fragment>
            );
          })}
        </div>
        <Composer convId={convId} initial={draft} disabled={conv.blocked}
          onSent={(m) => { stick.current = true; setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m])); onActivity(); }} />
      </div>
      {reportMsg ? <ReportModal type="message" id={reportMsg.id} blockUser={reportMsg.sender} onClose={() => setReportMsg(null)} onBlocked={loadMsgs} /> : null}
    </>
  );
}

export default function Chats() {
  const [params, setParams] = useSearchParams();
  const active = Number(params.get('c')) || null;
  const draft = params.get('draft') || '';
  const [tab, setTab] = useState(params.get('type') || 'dm');
  const [refreshKey, setRefreshKey] = useState(0);
  const [info, setInfo] = useState(null);
  useEffect(() => { if (!active) setInfo(null); }, [active]);

  // When opened via ?c=, switch to that conversation's tab.
  useEffect(() => {
    if (!active) return;
    api.get(`/chats/${active}`).then((r) => setTab(r.conversation.type)).catch(() => setParams({}));
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => onSocket('message', () => setRefreshKey((k) => k + 1)), []);

  const open = (id) => setParams({ c: String(id) });
  const switchTab = (t) => { setTab(t); setParams({ type: t }); };

  return (
    <div className="page">
      <div className="page-head"><div><h1 className="page-title">Chats</h1><p className="page-sub">All your conversations in one place.</p></div></div>
      <div className="chat-shell">
        <div className="stack" style={{ gap: 12, minHeight: 0 }}>
          <div className="big-tabs" role="tablist">
            {TABS.map(({ value, label, icon: Icon }) => (
              <button key={value} role="tab" aria-selected={tab === value} className={`big-tab ${tab === value ? 'on' : ''}`} onClick={() => switchTab(value)}><Icon size={18} /><span>{label}</span></button>
            ))}
          </div>
          <div className={`chat-box ${active ? 'has-active' : ''}`} style={{ flex: 1 }}>
            <ConversationList type={tab} activeId={active} onOpen={open} refreshKey={`${refreshKey}-${active}`} />
            {active ? (
              <ChatWindow key={active} convId={active} draft={draft} onBack={() => setParams({ type: tab })}
                onActivity={() => setRefreshKey((k) => k + 1)} onLeft={() => { setParams({ type: tab }); setRefreshKey((k) => k + 1); }} onInfo={setInfo} />
            ) : (
              <div className="chat-main chat-empty">
                <div>
                  <Scene3D preset="chats" />
                  <h2 className="card-title" style={{ fontSize: 20 }}>Pick a conversation</h2>
                  <p className="muted small" style={{ marginTop: 4 }}>Choose a chat on the left to start messaging.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        {info ? <InfoPanel {...info} /> : <div className="chat-side card"><Empty icon={MessagesSquare} title="Select a conversation">Details appear here.</Empty></div>}
      </div>
    </div>
  );
}
