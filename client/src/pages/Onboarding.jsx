import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, GraduationCap, Heart, Globe2, UserRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Spinner } from '../components/ui.jsx';
import { ThemeToggle } from '../lib/theme.jsx';
import { isCollegeEmail, departmentFromEmail, EMAIL_EXAMPLE } from '../lib/college.js';
import { EMPTY_PROFILE, BasicSection, AcademicSection, PreferenceSection, CulturalSection } from '../components/ProfileForm.jsx';

const STEPS = [
  { title: 'Create Your Profile', sub: "Let's start with your basic information", icon: UserRound, side: ['Your profile', 'Your story', 'Your community'] },
  { title: 'Academic Information', sub: 'Tell us about your academic background', icon: GraduationCap, side: ['Find study partners', 'Join project teams', 'Share notes'] },
  { title: 'Preferences', sub: 'Select what interests you', icon: Heart, side: ['Personalised feed', 'Hobby groups', 'Events you’ll love'] },
  { title: 'Cultural Information', sub: 'Share your cultural background', icon: Globe2, side: ['Cultural buddies', 'Teach & learn', 'Step outside your circle'] },
];

export default function Onboarding() {
  const { options, meta } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [v, setV] = useState(EMPTY_PROFILE);
  const [avatar, setAvatar] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val?.target ? val.target.value : val }));
  const suffixes = meta?.emailSuffixes;
  const detectedDept = departmentFromEmail(v.email, options?.departmentInfo);

  if (!options) return <div className="auth-wrap"><Spinner /></div>;

  const validate = async () => {
    const e = {};
    if (step === 0) {
      if (!v.name.trim()) e.name = 'Name is required';
      if (v.password.length < 8) e.password = 'Use at least 8 characters';
      if (!isCollegeEmail(v.email, suffixes)) e.email = `Use your IITR email, e.g. ${EMAIL_EXAMPLE}`;
      if (!/^[a-z0-9_.]{3,20}$/i.test(v.handle)) e.handle = '3–20 letters, numbers, _ or .';
      if (!e.email || !e.handle) {
        const r = await api.post('/auth/check', { email: v.email.trim(), handle: v.handle }).catch(() => ({ errors: {} }));
        Object.assign(e, Object.fromEntries(Object.entries(r.errors).filter(([k]) => !e[k])));
      }
    }
    if (step === 1) {
      if (!v.department) e.department = 'Choose your department';
      if (!v.year) e.year = 'Choose your year';
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const next = async () => {
    setBusy(true);
    const ok = await validate();
    setBusy(false);
    if (!ok) return;
    // khushi@ece.iitr.ac.in → pre-select ECE on the academic step (still editable).
    if (step === 0 && detectedDept && !v.department) setV((x) => ({ ...x, department: detectedDept }));
    if (step < 3) { setStep(step + 1); window.scrollTo(0, 0); return; }
    // Finish → create account, then go to login (per the spec, users log in after completing the profile).
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('profile', JSON.stringify(v));
      if (avatar) fd.append('avatar', avatar);
      await api.post('/auth/register', fd);
      toast('Profile created!');
      nav(`/login?registered=1&email=${encodeURIComponent(v.email.trim())}`);
    } catch (err) {
      toast(err.message, 'error');
      if (/email|handle|password|name/i.test(err.message)) setStep(0);
    } finally { setBusy(false); }
  };

  const S = STEPS[step];
  return (
    <div className="auth-wrap">
      <ThemeToggle className="icon-btn auth-theme" />
      <div className="card onboard-card">
        <div className="onboard-main">
          <div className="row between">
            <Link to="/" className="row" title="Back to home" style={{ gap: 8, fontWeight: 800 }}><img src="/logo.svg" alt="" style={{ width: 28 }} />CampusConnect</Link>
            <span className="tiny faint">Step {step + 1} of 4</span>
          </div>
          <div className="stepper" aria-label={`Step ${step + 1} of 4`}>
            {STEPS.map((_, i) => (
              <span key={i} className="row" style={{ gap: 0 }}>
                {i ? <span className={`step-line ${i <= step ? 'done' : ''}`} /> : null}
                <span className={`step-dot ${i < step ? 'done' : i === step ? 'on' : ''}`}>{i < step ? <Check size={14} /> : i + 1}</span>
              </span>
            ))}
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{S.title}</h1>
            <p className="muted">{S.sub}</p>
          </div>
          <div className="stack" style={{ gap: 18 }}>
            {step === 0 ? <BasicSection v={v} set={set} errors={errors} avatarFile={avatar} setAvatarFile={setAvatar} detectedDept={detectedDept} /> : null}
            {step === 1 ? <AcademicSection v={v} set={set} options={options} errors={errors} /> : null}
            {step === 2 ? <PreferenceSection v={v} set={set} options={options} /> : null}
            {step === 3 ? <CulturalSection v={v} set={set} options={options} /> : null}
          </div>
          <div className="row between" style={{ marginTop: 'auto', paddingTop: 10 }}>
            {step ? <button className="btn btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} />Back</button>
              : <span className="small muted">Already have an account? <Link to="/login" className="see-all">Log in</Link></span>}
            <button className="btn btn-primary btn-lg" style={{ background: 'var(--text)' }} disabled={busy} onClick={next}>
              {step === 3 ? (busy ? 'Creating…' : 'Finish') : <>Next <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
        <aside className="onboard-side">
          <div className="section-icon" style={{ width: 72, height: 72, borderRadius: '50%' }}><S.icon size={32} /></div>
          {S.side.map((t) => <div key={t} className="bold">{t}</div>)}
          <p className="small muted" style={{ marginTop: 10 }}>Common interests + compatible preferences + different backgrounds = connections worth making.</p>
        </aside>
      </div>
    </div>
  );
}
