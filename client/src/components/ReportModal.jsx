import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Modal } from './ui.jsx';

const LABEL = { user: 'profile', post: 'post', activity: 'group', community: 'community', message: 'message' };

/** Block / Report / Cancel dialog. `blockUser` ({id, name}) enables the Block action. */
export default function ReportModal({ type, id, blockUser, onClose, onBlocked }) {
  const { options } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const report = async () => {
    setBusy(true);
    try {
      await api.post('/reports', { target_type: type, target_id: id, reason, details });
      toast('Thanks — our moderators will review this report.');
      onClose();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const block = async () => {
    setBusy(true);
    try {
      await api.post(`/users/${blockUser.id}/block`);
      toast(`${blockUser.name} is blocked. You won't see each other's content.`);
      onBlocked?.();
      onClose();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Block or report this ${LABEL[type]}`} onClose={onClose} footer={(
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        {blockUser ? <button className="btn btn-danger-soft" disabled={busy} onClick={block}>Block {blockUser.name.split(' ')[0]}</button> : null}
        <button className="btn btn-danger" disabled={!reason || busy} onClick={report}>Report</button>
      </>
    )}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className="section-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><ShieldAlert size={20} /></span>
        <p className="muted">Reports are confidential. Blocking hides your profiles, posts and messages from each other.</p>
      </div>
      <div className="field">
        <span className="label">Reason</span>
        <div className="chips">
          {(options?.reportReasons || []).map((r) => (
            <button key={r} type="button" className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="label">Details <span className="hint">(optional)</span></span>
        <textarea className="textarea" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything that helps us understand what happened" />
      </label>
    </Modal>
  );
}
