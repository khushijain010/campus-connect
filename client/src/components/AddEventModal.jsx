import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Modal, OptionGrid, Field, Group } from './ui.jsx';

const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

/** "Add Event" template from the Discover tab. `preset` pre-fills type/kind (e.g. Teach Me Something). */
export default function AddEventModal({ onClose, onCreated, preset = {} }) {
  const { options } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({
    title: '', type: preset.type || 'Hobby', date: '', time: '17:00', location: 'Campus', description: '', capacity: 8,
    requirements: [], level: 'Beginner', department: '', course: '', looking_for: [], skills: [], tags: [], kind: preset.kind || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post('/activities', { ...f, capacity: Number(f.capacity), is_cultural_exchange: f.type === 'Cultural' });
      toast('Event created — a group chat is ready for participants.');
      onCreated?.(r.activity);
      onClose();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal title={preset.kind === 'teach' ? 'Teach something from your culture' : 'Add Event'} onClose={onClose} wide footer={(
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create event'}</button>
      </>
    )}>
      <Field label="Title"><input className="input" autoFocus placeholder={preset.kind === 'teach' ? 'e.g. Bengali Cooking, Tamil Phrases' : 'e.g. Photography Walk'} value={f.title} onChange={set('title')} /></Field>
      {preset.kind !== 'teach' ? (
        <Group label="Type"><OptionGrid variant="chip" multi={false} options={options?.eventTypes || []} value={f.type} onChange={(v) => set('type')(v || 'Hobby')} /></Group>
      ) : null}
      <div className="grid-3">
        <Field label="Date"><input className="input" type="date" min={today()} value={f.date} onChange={set('date')} /></Field>
        <Field label="Time"><input className="input" type="time" value={f.time} onChange={set('time')} /></Field>
        <Field label="People" hint="(max)"><input className="input" type="number" min={2} max={200} value={f.capacity} onChange={set('capacity')} /></Field>
      </div>
      <div className="grid-2">
        <Field label="Location">
          <input className="input" list="locations" value={f.location} onChange={set('location')} />
          <datalist id="locations">{(options?.locations || []).concat(['IITR Campus', 'OAT', 'Mess Lawn']).map((l) => <option key={l} value={l} />)}</datalist>
        </Field>
        <Field label="Level">
          <select className="select" value={f.level} onChange={set('level')}>{(options?.levels || []).map((l) => <option key={l}>{l}</option>)}</select>
        </Field>
      </div>
      <Field label="Description"><textarea className="textarea" placeholder="Short event description" value={f.description} onChange={set('description')} /></Field>
      <Group label="Requirements" hint="(optional)">
        <OptionGrid options={['Camera', 'Laptop', 'Sports Equipment', 'Instrument']} value={f.requirements} onChange={set('requirements')} allowCustom />
      </Group>
      {f.type === 'Study' ? (
        <div className="grid-2">
          <Field label="Course"><select className="select" value={f.course} onChange={set('course')}><option value="">Any</option>{(options?.courses || []).map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Department"><select className="select" value={f.department} onChange={set('department')}><option value="">Open to all</option>{(options?.departments || []).map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
      ) : null}
      {f.type === 'Project' ? (
        <>
          <Group label="Looking for"><OptionGrid options={['ML', 'Frontend', 'Backend', 'Hardware', 'Design']} value={f.looking_for} onChange={set('looking_for')} allowCustom /></Group>
          <Group label="Skills"><OptionGrid options={options?.skills || []} value={f.skills} onChange={set('skills')} allowCustom /></Group>
        </>
      ) : null}
      <Group label="Tags" hint="(help the right people find it)">
        <OptionGrid options={[...(options?.interests || []), ...(options?.hobbies || []).slice(0, 4), ...(options?.culturalInterests || [])]} value={f.tags} onChange={set('tags')} allowCustom />
      </Group>
    </Modal>
  );
}
