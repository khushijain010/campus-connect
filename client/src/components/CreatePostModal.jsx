import { useEffect, useMemo, useRef, useState } from 'react';
import { Type, Image as ImageIcon, Link2, CalendarDays, Hammer, MessagesSquare, BarChart3, X, Smile, Paperclip, FileText, Plus } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Avatar, Modal, OptionGrid } from './ui.jsx';

const TYPES = [
  { v: 'text', label: 'Text', icon: Type },
  { v: 'image', label: 'Image', icon: ImageIcon },
  { v: 'link', label: 'Link', icon: Link2 },
  { v: 'event', label: 'Event', icon: CalendarDays },
  { v: 'project', label: 'Project', icon: Hammer },
  { v: 'discussion', label: 'Discussion', icon: MessagesSquare },
  { v: 'poll', label: 'Poll', icon: BarChart3 },
];
// Topic chips in the composer; "For You" means no specific topic.
const COMPOSER_TOPICS = ['Tech', 'Culture', 'Politics', 'Sports', 'Arts', 'Academics', 'Life@Campus', 'Memes', 'Other'];
const EMOJIS = ['😀', '😂', '🥳', '🔥', '✨', '🎉', '📷', '💻', '⚽', '🎶', '🍛', '🙌'];

/** kind = 'post' (feed) or 'story' (cultural card). */
export default function CreatePostModal({ onClose, onCreated, kind = 'post', defaultTopic, communityId, initialType = 'text' }) {
  const { user, options } = useAuth();
  const toast = useToast();
  const [type, setType] = useState(kind === 'story' ? 'text' : initialType);
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [doc, setDoc] = useState(null);
  const [link, setLink] = useState('');
  const [meta, setMeta] = useState({ title: '', date: '', time: '', location: '', lookingFor: [], skills: [], teamSize: '' });
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [topic, setTopic] = useState(defaultTopic || '');
  const [storyCategory, setStoryCategory] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [community, setCommunity] = useState(communityId || '');
  const [myCommunities, setMyCommunities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const fileRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    if (kind === 'post') api.get('/communities?joined=1').then((r) => setMyCommunities(r.communities)).catch(() => {});
  }, [kind]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const setM = (k) => (e) => setMeta((m) => ({ ...m, [k]: e?.target ? e.target.value : e }));

  const submit = async () => {
    const fd = new FormData();
    fd.append('kind', kind);
    fd.append('type', type);
    fd.append('content', content);
    if (topic) fd.append('topic', topic);
    if (kind === 'story') fd.append('story_category', storyCategory);
    fd.append('visibility', visibility);
    if (community) fd.append('community_id', community);
    if (type === 'link') fd.append('link_url', link.trim());
    let m = null;
    if (type === 'event') m = { title: meta.title, date: meta.date, time: meta.time, location: meta.location };
    if (type === 'project') m = { title: meta.title, lookingFor: meta.lookingFor, skills: meta.skills, teamSize: meta.teamSize };
    if (type === 'link' && meta.title) m = { title: meta.title };
    if (type === 'poll') m = { poll: { options: pollOptions.map((o) => o.trim()).filter(Boolean) } };
    if (m) fd.append('meta', JSON.stringify(m));
    files.forEach((f) => fd.append('images', f));
    if (doc) fd.append('file', doc);
    setBusy(true);
    try {
      const r = await api.post('/posts', fd);
      toast(kind === 'story' ? 'Your story is live!' : 'Posted!');
      onCreated?.(r.post);
      onClose();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal title={kind === 'story' ? 'Share a cultural story' : 'Create Post'} onClose={onClose} wide>
      <div className="row"><Avatar user={user} size={42} /><div><div className="bold">{user.name}</div><div className="tiny muted">{user.department} · {user.year} Year</div></div></div>

      {kind === 'story' ? (
        <div className="field">
          <span className="label">Story type</span>
          <OptionGrid variant="chip" multi={false} options={options?.storyCategories || []} value={storyCategory} onChange={setStoryCategory} />
        </div>
      ) : null}

      <div style={{ position: 'relative' }}>
        <textarea className="textarea" style={{ minHeight: 130, paddingBottom: 40 }} autoFocus value={content} onChange={(e) => setContent(e.target.value)}
          placeholder={kind === 'story' ? 'Tell everyone something about your culture — a dish, a festival, a game…' : type === 'poll' ? 'Ask a question…' : "What's on your mind?"} />
        <div className="row" style={{ position: 'absolute', right: 8, bottom: 8, gap: 2 }}>
          {kind === 'post' ? <button type="button" className="icon-btn sm" onClick={() => docRef.current.click()} aria-label="Attach file" title="Attach a PDF or document"><Paperclip size={18} /></button> : null}
          <button type="button" className="icon-btn sm" onClick={() => setEmoji((x) => !x)} aria-label="Emoji"><Smile size={18} /></button>
        </div>
        {emoji ? (
          <div className="emoji-pop" style={{ bottom: 44, right: 8, gridTemplateColumns: 'repeat(6, 32px)' }}>
            {EMOJIS.map((e) => <button key={e} type="button" onClick={() => { setContent((c) => c + e); setEmoji(false); }}>{e}</button>)}
          </div>
        ) : null}
        <input ref={docRef} type="file" hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt"
          onChange={(e) => { const f = e.target.files[0]; if (f && f.size > 10 * 1024 * 1024) toast('Documents must be under 10 MB', 'error'); else if (f) setDoc(f); e.target.value = ''; }} />
      </div>

      {doc ? (
        <div className="file-card" style={{ marginTop: 0 }}>
          <span className="file-icon"><FileText size={19} /></span>
          <span className="grow small bold ellipsis">{doc.name}</span>
          <button type="button" className="icon-btn sm" onClick={() => setDoc(null)} aria-label="Remove file"><X size={15} /></button>
        </div>
      ) : null}

      {kind === 'post' ? (
        <div className="chips">
          {TYPES.map(({ v, label, icon: Icon }) => (
            <button key={v} type="button" className={`chip ${type === v ? 'navy' : ''}`} style={{ borderRadius: 8 }} onClick={() => setType(v)}><Icon size={15} />{label}</button>
          ))}
        </div>
      ) : null}

      {type === 'link' ? (
        <div className="grid-2">
          <input className="input" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
          <input className="input" placeholder="Link title (optional)" value={meta.title} onChange={setM('title')} />
        </div>
      ) : null}
      {type === 'event' ? (
        <div className="grid-2">
          <input className="input" placeholder="Event title" value={meta.title} onChange={setM('title')} />
          <input className="input" placeholder="Location" value={meta.location} onChange={setM('location')} />
          <input className="input" type="date" value={meta.date} onChange={setM('date')} aria-label="Date" />
          <input className="input" type="time" value={meta.time} onChange={setM('time')} aria-label="Time" />
        </div>
      ) : null}
      {type === 'project' ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="grid-2">
            <input className="input" placeholder="Project title" value={meta.title} onChange={setM('title')} />
            <input className="input" placeholder="Team size, e.g. 2/5" value={meta.teamSize} onChange={setM('teamSize')} />
          </div>
          <div className="field"><span className="label">Looking for</span>
            <OptionGrid options={['ML', 'Frontend', 'Backend', 'Hardware', 'Design']} value={meta.lookingFor} onChange={setM('lookingFor')} allowCustom /></div>
          <div className="field"><span className="label">Skills needed</span>
            <OptionGrid options={options?.skills || []} value={meta.skills} onChange={setM('skills')} allowCustom /></div>
        </div>
      ) : null}
      {type === 'poll' ? (
        <div className="stack" style={{ gap: 8 }}>
          {pollOptions.map((o, i) => (
            <div key={i} className="row">
              <input className="input" placeholder={`Option ${i + 1}`} value={o} maxLength={80}
                onChange={(e) => setPollOptions((x) => x.map((y, j) => (j === i ? e.target.value : y)))} />
              {pollOptions.length > 2 ? <button type="button" className="icon-btn sm" onClick={() => setPollOptions((x) => x.filter((_, j) => j !== i))} aria-label="Remove option"><X size={15} /></button> : null}
            </div>
          ))}
          {pollOptions.length < 6 ? <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPollOptions((x) => [...x, ''])}><Plus size={15} />Add option</button> : null}
        </div>
      ) : null}

      {(type === 'image' || kind === 'story' || files.length) ? (
        <div className="row wrap">
          {previews.map((src, i) => (
            <div key={src} style={{ position: 'relative' }}>
              <img src={src} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10 }} />
              <button type="button" className="icon-btn sm" style={{ position: 'absolute', top: 4, right: 4, background: 'var(--surface)' }}
                onClick={() => setFiles((f) => f.filter((_, j) => j !== i))} aria-label="Remove image"><X size={14} /></button>
            </div>
          ))}
          {files.length < 6 ? (
            <button type="button" className="btn btn-outline" style={{ height: 96, width: 96, flexDirection: 'column', gap: 4 }} onClick={() => fileRef.current.click()}>
              <ImageIcon size={20} /><span className="tiny">Add photo</span>
            </button>
          ) : null}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { setFiles((f) => [...f, ...e.target.files].slice(0, 6)); e.target.value = ''; }} />
        </div>
      ) : null}

      {kind === 'post' ? (
        <>
          <div className="field">
            <span className="label">Add to topic <span className="hint">(optional)</span></span>
            <div className="chips">
              <button type="button" className={`chip ${!topic ? 'navy' : ''}`} style={{ borderRadius: 8 }} onClick={() => setTopic('')}>For You</button>
              {COMPOSER_TOPICS.map((t) => <button key={t} type="button" className={`chip ${topic === t ? 'navy' : ''}`} style={{ borderRadius: 8 }} onClick={() => setTopic(t)}>{t}</button>)}
            </div>
          </div>
          {myCommunities.length ? (
            <label className="field">
              <span className="label">Post in a community <span className="hint">(optional)</span></span>
              <select className="select" value={community} onChange={(e) => setCommunity(e.target.value)}>
                <option value="">No community</option>
                {myCommunities.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </label>
          ) : null}
        </>
      ) : null}

      <label className="field">
        <span className="label">Visibility</span>
        <select className="select" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="public">Public (Everyone)</option>
          <option value="friends">Friends only</option>
          <option value="department">My department</option>
        </select>
      </label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-navy btn-lg" style={{ minWidth: 110 }} disabled={busy} onClick={submit}>{busy ? 'Posting…' : 'Post'}</button>
      </div>
    </Modal>
  );
}
