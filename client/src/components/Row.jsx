import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Netflix-style sliding row: a heading with arrows, and a horizontally scrolling track that snaps per card.
 * Arrows page by ~one screen; edges fade when there is more to scroll.
 */
export default function Row({ title, sub, icon: Icon, action, children, empty, id, size = 'md' }) {
  const track = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);
  const page = (dir) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <section className="slide-row" id={id}>
      <div className="slide-head">
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          {Icon ? <span className="section-icon"><Icon size={20} /></span> : null}
          <div style={{ minWidth: 0 }}>
            <h2 className="slide-title">{title}</h2>
            {sub ? <div className="card-sub">{sub}</div> : null}
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
          {action}
          {!empty ? (
            <>
              <button className="slide-arrow" onClick={() => page(-1)} disabled={!edges.left} aria-label={`Scroll ${title} left`}><ChevronLeft size={18} /></button>
              <button className="slide-arrow" onClick={() => page(1)} disabled={!edges.right} aria-label={`Scroll ${title} right`}><ChevronRight size={18} /></button>
            </>
          ) : null}
        </div>
      </div>
      {empty ? <div className="small muted" style={{ padding: '10px 4px 0' }}>{empty}</div> : (
        <div className={`slide-track ${size} ${edges.left ? 'fade-l' : ''} ${edges.right ? 'fade-r' : ''}`} ref={track} onScroll={measure}>
          {children}
        </div>
      )}
    </section>
  );
}
