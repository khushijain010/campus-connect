import { useMemo, useRef, useState } from 'react';
import { Upload, Eye, EyeOff, UserRound } from 'lucide-react';
import { OptionGrid, Field, Group } from './ui.jsx';
import { EMAIL_EXAMPLE } from '../lib/college.js';

export const EMPTY_PROFILE = {
  name: '', handle: '', email: '', password: '',
  department: '', year: '', courses: [], skills: [], availability: [],
  hobbies: [], interests: [], clubs: [], bio: '',
  region: '', languages_spoken: [], languages_interested: [], cultural_interests: [], foods: [], festivals: [], music_art: [],
};

export function PasswordInput({ value, onChange, placeholder = 'Enter your password', error, autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-icon" style={{ position: 'relative' }}>
      <input className={`input ${error ? 'error' : ''}`} style={{ paddingLeft: 14, paddingRight: 44 }} type={show ? 'text' : 'password'} value={value}
        onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} />
      <button type="button" className="icon-btn sm trail" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function AvatarPicker({ file, current, onFile }) {
  const ref = useRef(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : current), [file, current]);
  return (
    <div className="upload-row">
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--surface-3)', overflow: 'hidden', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {preview ? <img src={preview} alt="Profile preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserRound size={40} className="faint" />}
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => ref.current.click()}><Upload size={15} />{preview ? 'Change' : 'Upload'}</button>
        <span className="tiny faint">JPG, PNG (Max 5MB)</span>
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => {
        const f = e.target.files[0];
        if (f && f.size > 5 * 1024 * 1024) { window.alert('Image must be under 5 MB'); return; }
        if (f) onFile(f);
      }} />
    </div>
  );
}

export function BasicSection({ v, set, errors = {}, avatarFile, setAvatarFile, detectedDept, editing }) {
  return (
    <>
      <Field label="Full Name" error={errors.name}><input className={`input ${errors.name ? 'error' : ''}`} placeholder="Enter your full name" value={v.name} onChange={set('name')} autoComplete="name" /></Field>
      {!editing ? (
        <>
          <Field label="Username / Handle" error={errors.handle}>
            <input className={`input ${errors.handle ? 'error' : ''}`} placeholder="Enter a unique handle" value={v.handle} onChange={(e) => set('handle')(e.target.value.replace(/^@/, '').toLowerCase())} autoComplete="username" />
          </Field>
          <Field label="College Email" hint="(your IITR email, e.g. name@ece.iitr.ac.in)" error={errors.email}>
            <input className={`input ${errors.email ? 'error' : ''}`} type="email" placeholder={EMAIL_EXAMPLE} value={v.email} onChange={set('email')} autoComplete="email" />
            {detectedDept && !errors.email ? <span className="small" style={{ color: 'var(--success)' }}>Looks like you're in {detectedDept}. We'll fill that in for you.</span> : null}
          </Field>
        </>
      ) : null}
      <Field label={editing ? 'New Password' : 'Password'} hint={editing ? '(leave blank to keep current)' : '(min 8 characters)'} error={errors.password}>
        <PasswordInput value={v.password} onChange={set('password')} error={errors.password} autoComplete="new-password" placeholder={editing ? 'New password' : 'Create a password'} />
      </Field>
      <Group label="Profile Picture"><AvatarPicker file={avatarFile} current={v.avatar} onFile={setAvatarFile} /></Group>
    </>
  );
}

export function AcademicSection({ v, set, options, errors = {} }) {
  return (
    <>
      <div className="grid-2">
        <Field label="Department" error={errors.department}>
          <select className={`select ${errors.department ? 'error' : ''}`} value={v.department} onChange={set('department')}>
            <option value="">Select your department</option>
            {(options.departmentInfo || options.departments.map((d) => ({ value: d, name: d }))).map((d) => (
              <option key={d.value} value={d.value}>{d.name === d.value ? d.value : `${d.name} (${d.value})`}</option>
            ))}
          </select>
        </Field>
        <Field label="Year" error={errors.year}>
          <select className="select" value={v.year} onChange={set('year')}>
            <option value="">Select your year</option>
            {options.years.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
      </div>
      <Group label="Current Courses" hint="(select multiple)"><OptionGrid options={options.courses} value={v.courses} onChange={set('courses')} allowCustom /></Group>
      <Group label="Skills" hint="(select multiple)"><OptionGrid options={options.skills} value={v.skills} onChange={set('skills')} allowCustom /></Group>
      <Group label="When are you usually free?" hint="(helps match study partners & events)"><OptionGrid options={options.availability} value={v.availability} onChange={set('availability')} /></Group>
    </>
  );
}

export function PreferenceSection({ v, set, options }) {
  return (
    <>
      <Group label="Hobbies" hint="(select multiple)"><OptionGrid options={options.hobbies} value={v.hobbies} onChange={set('hobbies')} allowCustom /></Group>
      <Group label="Academic Interests" hint="(select multiple)"><OptionGrid options={options.interests} value={v.interests} onChange={set('interests')} allowCustom /></Group>
      <Group label="Clubs / Activities" hint="(select multiple)"><OptionGrid options={options.clubs} value={v.clubs} onChange={set('clubs')} allowCustom /></Group>
      <Field label="Bio"><textarea className="textarea" maxLength={500} placeholder="Tell us something about yourself — interests, activities…" value={v.bio} onChange={set('bio')} /></Field>
    </>
  );
}

export function CulturalSection({ v, set, options }) {
  return (
    <>
      <Field label="Home Region / State / Country">
        <select className="select" value={v.region} onChange={set('region')}>
          <option value="">Select your region</option>
          {options.regions.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <OptionGrid variant="chip" multi={false} options={['Kerala', 'Rajasthan', 'Assam', 'Japan']} value={v.region} onChange={(x) => set('region')(x)} />
      <Group label="Languages Spoken" hint="(select multiple)"><OptionGrid options={options.languages.slice(0, 8)} value={v.languages_spoken} onChange={set('languages_spoken')} allowCustom /></Group>
      <Group label="Languages Interested In" hint="(select multiple)"><OptionGrid options={options.languagesInterested} value={v.languages_interested} onChange={set('languages_interested')} allowCustom /></Group>
      <Group label="Cultural Interests" hint="(select multiple)"><OptionGrid options={options.culturalInterests} value={v.cultural_interests} onChange={set('cultural_interests')} /></Group>
      <Group label="Favourite Traditional Food"><OptionGrid options={options.foods} value={v.foods} onChange={set('foods')} allowCustom customPlaceholder="Add a dish…" /></Group>
      <Group label="Festivals Celebrated" hint="(select multiple)"><OptionGrid options={options.festivals} value={v.festivals} onChange={set('festivals')} allowCustom /></Group>
      <Group label="Music / Movies / Art" hint="(select multiple)"><OptionGrid options={options.musicArt} value={v.music_art} onChange={set('music_art')} allowCustom /></Group>
    </>
  );
}
