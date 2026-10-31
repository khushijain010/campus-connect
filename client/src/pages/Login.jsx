import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { isCollegeEmail, EMAIL_EXAMPLE } from '../lib/college.js';
import { ThemeToggle } from '../lib/theme.jsx';
import { Field } from '../components/ui.jsx';
import { PasswordInput } from '../components/ProfileForm.jsx';

export default function Login() {
  const { login, meta } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isCollegeEmail(email, meta?.emailSuffixes)) { setError(`Use your IITR email, e.g. ${EMAIL_EXAMPLE}`); return; }
    setBusy(true);
    try { await login(email.trim(), password); nav('/', { replace: true }); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <ThemeToggle className="icon-btn auth-theme" />
      <div className="stack" style={{ alignItems: 'center', gap: 26, width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Link to="/" className="row" style={{ justifyContent: 'center', gap: 12 }} title="Back to home">
            <img src="/logo.svg" alt="" style={{ width: 52 }} />
            <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>CampusConnect</span>
          </Link>
          <div className="muted small" style={{ marginTop: 4 }}>Learn · Share · Grow · Together</div>
        </div>
        <form className="card auth-card stack" onSubmit={submit} style={{ gap: 18 }}>
          <h1 style={{ fontSize: 22, textAlign: 'center', fontWeight: 700 }}>Login to your account</h1>
          {params.get('registered') ? <div className="pill green" style={{ height: 'auto', padding: '8px 14px', borderRadius: 10, whiteSpace: 'normal' }}>Profile created! Log in with your college email.</div> : null}
          <Field label="College Email" hint="(IITR email)">
            <input className="input" type="email" placeholder={EMAIL_EXAMPLE} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
          </Field>
          <Field label="Password"><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {error ? <div className="field-error" role="alert">{error}</div> : null}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !email || !password}>{busy ? 'Logging in…' : 'Login'}</button>
          <div className="row" style={{ gap: 12 }}><div className="divider grow" /><span className="tiny faint">or</span><div className="divider grow" /></div>
          <div className="small" style={{ textAlign: 'center' }}>New here? <Link to="/signup" className="see-all">Create your profile</Link></div>
          {/* <div className="tiny faint" style={{ textAlign: 'center' }}>Demo account: arjunm@cse.iitr.ac.in · password123</div>*/}
        </form>
        <Link to="/" className="back-link small" style={{ margin: 0 }}><ArrowLeft size={15} />Back to home</Link>
      </div>
    </div>
  );
}
