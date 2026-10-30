'use client';
import { useEffect, useState } from 'react';
import { Skyline } from './Skyline';

// ~3.9s opening: skyline rises, bats leave the bridge, neon sign flickers on, lone star spins in,
// tagline + Dario Bucks coin drop. Once per app open (not on every tab switch). Tap to skip.
const BATS = Array.from({ length: 14 }, (_, i) => ({
  left: 30 + Math.random() * 40,
  dx: `${(Math.random() - 0.5) * 140}vw`,
  dy: `${-30 - Math.random() * 45}vh`,
  delay: 0.25 + Math.random() * 0.6,
  size: 18 + Math.random() * 16,
  k: i,
}));

export function LaunchIntro() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      const force = new URLSearchParams(location.search).has('intro');
      seen = !force && sessionStorage.getItem('fd.intro') === '1';
      sessionStorage.setItem('fd.intro', '1');
    } catch {}
    if (seen) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 3950);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="intro" onClick={() => setShow(false)} role="presentation">
      <div className="stars" />
      {BATS.map((b) => (
        <span key={b.k} className="ibat" style={{ left: `${b.left}%`, fontSize: b.size, animationDelay: `${b.delay}s`, ['--dx' as any]: b.dx, ['--dy' as any]: b.dy }}>🦇</span>
      ))}
      <div className="neon">
        <span className="fan">FAN</span>
        <span className="dar">DARIO<span className="star">★</span></span>
      </div>
      <div className="itag">Keep Austin Betting</div>
      <div className="coin">$50 DARIO BUCKS</div>
      <div className="sky"><Skyline /></div>
      <div className="river" />
      <div className="skip">TAP TO SKIP</div>
    </div>
  );
}
