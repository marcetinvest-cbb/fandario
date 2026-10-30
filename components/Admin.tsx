'use client';
import { useCallback, useEffect, useState } from 'react';
import { fmtMoney, fmtOdds } from '@/lib/odds';
import { api, ago, BetCard } from './App';

export default function Admin() {
  const [s, setS] = useState<any>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'lines' | 'new' | 'players' | 'bets'>('lines');

  const load = useCallback(async () => {
    try { setS(await api('/api/admin')); setAuthed(true); }
    catch (e: any) { if (e.status === 401) setAuthed(false); else setErr(e.message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(() => document.visibilityState === 'visible' && load(), 15000); return () => clearInterval(t); }, [load]);

  const act = async (body: any, done?: string) => {
    setErr(''); setMsg('');
    try { await api('/api/admin', body); if (done) setMsg(done); await load(); return true; }
    catch (e: any) { setErr(e.message); return false; }
  };

  if (authed === false)
    return (
      <div className="wrap">
        <div className="hero"><div className="brand">Fan<b>Dario</b></div><div className="tag">Commissioner's office</div></div>
        <div className="card" style={{ padding: 16 }}>
          <label>Admin PIN</label>
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && document.getElementById('go')?.click()} />
          {err && <div className="err">{err}</div>}
          <button id="go" className="btn" style={{ marginTop: 12 }} onClick={async () => { try { await api('/api/auth', { action: 'admin', pin }); load(); } catch (e: any) { setErr(e.message); } }}>Enter</button>
        </div>
      </div>
    );
  if (!s) return <div className="wrap"><p className="muted center" style={{ marginTop: 60 }}>{err || 'Loading…'}</p></div>;

  return (
    <div className="adm">
      <div className="top"><div className="top-in">
        <div><div className="brand">Fan<b>Dario</b></div><div className="tag">Commish · admin</div></div>
        <a className="bal" href="/" style={{ textDecoration: 'none' }}><div className="v" style={{ color: 'var(--orange2)', fontSize: 14 }}>Open app →</div></a>
      </div></div>
      <div className="wrap">
        <div className="seg" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          {(['lines', 'new', 'players', 'bets'] as const).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{{ lines: 'Lines', new: '+ New line', players: 'Players', bets: 'All bets' }[t]}</button>
          ))}
        </div>
        {err && <div className="err">{err}</div>}
        {msg && <div className="err" style={{ background: '#17301f', color: '#a5f3c4' }}>{msg}</div>}

        {tab === 'lines' && s.markets.map((m: any) => <MarketAdmin key={m.id} m={m} act={act} />)}
        {tab === 'new' && <NewMarket act={act} onDone={() => setTab('lines')} />}
        {tab === 'players' && <Players s={s} act={act} />}
        {tab === 'bets' && (
          <div className="card" style={{ padding: 0 }}>
            {s.allBets.map((b: any) => <div key={b.id}><BetCard bet={b} showName /><div className="small muted" style={{ padding: '0 14px 8px' }}>{ago(b.created_at)}</div></div>)}
            {!s.allBets.length && <p className="center muted" style={{ padding: 16 }}>No bets yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function MarketAdmin({ m, act }: { m: any; act: (b: any, done?: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [winner, setWinner] = useState('');
  const [title, setTitle] = useState(m.title);
  const [lockAt, setLockAt] = useState(toLocalInput(m.lock_at));
  const [add, setAdd] = useState({ label: '', odds: '', blurb: '' });
  const graded = m.status === 'settled' || m.status === 'void';
  const betCount = m.options.reduce((a: number, o: any) => a + o.bet_count, 0);
  const winnerLabel = m.options.find((o: any) => o.id === m.winner_option_id)?.label;

  return (
    <div className="card">
      <div className="row" onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        <b style={{ flex: 1 }}>{m.title}</b>
        <span className={`chip ${graded ? (m.status === 'void' ? 'void' : 'won') : m.is_open ? 'open' : 'lock'}`}>
          {graded ? (m.status === 'void' ? 'Void' : `Won: ${winnerLabel}`) : m.is_open ? 'Open' : 'Locked'}
        </span>
      </div>
      <div className="small muted">{betCount} {betCount === 1 ? 'bet' : 'bets'}{m.lock_at ? ` · auto-locks ${new Date(m.lock_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''} · tap to {open ? 'close' : 'edit'}</div>

      {!graded && (
        <div className="acts">
          {m.status === 'open'
            ? <button className="btn sm ghost" onClick={() => act({ action: 'updateMarket', id: m.id, status: 'locked' }, 'Locked')}>🔒 Lock</button>
            : <button className="btn sm ghost" onClick={() => act({ action: 'updateMarket', id: m.id, status: 'open' }, 'Reopened for betting')}>🔓 Open betting</button>}
          <select value={winner} onChange={(e) => setWinner(e.target.value)} style={{ width: 'auto', flex: 1, padding: '6px 8px' }}>
            <option value="">Pick winner…</option>
            {m.options.map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button className="btn sm" disabled={!winner} onClick={() => {
            const lbl = m.options.find((o: any) => String(o.id) === winner)?.label;
            if (confirm(`Grade "${m.title}" — ${lbl} wins? Pays out right away.`)) act({ action: 'settle', id: m.id, winner: Number(winner) }, `Graded: ${lbl}`);
          }}>Grade</button>
          <button className="btn sm ghost" onClick={() => confirm(`Void "${m.title}"? Legs on it are refunded/removed from parlays.`) && act({ action: 'settle', id: m.id, winner: null }, 'Voided')}>Void</button>
        </div>
      )}
      {graded && (
        <div className="acts">
          <button className="btn sm ghost" onClick={() => confirm('Reverse this result? Payouts are taken back and the line is re-locked so you can grade it again.') && act({ action: 'reopen', id: m.id }, 'Reversed — grade it again')}>⚠️ Undo result</button>
        </div>
      )}

      {open && (
        <>
          <label>Title</label>
          <div className="row"><input value={title} onChange={(e) => setTitle(e.target.value)} /><button className="btn sm" onClick={() => act({ action: 'updateMarket', id: m.id, title }, 'Saved')}>Save</button></div>
          <label>Auto-lock at (optional)</label>
          <div className="row">
            <input type="datetime-local" value={lockAt} onChange={(e) => setLockAt(e.target.value)} />
            <button className="btn sm" onClick={() => act({ action: 'updateMarket', id: m.id, lockAt: lockAt ? new Date(lockAt).toISOString() : null }, 'Saved')}>Save</button>
          </div>
          {m.options.map((o: any) => <OptionAdmin key={o.id} o={o} act={act} />)}
          <label>Add a pick</label>
          <div className="orow" style={{ borderTop: 0 }}>
            <input placeholder="Name" value={add.label} onChange={(e) => setAdd({ ...add, label: e.target.value })} />
            <input placeholder="+250" value={add.odds} onChange={(e) => setAdd({ ...add, odds: e.target.value })} />
            <textarea placeholder="Blurb (optional)" value={add.blurb} onChange={(e) => setAdd({ ...add, blurb: e.target.value })} />
          </div>
          <button className="btn sm" onClick={async () => { if (await act({ action: 'addOption', marketId: m.id, label: add.label, odds: add.odds.replace('+', ''), blurb: add.blurb }, 'Pick added')) setAdd({ label: '', odds: '', blurb: '' }); }}>Add pick</button>
        </>
      )}
    </div>
  );
}

function OptionAdmin({ o, act }: { o: any; act: (b: any, done?: string) => Promise<boolean> }) {
  const [label, setLabel] = useState(o.label);
  const [odds, setOdds] = useState(fmtOdds(o.odds));
  const [blurb, setBlurb] = useState(o.blurb || '');
  const [boost, setBoost] = useState('');
  const [mins, setMins] = useState('60');
  const dirty = label !== o.label || odds !== fmtOdds(o.odds) || blurb !== (o.blurb || '');
  return (
    <div className="orow" style={{ opacity: o.active ? 1 : 0.5 }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} />
      <input value={odds} onChange={(e) => setOdds(e.target.value)} />
      <textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} />
      <div className="acts" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
        <span className="small muted" style={{ alignSelf: 'center' }}>{o.bet_count} bets</span>
        {dirty && <button className="btn sm" onClick={() => act({ action: 'updateOption', id: o.id, label, odds: odds.replace('+', ''), blurb }, 'Saved (existing bets keep their odds)')}>Save</button>}
        <button className="btn sm ghost" onClick={() => act({ action: 'updateOption', id: o.id, active: !o.active }, o.active ? 'Pulled from the board' : 'Back on the board')}>{o.active ? 'Pull' : 'Restore'}</button>
        {o.boosted
          ? <button className="btn sm ghost" onClick={() => act({ action: 'boost', id: o.id, odds: null }, 'Boost ended')}>🔥 {fmtOdds(o.eff_odds)} · End boost</button>
          : <>
              <input placeholder="Boost to +…" value={boost} onChange={(e) => setBoost(e.target.value)} style={{ width: 110, padding: '6px 8px' }} />
              <select value={mins} onChange={(e) => setMins(e.target.value)} style={{ width: 'auto', padding: '6px 8px' }}>
                {['15', '30', '60', '120', '240'].map((m) => <option key={m} value={m}>{Number(m) >= 60 ? `${Number(m) / 60}h` : `${m}m`}</option>)}
              </select>
              <button className="btn sm ghost" disabled={!boost} onClick={async () => { if (await act({ action: 'boost', id: o.id, odds: boost.replace('+', ''), minutes: Number(mins) }, 'Boost is live 🔥')) setBoost(''); }}>🔥 Boost</button>
            </>}
      </div>
    </div>
  );
}

function NewMarket({ act, onDone }: { act: (b: any, done?: string) => Promise<boolean>; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [lockAt, setLockAt] = useState('');
  const [text, setText] = useState('');
  const parsed = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    // "-150 Nick, blurb"  or  "Nick | -150 | blurb"
    let m = l.match(/^([+-]?\s?[\d,]+)\s+([^,]+?)(?:,\s*(.*))?$/);
    if (m) return { odds: m[1].replace(/[\s,+]/g, ''), label: m[2].trim(), blurb: m[3] || '' };
    const parts = l.split('|').map((x) => x.trim());
    return { label: parts[0], odds: (parts[1] || '').replace(/[\s,+]/g, ''), blurb: parts[2] || '' };
  });
  return (
    <div className="card">
      <label>Line title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="First one to fall in the pool" />
      <label>Subtitle (optional)</label>
      <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Saturday on the boat" />
      <label>Picks — one per line, same format as your list</label>
      <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'-150 Nick, has been ready to go\n+300 Dean, dark horse\n+500 Field, anyone else'} />
      {parsed.length > 0 && (
        <div className="small" style={{ marginTop: 8 }}>
          {parsed.map((p, i) => {
            const n = Number(p.odds);
            const okOdds = Number.isInteger(n) && Math.abs(n) >= 100;
            return <div key={i} className={okOdds ? '' : 'red'}>{okOdds ? '✓' : '✗'} <b>{p.label || '?'}</b> {okOdds ? fmtOdds(n) : `"${p.odds}" not valid odds`} <span className="muted">{p.blurb}</span></div>;
          })}
        </div>
      )}
      <label>Auto-lock at (optional)</label>
      <input type="datetime-local" value={lockAt} onChange={(e) => setLockAt(e.target.value)} />
      <button className="btn" style={{ marginTop: 14 }} disabled={!title || parsed.length < 2} onClick={async () => {
        if (await act({ action: 'createMarket', title, subtitle, lockAt: lockAt ? new Date(lockAt).toISOString() : null, options: parsed.map((p) => ({ ...p, odds: Number(p.odds) })) }, `"${title}" is live — everyone sees it now`)) {
          setTitle(''); setSubtitle(''); setText(''); setLockAt(''); onDone();
        }
      }}>Post line to the board 🚨</button>
    </div>
  );
}

function Players({ s, act }: { s: any; act: (b: any, done?: string) => Promise<boolean> }) {
  return (
    <>
      <div className="card">
        <b>Names &amp; PINs</b> <span className="small muted">— for when someone forgets</span>
        {[...s.board].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((p: any) => (
          <div className="row" key={p.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
            <span style={{ fontWeight: 800 }}>{p.name}</span>
            <span style={{ fontFamily: 'var(--display)', fontSize: 24, letterSpacing: 4 }}>{s.pins?.[p.id] ?? <span className="small muted" style={{ fontFamily: 'inherit', letterSpacing: 0 }}>shows after next sign-in</span>}</span>
          </div>
        ))}
      </div>
      {s.board.map((p: any) => <PlayerRow key={p.id} p={p} act={act} />)}
      {!s.board.length && <p className="center muted">Nobody has joined yet. Send the boys the link.</p>}
    </>
  );
}

function PlayerRow({ p, act }: { p: any; act: (b: any, done?: string) => Promise<boolean> }) {
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  return (
    <div className="card">
      <div className="row"><b>{p.name}</b><span><b className="green">{fmtMoney(p.balance)}</b> <span className="small muted">cash · {fmtMoney(p.at_risk)} live · {p.w}-{p.l}</span></span></div>
      <label>Give / take Dario Bucks (use - to take)</label>
      <div className="row">
        <input placeholder="10 or -5" value={amt} onChange={(e) => setAmt(e.target.value)} style={{ width: 100 }} />
        <input placeholder="Reason (shows in feed)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn sm" disabled={!amt} onClick={async () => { if (await act({ action: 'adjust', playerId: p.id, amount: Number(amt), note }, 'Done')) { setAmt(''); setNote(''); } }}>Go</button>
      </div>
      <label>Reset PIN</label>
      <div className="row">
        <input placeholder="New 4-digit PIN" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <button className="btn sm ghost" disabled={pin.length !== 4} onClick={async () => { if (await act({ action: 'resetPin', playerId: p.id, pin }, `PIN reset for ${p.name}`)) setPin(''); }}>Reset</button>
        <button className="btn sm ghost" onClick={() => confirm(`Remove ${p.name}?`) && act({ action: 'removePlayer', playerId: p.id }, 'Removed')}>Remove</button>
      </div>
    </div>
  );
}
