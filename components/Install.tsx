'use client';
import { useEffect, useState } from 'react';

// Same install approach as CB Rewards: one-tap Install where Android allows it, written steps elsewhere,
// Samsung Internet sent to Chrome (Samsung's installer triggers a Play Protect warning),
// and iPhone users asked to add the app FIRST so they only sign in once.
declare global { interface Window { __fdInstallPrompt?: any } }
type Mode = 'hidden' | 'ios-safari' | 'ios-other' | 'android-chrome' | 'android-samsung' | 'android-other' | 'desktop';

export function isInstalled() {
  return typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
}
function detect(): Mode {
  if (isInstalled()) return 'hidden';
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) {
    if (/SamsungBrowser/i.test(ua)) return 'android-samsung';
    if (/Chrome\//.test(ua) && !/OPR|YaBrowser|DuckDuckGo|EdgA|Firefox/i.test(ua)) return 'android-chrome';
    return 'android-other';
  }
  return 'desktop';
}

export const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" style={{ verticalAlign: '-3px' }} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

export function PwaSetup() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); window.__fdInstallPrompt = e; window.dispatchEvent(new Event('fd-install-ready')); };
    const onInstalled = () => { window.__fdInstallPrompt = null; };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  return null;
}

export function InstallCard({ onDismiss }: { onDismiss?: () => void }) {
  const [mode, setMode] = useState<Mode>('hidden');
  const [prompt, setPrompt] = useState<any>(null);
  useEffect(() => {
    setMode(detect());
    if (window.__fdInstallPrompt) setPrompt(window.__fdInstallPrompt);
    const ready = () => setPrompt(window.__fdInstallPrompt ?? null);
    const done = () => { setPrompt(null); setMode('hidden'); };
    window.addEventListener('fd-install-ready', ready);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('fd-install-ready', ready); window.removeEventListener('appinstalled', done); };
  }, []);
  if (mode === 'hidden' || mode === 'desktop') return null;

  const install = async () => {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null); window.__fdInstallPrompt = null;
    if (outcome === 'accepted') setMode('hidden');
  };

  return (
    <div className="howto">
      <div className="row"><span className="h">📲 Put FanDario on your home screen</span>{onDismiss && <button className="muted small" onClick={onDismiss}>Later</button>}</div>
      {mode === 'android-samsung' ? (
        <>
          <p className="small muted" style={{ margin: '6px 0 10px' }}>Install from <b>Chrome</b> — no security warning that way.</p>
          <a className="btn" href={`intent://${location.host}/#Intent;scheme=https;package=com.android.chrome;end`} style={{ textDecoration: 'none' }}>Open in Chrome</a>
          <p className="small muted" style={{ marginTop: 8 }}>Then tap <b>⋮</b> → <b>Install app</b>.</p>
        </>
      ) : prompt ? (
        <button className="btn" style={{ marginTop: 10 }} onClick={install}>Install FanDario</button>
      ) : (
        <p className="small" style={{ margin: '6px 0 0' }}>
          {mode === 'ios-safari' && <>Tap <b>Share</b> <ShareIcon /> at the bottom of Safari → <b>Add to Home Screen</b> → <b>Add</b>.</>}
          {mode === 'ios-other' && <>Tap <b>Share</b> <ShareIcon /> → <b>Add to Home Screen</b>. Don&apos;t see it? Open this link in <b>Safari</b>.</>}
          {mode === 'android-chrome' && <>Tap <b>⋮</b> at the top right → <b>Install app</b> (or <b>Add to Home screen</b> → <b>Install</b>).</>}
          {mode === 'android-other' && <>Open your browser menu → <b>Add to Home screen</b> / <b>Install app</b>.</>}
        </p>
      )}
    </div>
  );
}

// iPhone keeps home-screen apps separate from Safari — add first, sign in once inside the app.
export function IosInstallFirst({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'form' | 'safari' | 'other'>('form');
  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (ios && !isInstalled()) setMode(/CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(ua) ? 'other' : 'safari');
  }, []);
  if (mode === 'form') return <>{children}</>;
  const steps = [
    mode === 'safari' ? <>Tap <b>Share</b> <ShareIcon /> at the bottom of Safari</> : <>Tap <b>Share</b> <ShareIcon /> (or open this link in <b>Safari</b>)</>,
    <>Scroll down, tap <b>Add to Home Screen</b> → <b>Add</b></>,
    <>Open <b>FanDario</b> from your Home Screen and grab your $50</>,
  ];
  return (
    <>
      <div className="howto">
        <div className="h">On iPhone — add the app first</div>
        <p className="small muted" style={{ margin: '4px 0 0' }}>Then you only sign in once, inside the app.</p>
        <ol>{steps.map((t, i) => <li key={i}><span className="n">{i + 1}</span><span>{t}</span></li>)}</ol>
      </div>
      <button className="btn ghost" onClick={() => setMode('form')}>Continue in Safari instead</button>
    </>
  );
}
