import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { UserPlus, UserCheck, MessageCircle, MoreHorizontal, Ban, Flag, Pencil, Clock, MapPin, Languages, Sparkles, Snowflake, UserX, Check } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { Avatar, Cover, Dropdown, Empty, Spinner, Tabs, useApi } from '../components/ui.jsx';
import PostCard from '../components/PostCard.jsx';
import ReportModal from '../components/ReportModal.jsx';

export function TagRow({ label, items, tone = '' }) {
  if (!items?.length) return null;
  return (
    <div className="kv" style={{ gridTemplateColumns: '150px 1fr' }}>
      <dt>{label}</dt>
      <dd className="chips">{items.map((i) => <span key={i} className={`pill ${tone}`}>{i}</span>)}</dd>
    </div>
  );
}

export async function openDm(nav, toast, userId, draft) {
  try {
    const r = await api.post(`/chats/dm/${userId}`);
    nav(`/chats?c=${r.conversation_id}${draft ? `&draft=${encodeURIComponent(draft)}` : ''}`);
  } catch (e) { toast(e.message, 'error'); }
}

function FriendButton({ data, setData }) {
  const toast = useToast();
  const id = data.user.id;
  const call = async (fn, msg) => {
    try { const r = await fn(); setData((d) => ({ ...d, friendship: r.friendship })); if (msg) toast(msg); } catch (e) { toast(e.message, 'error'); }
  };
  switch (data.friendship) {
    case 'friends':
      return (
        <Dropdown trigger={({ toggle }) => <button className="btn btn-success-soft" onClick={toggle}><UserCheck size={17} />Friends</button>}>
          <button className="menu-item danger" onClick={() => window.confirm(`Remove ${data.user.name} from friends?`) && call(() => api.del(`/users/${id}/friend`), 'Friend removed')}><UserX size={16} />Remove friend</button>
        </Dropdown>
      );
    case 'requested':
      return <button className="btn btn-soft" onClick={() => call(() => api.del(`/users/${id}/friend`), 'Request cancelled')}><Clock size={17} />Requested</button>;
    case 'incoming':
      return (
        <>
          <button className="btn btn-primary" onClick={() => call(() => api.post(`/users/${id}/friend/accept`), `You and ${data.user.name} are now friends`)}><Check size={17} />Accept request</button>
          <button className="btn btn-outline" onClick={() => call(() => api.del(`/users/${id}/friend`), 'Request declined')}>Decline</button>
        </>
      );
    default:
      return <button className="btn btn-primary" onClick={() => call(() => api.post(`/users/${id}/friend`), 'Friend request sent')}><UserPlus size={17} />Add Friend</button>;
  }
}

export function Icebreakers({ list, user, compact }) {
  const nav = useNavigate();
  const toast = useToast();
  const [i, setI] = useState(0);
  if (!list?.length) return null;
  const q = list[i % list.length];
  return (
    <div className="card">
      <div className="card-head">
        <div className="row" style={{ gap: 12 }}>
          <span className="section-icon"><Snowflake size={20} /></span>
          <div><div className="card-title">Cultural Icebreaker</div><div className="card-sub">{user ? `You and ${user.name.split(' ')[0]} come from different backgrounds — try asking…` : 'Try asking…'}</div></div>
        </div>
      </div>
      <div className="card-body stack" style={{ gap: 14 }}>
        <div style={{ padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 12 }}>
          <div className="tiny faint" style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{q.topic}</div>
          <div className="bold" style={{ fontSize: 16, marginTop: 4 }}>“{q.question}”</div>
        </div>
        <div className={compact ? 'stack' : 'row'} style={{ gap: 8 }}>
          {user ? <button className={`btn btn-primary ${compact ? '' : 'grow'}`} onClick={() => openDm(nav, toast, user.id, q.question)}>Use Question</button> : null}
          <button className="btn btn-outline" onClick={() => setI(i + 1)}>Skip</button>
          {user ? <button className="btn btn-soft" onClick={() => openDm(nav, toast, user.id)}><MessageCircle size={16} />Start Chat</button> : null}
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { handle } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, setData, reload } = useApi(() => api.get(`/users/${handle}`), [handle]);
  const [tab, setTab] = useState('about');
  const [reporting, setReporting] = useState(false);
  const posts = useApi(() => (tab === 'posts' ? api.get(`/posts?user=${encodeURIComponent(handle)}&tab=latest`) : Promise.resolve(null)), [handle, tab]);

  if (loading) return <div className="page"><Spinner /></div>;
  if (error) return <div className="page"><div className="card"><Empty icon={UserX} title="Profile not available">This user doesn't exist or isn't visible to you.</Empty></div></div>;

  const { user: u, isSelf, match, stats, communities, icebreakers, blockedByMe } = data;
  const unblock = async () => { await api.del(`/users/${u.id}/block`); toast(`${u.name} unblocked`); reload(); };

  return (
    <div className="page">
      <div className="with-rail">
        <div className="stack">
          <section className="card profile-card">
            <div className="profile-cover" />
            <div className="profile-hero">
              <Avatar user={u} size={120} />
              <div className="grow stack" style={{ gap: 10 }}>
                <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{u.name}</h1>
                    <div className="muted row wrap" style={{ gap: 0 }}>
                      <span>@{u.handle}</span><span className="dot-sep">{u.year} Year</span><span className="dot-sep">{u.department}</span>
                      {u.online ? <span className="dot-sep" style={{ color: 'var(--success)' }}>Online</span> : null}
                    </div>
                  </div>
                  {isSelf ? <button className="btn btn-outline" onClick={() => nav('/personal/edit')}><Pencil size={16} />Edit Profile</button> : null}
                </div>
                {u.bio ? <p style={{ fontSize: 15 }}>{u.bio}</p> : null}
                <div className="row wrap small muted" style={{ gap: 16 }}>
                  {u.region ? <span className="row" style={{ gap: 5 }}><MapPin size={15} />{u.region}</span> : null}
                  {u.languages_spoken?.length ? <span className="row" style={{ gap: 5 }}><Languages size={15} />{u.languages_spoken.join(', ')}</span> : null}
                </div>
                <div className="row wrap small" style={{ gap: 18 }}>
                  <span><b>{stats.friends}</b> <span className="muted">friends</span></span>
                  {!isSelf ? <span><b>{stats.mutual}</b> <span className="muted">mutual</span></span> : null}
                  <span><b>{stats.posts}</b> <span className="muted">posts</span></span>
                  <span><b>{stats.events}</b> <span className="muted">activities</span></span>
                </div>
                {!isSelf ? (
                  blockedByMe ? (
                    <div className="row"><span className="pill red"><Ban size={14} />You blocked this user</span><button className="btn btn-outline btn-sm" onClick={unblock}>Unblock</button></div>
                  ) : (
                    <div className="row wrap">
                      <FriendButton data={data} setData={setData} />
                      <button className="btn btn-outline" onClick={() => openDm(nav, toast, u.id)}><MessageCircle size={17} />Message</button>
                      <Dropdown trigger={({ toggle }) => <button className="icon-btn" onClick={toggle} aria-label="More actions"><MoreHorizontal size={20} /></button>}>
                        <button className="menu-item danger" onClick={() => setReporting(true)}><Flag size={16} />Block / Report</button>
                      </Dropdown>
                    </div>
                  )
                ) : null}
              </div>
            </div>
          </section>

          <Tabs tabs={[{ value: 'about', label: 'About' }, { value: 'posts', label: 'Posts' }]} value={tab} onChange={setTab} />

          {tab === 'about' ? (
            <>
              <section className="card card-pad stack" style={{ gap: 14 }}>
                <h2 className="card-title">Interests & Academics</h2>
                <TagRow label="Interests" items={u.interests} />
                <TagRow label="Hobbies" items={u.hobbies} />
                <TagRow label="Clubs" items={u.clubs} tone="grey" />
                <TagRow label="Courses" items={u.courses} tone="grey" />
                <TagRow label="Skills" items={u.skills} tone="grey" />
              </section>
              <section className="card card-pad stack" style={{ gap: 14 }}>
                <h2 className="card-title">Cultural Information</h2>
                <TagRow label="Region" items={u.region ? [u.region] : []} />
                <TagRow label="Languages" items={u.languages_spoken} />
                <TagRow label="Wants to learn" items={u.languages_interested} tone="grey" />
                <TagRow label="Cultural interests" items={u.cultural_interests} />
                <TagRow label="Favourite food" items={u.foods} tone="amber" />
                <TagRow label="Festivals" items={u.festivals} tone="amber" />
                <TagRow label="Music / Movies / Art" items={u.music_art} tone="grey" />
              </section>
            </>
          ) : posts.loading ? <Spinner /> : (
            posts.data?.posts?.length
              ? posts.data.posts.map((p) => <PostCard key={p.id} post={p} onChange={(np) => posts.setData((d) => ({ ...d, posts: d.posts.map((x) => (x.id === np.id ? np : x)) }))} onDelete={(id) => posts.setData((d) => ({ ...d, posts: d.posts.filter((x) => x.id !== id) }))} />)
              : <div className="card"><Empty title="No posts yet" /></div>
          )}
        </div>

        <aside className="rail">
          {match ? (
            <div className="card card-pad row" style={{ gap: 16 }}>
              <div className="match-ring" style={{ '--p': match.percent }}><div><b>{match.percent}%</b><span className="tiny muted">Match</span></div></div>
              <div className="stack" style={{ gap: 6 }}>
                <div className="bold row" style={{ gap: 6 }}><Sparkles size={16} color="var(--primary)" />Why you'd click</div>
                {match.reasons.length ? match.reasons.map((r) => <div key={r} className="small muted">• {r}</div>) : <div className="small muted">Different worlds — a great chance to step outside your circle.</div>}
              </div>
            </div>
          ) : null}
          {!isSelf && !blockedByMe ? <Icebreakers list={icebreakers} user={u} compact /> : null}
          <div className="card">
            <div className="card-head"><div className="card-title">Communities</div></div>
            <div className="card-body">
              {communities.length ? communities.map((c) => (
                <Link key={c.id} to={`/community/${c.id}`} className="list-row clickable" style={{ padding: '8px 6px' }}>
                  <Cover emoji={c.emoji} color={c.color} size={40} radius={10} />
                  <div className="grow"><div className="bold small">{c.name}</div><div className="tiny muted">{c.member_count} members</div></div>
                </Link>
              )) : <p className="small muted">Not in any communities yet.</p>}
            </div>
          </div>
        </aside>
      </div>
      {reporting ? <ReportModal type="user" id={u.id} blockUser={u} onClose={() => setReporting(false)} onBlocked={reload} /> : null}
    </div>
  );
}
