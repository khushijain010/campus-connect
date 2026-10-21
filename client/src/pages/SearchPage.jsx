import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { Avatar, Empty, Spinner, Tabs, useApi } from '../components/ui.jsx';
import PostCard from '../components/PostCard.jsx';
import { ActivityCard, CommunityTile } from '../components/cards.jsx';

const TABS = [{ value: 'all', label: 'All' }, { value: 'people', label: 'People' }, { value: 'posts', label: 'Posts' },
  { value: 'communities', label: 'Communities' }, { value: 'activities', label: 'Events & Groups' }];

export default function SearchPage() {
  const [params] = useSearchParams();
  const term = params.get('q') || '';
  const [tab, setTab] = useState('all');
  const { data, loading, setData } = useApi(() => api.get(`/search${qs({ q: term, type: tab })}`), [term, tab]);
  const patch = (key) => (item) => setData((d) => ({ ...d, [key]: d[key].map((x) => (x.id === item.id ? { ...x, ...item } : x)) }));
  const total = data ? data.people.length + data.posts.length + data.communities.length + data.activities.length : 0;
  const show = (k) => tab === 'all' || tab === k;

  return (
    <div className="page">
      <div className="page-head"><div><h1 className="page-title">Search</h1><p className="page-sub">Results for “{term}”</p></div></div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="stack" style={{ marginTop: 18 }}>
        {loading ? <Spinner /> : !total ? <div className="card"><Empty icon={SearchX} title="No results">Try a name, @handle, department, topic or event.</Empty></div> : (
          <>
            {show('people') && data.people.length ? (
              <section className="card">
                <div className="card-head"><div className="card-title">People</div></div>
                <div className="card-body">
                  {data.people.map((u) => (
                    <Link key={u.id} to={`/u/${u.handle}`} className="list-row clickable" style={{ padding: '10px 6px' }}>
                      <Avatar user={u} size={44} />
                      <div className="grow"><div className="bold">{u.name}</div><div className="small muted">@{u.handle} · {u.department} · {u.year} year · {u.region}</div></div>
                      <div className="chips">{u.interests.slice(0, 3).map((i) => <span key={i} className="pill sm">{i}</span>)}</div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
            {show('communities') && data.communities.length ? (
              <section className="stack" style={{ gap: 10 }}>
                <h2 className="card-title">Communities</h2>
                <div className="grid-auto">{data.communities.map((c) => <CommunityTile key={c.id} community={c} onChange={patch('communities')} />)}</div>
              </section>
            ) : null}
            {show('activities') && data.activities.length ? (
              <section className="stack" style={{ gap: 10 }}>
                <h2 className="card-title">Events & Groups</h2>
                <div className="grid-auto">{data.activities.map((a) => <ActivityCard key={a.id} activity={{ ...a, openings: a.capacity - a.participants }} onChange={patch('activities')} />)}</div>
              </section>
            ) : null}
            {show('posts') && data.posts.length ? (
              <section className="stack" style={{ gap: 10 }}>
                <h2 className="card-title">Posts</h2>
                {data.posts.map((p) => <PostCard key={p.id} post={p} compact onChange={patch('posts')} onDelete={(id) => setData((d) => ({ ...d, posts: d.posts.filter((x) => x.id !== id) }))} />)}
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
