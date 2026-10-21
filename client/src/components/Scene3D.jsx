import { useEffect, useRef, useState } from 'react';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Decorative 3D scene, loaded lazily. `variant="globe"` reuses the landing-page connection globe;
 * otherwise a cluster of glossy shapes using one of the presets in lib/scene3d.js.
 * Falls back to soft CSS blobs when WebGL isn't available.
 */
export default function Scene3D({ variant = 'shapes', preset = 'home', className = '' }) {
  const ref = useRef(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    let scene = null;
    let cancelled = false;
    const load = variant === 'globe'
      ? import('../lib/heroScene.js').then((m) => (el, o) => m.createHeroScene(el, o))
      : import('../lib/scene3d.js').then((m) => (el, o) => m.createShapesScene(el, { ...o, preset }));
    load.then((create) => {
      if (cancelled || !ref.current) return;
      scene = create(ref.current, { reducedMotion: reducedMotion() });
      setState(scene ? 'ready' : 'failed');
    }).catch(() => setState('failed'));
    return () => { cancelled = true; scene?.dispose(); };
  }, [variant, preset]);
  return (
    <div ref={ref} className={`scene3d ${state} ${className}`} aria-hidden="true">
      {state === 'failed' ? <><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></> : null}
    </div>
  );
}
