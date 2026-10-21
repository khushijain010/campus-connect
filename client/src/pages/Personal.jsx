import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Pencil, BadgeCheck, Plus, Send, CalendarDays, CheckCircle2, ChevronRight, Star, MessageCircle, UserX, Eye, Users, ClipboardList, UserPlus,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { eventDate, eventTime } from '../lib/format.js';
import { Avatar, Cover, Empty, Modal, Spinner, StatusPill, useApi } from '../components/ui.jsx';
import { kindColor } from '../components/cards.jsx';
import SurveyModal from '../components/SurveyModal.jsx';
import { ManageApplications } from './ActivityPage.jsx';
import { openDm } from './Profile.jsx';

function RailSection({ icon: Icon, tone, title, sub, children, onSeeAll }) {
  return (
    <div className="card">
      <div className="card-head" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="section-icon" style={tone ? { background: `var(--${tone}-soft)`, color: `var(--${tone})` } : undefined}><Icon size={20} /></span>
          <div><div className="card-title">{title}</div><div className="card-sub">{sub}</div></div>
        </div>
        {onSeeAll ? <button className="see-all" onClick={onSeeAll}>See all</button> : null}
      </div>
      <div className="card-body" style={{ paddingTop: 4 }}>{children}</div>
    </div>
  );
}

function EventLine({ a, right }) {
  const nav = useNavigate();
  return (
    <div className="list-row clickable" style={{ padding: '10px 6px' }} onClick={() => nav(`/activity/${a.id}`)}>
      <Cover emoji={a.emoji} color={kindColor(a)} size={52} radius={10} />
      <div className="grow">
        <div className="bold ellipsis">{a.title}</div>
        <div className="small muted ellipsis">{eventDate(a.date)}{a.time ? ` · ${eventTime(a.time)}` : ''} · {a.location}</div>
      </div>
      {right}
      <ChevronRight size={18} className="faint" />
    </div>
  );
}

function FriendsModal({ friends, onClose, onRemoved }) {
  const nav = useNavigate();
  const toast = useToast();
  const remove = async (f) => {
    if (!window.confirm(`Remove ${f.name} from your connections?`)) return;
    try { await api.del(`/users/${f.id}/friend`); toast('Removed'); onRemoved(f.id); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal title={`Friends / Connections (${friends.length})`} onClose={onClose} wide>
      {friends.length ? friends.map((f) => (
        <div key={f.id} className="list-row">
          <Avatar user={f} size={44} />
          <div className="grow">
            <div className="bold">{f.name}</div>
            <div className="small muted">{f.year} Yr · {f.department}</div>
            <div className="chips" style={{ gap: 4, marginTop: 4 }}>{f.interests.slice(0, 3).map((i) => <span key={i} className="pill sm">{i}</span>)}</div>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => nav(`/u/${f.handle}`)}><Eye size={14} />View Profile</button>
          <button className="btn btn-sm btn-soft" onClick={() => openDm(nav, toast, f.id)}><MessageCircle size={14} />Message</button>
          <button className="btn btn-sm btn-danger-soft" onClick={() => remove(f)} aria-label={`Remove ${f.name}`}><UserX size={14} /></button>
        </div>
      )) : <Empty icon={Users} title="No connections yet" />}
    </Modal>
  );
}

export default function Personal() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const acts = useApi(() => api.get('/me/activities'));
  const friends = useApi(() => api.get('/users/me/friends'));
  const requests = useApi(() => api.get('/users/me/requests'));
  const comms = useApi(() => api.get('/communities?joined=1'));
  const [showFriends, setShowFriends] = useState(false);
  const [survey, setSurvey] = useState(null);
  const [manage, setManage] = useState(null);
  const [expand, setExpand] = useState({});

  // Deep links from notifications: ?feedback=ID, ?manage=ID, ?tab=requests
  useEffect(() => {
    if (!acts.data) return;
    const fb = Number(params.get('feedback'));
    if (fb) {
      const a = acts.data.past.find((x) => x.id === fb);
      if (a && !a.feedback_given) setSurvey(a);
    }
    const m = Number(params.get('manage'));
    if (m) setManage(m);
    if (params.get('tab') === 'requests') document.getElementById('requests')?.scrollIntoView({ behavior: 'smooth' });
  }, [acts.data, params]);

  const clearParams = () => setParams({}, { replace: true });
  const respond = async (u, accept) => {
    try {
      if (accept) await api.post(`/users/${u.id}/friend/accept`); else await api.del(`/users/${u.id}/friend`);
      toast(accept ? `You and ${u.name} are now friends` : 'Request declined');
      requests.reload(); friends.reload();
    } catch (e) { toast(e.message, 'error'); }
  };
  const leave = async (c) => {
    try { await api.del(`/communities/${c.id}/join`); toast(`Left ${c.name}`); comms.setData((d) => ({ communities: d.communities.filter((x) => x.id !== c.id) })); } catch (e) { toast(e.message, 'error'); }
  };

  const tags = [...user.interests, ...user.hobbies];
  const list = (key, n) => (expand[key] ? acts.data[key] : acts.data[key].slice(0, n));
  const seeAll = (key, n) => (acts.data?.[key]?.length > n ? () => setExpand((e) => ({ ...e, [key]: !e[key] })) : undefined);

  return (
    <div className="page">
      <div className="page-head"><div><h1 className="page-title">Personal</h1><p className="page-sub">Manage your profile, connections and all your event activities in one place.</p></div></div>
      <div className="with-rail wide-rail">
        <div className="stack">
          <section className="card profile-card">
            <div className="profile-cover" />
            <div className="profile-hero">
              <Avatar user={user} size={128} />
              <div className="grow stack" style={{ gap: 10 }}>
                <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h2 className="row" style={{ fontSize: 26, fontWeight: 800, gap: 8 }}>{user.name}<BadgeCheck size={22} color="#fff" fill="var(--primary)" aria-label="Verified college email" /></h2>
                    <div className="muted row wrap" style={{ gap: 0 }}><span>@{user.handle}</span><span className="dot-sep">{user.year} Year</span><span className="dot-sep">{user.department}</span>{user.region ? <span className="dot-sep">{user.region}</span> : null}</div>
                  </div>
                  <button className="btn btn-soft" onClick={() => nav('/personal/edit')}><Pencil size={16} />Edit Profile</button>
                </div>
                {user.bio ? <p style={{ fontSize: 15 }}>{user.bio}</p> : <p className="muted">Add a short bio so people know what you're into.</p>}
                <div className="chips">
                  {tags.slice(0, 4).map((t) => <span key={t} className="pill">{t}</span>)}
                  {tags.length > 4 ? <Link to={`/u/${user.handle}`} className="pill grey">+{tags.length - 4}</Link> : null}
                </div>
                <div className="small muted">
                  {user.courses.length ? <>Courses: <b style={{ color: 'var(--text)' }}>{user.courses.join(', ')}</b></> : null}
                  {user.skills.length ? <> · Skills: <b style={{ color: 'var(--text)' }}>{user.skills.join(', ')}</b></> : null}
                  {user.languages_spoken.length ? <> · Languages: <b style={{ color: 'var(--text)' }}>{user.languages_spoken.join(', ')}</b></> : null}
                </div>
              </div>
            </div>
          </section>

          {requests.data?.incoming?.length ? (
            <section className="card" id="requests">
              <div className="card-head"><div className="card-title row" style={{ gap: 8 }}><UserPlus size={18} />Friend Requests <span className="badge">{requests.data.incoming.length}</span></div></div>
              <div className="card-body">
                {requests.data.incoming.map((u) => (
                  <div key={u.id} className="list-row">
                    <Link to={`/u/${u.handle}`}><Avatar user={u} size={42} /></Link>
                    <div className="grow"><Link to={`/u/${u.handle}`} className="bold">{u.name}</Link><div className="small muted">{u.year} Yr · {u.department} · {u.region}</div></div>
                    <button className="btn btn-sm btn-primary" onClick={() => respond(u, true)}>Accept</button>
                    <button className="btn btn-sm btn-outline" onClick={() => respond(u, false)}>Decline</button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card">
            <div className="card-head"><div className="card-title">Your Connections</div><button className="see-all" onClick={() => setShowFriends(true)}>See all</button></div>
            <div className="card-body">
              {friends.loading ? <Spinner /> : (
                <div className="row" style={{ gap: 18, overflowX: 'auto', paddingBottom: 4 }}>
                  {friends.data.friends.slice(0, 6).map((f) => (
                    <Link key={f.id} to={`/u/${f.handle}`} className="stack" style={{ alignItems: 'center', gap: 4, minWidth: 92 }}>
                      <Avatar user={f} size={70} />
                      <span className="bold small" style={{ marginTop: 4 }}>{f.name.split(' ')[0]}</span>
                      <span className="tiny muted">{f.year} Yr · {f.department === 'Mechanical' ? 'Mech' : f.department}</span>
                    </Link>
                  ))}
                  <Link to="/culture" className="stack" style={{ alignItems: 'center', gap: 4, minWidth: 92 }}>
                    <span style={{ width: 70, height: 70, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}><Plus size={28} className="faint" /></span>
                    <span className="small muted" style={{ marginTop: 4 }}>Find People</span>
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div className="card-title">Your Communities</div><Link to="/discover?tab=communities" className="see-all">Find more</Link></div>
            <div className="card-body">
              {comms.loading ? <Spinner /> : comms.data.communities.length ? (
                <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                  {comms.data.communities.map((c) => (
                    <div key={c.id} className="tile" style={{ padding: 14, gap: 10 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <Cover emoji={c.emoji} color={c.color} size={46} radius={12} />
                        <div style={{ minWidth: 0 }}><div className="bold small ellipsis">{c.name}</div><div className="tiny muted">{c.member_count} members</div></div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-sm btn-soft grow" onClick={() => nav(`/community/${c.id}`)}>Open</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => leave(c)}>Leave</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Empty icon={Users} title="No communities yet" action={<Link to="/discover?tab=communities" className="btn btn-primary btn-sm">Explore communities</Link>} />}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><div className="card-title">Your Events / Groups</div><div className="card-sub">Events and groups you created</div></div><Link to="/discover" className="see-all">Create new</Link></div>
            <div className="card-body">
              {acts.loading ? <Spinner /> : acts.data.created.length ? acts.data.created.map((a) => (
                <div key={a.id} className="list-row">
                  <Cover emoji={a.emoji} color={kindColor(a)} size={48} radius={10} />
                  <div className="grow">
                    <Link to={`/activity/${a.id}`} className="bold">{a.title}</Link>
                    <div className="small muted">
                      {a.applications_count} applications · {a.accepted_count} accepted · {a.openings} opening{a.openings === 1 ? '' : 's'}
                      {a.status === 'completed' ? ' · Completed' : ` · ${eventDate(a.date)}`}
                    </div>
                  </div>
                  {a.status === 'open' ? (
                    <button className="btn btn-sm btn-soft" onClick={() => setManage(a.id)}><ClipboardList size={14} />Manage Applications{a.pending ? <span className="badge">{a.pending}</span> : null}</button>
                  ) : <StatusPill status="completed" />}
                </div>
              )) : <Empty icon={CalendarDays} title="You haven't created anything yet" action={<Link to="/discover" className="btn btn-primary btn-sm">Add an event</Link>} />}
            </div>
          </section>
        </div>

        <aside className="rail" style={{ position: 'static' }}>
          {acts.loading ? <Spinner /> : (
            <>
              <RailSection icon={Send} title="Event Applications" sub="Events and groups you have applied to" onSeeAll={seeAll('applications', 4)}>
                {acts.data.applications.length ? list('applications', 4).map((a) => <EventLine key={a.id} a={a} right={<StatusPill status={a.my_status} />} />)
                  : <p className="small muted">No applications yet. <Link to="/discover" className="see-all">Discover activities</Link></p>}
              </RailSection>
              <RailSection icon={CalendarDays} title="Upcoming Events" sub="Events you are going to attend" onSeeAll={seeAll('upcoming', 4)}>
                {acts.data.upcoming.length ? list('upcoming', 4).map((a) => <EventLine key={a.id} a={a} />) : <p className="small muted">Nothing scheduled.</p>}
              </RailSection>
              <RailSection icon={CheckCircle2} tone="success" title="Completed Events" sub="Past events you have attended" onSeeAll={seeAll('past', 4)}>
                {acts.data.past.length ? list('past', 4).map((a) => (
                  <EventLine key={a.id} a={a} right={a.feedback_given
                    ? <span className="pill green"><Star size={13} fill="currentColor" />{a.my_rating?.toFixed(1)}</span>
                    : <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); setSurvey(a); }}>Submit Feedback</button>} />
                )) : <p className="small muted">No past events yet.</p>}
              </RailSection>
            </>
          )}
        </aside>
      </div>
      {showFriends ? <FriendsModal friends={friends.data?.friends || []} onClose={() => setShowFriends(false)} onRemoved={(id) => friends.setData((d) => ({ friends: d.friends.filter((f) => f.id !== id) }))} /> : null}
      {survey ? <SurveyModal activity={survey} onClose={() => { setSurvey(null); clearParams(); }} onDone={acts.reload} /> : null}
      {manage ? <ManageApplications activityId={manage} onClose={() => { setManage(null); clearParams(); }} onChanged={acts.reload} /> : null}
    </div>
  );
}
