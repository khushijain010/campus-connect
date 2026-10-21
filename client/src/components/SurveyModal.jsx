import { useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { Modal, Stars } from './ui.jsx';

const QUESTIONS = [
  ['met_new', 'Connection', 'Did you meet someone you would not normally interact with?'],
  ['learned_new', 'Learning', 'Did you learn something new?'],
  ['cultural', 'Cultural Interaction', 'Did you learn something about another culture/region?'],
  ['again', 'Future Participation', 'Would you participate in a similar activity again?'],
];

export default function SurveyModal({ activity, onClose, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [ans, setAns] = useState({});
  const [comment, setComment] = useState('');
  const [allowPublic, setAllowPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/activities/${activity.id}/feedback`, { rating, ...ans, comment, allow_public: allowPublic });
      toast(r.featured ? 'Thanks! Your feedback may appear anonymously in Reviews.' : 'Thanks for your feedback!');
      onDone?.(rating);
      onClose();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal title={`How was “${activity.title}”?`} onClose={onClose} footer={(
      <>
        <button className="btn btn-ghost" onClick={onClose}>Later</button>
        <button className="btn btn-primary" disabled={!rating || busy} onClick={submit}>Submit feedback</button>
      </>
    )}>
      <div className="field">
        <span className="label">Experience</span>
        <span className="small muted">How was your overall experience?</span>
        <Stars value={rating} onChange={setRating} />
      </div>
      {QUESTIONS.map(([key, title, q]) => (
        <div key={key} className="field">
          <span className="label">{title}</span>
          <span className="small muted">{q}</span>
          <div className="yn">
            {['yes', 'no'].map((v) => (
              <button key={v} type="button" className={`chip ${ans[key] === v ? 'on' : ''}`} onClick={() => setAns((a) => ({ ...a, [key]: v }))}>{v === 'yes' ? 'Yes' : 'No'}</button>
            ))}
          </div>
        </div>
      ))}
      <label className="field">
        <span className="label">Feedback</span>
        <span className="small muted">What did you like about the experience?</span>
        <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share a highlight…" />
      </label>
      <label className="check"><input type="checkbox" checked={allowPublic} onChange={(e) => setAllowPublic(e.target.checked)} />Allow this to appear anonymously in Reviews & Testimonials</label>
    </Modal>
  );
}
