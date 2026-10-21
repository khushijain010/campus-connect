import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, Gauge, MessageCircle, Flag, CheckCircle2, ClipboardList, Star, Wrench, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { eventDate, eventTime, timeAgo } from '../lib/format.js';
import { Avatar, Empty, Modal, Spinner, StatusPill, useApi } from '../components/ui.jsx';
import { JoinButton, kindColor } from '../components/cards.jsx';
import ReportModal from '../components/ReportModal.jsx';
import SurveyModal from '../components/SurveyModal.jsx';

export function ManageApplications({ activityId, onClose, onChanged }) {
  const toast = useToast();
  const { data, loading, reload } = useApi(() => api.get(`/activities/${activityId}`), [activityId]);
  const decide = async (userId, status) => {
    try { await api.post(`/activities/${activityId}/applications/${userId}`, { status }); toast(status === 'accepted' ? 'Accepted — added to the group chat' : 'Application declined'); reload(); onChanged?.(); } catch (e) { toast(e.message, 'error'); }
  };
  const a = data?.activity;
  return (
    <Modal title={a ? `Applications · ${a.title}` : 'Applications'} onClose={onClose} wide>
      {loading ? <Spinner /> : (
        <>
          <div className="row wrap" style={{ gap: 10 }}>
            <span className="pill">{a.applications.length} applications</span>
            <span className="pill green">{a.participants - 1} accepted</span>
            <span className="pill amber">{a.applications.filter((x) => x.status === 'pending').length} pending</span>
            <span className="pill grey">{a.openings} opening{a.openings === 1 ? '' : 's'}</span>
          </div>
          {a.applications.length ? a.applications.map((u) => (
            <div key={u.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <Link to={`/u/${u.handle}`}><Avatar user={u} size={44} /></Link>
              <div className="grow stack" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 8 }}><Link to={`/u/${u.handle}`} className="bold">{u.name}</Link><StatusPill status={u.status} /></div>
                <div className="tiny muted">{u.year} Yr · {u.department} · applied {timeAgo(u.applied_at)}</div>
                {u.skills?.length ? <div className="chips" style={{ gap: 4 }}>{u.skills.map((s) => <span key={s} className="pill sm grey">{s}</span>)}</div> : null}
                {u.message ? <p className="small" style={{ background: 'var(--surface-2)', padding: '8px 10px', borderRadius: 10 }}>{u.message}</p> : null}
              </div>
              {u.status !== 'accepted' ? <button className="btn btn-sm btn-success-soft" disabled={a.openings <= 0} onClick={() => decide(u.id, 'accepted')}>Accept</button> : null}
              {u.status !== 'rejected' ? <button className="btn btn-sm btn-danger-soft" onClick={() => decide(u.id, 'rejected')}>{u.status === 'accepted' ? 'Remove' : 'Reject'}</button> : null}
            </div>
          )) : <Empty icon={ClipboardList} title="No applications yet">Share your event so people can find it.</Empty>}
        </>
      )}
    </Modal>
  );
}

export default function ActivityPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data, loading, error, setData, reload } = useApi(() => api.get(`/activities/${id}`), [id]);
  const [manage, setManage] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [survey, setSurvey] = useState(false);

  if (loading) return <div className="page"><Spinner /></div>;
  if (error) return <div className="page"><div className="card"><Empty icon={Search} title="Activity not found" /></div></div>;
  const a = data.activity;
  const mine = a.creator_id === user.id;
  const complete = async () => {
    if (!window.confirm('Mark as completed? Participants will be asked for feedback.')) return;
    try { await api.post(`/activities/${a.id}/complete`); toast('Marked as completed — feedback survey sent'); reload(); } catch (e) { toast(e.message, 'error'); }
  };
  const openChat = async () => {
    const r = await api.get(`/activities/${a.id}`);
    if (r.activity.conversation_id) nav(`/chats?c=${r.activity.conversation_id}`);
  };

  return (
    <div className="page">
      <button className="btn btn-ghost" style={{ marginBottom: 12, paddingLeft: 6 }} onClick={() => nav(-1)}><ArrowLeft size={18} />Back</button>
      <div className="with-rail">
        <div className="stack">
          <section className="card" style={{ overflow: 'hidden' }}>
            <div style={{ height: 150, background: `linear-gradient(120deg, ${kindColor(a)}, ${kindColor(a)}88)`, display: 'grid', placeItems: 'center', fontSize: 72 }}>{a.emoji}</div>
            <div className="card-pad stack" style={{ gap: 14 }}>
              <div className="chips"><span className="pill">{a.type}</span><span className="pill grey">{a.category}</span>{a.is_cultural_exchange ? <span className="pill amber">Cultural exchange</span> : null}<StatusPill status={a.status === 'completed' ? 'completed' : a.my_status || ''} /></div>
              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{a.title}</h1>
              <div className="grid-3" style={{ gap: 12 }}>
                <div className="row small"><CalendarDays size={17} className="muted" />{eventDate(a.date)}</div>
                <div className="row small"><Clock size={17} className="muted" />{eventTime(a.time)}{a.slot ? <span className="faint">({a.slot})</span> : null}</div>
                <div className="row small"><MapPin size={17} className="muted" />{a.location}</div>
                <div className="row small"><Users size={17} className="muted" />{a.participants}/{a.capacity} people · {a.openings} open</div>
                <div className="row small"><Gauge size={17} className="muted" />{a.level}</div>
                {a.course ? <div className="row small"><ClipboardList size={17} className="muted" />{a.course}{a.department ? ` · ${a.department}` : ''}</div> : null}
              </div>
              {a.description ? <p style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{a.description}</p> : null}
              {a.looking_for?.length ? <div><div className="label" style={{ marginBottom: 6 }}>Looking for</div><div className="chips">{a.looking_for.map((x) => <span key={x} className="pill">{x}</span>)}</div></div> : null}
              {a.skills?.length ? <div><div className="label" style={{ marginBottom: 6 }}>Skills</div><div className="chips">{a.skills.map((x) => <span key={x} className="pill grey">{x}</span>)}</div></div> : null}
              {a.requirements?.length ? <div><div className="label" style={{ marginBottom: 6 }}>Requirements</div><div className="chips">{a.requirements.map((x) => <span key={x} className="pill amber"><Wrench size={12} />{x}</span>)}</div></div> : null}
              <div className="row wrap" style={{ paddingTop: 4 }}>
                {!mine ? <JoinButton activity={a} size="lg" onChange={(n) => { setData((d) => ({ ...d, activity: { ...d.activity, ...n } })); reload(); }} /> : null}
                {a.my_status === 'accepted' ? <button className="btn btn-outline btn-lg" onClick={openChat}><MessageCircle size={17} />Group chat</button> : null}
                {mine && a.status === 'open' ? (
                  <>
                    <button className="btn btn-primary btn-lg" onClick={() => setManage(true)}><ClipboardList size={17} />Manage Applications{a.pending ? <span className="badge" style={{ background: '#fff', color: 'var(--primary)' }}>{a.pending}</span> : null}</button>
                    <button className="btn btn-outline btn-lg" onClick={complete}><CheckCircle2 size={17} />Mark completed</button>
                  </>
                ) : null}
                {a.status === 'completed' && a.my_status === 'accepted' && !a.feedback_given ? <button className="btn btn-primary btn-lg" onClick={() => setSurvey(true)}><Star size={17} />Submit Feedback</button> : null}
                {a.feedback_given ? <span className="pill green">Feedback submitted — thank you!</span> : null}
                <span className="grow" />
                {!mine ? <button className="btn btn-ghost" onClick={() => setReporting(true)}><Flag size={16} />Report</button> : null}
              </div>
            </div>
          </section>
        </div>
        <aside className="rail">
          <div className="card card-pad stack" style={{ gap: 10 }}>
            <div className="label">Organised by</div>
            <Link to={`/u/${a.creator.handle}`} className="row"><Avatar user={a.creator} size={44} /><div><div className="bold">{a.creator.name}</div><div className="tiny muted">@{a.creator.handle}</div></div></Link>
          </div>
          <div className="card">
            <div className="card-head"><div className="card-title">Participants ({a.members.length})</div></div>
            <div className="card-body">
              {a.members.map((m) => (
                <Link key={m.id} to={`/u/${m.handle}`} className="list-row clickable" style={{ padding: '8px 6px' }}>
                  <Avatar user={m} size={36} />
                  <div className="grow"><div className="small bold">{m.name}</div><div className="tiny muted">{m.year} Yr · {m.department} · {m.region}</div></div>
                  {m.id === a.creator_id ? <span className="pill sm">Organiser</span> : null}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
      {manage ? <ManageApplications activityId={a.id} onClose={() => { setManage(false); reload(); }} /> : null}
      {reporting ? <ReportModal type="activity" id={a.id} blockUser={a.creator} onClose={() => setReporting(false)} onBlocked={() => nav('/discover')} /> : null}
      {survey ? <SurveyModal activity={a} onClose={() => setSurvey(false)} onDone={reload} /> : null}
    </div>
  );
}

