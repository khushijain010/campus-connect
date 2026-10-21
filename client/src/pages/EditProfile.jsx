import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Ban } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Avatar, Spinner, useApi } from '../components/ui.jsx';
import { BasicSection, AcademicSection, PreferenceSection, CulturalSection } from '../components/ProfileForm.jsx';

function Block({ id, title, children }) {
  return (
    <section className="card card-pad stack" id={id} style={{ gap: 16 }}>
      <h2 className="card-title">{title}</h2>
      {children}
    </section>
  );
}

export default function EditProfile() {
  const { user, setUser, options } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [v, setV] = useState({ ...user, password: '' });
  const [avatar, setAvatar] = useState(null);
  const [busy, setBusy] = useState(false);
  const blocked = useApi(() => api.get('/users/me/blocked'));
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val?.target ? val.target.value : val }));

  useEffect(() => { if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView(); }, []);
  if (!options) return <Spinner />;

  const save = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      const { password, ...rest } = v;
      fd.append('profile', JSON.stringify({ ...rest, ...(password ? { password } : {}) }));
      if (avatar) fd.append('avatar', avatar);
      const r = await api.put('/users/me', fd);
      setUser(r.user);
      toast('Profile updated');
      nav('/personal');
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const unblock = async (u) => { await api.del(`/users/${u.id}/block`); toast(`${u.name} unblocked`); blocked.reload(); };

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <button className="btn btn-ghost" style={{ marginBottom: 12, paddingLeft: 6 }} onClick={() => nav(-1)}><ArrowLeft size={18} />Back</button>
      <div className="page-head">
        <div><h1 className="page-title">Edit Profile</h1><p className="page-sub">Better profiles mean better recommendations.</p></div>
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
      <div className="stack" style={{ gap: 18 }}>
        <Block title="Basic Information"><BasicSection v={v} set={set} avatarFile={avatar} setAvatarFile={setAvatar} editing /></Block>
        <Block title="Academic Information"><AcademicSection v={v} set={set} options={options} /></Block>
        <Block title="Preferences"><PreferenceSection v={v} set={set} options={options} /></Block>
        <Block id="culture" title="Cultural Information"><CulturalSection v={v} set={set} options={options} /></Block>
        <Block title="Blocked users">
          {blocked.data?.blocked?.length ? blocked.data.blocked.map((u) => (
            <div key={u.id} className="list-row"><Avatar user={u} size={36} /><div className="grow bold small">{u.name}</div><button className="btn btn-sm btn-outline" onClick={() => unblock(u)}>Unblock</button></div>
          )) : <p className="small muted row" style={{ gap: 6 }}><Ban size={15} />You haven't blocked anyone.</p>}
        </Block>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => nav('/personal')}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

