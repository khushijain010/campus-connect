import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Heart, MessageCircle, MoreHorizontal, ChevronDown, Trash2, Flag, X, Check } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { timeAgo } from '../lib/format.js';
import { Avatar, Dropdown, Empty, Spinner, useApi } from '../components/ui.jsx';
import PostCard from '../components/PostCard.jsx';
import ReportModal from '../components/ReportModal.jsx';

const SORTS = [{ value: 'relevant', label: 'Most Relevant' }, { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }];

function Comment({ c, postOwnerId, onReply, onChanged, isReply }) {
  const { user } = useAuth();
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const like = async () => {
    try { const r = await api.post(`/comments/${c.id}/like`); onChanged({ ...c, liked: r.liked, likes: r.likes }); } catch (e) { toast(e.message, 'error'); }
  };
  const del = async () => {
    if (!window.confirm('Delete this comment?')) return;
    try { await api.del(`/comments/${c.id}`); onChanged(null); toast('Comment deleted'); } catch (e) { toast(e.message, 'error'); }
  };
  const canDelete = c.author.id === user.id || postOwnerId === user.id;
  return (
    <div className="comment">
      <Link to={`/u/${c.author.handle}`}><Avatar user={c.author} size={isReply ? 28 : 34} /></Link>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="row" style={{ gap: 6 }}><Link to={`/u/${c.author.handle}`} className="bold small">{c.author.name}</Link><span className="tiny faint">· {timeAgo(c.created_at)}</span></div>
            <div className="tiny muted">{c.author.department}{c.author.year ? ` · ${c.author.year} Year` : ''}</div>
          </div>
          <Dropdown trigger={({ toggle }) => <button className="icon-btn sm" onClick={toggle} aria-label="Comment options"><MoreHorizontal size={16} /></button>}>
            {canDelete ? <button className="menu-item danger" onClick={del}><Trash2 size={15} />Delete comment</button> : null}
            {c.author.id !== user.id ? <button className="menu-item danger" onClick={() => setReporting(true)}><Flag size={15} />Block / Report</button> : null}
          </Dropdown>
        </div>
        <p className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{c.content}</p>
        <div className="comment-actions">
          <button className={c.liked ? 'on' : ''} onClick={like} aria-pressed={c.liked} aria-label="Like comment"><Heart size={14} fill={c.liked ? 'currentColor' : 'none'} />{c.likes}</button>
          <button onClick={() => onReply(c)}><MessageCircle size={14} />Reply</button>
        </div>
        {c.replies?.length ? (
          <div className="replies">
            {c.replies.map((r) => (
              <Comment key={r.id} c={r} postOwnerId={postOwnerId} onReply={() => onReply(c, r.author)} isReply
                onChanged={(n) => onChanged({ ...c, replies: n ? c.replies.map((x) => (x.id === r.id ? n : x)) : c.replies.filter((x) => x.id !== r.id) })} />
            ))}
          </div>
        ) : null}
      </div>
      {reporting ? <ReportModal type="comment" id={c.id} blockUser={c.author} onClose={() => setReporting(false)} onBlocked={() => onChanged(null)} /> : null}
    </div>
  );
}

const countAll = (list) => list.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);

export default function PostDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [sort, setSort] = useState('relevant');
  const { data, loading, error, setData } = useApi(() => api.get(`/posts/${id}?sort=${sort}`), [id]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const inputRef = useRef(null);

  const changeSort = async (s) => {
    setSort(s);
    const r = await api.get(`/posts/${id}/comments?sort=${s}`);
    setData((d) => ({ ...d, comments: r.comments }));
  };
  const setComment = (cid, next) => setData((d) => ({ ...d, comments: next ? d.comments.map((x) => (x.id === cid ? next : x)) : d.comments.filter((x) => x.id !== cid) }));
  const reply = (c, mention) => {
    setReplyTo({ id: c.id, name: (mention || c.author).name });
    if (mention && mention.id !== user.id) setText(`@${mention.handle} `);
    inputRef.current?.focus();
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const r = await api.post(`/posts/${id}/comments`, { content: text, parent_id: replyTo?.id });
      setData((d) => {
        const comments = r.comment.parent_id
          ? d.comments.map((c) => (c.id === r.comment.parent_id ? { ...c, replies: [...c.replies, r.comment] } : c))
          : (sort === 'oldest' ? [...d.comments, r.comment] : [r.comment, ...d.comments]);
        return { ...d, comments, post: { ...d.post, comment_count: d.post.comment_count + 1 } };
      });
      setText(''); setReplyTo(null);
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="page">
      <div className="feed-col">
        <button className="back-link" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}><ArrowLeft size={17} />Back</button>
        {loading ? <Spinner /> : error ? <div className="card"><Empty title="Post not found">It may have been deleted or you don't have access.</Empty></div> : (
          <div className="card">
            <PostCard bare post={data.post} onChange={(p) => setData((d) => ({ ...d, post: p }))} onDelete={() => nav('/')} />
            <div style={{ padding: '4px 20px 0', borderTop: '1px solid var(--border)' }}>
              <div className="row between" style={{ padding: '12px 0 4px' }}>
                <span className="bold">Comments ({countAll(data.comments)})</span>
                <Dropdown trigger={({ toggle }) => (
                  <button className="btn btn-ghost btn-sm" onClick={toggle}>{SORTS.find((s) => s.value === sort).label}<ChevronDown size={14} /></button>
                )}>
                  {SORTS.map((s) => (
                    <button key={s.value} className="menu-item" onClick={() => changeSort(s.value)}>
                      {s.label}{sort === s.value ? <Check size={15} color="var(--primary)" style={{ marginLeft: 'auto' }} /> : null}
                    </button>
                  ))}
                </Dropdown>
              </div>
              {data.comments.length ? data.comments.map((c) => (
                <Comment key={c.id} c={c} postOwnerId={data.post.author.id} onReply={reply} onChanged={(n) => setComment(c.id, n)} />
              )) : <p className="muted small" style={{ padding: '10px 0 16px' }}>No comments yet — start the conversation.</p>}
            </div>
            <form className="composer" onSubmit={send} style={{ flexWrap: 'wrap' }}>
              {replyTo ? (
                <div className="row small muted" style={{ width: '100%', gap: 6 }}>
                  Replying to <b style={{ color: 'var(--text)' }}>{replyTo.name}</b>
                  <button type="button" className="icon-btn sm" onClick={() => { setReplyTo(null); setText(''); }} aria-label="Cancel reply"><X size={14} /></button>
                </div>
              ) : null}
              <Avatar user={user} size={34} />
              <input ref={inputRef} className="input grow" placeholder={replyTo ? 'Write a reply…' : 'Write a comment…'} value={text} onChange={(e) => setText(e.target.value)} />
              <button className="icon-btn" style={{ color: 'var(--primary)' }} disabled={!text.trim()} aria-label="Send"><Send size={19} /></button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
