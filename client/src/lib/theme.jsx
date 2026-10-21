import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

// Light / dark theme. The saved choice wins; with no choice we follow the OS setting (and keep following it).
// index.html applies the theme before first paint so there is no white flash on load.
const KEY = 'cc_theme';
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const store = (v) => { try { localStorage.setItem(KEY, v); } catch { /* storage unavailable */ } };
export const currentTheme = () => document.documentElement.dataset.theme || 'light';

function apply(theme, animate) {
  const html = document.documentElement;
  if (animate) {
    html.classList.add('theme-anim');
    setTimeout(() => html.classList.remove('theme-anim'), 350);
  }
  html.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a1020' : '#f5f7fc');
  window.dispatchEvent(new CustomEvent('cc:theme', { detail: theme }));
}

/** Call once at startup: keeps following the OS setting until the user picks a theme. */
export function initTheme() {
  const pref = stored();
  apply(pref === 'dark' || pref === 'light' ? pref : (media()?.matches ? 'dark' : 'light'));
  media()?.addEventListener?.('change', (e) => { if (!stored()) apply(e.matches ? 'dark' : 'light', true); });
}

export function useTheme() {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const on = (e) => setTheme(e.detail);
    window.addEventListener('cc:theme', on);
    return () => window.removeEventListener('cc:theme', on);
  }, []);
  const toggle = () => { const next = theme === 'dark' ? 'light' : 'dark'; store(next); apply(next, true); };
  return { theme, toggle };
}

export function ThemeToggle({ className = 'icon-btn', size = 20, style }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" className={className} style={style} onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  );
}
