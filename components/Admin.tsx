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
  const [tab, setTab] = useState<'lines' | 'new' | 'pitches' | 'players' | 'bets'>('lines');

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
        <div className="seg" style={{ gridTemplateColumns: 'repeat(5,1fr)', fontSize: 13 }}>
          {(['lines', 'new', 'pitches', 'players', 'bets'] as const).map((t) => {
            const pending = (s.pitches ?? []).filter((x: any) => x.status === 'pending').length;
            return (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)} style={{ position: 'relative' }}>
                {{ lines: 'Lines', new: '+ New', pitches: 'Pitches', players: 'Players', bets: 'Bets' }[t]}
                {t === 'pitches' && pending > 0 && <span className="badge" style={{ top: -4, right: -2 }}>{pending}</span>}
              </button>
            );
          })}
        </div>
        {err && <div className="err">{err}</div>}
        {msg && <div className="err" style={{ background: '#17301f', color: '#a5f3c4' }}>{msg}</div>}

        {tab === 'lines' && s.markets.map((m: any) => <MarketAdmin key={m.id} m={m} act={act} />)}
        {tab === 'new' && <NewMarket act={act} onDone={() => setTab('lines')} />}
        {tab === 'pitches' && (
          <>
            {(s.pitches ?? []).map((pt: any) => <PitchAdmin key={pt.id} pt={pt} act={act} />)}
            {!(s.pitches ?? []).length && <p className="center muted" style={{ marginTop: 30 }}>No pitches yet. The boys can pitch a bet from the bottom of the Lines tab.</p>}
          </>
        )}
        {tab === 'players' && <Players s={s} act={act} />}
        {tab === 'bets' && <AllBets s={s} />}
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

function PitchAdmin({ pt, act }: { pt: any; act: (b: any, done?: string) => Promise<boolean> }) {
  const [title, setTitle] = useState(pt.title);
  const [rows, setRows] = useState<any[]>(pt.options.map((o: any) => ({ label: o.label, odds: fmtOdds(o.odds), blurb: o.blurb || '' })));
  const pending = pt.status === 'pending';
  const set = (i: number, k: string, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="card" style={{ opacity: pending ? 1 : 0.55 }}>
      <div className="row">
        <span className="small"><b className="orange">{pt.name}</b> pitched · {ago(pt.created_at)}</span>
        <span className={`chip ${pending ? 'lock' : pt.status === 'approved' ? 'won' : 'lost'}`}>{pending ? 'New' : pt.status}</span>
      </div>
      {pending ? (
        <>
          <label>Bet</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
          {rows.map((r, i) => (
            <div className="orow" key={i}>
              <input value={r.label} onChange={(e) => set(i, 'label', e.target.value)} />
              <input value={r.odds} onChange={(e) => set(i, 'odds', e.target.value)} />
              <textarea value={r.blurb} onChange={(e) => set(i, 'blurb', e.target.value)} placeholder="Blurb (optional)" />
            </div>
          ))}
          <div className="acts">
            <button className="btn sm ghost" onClick={() => setRows([...rows, { label: '', odds: '+500', blurb: '' }])}>+ Add a name</button>
            <button className="btn sm ghost" onClick={() => confirm('Reject this pitch?') && act({ action: 'rejectPitch', id: pt.id }, 'Rejected')}>Reject</button>
            <button className="btn sm" onClick={() => act({ action: 'approvePitch', id: pt.id, title, options: rows.filter((r) => r.label.trim()) }, `"${title}" is live 🚨`)}>Approve &amp; post</button>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 6 }}><b>{pt.title}</b><div className="small muted">{pt.options.map((o: any) => `${o.label} ${fmtOdds(o.odds)}`).join(' · ')}</div></div>
      )}
    </div>
  );
}

function AllBets({ s }: { s: any }) {
  const [who, setWho] = useState('all');
  const [st, setSt] = useState<'all' | 'open' | 'done'>('all');
  const bets = s.allBets.filter((b: any) => (who === 'all' || String(b.player_id) === who) && (st === 'all' || (st === 'open' ? b.status === 'open' : b.status !== 'open')));
  const live = bets.filter((b: any) => b.status === 'open');
  const risk = live.reduce((a: number, b: any) => a + b.stake, 0);
  const owe = live.reduce((a: number, b: any) => a + b.potential, 0);
  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <select value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">Everyone ({s.allBets.length} bets)</option>
          {[...s.board].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((p: any) => (
            <option key={p.id} value={p.id}>{p.name} ({s.allBets.filter((b: any) => b.player_id === p.id).length})</option>
          ))}
        </select>
        <select value={st} onChange={(e) => setSt(e.target.value as any)} style={{ width: 130 }}>
          <option value="all">All</option><option value="open">Live</option><option value="done">Settled</option>
        </select>
      </div>
      <p className="small muted" style={{ margin: '8px 2px' }}>{live.length} live · {fmtMoney(risk)} riding · {fmtMoney(owe)} if they all hit</p>
      <div className="card" style={{ padding: 0 }}>
        {bets.map((b: any) => <div key={b.id}><BetCard bet={b} showName /><div className="small muted" style={{ padding: '0 14px 8px' }}>{ago(b.created_at)}</div></div>)}
        {!bets.length && <p className="center muted" style={{ padding: 16 }}>No bets here.</p>}
      </div>
    </>
  );
}

function Players({ s, act }: { s: any; act: (b: any, done?: string) => Promise<boolean> }) {
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  return (
    <>
      <div className="card">
        <b>💸 Give everyone Dario Bucks</b>
        <div className="row" style={{ marginTop: 8 }}>
          <input placeholder="10" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} style={{ width: 90 }} />
          <input placeholder="Reason (shows in feed)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn sm" disabled={!Number(amt)} onClick={async () => {
            if (confirm(`Give all ${s.board.length} players $${amt}?`) && await act({ action: 'adjustAll', amount: Number(amt), note }, `Everyone got $${amt}`)) { setAmt(''); setNote(''); }
          }}>Give all</button>
        </div>
      </div>
      <div className="card">
        <b>Names &amp; PINs</b> <span className="small muted">— for when someone forgets</span>
        {[...s.board].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((p: any) => (
          <div className="row" key={p.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
            <span style={{ fontWeight: 800 }}>{p.name}</span>
            <span style={{ fontFamily: 'var(--display)', fontSize: 24, letterSpacing: 4 }}>{s.pins?.[p.id] ?? <span className="small muted" style={{ fontFamily: 'inherit', letterSpacing: 0 }}>shows after next sign-in</span>}</span>
          </div>
        ))}
      </div>
      {s.board.map((p: any) => <PlayerRow key={p.id} p={p} act={act} markets={s.markets} />)}
      {!s.board.length && <p className="center muted">Nobody has joined yet. Send the boys the link.</p>}
    </>
  );
}

function BetFor({ p, act, markets }: { p: any; act: (b: any, done?: string) => Promise<boolean>; markets: any[] }) {
  const [open, setOpen] = useState(false);
  const [legs, setLegs] = useState<{ m: string; o: string }[]>([{ m: '', o: '' }]);
  const [stake, setStake] = useState('');
  const live = markets.filter((m: any) => m.is_open);
  const pick = (i: number) => { const m = live.find((x: any) => String(x.id) === legs[i].m); return m?.options.find((o: any) => String(o.id) === legs[i].o && o.active); };
  const chosen = legs.map((_, i) => pick(i)).filter(Boolean);
  const dec = chosen.reduce((a: number, o: any) => a * (o.eff_odds > 0 ? 1 + o.eff_odds / 100 : 1 + 100 / -o.eff_odds), 1);
  const pay = Math.floor((Number(stake) || 0) * 100 * dec + 1e-6);
  if (!open) return <button className="btn sm ghost" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>🎟️ Place a bet for {p.name}</button>;
  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: '1px dashed var(--orange)' }}>
      <b className="small orange">Bet for {p.name} — comes out of his {fmtMoney(p.balance)}</b>
      {legs.map((l, i) => {
        const m = live.find((x: any) => String(x.id) === l.m);
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
            <select value={l.m} onChange={(e) => setLegs(legs.map((x, j) => (j === i ? { m: e.target.value, o: '' } : x)))}>
              <option value="">Line…</option>
              {live.filter((x: any) => String(x.id) === l.m || !legs.some((y) => y.m === String(x.id))).map((x: any) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
            <select value={l.o} disabled={!m} onChange={(e) => setLegs(legs.map((x, j) => (j === i ? { ...x, o: e.target.value } : x)))}>
              <option value="">Pick…</option>
              {m?.options.filter((o: any) => o.active).map((o: any) => <option key={o.id} value={o.id}>{o.label} {fmtOdds(o.eff_odds)}</option>)}
            </select>
          </div>
        );
      })}
      <div className="acts">
        {legs.length < 3 && <button className="btn sm ghost" onClick={() => setLegs([...legs, { m: '', o: '' }])}>+ Parlay leg</button>}
        <input placeholder="$ wager" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value.replace(/[^\d.]/g, ''))} style={{ width: 100, padding: '6px 10px' }} />
        <span className="small" style={{ alignSelf: 'center' }}>pays <b className="green">{fmtMoney(pay)}</b></span>
      </div>
      <div className="acts">
        <button className="btn sm" disabled={!chosen.length || chosen.length !== legs.filter((l) => l.m).length || !(Number(stake) >= 1)} onClick={async () => {
          const ok = await act({ action: 'betFor', playerId: p.id, stake: Number(stake), legs: chosen.map((o: any) => ({ optionId: o.id, odds: o.eff_odds })) }, `Bet placed for ${p.name}`);
          if (ok) { setLegs([{ m: '', o: '' }]); setStake(''); setOpen(false); }
        }}>Place it</button>
        <button className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function PlayerRow({ p, act, markets }: { p: any; act: (b: any, done?: string) => Promise<boolean>; markets: any[] }) {
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  return (
    <div className="card">
      <div className="row"><b>{p.name}</b><span><b className="green">{fmtMoney(p.balance)}</b> <span className="small muted">cash · {fmtMoney(p.at_risk)} live · {p.w}-{p.l}</span></span></div>
      <label>Add Dario Bucks</label>
      <div className="acts" style={{ marginTop: 0 }}>
        {[5, 10, 25, 50].map((v) => (
          <button key={v} className="btn sm ghost" onClick={() => act({ action: 'adjust', playerId: p.id, amount: v, note }, `+$${v} to ${p.name}`)}>+${v}</button>
        ))}
      </div>
      <label>Or a custom amount (use - to take away)</label>
      <div className="row">
        <input placeholder="10 or -5" value={amt} onChange={(e) => setAmt(e.target.value)} style={{ width: 100 }} />
        <input placeholder="Reason (shows in feed)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn sm" disabled={!amt} onClick={async () => { if (await act({ action: 'adjust', playerId: p.id, amount: Number(amt), note }, 'Done')) { setAmt(''); setNote(''); } }}>Go</button>
      </div>
      <BetFor p={p} act={act} markets={markets} />
      <label>Reset PIN</label>
      <div className="row">
        <input placeholder="New 4-digit PIN" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <button className="btn sm ghost" disabled={pin.length !== 4} onClick={async () => { if (await act({ action: 'resetPin', playerId: p.id, pin }, `PIN reset for ${p.name}`)) setPin(''); }}>Reset</button>
        <button className="btn sm ghost" onClick={() => confirm(`Remove ${p.name}?`) && act({ action: 'removePlayer', playerId: p.id }, 'Removed')}>Remove</button>
      </div>
    </div>
  );
}
