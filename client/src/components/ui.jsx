import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Plus, ImageOff, Inbox, Star } from 'lucide-react';

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0d9488', '#16a34a', '#0891b2', '#9333ea', '#c2410c', '#4f46e5'];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({ user, size = 40, online }) {
  const [broken, setBroken] = useState(false);
  const name = user?.name || '?';
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const bg = AVATAR_COLORS[hash(name) % AVATAR_COLORS.length];
  const showOnline = online ?? user?.online;
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {user?.avatar && !broken
        ? <img src={user.avatar} alt="" onError={() => setBroken(true)} />
        : <span className="initials" style={{ background: `linear-gradient(135deg, ${bg}, ${bg}cc)`, fontSize: size * 0.36 }}>{initials}</span>}
      {showOnline ? <span className="online" /> : null}
    </span>
  );
}

// Emoji + colour tile used for communities and activities (no stock images needed).
export function Cover({ emoji, color = '#2563eb', size = 48, radius = 12, style }) {
  return (
    <span className="cover" style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.5,
      background: `linear-gradient(135deg, color-mix(in srgb, ${color} 26%, var(--tint-base)), color-mix(in srgb, ${color} 10%, var(--tint-base)))`, ...style }}>{emoji}</span>
  );
}

export function Img({ src, alt = '', className, onClick }) {
  const [broken, setBroken] = useState(false);
  if (broken || !src) return <div className={`img-fallback ${className || ''}`}><ImageOff size={22} /></div>;
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setBroken(true)} onClick={onClick} />;
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Dropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="dropdown" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open ? (
        <div className="menu" style={align === 'left' ? { left: 0, right: 'auto' } : undefined} onClick={() => setOpen(false)}>
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      ) : null}
    </div>
  );
}

// Multi/single select chips with optional free-text "add your own".
export function OptionGrid({ options = [], value, onChange, multi = true, allowCustom = false, customPlaceholder = 'Add other…', variant = 'opt' }) {
  const [custom, setCustom] = useState('');
  const selected = multi ? (value || []) : value;
  const all = multi ? [...new Set([...options, ...selected])] : options;
  const isOn = (o) => (multi ? selected.includes(o) : selected === o);
  const toggle = (o) => {
    if (!multi) return onChange(selected === o ? '' : o);
    onChange(isOn(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  };
  const add = () => {
    const v = custom.trim();
    if (!v) return;
    if (multi && !selected.includes(v)) onChange([...selected, v]);
    if (!multi) onChange(v);
    setCustom('');
  };
  return (
    <div className="opt-grid">
      {all.map((o) => (
        variant === 'chip'
          ? <button type="button" key={o} className={`chip ${isOn(o) ? 'on' : ''}`} onClick={() => toggle(o)}>{o}</button>
          : (
            <button type="button" key={o} className={`opt ${isOn(o) ? 'on' : ''}`} onClick={() => toggle(o)} aria-pressed={isOn(o)}>
              <span className="box">{isOn(o) ? <Check size={12} strokeWidth={3} /> : null}</span>{o}
            </button>
          )
      ))}
      {allowCustom ? (
        <span className="opt-add">
          <input value={custom} placeholder={customPlaceholder} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          {custom ? <button type="button" className="icon-btn sm" onClick={add} aria-label="Add"><Plus size={16} /></button> : null}
        </span>
      ) : null}
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field" style={{ display: 'flex' }}>
      {label ? <span className="label">{label}{hint ? <span className="hint">{hint}</span> : null}</span> : null}
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function Group({ label, hint, children }) {
  return (
    <div className="field">
      <span className="label">{label}{hint ? <span className="hint">{hint}</span> : null}</span>
      {children}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.value;
        const label = typeof t === 'string' ? t : t.label;
        return (
          <button key={key} role="tab" aria-selected={value === key} className={`tab ${value === key ? 'on' : ''}`} onClick={() => onChange(key)}>
            {t.icon ? <t.icon size={16} /> : null}{label}{t.count ? <span className="badge">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon size={24} /></div>
      {title ? <div className="bold" style={{ color: 'var(--text)' }}>{title}</div> : null}
      {children ? <div className="small">{children}</div> : null}
      {action}
    </div>
  );
}

export const Spinner = () => <div className="center"><div className="spinner" /></div>;

export function Stars({ value, onChange, size = 26 }) {
  return (
    <div className="stars" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} className={n <= value ? 'on' : ''} onClick={() => onChange?.(n)} aria-label={`${n} star`}>
          <Star size={size} fill="currentColor" />
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ status }) {
  const map = { pending: ['amber', 'Pending'], accepted: ['green', 'Accepted'], rejected: ['red', 'Rejected'], completed: ['grey', 'Completed'] };
  if (!status) return null;
  const [cls, label] = map[status] || ['grey', status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

// Small data-loading hook: const { data, loading, error, reload, setData } = useApi(() => api.get(...), [deps])
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    return fnRef.current()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => setState({ data: null, loading: false, error }));
  }, []);
  useEffect(() => { reload(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload, setData };
}
