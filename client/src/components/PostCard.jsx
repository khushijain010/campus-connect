import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Link2, Flag, Trash2, CalendarDays, MapPin, Clock, Hammer, Users, FileText, Check, Sparkles,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { timeAgo, eventDate, eventTime } from '../lib/format.js';
import { Avatar, Dropdown, Img } from './ui.jsx';
import ReportModal from './ReportModal.jsx';

const HASHTAG = /#[\p{L}\p{N}_/+-]+/gu;

// Inline #tags become links. Trailing hashtags are shown as pills under the text instead (see splitHashtags).
export function RichText({ text }) {
  const parts = String(text || '').split(/(#[\p{L}\p{N}_/+-]+)/gu);
  return parts.map((p, i) => (p.startsWith('#') ? <Link key={i} className="tag" to={`/search?q=${encodeURIComponent(p)}`}>{p}</Link> : p));
}

export function splitHashtags(content) {
  const text = String(content || '');
  const m = text.match(/(?:\s*#[\p{L}\p{N}_/+-]+)+\s*$/u);
  if (!m) return { body: text, tags: [] };
  return { body: text.slice(0, m.index).trimEnd(), tags: m[0].match(HASHTAG) || [] };
}

const fileSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function usePostActions(post, onChange) {
  const toast = useToast();
  const upvote = async () => {
    onChange({ ...post, upvoted: !post.upvoted, upvotes: post.upvotes + (post.upvoted ? -1 : 1) });
    try { const r = await api.post(`/posts/${post.id}/upvote`); onChange({ ...post, upvoted: r.upvoted, upvotes: r.upvotes }); } catch (e) { toast(e.message, 'error'); onChange(post); }
  };
  const save = async () => {
    try { const r = await api.post(`/posts/${post.id}/save`); onChange({ ...post, saved: r.saved }); toast(r.saved ? 'Saved' : 'Removed from saved'); } catch (e) { toast(e.message, 'error'); }
  };
  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try { await navigator.clipboard.writeText(url); toast('Link copied to clipboard'); } catch { toast(url); }
  };
  return { upvote, save, share };
}

function PostMenu({ post, onDelete }) {
  const { user } = useAuth();
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const mine = post.author.id === user.id;
  const del = async () => {
    if (!window.confirm('Delete this post?')) return;
    try { await api.del(`/posts/${post.id}`); toast('Post deleted'); onDelete?.(post.id); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <Dropdown trigger={({ toggle }) => <button className="icon-btn sm" onClick={toggle} aria-label="Post options"><MoreHorizontal size={18} /></button>}>
        {post.reasons?.length ? (
          <div className="menu-item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
            <Sparkles size={16} color="var(--primary)" style={{ marginTop: 2 }} />
            <span><span className="tiny faint" style={{ display: 'block' }}>Why you're seeing this</span>{post.reasons.join(' · ')}</span>
          </div>
        ) : null}
        <button className="menu-item" onClick={async () => { await navigator.clipboard?.writeText(`${window.location.origin}/post/${post.id}`); toast('Link copied'); }}><Link2 size={16} /> Copy link</button>
        {mine
          ? <button className="menu-item danger" onClick={del}><Trash2 size={16} /> Delete post</button>
          : <button className="menu-item danger" onClick={() => setReporting(true)}><Flag size={16} /> Block / Report</button>}
      </Dropdown>
      {reporting ? <ReportModal type="post" id={post.id} blockUser={post.author} onClose={() => setReporting(false)} onBlocked={() => onDelete?.(post.id)} /> : null}
    </>
  );
}

function Poll({ post, onChange }) {
  const toast = useToast();
  const p = post.poll;
  const voted = p.my_vote !== null && p.my_vote !== undefined;
  const vote = async (i) => {
    try { const r = await api.post(`/posts/${post.id}/vote`, { option: i }); onChange({ ...post, poll: r.poll }); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <div className="poll">
      {p.options.map((o, i) => {
        const pct = p.total ? Math.round((p.counts[i] / p.total) * 100) : 0;
        return (
          <button key={o} className={`poll-opt ${p.my_vote === i ? 'mine' : ''}`} onClick={() => vote(i)} aria-pressed={p.my_vote === i}>
            {voted ? <span className="bar" style={{ width: `${pct}%` }} /> : null}
            <span>{p.my_vote === i ? <Check size={15} color="var(--primary)" /> : null}{o}</span>
            {voted ? <span className="small muted">{pct}%</span> : null}
          </button>
        );
      })}
      <div className="tiny faint">{p.total} vote{p.total === 1 ? '' : 's'}{voted ? ' · tap another option to change your vote' : ''}</div>
    </div>
  );
}

function TypeBlock({ post, onChange }) {
  const m = post.meta || {};
  return (
    <>
      {m.file ? (
        <a className="file-card" href={m.file.url} target="_blank" rel="noreferrer" download={m.file.name}>
          <span className="file-icon"><FileText size={20} /></span>
          <span className="grow" style={{ minWidth: 0 }}><span className="bold small ellipsis" style={{ display: 'block' }}>{m.file.name}</span><span className="tiny muted">{fileSize(m.file.size)} · {m.file.type}</span></span>
        </a>
      ) : null}
      {post.type === 'poll' && post.poll ? <Poll post={post} onChange={onChange} /> : null}
      {post.type === 'link' && post.link_url ? (() => {
        let host = post.link_url;
        try { host = new URL(post.link_url).hostname; } catch { /* keep raw */ }
        return (
          <a className="file-card" href={post.link_url} target="_blank" rel="noreferrer noopener">
            <span className="file-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Link2 size={19} /></span>
            <span className="grow" style={{ minWidth: 0 }}><span className="bold small ellipsis" style={{ display: 'block' }}>{m.title || post.link_url}</span><span className="tiny muted">{host}</span></span>
          </a>
        );
      })() : null}
      {post.type === 'event' && m.title ? (
        <div className="file-card">
          <span className="file-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><CalendarDays size={19} /></span>
          <div className="grow">
            <div className="bold small">{m.title}</div>
            <div className="row wrap tiny muted" style={{ gap: 10, marginTop: 2 }}>
              {m.date ? <span className="row" style={{ gap: 4 }}><CalendarDays size={12} />{eventDate(m.date)}</span> : null}
              {m.time ? <span className="row" style={{ gap: 4 }}><Clock size={12} />{eventTime(m.time)}</span> : null}
              {m.location ? <span className="row" style={{ gap: 4 }}><MapPin size={12} />{m.location}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
      {post.type === 'project' && m.title ? (
        <div className="file-card" style={{ alignItems: 'flex-start' }}>
          <span className="file-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Hammer size={19} /></span>
          <div className="grow stack" style={{ gap: 4 }}>
            <div className="row between"><span className="bold small">{m.title}</span>{m.teamSize ? <span className="pill sm grey"><Users size={12} />{m.teamSize}</span> : null}</div>
            {m.lookingFor?.length ? <div className="tiny"><span className="muted">Looking for: </span>{m.lookingFor.join(', ')}</div> : null}
            {m.skills?.length ? <div className="tiny"><span className="muted">Skills: </span>{m.skills.join(', ')}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function PostCard({ post, onChange, onDelete, compact, bare }) {
  const nav = useNavigate();
  const { upvote, save, share } = usePostActions(post, onChange);
  const imgs = post.images || [];
  const { body, tags } = splitHashtags(post.content);
  const a = post.author;
  return (
    <article className={bare ? 'post' : 'card post'}>
      <div className="post-head">
        <Link to={`/u/${a.handle}`}><Avatar user={a} size={40} /></Link>
        <div className="grow" style={{ minWidth: 0 }}>
          <Link to={`/u/${a.handle}`} className="bold">{a.name}</Link>
          <div className="tiny muted row wrap" style={{ gap: 0 }}>
            <span>{[a.department, a.year ? `${a.year} Year` : null].filter(Boolean).join(' · ')}</span>
            <span className="dot-sep">{timeAgo(post.created_at)}</span>
            {post.community ? <Link to={`/community/${post.community.id}`} className="dot-sep" style={{ color: 'var(--primary)' }}>{post.community.name}</Link> : null}
          </div>
        </div>
        <PostMenu post={post} onDelete={onDelete} />
      </div>
      {post.story_category ? <div className="bold" style={{ marginTop: 10 }}>{post.story_category}</div> : null}
      {body ? (
        <div className={`post-body ${compact ? 'clamp-2' : ''}`} onClick={() => compact && nav(`/post/${post.id}`)} style={{ cursor: compact ? 'pointer' : undefined }}>
          <RichText text={body} />
        </div>
      ) : null}
      {tags.length ? <div className="hashtags">{tags.map((t) => <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="hashtag">{t}</Link>)}</div> : null}
      <TypeBlock post={post} onChange={onChange} />
      {imgs.length ? (
        <div className={`post-images n${Math.min(imgs.length, 4)}`} onClick={() => nav(`/post/${post.id}`)} style={{ cursor: 'pointer' }}>
          {imgs.slice(0, 4).map((src) => <Img key={src} src={src} />)}
        </div>
      ) : null}
      <div className="post-actions">
        <button className={`post-action ${post.upvoted ? 'on-red' : ''}`} onClick={upvote} aria-pressed={post.upvoted} title="Upvote" aria-label="Upvote">
          <Heart size={18} fill={post.upvoted ? 'currentColor' : 'none'} />{post.upvotes}
        </button>
        <button className="post-action" onClick={() => nav(`/post/${post.id}`)} aria-label="Comments"><MessageCircle size={18} />{post.comment_count}</button>
        <button className="post-action" onClick={share}><Share2 size={17} />Share</button>
        <span className="grow" />
        <button className={`post-action ${post.saved ? 'on' : ''}`} onClick={save} aria-label="Save"><Bookmark size={18} fill={post.saved ? 'currentColor' : 'none'} /></button>
      </div>
    </article>
  );
}

// Compact cultural card / mini story (Culture page).
export function StoryCard({ post, onChange }) {
  const nav = useNavigate();
  const { upvote, save, share } = usePostActions(post, onChange);
  return (
    <article className="tile" style={{ minWidth: 0 }}>
      <div className="row" style={{ padding: '12px 14px 8px', gap: 10 }}>
        <Link to={`/u/${post.author.handle}`}><Avatar user={post.author} size={32} /></Link>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="small bold ellipsis">{post.author.name}</div>
          <div className="tiny muted">{post.author.region}</div>
        </div>
      </div>
      <div style={{ padding: '0 14px 8px', cursor: 'pointer' }} onClick={() => nav(`/post/${post.id}`)}>
        <div className="bold small" style={{ marginBottom: 4 }}>{post.story_category}</div>
        {post.images?.[0] ? <Img src={post.images[0]} /> : <p className="small muted clamp-2">{post.content}</p>}
        {post.images?.[0] ? <p className="small muted clamp-2" style={{ marginTop: 6 }}>{post.content}</p> : null}
      </div>
      <div className="post-actions" style={{ padding: '0 8px 6px', marginTop: 'auto' }}>
        <button className={`post-action ${post.upvoted ? 'on-red' : ''}`} onClick={upvote} aria-label="Like"><Heart size={16} fill={post.upvoted ? 'currentColor' : 'none'} />{post.upvotes}</button>
        <button className="post-action" onClick={() => nav(`/post/${post.id}`)} aria-label="Comment"><MessageCircle size={16} />{post.comment_count}</button>
        <span className="grow" />
        <button className={`post-action ${post.saved ? 'on' : ''}`} onClick={save} aria-label="Save"><Bookmark size={16} fill={post.saved ? 'currentColor' : 'none'} /></button>
        <button className="post-action" onClick={share} aria-label="Share"><Share2 size={16} /></button>
      </div>
    </article>
  );
}
