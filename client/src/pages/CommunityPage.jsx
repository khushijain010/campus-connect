import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Flag, Plus, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { compact } from '../lib/format.js';
import { Avatar, Empty, Spinner, Tabs, useApi } from '../components/ui.jsx';
import PostCard from '../components/PostCard.jsx';
import CreatePostModal from '../components/CreatePostModal.jsx';
import ReportModal from '../components/ReportModal.jsx';
import { ActivityRow } from '../components/cards.jsx';

export default function CommunityPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => api.get(`/communities/${id}`), [id]);
  const posts = useApi(() => api.get(`/posts?tab=latest&community=${id}`), [id]);
  const [tab, setTab] = useState('posts');
  const [composer, setComposer] = useState(false);
  const [reporting, setReporting] = useState(false);

  if (loading) return <div className="page"><Spinner /></div>;
  if (error) return <div className="page"><div className="card"><Empty title="Community not found" /></div></div>;
  const c = data.community;

  const toggle = async () => {
    try {
      if (c.joined) { await api.del(`/communities/${c.id}/join`); toast(`Left ${c.name}`); }
      else { await api.post(`/communities/${c.id}/join`); toast(`Welcome to ${c.name}!`); }
      reload();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="page">
      <button className="btn btn-ghost" style={{ marginBottom: 12, paddingLeft: 6 }} onClick={() => nav(-1)}><ArrowLeft size={18} />Back</button>
      <div className="with-rail">
        <div className="stack">
          <section className="card" style={{ overflow: 'hidden' }}>
            <div style={{ height: 140, background: `linear-gradient(120deg, ${c.color}, ${c.color}88)`, display: 'grid', placeItems: 'center', fontSize: 70 }}>{c.emoji}</div>
            <div className="card-pad stack" style={{ gap: 12 }}>
              <div className="row between wrap">
                <div>
                  <h1 style={{ fontSize: 26, fontWeight: 800 }}>{c.name}</h1>
                  <div className="muted small">{compact(c.member_count)} members · {c.category} · Public community</div>
                </div>
                <div className="row">
                  {c.joined ? <button className="btn btn-primary" onClick={() => nav(`/chats?c=${data.conversation_id}`)}><MessageCircle size={16} />Open chat</button> : null}
                  <button className={`btn ${c.joined ? 'btn-outline' : 'btn-primary'}`} onClick={toggle}>{c.joined ? 'Leave' : 'Join Community'}</button>
                  <button className="icon-btn" onClick={() => setReporting(true)} aria-label="Report community"><Flag size={18} /></button>
                </div>
              </div>
              <p>{c.description}</p>
              <div className="chips">{c.tags.map((t) => <span key={t} className="pill">{t}</span>)}</div>
            </div>
          </section>
          <Tabs tabs={[{ value: 'posts', label: 'Posts' }, { value: 'members', label: `Members (${c.member_count})` }]} value={tab} onChange={setTab} />
          {tab === 'posts' ? (
            <div className="stack">
              {c.joined ? <button className="btn btn-soft" onClick={() => setComposer(true)}><Plus size={16} />Post in {c.name}</button> : null}
              {posts.loading ? <Spinner /> : posts.data.posts.length ? posts.data.posts.map((p) => (
                <PostCard key={p.id} post={p} onChange={(n) => posts.setData((d) => ({ ...d, posts: d.posts.map((x) => (x.id === n.id ? n : x)) }))}
                  onDelete={(pid) => posts.setData((d) => ({ ...d, posts: d.posts.filter((x) => x.id !== pid) }))} />
              )) : <div className="card"><Empty title="No posts yet">{c.joined ? 'Start the first discussion!' : 'Join to post here.'}</Empty></div>}
            </div>
          ) : (
            <div className="card card-body">
              {data.members.map((m) => (
                <Link key={m.id} to={`/u/${m.handle}`} className="list-row clickable" style={{ padding: '10px 6px' }}>
                  <Avatar user={m} size={40} />
                  <div className="grow"><div className="bold small">{m.name}</div><div className="tiny muted">{m.year} Yr · {m.department} · {m.region}</div></div>
                  <span className={`pill sm ${m.role === 'admin' ? '' : 'grey'}`}>{m.role === 'admin' ? 'Admin' : 'Member'}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <aside className="rail">
          <div className="card">
            <div className="card-head"><div className="card-title">Upcoming Events</div></div>
            <div className="card-body" style={{ paddingTop: 0 }}>
              {data.events.length ? data.events.map((a) => <ActivityRow key={a.id} activity={a} />) : <p className="small muted">No upcoming events.</p>}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="card-title row" style={{ gap: 8 }}><Users size={18} />Members</div><button className="see-all" onClick={() => setTab('members')}>See all</button></div>
            <div className="card-body row wrap" style={{ gap: 14 }}>
              {data.members.slice(0, 8).map((m) => (
                <Link key={m.id} to={`/u/${m.handle}`} className="stack" style={{ alignItems: 'center', gap: 4, width: 64 }}>
                  <Avatar user={m} size={44} /><span className="tiny ellipsis" style={{ maxWidth: 64 }}>{m.name.split(' ')[0]}</span>
                  <span className={`pill sm ${m.role === 'admin' ? '' : 'grey'}`}>{m.role === 'admin' ? 'Admin' : 'Member'}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
      {composer ? <CreatePostModal communityId={c.id} onClose={() => setComposer(false)} onCreated={(p) => posts.setData((d) => ({ ...d, posts: [p, ...d.posts] }))} /> : null}
      {reporting ? <ReportModal type="community" id={c.id} onClose={() => setReporting(false)} /> : null}
    </div>
  );
}
