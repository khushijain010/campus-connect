import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus, Quote, Star, Sparkles, Bookmark, Check } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import Scene3D from '../components/Scene3D.jsx';
import { api, qs } from '../lib/api.js';
import { Dropdown, Empty, Spinner, useApi } from '../components/ui.jsx';
import PostCard from '../components/PostCard.jsx';
import CreatePostModal from '../components/CreatePostModal.jsx';

const MAIN_TABS = [
  { value: 'foryou', label: 'For You' }, { value: 'trending', label: 'Trending' },
  { value: 'Tech', label: 'Tech' }, { value: 'Culture', label: 'Culture' }, { value: 'Politics', label: 'Politics' },
  { value: 'Sports', label: 'Sports' }, { value: 'Arts', label: 'Arts' },
];
const MORE_TABS = [
  { value: 'Academics', label: 'Academics' }, { value: 'Life@Campus', label: 'Life@Campus' }, { value: 'Events', label: 'Events' },
  { value: 'Memes', label: 'Memes' }, { value: 'Other', label: 'Other' }, { value: 'saved', label: 'Saved posts' },
];

// Reviews / Testimonials from post-event surveys, shown inline in the feed.
function Testimonials() {
  const { data } = useApi(() => api.get('/testimonials'));
  const [i, setI] = useState(0);
  const items = data?.testimonials || [];
  useEffect(() => {
    if (items.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  const t = items[i % items.length];
  return (
    <section className="card card-pad stack" style={{ gap: 10, background: 'linear-gradient(135deg, var(--primary-soft), var(--violet-soft) 60%, var(--surface))' }} aria-label="Reviews and testimonials">
      <div className="row between">
        <div><div className="card-title">Reviews & Testimonials</div><div className="card-sub">What students say about activities on Campus Connect</div></div>
        <Quote size={22} className="faint" />
      </div>
      <div className="row" style={{ gap: 2, color: '#f59e0b' }}>{Array.from({ length: t.rating }, (_, k) => <Star key={k} size={15} fill="currentColor" />)}</div>
      <p style={{ fontSize: 15 }}>“{t.comment}”</p>
      <div className="row between wrap">
        <div className="small muted">{t.who} · <span className="bold" style={{ color: 'var(--text)' }}>{t.activity}</span></div>
        <div className="row" style={{ gap: 6 }}>
          {items.map((_, k) => (
            <button key={k} aria-label={`Testimonial ${k + 1}`} onClick={() => setI(k)}
              style={{ width: 7, height: 7, borderRadius: 9, border: 0, padding: 0, background: k === i % items.length ? 'var(--primary)' : 'var(--surface-3)' }} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Feed({ tab }) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = (p, replace) => {
    setLoading(true);
    api.get(`/posts${qs({ tab, page: p })}`).then((r) => {
      setPosts((x) => (replace ? r.posts : [...x, ...r.posts]));
      setHasMore(r.hasMore);
      setPage(p);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { setPosts([]); load(0, true); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onNew = (e) => { if (tab === 'foryou' || tab === e.detail.topic) setPosts((x) => [e.detail, ...x]); };
    window.addEventListener('cc:post', onNew);
    return () => window.removeEventListener('cc:post', onNew);
  }, [tab]);

  const update = (p) => setPosts((x) => x.map((y) => (y.id === p.id ? { ...y, ...p } : y)));
  const remove = (id) => setPosts((x) => x.filter((y) => y.id !== id));

  if (loading && !posts.length) return <Spinner />;
  if (!posts.length) {
    return (
      <div className="card">
        <Empty icon={tab === 'saved' ? Bookmark : Sparkles} title={tab === 'saved' ? 'No saved posts yet' : 'Nothing here yet'}>
          {tab === 'saved' ? 'Tap the bookmark on any post to keep it here.' : 'Be the first to post in this topic.'}
        </Empty>
      </div>
    );
  }
  return (
    <div className="stack">
      {posts.map((p, i) => (
        <Fragment key={p.id}>
          <PostCard post={p} onChange={update} onDelete={remove} />
          {tab === 'foryou' && i === 2 ? <Testimonials /> : null}
        </Fragment>
      ))}
      {hasMore ? <button className="btn btn-outline" disabled={loading} onClick={() => load(page + 1)}>{loading ? 'Loading…' : 'Load more'}</button> : null}
    </div>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

function WelcomeBanner({ onCompose }) {
  const { user, unreadChats } = useAuth();
  return (
    <section className="banner" style={{ marginBottom: 18 }}>
      <div className="banner-copy">
        <span className="banner-kicker">Your campus, today</span>
        <h1>{greeting()}, {user.name.split(' ')[0]} 👋</h1>
        <p>See what your people are up to, or share something of your own.</p>
        <div className="quick">
          <Link to="/discover">✨ People you'd click with</Link>
          <Link to="/culture">🌏 Culture of the week</Link>
          {unreadChats ? <Link to="/chats">💬 <b>{unreadChats}</b> unread</Link> : null}
        </div>
        <div className="banner-actions"><button className="btn btn-primary btn-lg" onClick={onCompose}><Plus size={18} />Create Post</button></div>
      </div>
      <Scene3D preset="home" />
    </section>
  );
}

export default function Home() {
  const [tab, setTab] = useState('foryou');
  const [composer, setComposer] = useState(false);
  const moreActive = MORE_TABS.find((t) => t.value === tab);
  return (
    <div className="page">
      <div className="feed-col">
        <WelcomeBanner onCompose={() => setComposer(true)} />
        <div className="feed-tabs" role="tablist">
          <div className="tabs" style={{ flex: '0 1 auto' }}>
            {MAIN_TABS.map((t) => (
              <button key={t.value} role="tab" aria-selected={tab === t.value} className={`tab ${tab === t.value ? 'on' : ''}`} onClick={() => setTab(t.value)}>{t.label}</button>
            ))}
          </div>
          <Dropdown align="right" trigger={({ toggle }) => (
            <button className={`tab ${moreActive ? 'on' : ''}`} onClick={toggle} aria-haspopup="menu">{moreActive ? moreActive.label : 'More'}<ChevronDown size={15} /></button>
          )}>
            {MORE_TABS.map((t) => (
              <button key={t.value} className="menu-item" onClick={() => setTab(t.value)}>
                {t.label}{tab === t.value ? <Check size={15} color="var(--primary)" style={{ marginLeft: 'auto' }} /> : null}
              </button>
            ))}
          </Dropdown>
        </div>
        <Feed tab={tab} />
      </div>
      {composer ? <CreatePostModal onClose={() => setComposer(false)} onCreated={(p) => window.dispatchEvent(new CustomEvent('cc:post', { detail: p }))} /> : null}
    </div>
  );
}
