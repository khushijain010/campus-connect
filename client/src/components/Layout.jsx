import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  Home, Globe2, Compass, MessageCircle, Search, Bell, ChevronDown, LogOut, Pencil, UserCircle2, Users, CalendarDays, FileText,
} from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { api, qs } from '../lib/api.js';
import { onSocket } from '../lib/socket.js';
import { timeAgo, eventDate } from '../lib/format.js';
import { Avatar, Cover, Dropdown } from './ui.jsx';
import { ThemeToggle } from '../lib/theme.jsx';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/culture', label: 'Culture', icon: Globe2 },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/chats', label: 'Chats', icon: MessageCircle, badge: 'chats' },
];

export function Logo() {
  return <Link to="/" className="brand"><img src="/logo.svg" alt="" /><span>CampusConnect</span></Link>;
}

function Sidebar() {
  const { unreadChats } = useAuth();
  return (
    <aside className="sidebar">
      <Logo />
      <nav className="stack" style={{ gap: 4 }} aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={21} /><span>{label}</span>
            {badge === 'chats' && unreadChats > 0 ? <span className="badge">{unreadChats > 99 ? '99+' : unreadChats}</span> : null}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-card">
        <b>Step outside your circle</b>
        <p>Meet someone from a different department or region this week.</p>
        <Link to="/culture">Find a match →</Link>
      </div>
    </aside>
  );
}

function SearchBox() {
  const nav = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState(null);
  const [recent, setRecent] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!term.trim()) { setRes(null); return undefined; }
    const t = setTimeout(() => api.get(`/search${qs({ q: term.trim(), log: 0 })}`).then(setRes).catch(() => {}), 220);
    return () => clearTimeout(t);
  }, [term]);

  const openSearch = () => { setOpen(true); api.get('/search/recent').then((r) => setRecent(r.recent)).catch(() => {}); };
  const go = (path) => { setOpen(false); setTerm(''); nav(path); };
  const submit = (e) => { e.preventDefault(); if (term.trim()) go(`/search?q=${encodeURIComponent(term.trim())}`); };
  const total = res ? res.people.length + res.posts.length + res.communities.length + res.activities.length : 0;

  return (
    <form className="search input-icon" ref={ref} onSubmit={submit} style={{ position: 'relative' }} role="search">
      <Search size={19} />
      <input className="input search-input" placeholder="Search people, posts, communities, events…" value={term}
        onChange={(e) => { setTerm(e.target.value); setOpen(true); }} onFocus={openSearch} aria-label="Search" />
      {open ? (
        <div className="search-pop">
          {!term.trim() ? (
            recent.length ? (
              <>
                <div className="search-group">Recent searches</div>
                {recent.map((r) => <div key={r} className="search-item" onClick={() => go(`/search?q=${encodeURIComponent(r)}`)}><Search size={16} className="faint" />{r}</div>)}
              </>
            ) : <div className="search-item faint">Try “hackathon”, “photography” or “Kerala”</div>
          ) : !res ? <div className="search-item faint">Searching…</div> : (
            <>
              {res.people.length ? <div className="search-group">People</div> : null}
              {res.people.map((u) => (
                <div key={`u${u.id}`} className="search-item" onClick={() => go(`/u/${u.handle}`)}>
                  <Avatar user={u} size={34} />
                  <div className="grow"><div className="bold">{u.name}</div><div className="tiny muted">@{u.handle} · {u.department} · {u.year} year</div></div>
                </div>
              ))}
              {res.communities.length ? <div className="search-group">Communities</div> : null}
              {res.communities.map((c) => (
                <div key={`c${c.id}`} className="search-item" onClick={() => go(`/community/${c.id}`)}>
                  <Cover emoji={c.emoji} color={c.color} size={34} radius={10} />
                  <div className="grow"><div className="bold">{c.name}</div><div className="tiny muted">{c.member_count} members · {c.category}</div></div>
                </div>
              ))}
              {res.activities.length ? <div className="search-group">Events & groups</div> : null}
              {res.activities.map((a) => (
                <div key={`a${a.id}`} className="search-item" onClick={() => go(`/activity/${a.id}`)}>
                  <Cover emoji={a.emoji} color="#1f6feb" size={34} radius={10} />
                  <div className="grow"><div className="bold">{a.title}</div><div className="tiny muted">{eventDate(a.date)} · {a.location}</div></div>
                </div>
              ))}
              {res.posts.length ? <div className="search-group">Posts</div> : null}
              {res.posts.map((p) => (
                <div key={`p${p.id}`} className="search-item" onClick={() => go(`/post/${p.id}`)}>
                  <span className="section-icon" style={{ width: 34, height: 34, borderRadius: 10 }}><FileText size={16} /></span>
                  <div className="grow"><div className="ellipsis">{p.content || p.meta?.title}</div><div className="tiny muted">{p.author.name} · {timeAgo(p.created_at)}</div></div>
                </div>
              ))}
              {!total ? <div className="search-item faint">No matches for “{term}”</div> : null}
              <div className="search-item" style={{ color: 'var(--primary)', fontWeight: 600 }} onClick={() => go(`/search?q=${encodeURIComponent(term.trim())}`)}>
                <Search size={16} /> See all results for “{term.trim()}”
              </div>
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}

const NOTIF_ICON = { friend_request: Users, friend: Users, application: CalendarDays, join: CalendarDays, feedback: CalendarDays };

function Notifications() {
  const nav = useNavigate();
  const [data, setData] = useState({ items: [], unread: 0 });
  const load = () => api.get('/notifications').then(setData).catch(() => {});
  useEffect(() => { load(); return onSocket('notification', load); }, []);
  return (
    <Dropdown trigger={({ toggle }) => (
      <button className="icon-btn" aria-label="Notifications" onClick={() => {
        toggle();
        if (data.unread) api.post('/notifications/read').then(() => setData((d) => ({ ...d, unread: 0 })));
      }}>
        <Bell size={22} />{data.unread ? <span className="notif-dot" /> : null}
      </button>
    )}>
      <div style={{ width: 340, maxHeight: 420, overflowY: 'auto' }}>
        <div className="row between" style={{ padding: '8px 12px' }}><b>Notifications</b></div>
        {data.items.length ? data.items.map((n) => {
          const Icon = NOTIF_ICON[n.type] || Bell;
          return (
            <button key={n.id} className="menu-item" onClick={() => n.link && nav(n.link)} style={{ alignItems: 'flex-start', background: n.is_read ? undefined : 'var(--primary-soft)' }}>
              <span className="section-icon" style={{ width: 32, height: 32, borderRadius: 9 }}><Icon size={15} /></span>
              <span className="grow"><span style={{ display: 'block' }}>{n.text}</span><span className="tiny faint">{timeAgo(n.created_at)}</span></span>
            </button>
          );
        }) : <div className="menu-item faint">You're all caught up.</div>}
      </div>
    </Dropdown>
  );
}

function ProfileMenu() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <Dropdown trigger={({ toggle }) => (
      <button className="row" style={{ border: 0, background: 'none', padding: 4, gap: 8 }} onClick={toggle} aria-label="Profile menu">
        <Avatar user={user} size={42} />
        <ChevronDown size={18} className="muted" />
      </button>
    )}>
      <div className="row" style={{ padding: '10px 12px', gap: 10 }}>
        <Avatar user={user} size={38} />
        <div className="grow"><div className="bold ellipsis">{user.name}</div><div className="tiny muted">@{user.handle}</div></div>
      </div>
      <div className="divider" style={{ margin: '4px 0' }} />
      <button className="menu-item" onClick={() => nav('/personal')}><UserCircle2 size={17} /> Your profile</button>
      <button className="menu-item" onClick={() => nav(`/u/${user.handle}`)}><Users size={17} /> View as others see it</button>
      <button className="menu-item" onClick={() => nav('/personal/edit')}><Pencil size={17} /> Edit profile</button>
      <div className="divider" style={{ margin: '4px 0' }} />
      <button className="menu-item danger" onClick={() => { logout(); nav('/'); }}><LogOut size={17} /> Log out</button>
    </Dropdown>
  );
}

export default function Layout() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <header className="topbar">
          <SearchBox />
          <div className="topbar-actions">
            <ThemeToggle />
            <Notifications />
            <ProfileMenu />
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
