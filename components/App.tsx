'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmtMoney, fmtOdds, payoutCents, parlayDecimal, toAmerican } from '@/lib/odds';
import { Skyline } from './Skyline';
import { InstallCard, IosInstallFirst } from './Install';

type Opt = { id: number; market_id: number; label: string; blurb: string | null; odds: number; eff_odds: number; boosted: boolean; boost_until: string | null; active: boolean };
type Market = { id: number; title: string; subtitle: string | null; status: string; is_open: boolean; lock_at: string | null; winner_option_id: number | null; options: Opt[] };
type Leg = { id: number; label: string; market_title: string; odds: number; result: string; option_id: number; market_id: number; market_open: boolean; boosted: boolean };
type Bet = { id: number; player_id: number; player_name: string; stake: number; potential: number; payout: number; status: string; odds: number; legs: Leg[]; created_at: string; tailed_name: string | null; tailed_from: number | null };
type Sel = { optionId: number; marketId: number; label: string; marketTitle: string; odds: number; boosted: boolean };

export const MAX_LEGS = 3;

export async function api(path: string, body?: unknown) {
  const r = await fetch(path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: 'Network error' }));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Error'), { data: j, status: r.status });
  return j;
}

export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
const lockText = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

export function BetCard({ bet, showName, onTail, meId }: { bet: Bet; showName?: boolean; onTail?: (b: Bet) => void; meId?: number }) {
  const n = bet.legs.length;
  const canTail = onTail && bet.status === 'open' && bet.player_id !== meId && bet.legs.every((l) => l.market_open && l.result === 'open');
  const icon: Record<string, string> = { won: '✓', lost: '✗', void: '↺', open: '•' };
  return (
    <div className="bet">
      <div className="h">
        <span className="k">
          {showName && <span className="orange">{bet.player_name} · </span>}
          {n > 1 ? `${n}-Leg Parlay` : 'Straight'} <span className="muted">{fmtOdds(bet.odds)}</span>
        </span>
        <span className={`chip ${bet.status === 'open' ? 'open' : bet.status}`}>{bet.status === 'open' ? 'Live' : bet.status === 'won' ? 'Cashed' : bet.status}</span>
      </div>
      {bet.tailed_name && <div className="small muted">🐑 Tailing {bet.tailed_name}</div>}
      {bet.legs.map((l) => (
        <div className="lg" key={l.id}>
          <span className={`r ${l.result}`}>{icon[l.result]}</span>
          <span style={{ flex: 1 }}>
            <b>{l.label}</b> <span className="muted">{fmtOdds(l.odds)}{l.boosted ? ' 🔥' : ''}</span>
            <div className="small muted">{l.market_title}</div>
          </span>
        </div>
      ))}
      <div className="ft">
        <span className="muted">Bet {fmtMoney(bet.stake)}</span>
        {bet.status === 'won' ? <b className="green">Won {fmtMoney(bet.payout)}</b>
          : bet.status === 'lost' ? <b className="red">Lost</b>
          : bet.status === 'void' ? <b className="muted">Refunded {fmtMoney(bet.payout)}</b>
          : <b>To pay {fmtMoney(bet.potential)}</b>}
      </div>
      {canTail && <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => onTail!(bet)}>🐑 Tail this</button>}
    </div>
  );
}

const FEED_ICON: Record<string, string> = { bet: '🎟️', won: '💰', lost: '💀', badbeat: '😭', sweat: '😰', result: '📣', void: '↺', boost: '🔥', newline: '🚨', move: '📈', lock: '🔒', unlock: '🔓', join: '👋', adjust: '🏦', reopen: '⚠️', pitch: '💡' };

export default function App() {
  const [s, setS] = useState<any>(null);
  const [loadErr, setLoadErr] = useState('');
  const [tab, setTab] = useState<'lines' | 'bets' | 'feed' | 'board'>('lines');
  const [slip, setSlip] = useState<Sel[]>([]);
  const [slipOpen, setSlipOpen] = useState(false);
  const [tailFrom, setTailFrom] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [seenFeed, setSeenFeed] = useState<number>(0);
  const toastT = useRef<any>();
  const prevOdds = useRef<Map<number, number>>(new Map());
  const [moves, setMoves] = useState<Record<number, 'up' | 'down'>>({});
  const [hideInstall, setHideInstall] = useState(true);
  useEffect(() => { try { setHideInstall(localStorage.getItem('fd.installHide') === '1'); } catch { setHideInstall(false); } }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      setS(await api('/api/state'));
      setLoadErr('');
    } catch (e: any) {
      setLoadErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 8000);
    const v = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [load]);

  useEffect(() => {
    try { setSeenFeed(Number(localStorage.getItem('fd.feedSeen') || 0)); } catch {}
  }, []);
  useEffect(() => {
    if (tab === 'feed' && s?.feed?.[0]) {
      setSeenFeed(s.feed[0].id);
      try { localStorage.setItem('fd.feedSeen', String(s.feed[0].id)); } catch {}
    }
  }, [tab, s]);

  // flash odds buttons when the commish moves a line (green = better payout, red = worse)
  useEffect(() => {
    if (!s?.markets) return;
    const next: Record<number, 'up' | 'down'> = {};
    const seen = prevOdds.current.size > 0;
    s.markets.forEach((mk: Market) => mk.options.forEach((o) => {
      const before = prevOdds.current.get(o.id);
      if (seen && before !== undefined && before !== o.eff_odds) next[o.id] = o.eff_odds > before ? 'up' : 'down';
      prevOdds.current.set(o.id, o.eff_odds);
    }));
    if (Object.keys(next).length) {
      setMoves(next);
      const t = setTimeout(() => setMoves({}), 2300);
      return () => clearTimeout(t);
    }
  }, [s]);

  // keep slip odds fresh against the board
  const optIndex = useMemo(() => {
    const m = new Map<number, { o: Opt; mk: Market }>();
    s?.markets?.forEach((mk: Market) => mk.options.forEach((o) => m.set(o.id, { o, mk })));
    return m;
  }, [s]);

  if (!s) return <div className="wrap"><div className="hero"><div className="brand">Fan<b>Dario</b></div><p className="muted">{loadErr || 'Loading the board…'}</p></div></div>;
  if (!s.me) return <Login onDone={load} />;

  const toggle = (mk: Market, o: Opt) => {
    if (!mk.is_open) return;
    setTailFrom(null);
    setSlip((cur) => {
      if (cur.some((x) => x.optionId === o.id)) return cur.filter((x) => x.optionId !== o.id);
      const same = cur.findIndex((x) => x.marketId === mk.id);
      const sel: Sel = { optionId: o.id, marketId: mk.id, label: o.label, marketTitle: mk.title, odds: o.eff_odds, boosted: o.boosted };
      if (same >= 0) { const n = [...cur]; n[same] = sel; return n; }
      if (cur.length >= MAX_LEGS) { flash(`Max ${MAX_LEGS} legs — remove one first`); return cur; }
      return [...cur, sel];
    });
  };

  const tail = (b: Bet) => {
    const legs: Sel[] = [];
    for (const l of b.legs) {
      const hit = optIndex.get(l.option_id);
      if (!hit || !hit.mk.is_open || !hit.o.active) return flash('One of those lines is locked now');
      legs.push({ optionId: l.option_id, marketId: l.market_id, label: l.label, marketTitle: l.market_title, odds: hit.o.eff_odds, boosted: hit.o.boosted });
    }
    setSlip(legs);
    setTailFrom(b.id);
    setSlipOpen(true);
  };

  const selected = new Set(slip.map((x) => x.optionId));
  const openMarkets = s.markets.filter((m: Market) => m.status !== 'settled' && m.status !== 'void');
  const graded = s.markets.filter((m: Market) => m.status === 'settled' || m.status === 'void');
  const openBets = s.myBets.filter((b: Bet) => b.status === 'open');
  const doneBets = s.myBets.filter((b: Bet) => b.status !== 'open');
  const newFeed = s.feed.filter((f: any) => f.id > seenFeed).length;
  const slipOdds = slip.length ? toAmerican(parlayDecimal(slip.map((x) => x.odds))) : 0;

  return (
    <>
      <div className="top">
        <div className="top-in">
          <div>
            <div className="brand">Fan<b>Dario</b></div>
            <div className="tag">★ Keep Austin Betting</div>
          </div>
          <div className="bal">
            <div className="v">{fmtMoney(s.me.balance)}</div>
            <div className="l">Dario Bucks{s.me.at_risk ? ` · ${fmtMoney(s.me.at_risk)} live` : ''}</div>
          </div>
        </div>
      </div>

      <div className="wrap">
        {s.boosts.map((b: any) => (
          <button className="boost" key={b.id} onClick={() => { setTab('lines'); setTimeout(() => document.getElementById(`m${b.market_id}`)?.scrollIntoView({ behavior: 'smooth' }), 50); }}>
            <span style={{ fontSize: 26 }}>🔥</span>
            <span><span className="t">DARIO BOOST · {b.label} {fmtOdds(b.eff_odds)}</span>
              <small>{b.market_title} · was {fmtOdds(b.odds)} · ends {ago(b.boost_until).includes('ago') ? 'soon' : new Date(b.boost_until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
            </span>
          </button>
        ))}

        {tab === 'lines' && (
          <>
            <div className="skyline">
              <div className="hello">Howdy, <span>{s.me.name}</span></div>
              <Skyline />
            </div>
            {!hideInstall && <InstallCard onDismiss={() => { setHideInstall(true); try { localStorage.setItem('fd.installHide', '1'); } catch {} }} />}
            {openMarkets.map((m: Market) => (
              <div className="card mcard" key={m.id} id={`m${m.id}`}>
                <div className="mhead">
                  <div className="t">{m.title}
                    {m.subtitle && <div className="small muted" style={{ fontWeight: 500 }}>{m.subtitle}</div>}
                  </div>
                  {m.is_open
                    ? <span className="chip open">{m.lock_at ? `Locks ${lockText(m.lock_at)}` : 'Open'}</span>
                    : <span className="chip lock">Locked</span>}
                </div>
                {m.options.map((o) => <OptRow key={o.id} o={o} sel={selected.has(o.id)} move={moves[o.id]} disabled={!m.is_open} onTap={() => toggle(m, o)} />)}
              </div>
            ))}
            {!openMarkets.length && <p className="center muted" style={{ marginTop: 40 }}>No open lines. The commish is cooking.</p>}
            <PitchForm mine={s.myPitches} onSent={(m) => { flash(m); load(); }} />
            {graded.length > 0 && <h2 className="sec">Graded</h2>}
            {graded.map((m: Market) => (
              <div className="card" key={m.id}>
                <div className="mhead">
                  <div className="t">{m.title}</div>
                  <span className={`chip ${m.status === 'void' ? 'void' : 'won'}`}>{m.status === 'void' ? 'Void' : 'Final'}</span>
                </div>
                {m.options.filter((o) => o.id === m.winner_option_id).map((o) => (
                  <div className="opt win" key={o.id}><div className="who"><div className="n">{o.label}</div></div><div className="odds">{fmtOdds(o.odds)}</div></div>
                ))}
              </div>
            ))}
          </>
        )}

        {tab === 'bets' && (
          <>
            <h2 className="sec">Live bets ({openBets.length})</h2>
            <div className="card">{openBets.length ? openBets.map((b: Bet) => <BetCard key={b.id} bet={b} />) : <p className="center muted" style={{ padding: 16 }}>Nothing live. Go build a parlay.</p>}</div>
            {doneBets.length > 0 && <h2 className="sec">Settled</h2>}
            {doneBets.length > 0 && <div className="card">{doneBets.map((b: Bet) => <BetCard key={b.id} bet={b} />)}</div>}
            <button className="btn ghost" style={{ marginTop: 24 }} onClick={async () => { await api('/api/auth', { action: 'logout' }); setSlip([]); load(); }}>Sign out ({s.me.name})</button>
          </>
        )}

        {tab === 'feed' && (
          <div className="card">
            {s.feed.map((f: any) => (
              <div className={`fi ${f.kind}`} key={f.id}>
                {f.kind === 'bet' && f.bet ? (
                  <>
                    <div className="row"><span className="small"><b>{f.player_name}</b> placed a bet</span><span className="when">{ago(f.created_at)}</span></div>
                    <div style={{ margin: '0 -14px' }}><BetCard bet={f.bet} onTail={tail} meId={s.me.id} /></div>
                  </>
                ) : (
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <span><span style={{ marginRight: 6 }}>{FEED_ICON[f.kind] || '•'}</span><b>{f.text}</b></span>
                    <span className="when" style={{ whiteSpace: 'nowrap' }}>{ago(f.created_at)}</span>
                  </div>
                )}
              </div>
            ))}
            {!s.feed.length && <p className="center muted" style={{ padding: 16 }}>Quiet… too quiet.</p>}
          </div>
        )}

        {tab === 'board' && (
          <>
            <div className="board-hero">
              <div className="bh">★ DKR LEADERBOARD ★</div>
              {s.board.map((p: any, i: number) => (
                <div className={`lb ${p.id === s.me.id ? 'me' : ''} ${i === 0 ? 'first' : ''}`} key={p.id}>
                  <div className="rk">{i === 0 ? '👑' : i === s.board.length - 1 && s.board.length > 2 ? '🚽' : i + 1}</div>
                  <div>
                    <div className="nm">{p.name}</div>
                    <div className="small muted">{p.w}-{p.l}{p.at_risk ? ` · ${fmtMoney(p.at_risk)} live` : ''}{p.best ? ` · best hit +${fmtMoney(p.best)}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={`tot ${p.total >= 5000 ? 'green' : 'red'}`}>{fmtMoney(p.total)}</div>
                    <div className="small muted">{fmtMoney(p.balance)} cash</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="small muted center">Ranked by cash + live bets. Everyone started with $50 Dario Bucks. Last place is in the toilet.</p>
          </>
        )}
      </div>

      {slip.length > 0 && !slipOpen && (
        <button className="slipbar" onClick={() => setSlipOpen(true)}>
          <span className="a">🎟️ Bet slip · {slip.length} {slip.length > 1 ? 'picks' : 'pick'}</span>
          <span className="b">{slip.length > 1 ? 'Parlay ' : ''}{fmtOdds(slipOdds)} ▲</span>
        </button>
      )}
      {slipOpen && (
        <Slip
          slip={slip} setSlip={setSlip} balance={s.me.balance} tailFrom={tailFrom}
          onClose={() => setSlipOpen(false)}
          onPlaced={(msg) => { setSlip([]); setTailFrom(null); setSlipOpen(false); flash(msg); load(); }}
          refresh={load}
        />
      )}

      <Ticker items={s.feed.filter((f: any) => f.kind !== 'join').slice(0, 10).map((f: any) => f.text)} />
      <nav className="tabs">
        <div className="tabs-in">
          {([['lines', '🎯', 'Lines'], ['bets', '🎟️', 'My Bets'], ['feed', '📣', 'Feed'], ['board', '🏆', 'Board']] as const).map(([k, i, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              <span className="i">{i}</span>{l}
              {k === 'feed' && newFeed > 0 && tab !== 'feed' && <span className="badge">{newFeed > 9 ? '9+' : newFeed}</span>}
              {k === 'bets' && openBets.length > 0 && <span className="badge">{openBets.length}</span>}
            </button>
          ))}
        </div>
      </nav>

      {toast && <div className="toast">{toast}</div>}
      {s.unseen.length > 0 && <Celebrate bets={s.unseen} onDone={async () => { await api('/api/seen', { ids: s.unseen.map((b: Bet) => b.id) }).catch(() => {}); load(); }} />}
    </>
  );
}

function OptRow({ o, sel, disabled, onTap, move }: { o: Opt; sel: boolean; disabled: boolean; onTap: () => void; move?: 'up' | 'down' }) {
  const [more, setMore] = useState(false);
  return (
    <div className={`opt ${sel ? 'sel' : ''} ${disabled ? 'dis' : ''}`}>
      <div className="who" onClick={() => setMore((m) => !m)}>
        <div className="n">{o.label} {o.boosted && <span className="fire">🔥 BOOSTED</span>}</div>
        {o.blurb && <div className={`bl ${more ? '' : 'clamp'}`}>{o.blurb}</div>}
      </div>
      <button className={`odds ${o.eff_odds < 0 ? 'fav' : 'dog'} ${move ?? ''}`} onClick={onTap} disabled={disabled} aria-label={`${o.label} ${fmtOdds(o.eff_odds)}`}>
        {o.boosted && <s>{fmtOdds(o.odds)}</s>}
        {fmtOdds(o.eff_odds)}
      </button>
    </div>
  );
}

function Slip({ slip, setSlip, balance, tailFrom, onClose, onPlaced, refresh }: {
  slip: Sel[]; setSlip: (f: (s: Sel[]) => Sel[]) => void; balance: number; tailFrom: number | null;
  onClose: () => void; onPlaced: (m: string) => void; refresh: () => void;
}) {
  const [mode, setMode] = useState<'parlay' | 'singles'>('parlay');
  const [stake, setStake] = useState('');
  const [singles, setSingles] = useState<Record<number, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [stamped, setStamped] = useState(false);
  const isParlay = slip.length > 1 && mode === 'parlay';
  const cents = (v: string) => Math.round((Number(v) || 0) * 100);

  const total = isParlay || slip.length === 1 ? cents(stake) : slip.reduce((a, x) => a + cents(singles[x.optionId] || ''), 0);
  const payout = isParlay || slip.length === 1
    ? payoutCents(cents(stake), slip.map((x) => x.odds))
    : slip.reduce((a, x) => a + payoutCents(cents(singles[x.optionId] || ''), [x.odds]), 0);

  useEffect(() => { if (!slip.length) onClose(); }, [slip.length, onClose]);

  const quick = (set: (v: string) => void, other = 0) => (
    <div className="stakes">
      {[5, 10, 25].map((v) => <button key={v} onClick={() => set(String(v))}>${v}</button>)}
      <button onClick={() => set(String(Math.max(0, balance - other) / 100))}>Max</button>
    </div>
  );

  const place = async () => {
    setErr('');
    if (total < 100) return setErr('Minimum bet is $1.');
    if (total > balance) return setErr(`You only have ${fmtMoney(balance)}.`);
    setBusy(true);
    try {
      if (isParlay || slip.length === 1) {
        await api('/api/bet', { legs: slip.map((x) => ({ optionId: x.optionId, odds: x.odds })), stake: cents(stake) / 100, tailedFrom: tailFrom });
      } else {
        for (const x of slip) {
          const c = cents(singles[x.optionId] || '');
          if (c > 0) await api('/api/bet', { legs: [{ optionId: x.optionId, odds: x.odds }], stake: c / 100 });
        }
      }
      setStamped(true);
      try { navigator.vibrate?.([30, 40, 60]); } catch {}
      setTimeout(() => onPlaced(isParlay ? `Parlay in! To pay ${fmtMoney(payout)} 🤞` : 'Bet placed 🤞'), 1000);
    } catch (e: any) {
      const changed = e.data?.oddsChanged as Record<string, number> | undefined;
      if (changed) setSlip((cur) => cur.map((x) => (changed[x.optionId] !== undefined ? { ...x, odds: changed[x.optionId] } : x)));
      setErr(e.message);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sheetbg" onClick={onClose} />
      <div className="sheet">
        <div className="ticket">
          {stamped && <div className="stamp"><span>BET PLACED</span></div>}
          <div className="stubtop">
            <div>
              <div className="admit">ADMIT ONE · FANDARIO</div>
              <div className="ttl">{isParlay ? `${slip.length}-Leg Parlay` : slip.length > 1 ? 'Straight Bets' : 'Straight Bet'}</div>
            </div>
            <button className="clear" onClick={() => setSlip(() => [])}>Clear</button>
          </div>
          {tailFrom && <div className="small" style={{ marginTop: 4, color: '#bf5700', fontWeight: 700 }}>🐑 Tailing — you get today&apos;s odds, not theirs</div>}
          {slip.length > 1 && (
            <div className="seg">
              <button className={mode === 'parlay' ? 'on' : ''} onClick={() => setMode('parlay')}>Parlay {fmtOdds(toAmerican(parlayDecimal(slip.map((x) => x.odds))))}</button>
              <button className={mode === 'singles' ? 'on' : ''} onClick={() => setMode('singles')}>Straight bets</button>
            </div>
          )}
          <div className="perf" />
          {slip.map((x) => (
            <div className="leg" key={x.optionId}>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 16 }}>{x.label}</b> <span className="lo">{fmtOdds(x.odds)}{x.boosted ? ' 🔥' : ''}</span>
                <div className="small muted">{x.marketTitle}</div>
                {!isParlay && slip.length > 1 && (
                  <div className="money" style={{ marginTop: 6 }}>
                    <span>$</span>
                    <input inputMode="decimal" placeholder="0" value={singles[x.optionId] || ''} onChange={(e) => setSingles({ ...singles, [x.optionId]: e.target.value.replace(/[^\d.]/g, '') })} />
                    <span className="small muted" style={{ whiteSpace: 'nowrap' }}>→ {fmtMoney(payoutCents(cents(singles[x.optionId] || ''), [x.odds]))}</span>
                  </div>
                )}
              </div>
              <button className="x" onClick={() => setSlip((c) => c.filter((y) => y.optionId !== x.optionId))}>×</button>
            </div>
          ))}
          {slip.length < MAX_LEGS && <p className="small muted">Add up to {MAX_LEGS - slip.length} more {MAX_LEGS - slip.length === 1 ? 'leg' : 'legs'} from other lines for a parlay.</p>}
          {(isParlay || slip.length === 1) && (
            <>
              <div className="money" style={{ marginTop: 10 }}>
                <span className="big">$</span>
                <input inputMode="decimal" placeholder="Wager" value={stake} onChange={(e) => setStake(e.target.value.replace(/[^\d.]/g, ''))} />
              </div>
              {quick(setStake)}
            </>
          )}
          <div className="row" style={{ margin: '14px 0 12px', alignItems: 'flex-end' }}>
            <span className="small muted">Balance<br /><b style={{ color: '#1b1a22', fontSize: 15 }}>{fmtMoney(balance)}</b></span>
            <span style={{ textAlign: 'right' }}><span className="small muted">Payout</span><div className="pay">{fmtMoney(payout)}</div></span>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn" disabled={busy || stamped || total < 100} onClick={place}>
            {busy ? 'Placing…' : `Place ${isParlay ? 'parlay' : slip.length > 1 ? 'bets' : 'bet'} · ${fmtMoney(total)}`}
          </button>
          <div className="barcode" />
          <div className="fine">AUSTIN, TX · DARIO BUCKS ONLY · NO REFUNDS ON BAD DECISIONS</div>
        </div>
      </div>
    </>
  );
}

function Celebrate({ bets, onDone }: { bets: Bet[]; onDone: () => void }) {
  const won = bets.filter((b) => b.status === 'won');
  const lost = bets.filter((b) => b.status === 'lost');
  const net = won.reduce((a, b) => a + b.payout, 0);
  const bad = lost.some((b) => b.legs.length > 1 && b.legs.filter((l) => l.result === 'won').length === b.legs.length - 1);
  const isWin = won.length > 0;
  const isLoss = !isWin && lost.length > 0;
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.9, dur: 2 + Math.random() * 2,
    color: ['#bf5700', '#ff8a2a', '#3ee07f', '#ffd166', '#2ee6d6', '#ff4fa8', '#fff'][i % 7],
  })), []);
  const bats = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ top: 10 + Math.random() * 70, delay: Math.random() * 1.4, dur: 2.2 + Math.random() * 1.6, size: 22 + Math.random() * 22, k: i })), []);
  useEffect(() => { try { navigator.vibrate?.(isWin ? [40, 60, 40, 60, 120] : [200]); } catch {} }, [isWin]);
  return (
    <div className="celebrate" onClick={onDone}>
      {isWin && <div className="confetti">{pieces.map((p, i) => <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />)}</div>}
      {isLoss && <div className="bats">{bats.map((b) => <span key={b.k} style={{ top: `${b.top}%`, fontSize: b.size, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}>🦇</span>)}</div>}
      <div className="jumbo">
        <div className="bulbs">{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
        <div className="screen">
          <div className={`led ${isWin ? 'win' : 'loss'}`}>{isWin ? 'CASHED!' : bad ? 'BAD BEAT' : isLoss ? 'DEAD' : 'PUSH'}</div>
          {isWin && <div className="amt">+{fmtMoney(net)}</div>}
          {isLoss && <div className="sub" style={{ fontSize: 15, fontWeight: 800 }}>{bad ? 'One leg away. The bats feel for you.' : 'The bats came out for that one.'}</div>}
          {won.map((b) => <p key={b.id} className="sub">✓ {b.legs.map((l) => l.label).join(' + ')} · paid <b className="green">{fmtMoney(b.payout)}</b></p>)}
          {lost.map((b) => <p key={b.id} className="sub">✗ {b.legs.map((l) => l.label).join(' + ')} · lost {fmtMoney(b.stake)}</p>)}
          {bets.filter((b) => b.status === 'void').map((b) => <p key={b.id} className="sub">Refunded {fmtMoney(b.payout)} (line voided)</p>)}
        </div>
        <div className="bulbs" style={{ padding: '8px 6px 0' }}>{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
        <button className="btn" style={{ marginTop: 10 }}>{isWin ? 'Run it back' : 'Reload'}</button>
      </div>
    </div>
  );
}

function PitchForm({ mine, onSent }: { mine: any[]; onSent: (m: string) => void }) {
  const blank = () => ({ label: '', odds: '', blurb: '' });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState([blank(), blank(), blank()]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (i: number, k: 'label' | 'odds' | 'blurb', v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const oddsOk = (v: string) => { const n = Number(v.replace('+', '')); return Number.isInteger(n) && Math.abs(n) >= 100; };
  const filled = rows.filter((r) => r.label.trim());
  const ready = title.trim().length >= 4 && filled.length >= 2 && filled.every((r) => oddsOk(r.odds));
  const send = async () => {
    setErr(''); setBusy(true);
    try {
      await api('/api/pitch', { title, options: filled.map((r) => ({ label: r.label, odds: Number(r.odds.replace('+', '')), blurb: r.blurb })) });
      setTitle(''); setRows([blank(), blank(), blank()]); setOpen(false);
      onSent('Sent to the commish 🤠');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const tag: Record<string, string> = { pending: 'Waiting on the commish', approved: 'On the board ✓', rejected: 'Denied by the commish' };
  return (
    <div className="card pitch">
      <button className="pitch-h" onClick={() => setOpen(!open)}>
        <span className="t">💡 Want to add a bet?</span>
        <span className="small muted">{open ? 'Close' : 'Pitch it to the commish ›'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <label className="lbl">The bet</label>
          <input value={title} maxLength={90} onChange={(e) => setTitle(e.target.value)} placeholder="First one to lose their phone" />
          <label className="lbl">Names + lines <span className="muted">(like -150 or +300)</span></label>
          {rows.map((r, i) => (
            <div key={i} className="prow">
              <input placeholder={['Nick', 'Dean', 'Field'][i] ?? 'Name'} value={r.label} maxLength={30} onChange={(e) => set(i, 'label', e.target.value)} />
              <input className={r.odds && !oddsOk(r.odds) ? 'bad' : ''} placeholder={['-150', '+200', '+400'][i] ?? '+250'} inputMode="numeric" value={r.odds} onChange={(e) => set(i, 'odds', e.target.value.replace(/[^\d+-]/g, ''))} />
              <input className="why" placeholder="Why? (optional)" value={r.blurb} maxLength={200} onChange={(e) => set(i, 'blurb', e.target.value)} />
            </div>
          ))}
          {rows.length < 10 && <button className="btn sm ghost" onClick={() => setRows([...rows, blank()])}>+ Add a name</button>}
          {err && <div className="err">{err}</div>}
          <button className="btn" style={{ marginTop: 12 }} disabled={!ready || busy} onClick={send}>{busy ? 'Sending…' : 'Send to the commish'}</button>
          <p className="small muted center" style={{ margin: '8px 0 0' }}>The commish can tweak the odds before it goes live.</p>
        </div>
      )}
      {mine?.length > 0 && (
        <div style={{ padding: '0 14px 12px' }}>
          {mine.slice(0, 4).map((m) => (
            <div key={m.id} className="row small" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
              <span>{m.title}</span>
              <span className={m.status === 'approved' ? 'green' : m.status === 'rejected' ? 'red' : 'orange'}>{tag[m.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Ticker({ items }: { items: string[] }) {
  if (!items.length) return null;
  const dur = Math.max(25, items.join(' ').length * 0.12);
  return (
    <div className="ticker" aria-hidden="true">
      <div className="lbl">LIVE</div>
      <div className="run" style={{ animationDuration: `${dur}s` }}>
        {[...items, ...items].map((t, i) => <span key={i}>{t}</span>)}
      </div>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [players, setPlayers] = useState<{ id: number; name: string }[] | null>(null);
  const [pick, setPick] = useState<{ id: number; name: string } | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/auth').then((r) => setPlayers(r.players)).catch((e) => setErr(e.message)); }, []);

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      await api('/api/auth', isNew ? { action: 'join', name, pin } : { action: 'login', playerId: pick!.id, pin });
      onDone();
    } catch (e: any) { setErr(e.message); setPin(''); } finally { setBusy(false); }
  };

  const pinInput = (
    <input className="pinbox" inputMode="numeric" type="password" autoComplete="off" maxLength={4} placeholder="••••" value={pin}
      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus={!isNew}
      onKeyDown={(e) => e.key === 'Enter' && pin.length === 4 && submit()} />
  );

  return (
    <div className="wrap">
      <div className="hero">
        <div className="brand">Fan<b>Dario</b></div>
        <div className="tag">★ Keep Austin Betting ★</div>
        <p className="muted" style={{ marginTop: 18 }}>Everybody starts with <b className="green">$50 Dario Bucks</b>. Straights or up to 3-leg parlays. Last place is in the toilet.</p>
      </div>
      <IosInstallFirst>
      {!pick && !isNew && (
        <>
          <h2 className="sec center">Who are you?</h2>
          <div className="pills">
            {players?.map((p) => <button key={p.id} onClick={() => { setPick(p); setPin(''); setErr(''); }}>{p.name}</button>)}
          </div>
          <button className="btn" onClick={() => { setIsNew(true); setErr(''); }}>I'm new — grab my $50</button>
        </>
      )}
      {pick && (
        <div className="card" style={{ padding: 16 }}>
          <p className="center">Welcome back, <b>{pick.name}</b>. Enter your PIN.</p>
          {pinInput}
          {err && <div className="err">{err}</div>}
          <button className="btn" style={{ marginTop: 12 }} disabled={busy || pin.length !== 4} onClick={submit}>Let's go</button>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setPick(null)}>Not me</button>
        </div>
      )}
      {isNew && (
        <div className="card" style={{ padding: 16 }}>
          <label className="small muted">Your name (what the boys call you)</label>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jwills" autoFocus />
          <label className="small muted" style={{ display: 'block', marginTop: 12 }}>Pick a 4-digit PIN</label>
          {pinInput}
          {err && <div className="err">{err}</div>}
          <button className="btn" style={{ marginTop: 12 }} disabled={busy || pin.length !== 4 || name.trim().length < 2} onClick={submit}>Claim my $50 Dario Bucks</button>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setIsNew(false)}>Back</button>
        </div>
      )}
      {err && !pick && !isNew && <div className="err">{err}</div>}
      </IosInstallFirst>
      <div className="skyline" style={{ marginTop: 30 }}><Skyline /></div>
    </div>
  );
}
