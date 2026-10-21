import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Sparkles, HeartHandshake, CalendarClock, Globe, Newspaper, Compass, MessageCircle, UserRoundCheck,
  Star, ShieldCheck, BadgeCheck, Zap, Quote, Heart, Mail, LogIn, MousePointer2,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { ThemeToggle } from '../lib/theme.jsx';
import '../landing.css';

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const MARQUEE = [
  ['🤖', 'AI/ML'], ['🎶', 'Bihu'], ['🏸', 'Badminton'], ['🪔', 'Diwali'], ['📸', 'Photography'], ['💻', 'Hackathons'],
  ['🌾', 'Onam'], ['🎻', 'Carnatic'], ['♟️', 'Chess'], ['🍜', 'K-culture'], ['📡', 'DSP'], ['💃', 'Garba'],
  ['📚', 'Study groups'], ['⚽', 'Football'], ['🎨', 'Design'], ['🗣️', 'Language exchange'], ['🧠', 'CP'], ['🍛', 'Food swaps'],
];

const FORMULA = [
  { icon: HeartHandshake, title: 'Common Interests', text: 'Something to talk about from minute one — AI/ML, badminton, Carnatic music or memes.', eg: 'Both into Photography', tone: 'blue' },
  { icon: CalendarClock, title: 'Compatible Preferences', text: 'Free on the same evenings, a shared language, a similar pace — so plans actually happen.', eg: 'Both free on weekends', tone: 'amber' },
  { icon: Globe, title: 'Different Backgrounds', text: 'Another state, department or mother tongue — the part that helps you grow.', eg: 'From Assam · Speaks Assamese', tone: 'violet' },
];

const STEPS = [
  { title: 'Sign up with your IITR email', text: 'Use your department address, like name@ece.iitr.ac.in, so every profile you meet is a real classmate.' },
  { title: 'Build your profile in 4 quick pages', text: 'Basics, academics, preferences and culture — a few minutes, all chips and no essays.' },
  { title: 'Get matched, join in, meet up', text: 'Your feed, groups, events and chats are tuned to you, and every suggestion tells you why.' },
];

const BUILT = [
  { icon: ShieldCheck, title: 'IITR-only', text: 'Only .iitr.ac.in emails can join.' },
  { icon: BadgeCheck, title: 'Explainable matching', text: 'Every suggestion shows its reasons.' },
  { icon: Zap, title: 'Real-time everything', text: 'Chats, reactions, typing and read receipts.' },
  { icon: Star, title: 'Honest reviews', text: 'Anonymous, survey-backed testimonials.' },
];

// Shown only if the live reviews can't be loaded.
const FALLBACK_REVIEWS = [
  { rating: 5, comment: 'Jamming Bihu beats with Garba rhythms was magical. I made three new friends from the Northeast!', activity: 'Folk Music Jam', who: 'A 2nd year EE student', highlights: ['Met someone new', 'Cultural exchange'] },
  { rating: 5, comment: 'I tasted appam for the first time and learnt how Onam sadya is served. Best evening of my exchange so far.', activity: 'Regional Food Swap', who: 'A 3rd year CSE student', highlights: ['Cultural exchange'] },
  { rating: 4, comment: 'Study group made normalization finally click. Way more productive than revising alone.', activity: 'DBMS Study Circle', who: 'A 2nd year CSE student', highlights: [] },
];

/* ----------------------------------------------------------------- helpers */

function useCountUp(target, decimals = 0) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target == null) return undefined;
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) { setValue(target); return undefined; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min((now - t0) / 1600, 1);
        setValue(target * (1 - (1 - p) ** 3));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target]);
  return [ref, target == null ? '—' : value.toFixed(decimals)];
}

function Stat({ value, decimals, suffix = '', label, icon: Icon }) {
  const [ref, shown] = useCountUp(value, decimals);
  return (
    <div className="lp-stat" ref={ref}>
      <div className="lp-stat-num">{shown}{value == null ? '' : suffix}{Icon ? <Icon size={26} className="lp-stat-icon" /> : null}</div>
      <div className="lp-stat-label">{label}</div>
    </div>
  );
}

// Cards that tilt toward the cursor, with a soft spotlight that follows it.
function Tilt({ className = '', children, max = 7, ...rest }) {
  const ref = useRef(null);
  const move = (e) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - y) * max}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * max}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  };
  const leave = () => { ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg'); };
  return <div ref={ref} className={`lp-tilt ${className}`} onPointerMove={move} onPointerLeave={leave} {...rest}>{children}</div>;
}

function Stars({ n }) {
  return <span className="lp-stars" aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={15} fill={i <= n ? 'currentColor' : 'none'} />)}</span>;
}

function ReviewCard({ t }) {
  return (
    <figure className="lp-review">
      <div className="row between"><Stars n={t.rating} /><Quote size={22} className="lp-review-quote" /></div>
      <blockquote>{t.comment}</blockquote>
      <figcaption>
        <div className="lp-review-who">{t.who}</div>
        <div className="lp-review-act">after <b>{t.activity}</b></div>
        {t.highlights?.length ? <div className="lp-review-tags">{t.highlights.map((h) => <span key={h}>{h}</span>)}</div> : null}
      </figcaption>
    </figure>
  );
}

function HeroScene() {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let scene = null;
    let cancelled = false;
    import('../lib/heroScene.js').then(({ createHeroScene }) => {
      if (cancelled || !ref.current) return;
      scene = createHeroScene(ref.current, { reducedMotion: prefersReducedMotion() });
      if (!scene) setFailed(true);
      else ref.current.classList.add('ready');
    }).catch(() => setFailed(true));
    return () => { cancelled = true; scene?.dispose(); };
  }, []);
  return <div className={`lp-canvas${failed ? ' fallback' : ''}`} ref={ref} aria-hidden="true" />;
}

/* ----------------------------------------------------------------- page */

export default function Landing() {
  const [data, setData] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const pageRef = useRef(null);

  useEffect(() => {
    document.title = 'Campus Connect — find your people across every culture';
    api.get('/landing').then(setData).catch(() => setData({ stats: {}, testimonials: [] }));
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); document.title = 'Campus Connect'; };
  }, []);

  // Fade/slide sections in as they scroll into view.
  useEffect(() => {
    const els = pageRef.current?.querySelectorAll('.reveal:not(.in)') || [];
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.remove('reveal')); return undefined; }
    const timers = [];
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
      // Drop the reveal classes once played so tilt cards get their own transform back.
      timers.push(setTimeout(() => e.target.classList.remove('reveal', 'in'), 1100));
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el));
    return () => { io.disconnect(); timers.forEach(clearTimeout); };
  }, [data]);

  const stats = data?.stats || {};
  const reviews = data?.testimonials?.length >= 3 ? data.testimonials : (data ? FALLBACK_REVIEWS : []);
  const rowA = reviews.filter((_, i) => i % 2 === 0);
  const rowB = reviews.filter((_, i) => i % 2 === 1);

  return (
    <div className="lp" ref={pageRef}>
      <header className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="lp-wrap lp-nav-inner">
          <a href="#top" className="lp-brand"><img src="/logo.svg" alt="" />CampusConnect</a>
          <nav className="lp-links" aria-label="Sections">
            <a href="#aim">Our aim</a><a href="#features">Features</a><a href="#impact">Impact</a><a href="#reviews">Reviews</a>
          </nav>
          <div className="lp-nav-cta">
            <ThemeToggle className="lp-btn lp-btn-ghost lp-theme" size={18} />
            <Link to="/login" className="lp-btn lp-btn-ghost">Log in</Link>
            <Link to="/signup" className="lp-btn lp-btn-primary">Create account</Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="lp-hero" id="top">
        <div className="lp-hero-bg" aria-hidden="true"><span className="b1" /><span className="b2" /><span className="b3" /></div>
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow"><Sparkles size={14} />Made for IIT Roorkee students · .iitr.ac.in only</div>
            <h1>Find your people<br /><span className="lp-grad">across every culture</span></h1>
            <p className="lp-lead">
              Campus Connect matches you with classmates through <b>common interests</b>, <b>compatible preferences</b> and{' '}
              <b>different backgrounds</b>, so you make friends who share your passions and widen your world.
            </p>
            <div className="lp-cta-row">
              <Link to="/signup" className="lp-btn lp-btn-primary lp-btn-lg">Create your account<ArrowRight size={18} /></Link>
              <Link to="/login" className="lp-btn lp-btn-glass lp-btn-lg"><LogIn size={18} />Log in</Link>
            </div>
            <div className="lp-trust">
              <div className="lp-avatars" aria-hidden="true">
                {[['AT', '#8b5cf6'], ['RS', '#ef4444'], ['KB', '#f59e0b'], ['NM', '#22c55e'], ['DV', '#1f6feb']].map(([i, bg]) => <span key={i} style={{ background: bg }}>{i}</span>)}
              </div>
              <div>
                <div className="lp-trust-top"><Stars n={5} /><span><b>{stats.rating ?? '4.6'}</b>/5 average event rating</span></div>
                <div className="lp-trust-sub">{stats.students ? `${stats.students} students` : 'Students'} from {stats.regions || 'many'} states & regions are already connecting</div>
              </div>
            </div>
          </div>

          <div className="lp-hero-visual">
            <HeroScene />
            <div className="lp-float f1">
              <div className="lp-mini-avatar" style={{ background: '#8b5cf6' }}>AT</div>
              <div>
                <div className="lp-float-title">Aiko T. <span className="lp-match">92% match</span></div>
                <div className="lp-float-sub">Both into Photography · Speaks Japanese — which you want to learn</div>
              </div>
            </div>
            <div className="lp-float f2">
              <div className="lp-float-emoji">🎶</div>
              <div>
                <div className="lp-float-title">Bihu × Garba Jam</div>
                <div className="lp-float-sub">Tonight · SAC Lawn · 18 going</div>
              </div>
            </div>
            <div className="lp-float f3">
              <div className="lp-bubble">Teach me Hindi? I’ll teach you Japanese 😄</div>
              <div className="lp-typing"><i /><i /><i /></div>
            </div>
            <div className="lp-float f4"><Heart size={14} fill="currentColor" /> New friend from Assam</div>
            <div className="lp-drag-hint"><MousePointer2 size={13} />Drag to spin</div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ marquee */}
      <div className="lp-marquee" aria-hidden="true">
        {[0, 1].map((row) => (
          <div key={row} className={`lp-marquee-track${row ? ' reverse' : ''}`}>
            {[...MARQUEE, ...MARQUEE].map(([e, t], i) => <span key={i} className="lp-chip"><span>{e}</span>{t}</span>)}
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------ aim */}
      <section className="lp-section" id="aim">
        <div className="lp-wrap">
          <div className="lp-head reveal">
            <div className="lp-kicker">Our aim</div>
            <h2>Campuses are diverse<br />Friend circles usually aren’t</h2>
            <p>Students from every state, language and discipline share one campus, yet most of us talk to the same twenty people.
              Campus Connect turns proximity into real connection. Difference becomes something you go looking for, not something you walk past.</p>
          </div>
          <div className="lp-formula">
            {FORMULA.map((f, i) => (
              <div key={f.title} className="lp-formula-item reveal" style={{ '--d': `${i * 90}ms` }}>
                <Tilt className={`lp-formula-card tone-${f.tone}`}>
                  <div className="lp-formula-icon"><f.icon size={24} /></div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                  <span className="lp-eg">“{f.eg}”</span>
                </Tilt>
                <div className="lp-op" aria-hidden="true">{i < 2 ? '+' : '='}</div>
              </div>
            ))}
            <div className="lp-formula-item reveal" style={{ '--d': '270ms' }}>
              <Tilt className="lp-formula-card lp-result">
                <div className="lp-formula-icon"><Sparkles size={24} /></div>
                <h3>Connections that grow you</h3>
                <p>Friends who get you <i>and</i> show you something new. Every recommendation tells you exactly why it was made.</p>
                <span className="lp-eg">“Both into AI/ML · From Rajasthan”</span>
              </Tilt>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ features */}
      <section className="lp-section lp-section-alt" id="features">
        <div className="lp-wrap">
          <div className="lp-head reveal">
            <div className="lp-kicker">Everything in one place</div>
            <h2>One app for your whole campus life</h2>
            <p>A feed that knows you, culture you can step into, people to build and study with, and chats that keep it going.</p>
          </div>
          <div className="lp-bento">
            <Tilt className="lp-tile t-feed reveal" max={4}>
              <div className="lp-tile-icon"><Newspaper size={20} /></div>
              <h3>A feed that gets you</h3>
              <p>For You, Trending and topic tabs with posts, polls, projects and notes, ranked by what you care about.</p>
              <div className="lp-mock lp-mock-feed">
                <div className="lp-mock-tabs"><span className="on">For You</span><span>Trending</span><span>Tech</span><span>Culture</span></div>
                <div className="lp-mock-post">
                  <div className="row"><span className="lp-dot" style={{ background: '#22c55e' }} /><b>Rohan G.</b><span className="muted">· CSE · 4h</span></div>
                  <div className="lp-line w90" /><div className="lp-line w70" />
                  <div className="lp-file">📄 systems-design-notes.pdf</div>
                  <div className="lp-why"><Sparkles size={12} />Why you’re seeing this: matches your interest in System Design</div>
                </div>
              </div>
            </Tilt>
            <Tilt className="lp-tile t-culture reveal" max={6} style={{ '--d': '80ms' }}>
              <div className="lp-tile-icon"><Globe size={20} /></div>
              <h3>Step outside your circle</h3>
              <p>Cultural buddies, Culture of the Week, exchange events and “Teach me something”.</p>
              <div className="lp-mock-chips"><span>📖 Learn</span><span>🧑‍🏫 Teach</span><span>✨ Experience</span><span>🤝 Connect</span></div>
            </Tilt>
            <Tilt className="lp-tile t-discover reveal" max={6} style={{ '--d': '120ms' }}>
              <div className="lp-tile-icon"><Compass size={20} /></div>
              <h3>Discover your crew</h3>
              <p>Study partners, project teams, sports groups and events, with filters that matter.</p>
              <div className="lp-mock-list">
                <div><span>📚 DSA study circle</span><b>94%</b></div>
                <div><span>💻 Hackathon team</span><b>88%</b></div>
                <div><span>🏸 Evening badminton</span><b>81%</b></div>
              </div>
            </Tilt>
            <Tilt className="lp-tile t-chat reveal" max={6} style={{ '--d': '80ms' }}>
              <div className="lp-tile-icon"><MessageCircle size={20} /></div>
              <h3>Chats that keep it going</h3>
              <p>DMs, auto-created event and team groups, reactions and read receipts, all live.</p>
              <div className="lp-mock-chat">
                <div className="in">See you at the jam? 🎶</div>
                <div className="out">Obviously! Bringing my dhol 🥁<span>✓✓</span></div>
              </div>
            </Tilt>
            <Tilt className="lp-tile t-profile reveal" max={6} style={{ '--d': '120ms' }}>
              <div className="lp-tile-icon"><UserRoundCheck size={20} /></div>
              <h3>A profile in 4 steps</h3>
              <p>Basics, academics, preferences and culture. That’s all the matcher needs.</p>
              <div className="lp-mock-steps">{['Basics', 'Academic', 'Prefs', 'Culture'].map((s, i) => <span key={s}><i>{i + 1}</i>{s}</span>)}</div>
            </Tilt>
            <Tilt className="lp-tile t-survey reveal" max={6} style={{ '--d': '160ms' }}>
              <div className="lp-tile-icon"><Star size={20} /></div>
              <h3>Every event gets better</h3>
              <p>A quick post-event survey feeds anonymous reviews and smarter suggestions.</p>
              <div className="lp-mock-rate"><Stars n={5} /><span>“Met someone new” ✓</span></div>
            </Tilt>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head reveal">
            <div className="lp-kicker">How it works</div>
            <h2>From sign-up to first meet-up in minutes</h2>
          </div>
          <ol className="lp-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="reveal" style={{ '--d': `${i * 110}ms` }}>
                <span className="lp-step-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ impact */}
      <section className="lp-impact" id="impact">
        <div className="lp-impact-glow" aria-hidden="true" />
        <div className="lp-wrap">
          <div className="lp-head reveal light">
            <div className="lp-kicker">Achievements</div>
            <h2>Small campus moments, real results</h2>
            <p>Live numbers from the platform and from post-event surveys.</p>
          </div>
          <div className="lp-stats reveal">
            <Stat value={stats.students} label="Students connected" />
            <Stat value={stats.regions} label="States & regions represented" />
            <Stat value={stats.activities} label="Events, teams & study groups" />
            <Stat value={stats.communities} label="Active communities" />
            <Stat value={stats.metNew} label="Met someone new at an event" suffix="%" />
            <Stat value={stats.rating} decimals={1} label="Average event rating" icon={Star} />
          </div>
          <div className="lp-built reveal">
            {BUILT.map((b) => (
              <div key={b.title} className="lp-built-item">
                <b.icon size={20} />
                <div><div className="lp-built-title">{b.title}</div><div className="lp-built-text">{b.text}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ reviews */}
      <section className="lp-section" id="reviews">
        <div className="lp-wrap">
          <div className="lp-head reveal">
            <div className="lp-kicker">Reviews from students</div>
            <h2>Don’t take our word for it</h2>
            <p>Anonymous reviews written by students in the post-event survey.{stats.again != null ? ` ${stats.again}% say they’d join again.` : ''}</p>
          </div>
        </div>
        {reviews.length ? (
          <div className="lp-reviews">
            {[rowA, rowB].filter((r) => r.length).map((row, k) => (
              <div key={k} className={`lp-reviews-track${k ? ' reverse' : ''}`}>
                {[...row, ...row, ...row].map((t, i) => <ReviewCard key={i} t={t} />)}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ final CTA */}
      <section className="lp-section lp-final-wrap">
        <div className="lp-wrap">
          <div className="lp-final reveal">
            <div className="lp-final-orbs" aria-hidden="true"><span /><span /><span /></div>
            <h2>Your next best friend might be one hostel away</h2>
            <p>Join with your college email and get your first matches in under five minutes.</p>
            <div className="lp-cta-row center">
              <Link to="/signup" className="lp-btn lp-btn-white lp-btn-lg">Create your account<ArrowRight size={18} /></Link>
              <Link to="/login" className="lp-btn lp-btn-outline-light lp-btn-lg">I already have an account</Link>
            </div>
            <div className="lp-final-note"><Mail size={14} />Only <b>.iitr.ac.in</b> emails can sign up</div>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <div className="lp-brand"><img src="/logo.svg" alt="" />CampusConnect</div>
          <div className="lp-footer-tag">Learn · Share · Grow · Together</div>
          <div className="lp-footer-links"><Link to="/login">Log in</Link><Link to="/signup">Sign up</Link><a href="#top">Back to top ↑</a></div>
        </div>
        <div className="lp-wrap lp-copy">© {new Date().getFullYear()} Campus Connect · Built for IIT students</div>
      </footer>
    </div>
  );
}
