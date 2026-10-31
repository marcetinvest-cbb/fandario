import 'server-only';
import type { PoolClient } from 'pg';
import { q, tx, UserError } from './db';
import { fmtMoney, fmtOdds, isValidAmerican, payoutCents, toAmerican, parlayDecimal } from './odds';

export const MAX_LEGS = 3;
export const MIN_STAKE = 100;

const OPEN_SQL = `(m.status = 'open' and (m.lock_at is null or m.lock_at > now()))`;
const EFF_ODDS = `(case when o.boost_odds is not null and o.boost_until > now() then o.boost_odds else o.odds end)`;
const BOOSTED = `(o.boost_odds is not null and o.boost_until > now())`;

async function feed(c: PoolClient, kind: string, text: string, ids: { player?: number | null; bet?: number | null; market?: number | null } = {}) {
  await c.query(`insert into fd_feed (kind, text, player_id, bet_id, market_id) values ($1,$2,$3,$4,$5)`, [
    kind, text, ids.player ?? null, ids.bet ?? null, ids.market ?? null,
  ]);
}

/* ---------------- read model ---------------- */

/* one-time board fixes Jay asked for (each runs once, tracked in fd_meta) */
const g = globalThis as unknown as { __fdFix?: Promise<void> };
async function runFix(key: string, fn: () => Promise<void>) {
  const r = await q(`insert into fd_meta (key, value) values ($1, now()::text) on conflict do nothing returning key`, [key]);
  if (!r.length) return;
  try { await fn(); } catch (e) { await q(`delete from fd_meta where key = $1`, [key]); throw e; }
}
export function maintenance() {
  if (!g.__fdFix) g.__fdFix = (async () => {
    // 2026-10-30: night one is over — the night-one lines become night-two lines
    await runFix('fix-night-two', async () => {
      await q(`update fd_markets set title = '2nd Night Legend' where title = 'First Night Legend' and status in ('open','locked')`);
      await q(`update fd_markets set title = 'Blacks Out Night Two' where title = 'Blacks Out Night One' and status in ('open','locked')`);
      await q(`update fd_options set blurb = replace(blurb, 'First Night Legend', '2nd Night Legend') where blurb like '%First Night Legend%'`);
    });
    // 2026-10-30: strip night-one references from the night-two lines
    await runFix('fix-blurbs-n2', async () => {
      const set = (title: string, label: string, blurb: string | null) =>
        q(`update fd_options o set blurb = $3 from fd_markets m where m.id = o.market_id and m.title = $1 and o.label = $2`, [title, label, blurb]);
      await set('2nd Night Legend', 'Marc', 'All juiced up, forgets to electrolyte up before drinking and before we know it he\'s in the zone.');
      await set('2nd Night Legend', 'Dean', 'Might be due for an electric showing. Might already be shirtless.');
      await set('Blacks Out Night Two', 'Marc', 'Stars could align if he\'s the 2nd Night Legend. Wearing the no-show socks. Electric.');
      await set('Blacks Out Night Two', 'Jwills', 'Has way too many old fashioneds.');
      await set('2nd Night Legend', 'Jwills', "Always wanted to go to Texas, doesn't know what to do and turns into the 2nd Night Legend.");
    });
    // 2026-10-31: game-day lines — lock at kickoff (6:30 PM CT = 23:30Z)
    await runFix('add-gameday-total-arch', async () => {
      const KO = '2026-10-31T23:30:00Z';
      const t1 = 'Texas vs Miss St: O/U 50.5 Total Points';
      if (!(await q(`select 1 from fd_markets where title = $1`, [t1])).length)
        await createMarket(t1, 'Final score incl. OT · locks at kickoff', KO, [
          { label: 'Over 50.5', odds: -113, blurb: '51+ total points. Hook \'em, light up the scoreboard.' },
          { label: 'Under 50.5', odds: -107, blurb: '50 or fewer. Defense travels.' },
        ]);
      const t2 = 'Arch Manning O/U 2.5 Passing TDs';
      if (!(await q(`select 1 from fd_markets where title = $1`, [t2])).length)
        await createMarket(t2, 'Passing TDs only (rushing TDs don\'t count) · locks at kickoff', KO, [
          { label: 'Over 2.5', odds: 175, blurb: '3+ passing TDs. Arch goes off on Halloween.' },
          { label: 'Under 2.5', odds: -225, blurb: '2 or fewer. He averages about 1.7 a game this year.' },
        ]);
    });
    // 2026-10-30: Jay's new line — first group shot
    await runFix('add-first-group-shot', async () => {
      const exists = await q(`select 1 from fd_markets where title = $1`, ["What's the 1st Group Shot Everyone Has to Take?"]);
      if (exists.length) return;
      await createMarket("What's the 1st Group Shot Everyone Has to Take?", null, null, [
        { label: 'Fireball', odds: -150 },
        { label: 'Lemon Drop', odds: -115 },
        { label: 'Jack Daniels', odds: 125 },
        { label: 'Tequila', odds: 250 },
        { label: 'Bourbon', odds: 300 },
        { label: 'No Shots Taken', odds: 100 },
        { label: 'Field', odds: 325, blurb: 'Any other shot.' },
      ]);
    });
    // 2026-10-30: Mike blew up the bathroom first
    await runFix('fix-bathroom-mike', async () => {
      const m = (await q(`select id from fd_markets where title = 'First One to Blow Up the Bathroom' and status in ('open','locked')`))[0];
      if (!m) return;
      const o = (await q(`select id from fd_options where market_id = $1 and label = 'Mike'`, [m.id]))[0];
      if (o) await settleMarket(m.id, o.id);
    });
    // 2026-10-30: Zach took the first nap → Field wins
    await runFix('fix-nap-zach', async () => {
      const m = (await q(`select id from fd_markets where title = 'First One to Take a Nap' and status in ('open','locked')`))[0];
      if (!m) return;
      const f = (await q(`select id from fd_options where market_id = $1 and label = 'Field'`, [m.id]))[0];
      if (!f) return;
      await q(`update fd_options set label = 'Field (Zach)' where id = $1`, [f.id]);
      await settleMarket(m.id, f.id);
    });
  })().catch((e) => { g.__fdFix = undefined; console.error('maintenance', e); });
  return g.__fdFix;
}

export async function submitPitch(playerId: number, title: string, opts: { label: string; odds: number; blurb?: string }[]) {
  title = (title || '').trim().slice(0, 90);
  if (title.length < 4) throw new UserError('What\'s the bet? Give it a title.');
  const clean = (opts || []).map((o) => ({ label: String(o.label || '').trim().slice(0, 30), odds: Number(o.odds), blurb: String(o.blurb || '').trim().slice(0, 200) }))
    .filter((o) => o.label);
  if (clean.length < 2) throw new UserError('Add at least 2 names.');
  for (const o of clean) if (!isValidAmerican(o.odds)) throw new UserError(`Line for ${o.label} should look like -150 or +300.`);
  return tx(async (c) => {
    const n = (await c.query(`select count(*)::int as n from fd_pitches where player_id=$1 and status='pending'`, [playerId])).rows[0].n;
    if (n >= 5) throw new UserError('You have 5 pitches waiting already — let the commish catch up.');
    const p = (await c.query(`select name from fd_players where id=$1`, [playerId])).rows[0];
    await c.query(`insert into fd_pitches (player_id, title, options) values ($1,$2,$3)`, [playerId, title, JSON.stringify(clean)]);
    await feed(c, 'pitch', `${p.name} pitched a new line to the commish 👀`, { player: playerId });
    return { ok: true };
  });
}

export async function approvePitch(id: number, title: string, opts: { label: string; odds: number; blurb?: string }[]) {
  const pr = (await q(`select p.*, pl.name from fd_pitches p join fd_players pl on pl.id = p.player_id where p.id = $1`, [id]))[0];
  if (!pr || pr.status !== 'pending') throw new UserError('That pitch was already handled.');
  const r = await createMarket(title || pr.title, `Pitched by ${pr.name}`, null, opts?.length ? opts : pr.options);
  await q(`update fd_pitches set status='approved', market_id=$2 where id=$1`, [id, r.id]);
  return r;
}

export async function getState(playerId: number | null, opts: { admin?: boolean } = {}) {
  await maintenance();
  const markets = await q(`
    select m.id, m.title, m.subtitle, m.status, m.lock_at, m.winner_option_id, m.sort, m.created_at,
           extract(epoch from now() - m.created_at)::int as age_s,
           ${OPEN_SQL} as is_open
    from fd_markets m order by
      case when m.status in ('settled','void') then 1 else 0 end, m.created_at desc, m.sort, m.id`);
  const options = await q(`
    select o.id, o.market_id, o.label, o.blurb, o.odds, o.active, o.sort,
           ${EFF_ODDS} as eff_odds, ${BOOSTED} as boosted, o.boost_until, o.boost_odds,
           (select count(*)::int from fd_legs l where l.option_id = o.id) as bet_count
    from fd_options o order by o.sort, o.id`);
  const byMarket = new Map<number, any[]>();
  for (const o of options) {
    if (!opts.admin && !o.active) continue;
    if (!byMarket.has(o.market_id)) byMarket.set(o.market_id, []);
    byMarket.get(o.market_id)!.push(o);
  }
  const mk = markets.map((m) => ({ ...m, options: byMarket.get(m.id) ?? [] }));

  const board = await q(`
    select p.id, p.name, p.balance,
      coalesce((select sum(stake) from fd_bets b where b.player_id = p.id and b.status = 'open'),0)::int as at_risk,
      (select count(*) from fd_bets b where b.player_id = p.id and b.status = 'won')::int as w,
      (select count(*) from fd_bets b where b.player_id = p.id and b.status = 'lost')::int as l,
      coalesce((select max(payout - stake) from fd_bets b where b.player_id = p.id and b.status = 'won'),0)::int as best
    from fd_players p where not p.removed`);
  board.forEach((b) => (b.total = b.balance + b.at_risk));
  board.sort((a, b) => b.total - a.total || b.w - a.w || a.name.localeCompare(b.name));

  const feedRows = await q(`
    select f.id, f.kind, f.text, f.created_at, f.player_id, f.bet_id, f.market_id, p.name as player_name
    from fd_feed f left join fd_players p on p.id = f.player_id
    order by f.id desc limit 80`);

  const betIds = new Set<number>();
  feedRows.forEach((f) => f.bet_id && betIds.add(f.bet_id));
  let myBets: any[] = [];
  if (playerId) {
    myBets = await q(`select id from fd_bets where player_id = $1 order by id desc`, [playerId]);
    myBets.forEach((b) => betIds.add(b.id));
  }
  const bets = await loadBets([...betIds], opts.admin);
  const betMap = new Map(bets.map((b) => [b.id, b]));

  const me = playerId ? board.find((b) => b.id === playerId) ?? null : null;
  const unseen = playerId
    ? bets.filter((b) => b.player_id === playerId && b.status !== 'open' && !b.seen_at)
    : [];

  const myPitches = playerId
    ? await q(`select id, title, status, created_at from fd_pitches where player_id = $1 order by id desc limit 10`, [playerId])
    : [];
  return {
    now: new Date().toISOString(),
    myPitches,
    me,
    markets: mk,
    board,
    feed: feedRows.map((f) => ({ ...f, bet: f.bet_id ? betMap.get(f.bet_id) ?? null : null })),
    myBets: myBets.map((b) => betMap.get(b.id)).filter(Boolean),
    unseen,
    boosts: options
      .filter((o) => o.boosted && o.active)
      .map((o) => ({ ...o, market_title: markets.find((m) => m.id === o.market_id)?.title })),
  };
}

export async function loadBets(ids: number[], all = false) {
  if (!ids.length && !all) return [];
  const bets = await q(
    `select b.*, p.name as player_name, tp.name as tailed_name
     from fd_bets b join fd_players p on p.id = b.player_id
     left join fd_bets tb on tb.id = b.tailed_from left join fd_players tp on tp.id = tb.player_id
     ${all && !ids.length ? '' : 'where b.id = any($1)'} order by b.id desc`,
    all && !ids.length ? [] : [ids],
  );
  if (!bets.length) return [];
  const legs = await q(
    `select l.*, o.label, m.title as market_title, ${OPEN_SQL} as market_open
     from fd_legs l join fd_options o on o.id = l.option_id join fd_markets m on m.id = l.market_id
     where l.bet_id = any($1) order by l.id`,
    [bets.map((b) => b.id)],
  );
  const lm = new Map<number, any[]>();
  legs.forEach((l) => { if (!lm.has(l.bet_id)) lm.set(l.bet_id, []); lm.get(l.bet_id)!.push(l); });
  return bets.map((b) => {
    const ls = lm.get(b.id) ?? [];
    return { ...b, legs: ls, odds: toAmerican(parlayDecimal(ls.map((l) => l.odds))) };
  });
}

/* ---------------- betting ---------------- */

export type LegInput = { optionId: number; odds: number };

export async function placeBet(playerId: number, legsIn: LegInput[], stake: number, tailedFrom?: number | null, byAdmin = false) {
  if (!Array.isArray(legsIn) || legsIn.length < 1) throw new UserError('Pick at least one line.');
  if (legsIn.length > MAX_LEGS) throw new UserError(`Max ${MAX_LEGS} legs per parlay.`);
  if (!Number.isInteger(stake) || stake < MIN_STAKE) throw new UserError('Minimum bet is $1.');
  const ids = legsIn.map((l) => Number(l.optionId));
  if (new Set(ids).size !== ids.length) throw new UserError('Same pick twice.');

  return tx(async (c) => {
    const pr = await c.query(`select id, name, balance from fd_players where id = $1 and not removed for update`, [playerId]);
    const p = pr.rows[0];
    if (!p) throw new UserError('Sign in again.');
    const or = await c.query(
      `select o.id, o.label, o.market_id, o.active, ${EFF_ODDS} as eff, ${BOOSTED} as boosted, m.title, ${OPEN_SQL} as open
       from fd_options o join fd_markets m on m.id = o.market_id where o.id = any($1)`,
      [ids],
    );
    if (or.rowCount !== ids.length) throw new UserError('One of those lines no longer exists.');
    const rows = ids.map((id) => or.rows.find((r) => r.id === id)!);
    if (new Set(rows.map((r) => r.market_id)).size !== rows.length)
      throw new UserError("Can't parlay two picks from the same line.");
    for (const r of rows) {
      if (!r.open) throw new UserError(`"${r.title}" is locked.`);
      if (!r.active) throw new UserError(`${r.label} was pulled from "${r.title}".`);
    }
    const changed = rows.filter((r, i) => r.eff !== Number(legsIn[i].odds));
    if (changed.length)
      throw new UserError('Odds moved — check your slip.', {
        oddsChanged: Object.fromEntries(rows.map((r) => [r.id, r.eff])),
      });
    if (stake > p.balance) throw new UserError(`You only have ${fmtMoney(p.balance)} Dario Bucks.`);

    const odds = rows.map((r) => r.eff as number);
    const potential = payoutCents(stake, odds);
    await c.query(`update fd_players set balance = balance - $1 where id = $2`, [stake, playerId]);
    const br = await c.query(
      `insert into fd_bets (player_id, stake, potential, tailed_from) values ($1,$2,$3,$4) returning id`,
      [playerId, stake, potential, tailedFrom ?? null],
    );
    const betId = br.rows[0].id;
    for (const r of rows)
      await c.query(`insert into fd_legs (bet_id, market_id, option_id, odds, boosted) values ($1,$2,$3,$4,$5)`, [
        betId, r.market_id, r.id, r.eff, r.boosted,
      ]);
    const kind = rows.length > 1 ? `${rows.length}-leg parlay` : 'straight';
    const am = fmtOdds(toAmerican(parlayDecimal(odds)));
    await feed(c, 'bet', `${p.name} put ${fmtMoney(stake)} on a ${kind} (${am}) to win ${fmtMoney(potential)}${byAdmin ? ' (placed by the commish)' : ''}`, {
      player: playerId, bet: betId,
    });
    return { betId };
  });
}

/* ---------------- settlement ---------------- */

async function evaluateBet(c: PoolClient, betId: number, quiet = false) {
  const br = await c.query(`select b.*, p.name from fd_bets b join fd_players p on p.id = b.player_id where b.id = $1 for update of b`, [betId]);
  const b = br.rows[0];
  if (!b || b.status !== 'open') return;
  const legs = (await c.query(`select result, odds from fd_legs where bet_id = $1`, [betId])).rows;
  const lost = legs.filter((l) => l.result === 'lost').length;
  const open = legs.filter((l) => l.result === 'open').length;
  const won = legs.filter((l) => l.result === 'won');
  if (lost) {
    await c.query(`update fd_bets set status='lost', payout=0, settled_at=now() where id=$1`, [betId]);
    if (!quiet) {
      const bad = legs.length > 1 && lost === 1 && open === 0 && won.length === legs.length - 1;
      if (bad) await feed(c, 'badbeat', `BAD BEAT: ${b.name} went ${won.length}/${legs.length} and missed ${fmtMoney(b.potential)} by one leg`, { player: b.player_id, bet: betId });
      else await feed(c, 'lost', `${b.name}'s ${fmtMoney(b.stake)} bet is dead`, { player: b.player_id, bet: betId });
    }
    return;
  }
  if (open) {
    if (!quiet && open === 1 && legs.length > 1)
      await feed(c, 'sweat', `SWEAT: ${b.name} is one leg away from ${fmtMoney(b.potential)}`, { player: b.player_id, bet: betId });
    return;
  }
  const payout = won.length ? payoutCents(b.stake, won.map((l) => l.odds)) : b.stake;
  const status = won.length ? 'won' : 'void';
  await c.query(`update fd_bets set status=$2, payout=$3, settled_at=now() where id=$1`, [betId, status, payout]);
  await c.query(`update fd_players set balance = balance + $1 where id = $2`, [payout, b.player_id]);
  if (!quiet) {
    if (status === 'won') await feed(c, 'won', `CASHED: ${b.name} hit for ${fmtMoney(payout)} (+${fmtMoney(payout - b.stake)})`, { player: b.player_id, bet: betId });
    else await feed(c, 'void', `${b.name}'s ${fmtMoney(b.stake)} bet was refunded (line voided)`, { player: b.player_id, bet: betId });
  }
}

export async function settleMarket(marketId: number, winnerOptionId: number | null) {
  return tx(async (c) => {
    const m = (await c.query(`select * from fd_markets where id = $1 for update`, [marketId])).rows[0];
    if (!m) throw new UserError('Line not found.');
    if (m.status === 'settled' || m.status === 'void') throw new UserError('Already graded — reopen it first.');
    let winnerLabel = '';
    if (winnerOptionId != null) {
      const o = (await c.query(`select label from fd_options where id=$1 and market_id=$2`, [winnerOptionId, marketId])).rows[0];
      if (!o) throw new UserError('Pick a winner from this line.');
      winnerLabel = o.label;
    }
    await c.query(`update fd_markets set status=$2, winner_option_id=$3, settled_at=now() where id=$1`, [
      marketId, winnerOptionId == null ? 'void' : 'settled', winnerOptionId,
    ]);
    await c.query(
      `update fd_legs set result = case when $2::int is null then 'void' when option_id = $2 then 'won' else 'lost' end
       where market_id = $1 and result = 'open'`,
      [marketId, winnerOptionId],
    );
    await feed(c, 'result', winnerOptionId == null ? `VOID: "${m.title}" — all bets on it refunded` : `RESULT: ${winnerLabel} wins "${m.title}"`, { market: marketId });
    const bets = (await c.query(`select distinct l.bet_id from fd_legs l join fd_bets b on b.id = l.bet_id where l.market_id=$1 and b.status='open' order by 1`, [marketId])).rows;
    for (const r of bets) await evaluateBet(c, r.bet_id);
    return { graded: bets.length };
  });
}

export async function reopenMarket(marketId: number) {
  return tx(async (c) => {
    const m = (await c.query(`select * from fd_markets where id = $1 for update`, [marketId])).rows[0];
    if (!m) throw new UserError('Line not found.');
    if (m.status !== 'settled' && m.status !== 'void') throw new UserError('Not graded yet.');
    const bets = (await c.query(`select distinct bet_id from fd_legs where market_id=$1 order by 1`, [marketId])).rows.map((r) => r.bet_id);
    for (const id of bets) {
      const b = (await c.query(`select * from fd_bets where id=$1 for update`, [id])).rows[0];
      if (b.status === 'won' || b.status === 'void')
        await c.query(`update fd_players set balance = balance - $1 where id=$2`, [b.payout, b.player_id]);
      await c.query(`update fd_bets set status='open', payout=0, settled_at=null, seen_at=null where id=$1`, [id]);
    }
    await c.query(`update fd_legs set result='open' where market_id=$1`, [marketId]);
    await c.query(`update fd_markets set status='locked', winner_option_id=null, settled_at=null where id=$1`, [marketId]);
    for (const id of bets) await evaluateBet(c, id, true);
    await feed(c, 'reopen', `Correction: "${m.title}" result was reversed — being re-graded`, { market: marketId });
    return { reopened: bets.length };
  });
}

/* ---------------- admin edits ---------------- */

function checkOdds(o: unknown): number {
  const n = Number(o);
  if (!isValidAmerican(n)) throw new UserError(`Odds "${o}" aren't valid — use -100 or lower, or +100 or higher.`);
  return n;
}

export async function createMarket(title: string, subtitle: string | null, lockAt: string | null, opts: { label: string; odds: number; blurb?: string }[]) {
  title = (title || '').trim();
  if (!title) throw new UserError('Give the line a title.');
  if (opts.length < 2) throw new UserError('Need at least 2 options.');
  const clean = opts.map((o) => ({ label: o.label.trim(), odds: checkOdds(o.odds), blurb: o.blurb?.trim() || null }));
  return tx(async (c) => {
    const s = (await c.query(`select coalesce(max(sort),0)+10 as s from fd_markets`)).rows[0].s;
    const m = (await c.query(`insert into fd_markets (title, subtitle, sort, lock_at) values ($1,$2,$3,$4) returning id`, [title, subtitle || null, s, lockAt || null])).rows[0];
    let i = 0;
    for (const o of clean) await c.query(`insert into fd_options (market_id,label,odds,blurb,sort) values ($1,$2,$3,$4,$5)`, [m.id, o.label, o.odds, o.blurb, (i += 10)]);
    await feed(c, 'newline', `NEW LINE: "${title}" is on the board`, { market: m.id });
    return { id: m.id };
  });
}

export async function updateMarket(id: number, f: { title?: string; subtitle?: string | null; lockAt?: string | null; status?: 'open' | 'locked' }) {
  return tx(async (c) => {
    const m = (await c.query(`select * from fd_markets where id=$1 for update`, [id])).rows[0];
    if (!m) throw new UserError('Line not found.');
    if (f.status && (m.status === 'settled' || m.status === 'void')) throw new UserError('Graded lines must be reopened first.');
    await c.query(
      `update fd_markets set title=coalesce($2,title), subtitle=case when $3::boolean then $4 else subtitle end,
         lock_at=case when $5::boolean then $6::timestamptz else lock_at end, status=coalesce($7,status) where id=$1`,
      [id, f.title?.trim() || null, f.subtitle !== undefined, f.subtitle || null, f.lockAt !== undefined, f.lockAt || null, f.status ?? null],
    );
    if (f.status && f.status !== m.status)
      await feed(c, f.status === 'locked' ? 'lock' : 'unlock', f.status === 'locked' ? `LOCKED: "${m.title}" — no more bets` : `OPEN: "${m.title}" is taking bets again`, { market: id });
  });
}

export async function addOption(marketId: number, label: string, odds: number, blurb?: string) {
  const n = checkOdds(odds);
  if (!label?.trim()) throw new UserError('Name the pick.');
  return tx(async (c) => {
    const s = (await c.query(`select coalesce(max(sort),0)+10 as s from fd_options where market_id=$1`, [marketId])).rows[0].s;
    await c.query(`insert into fd_options (market_id,label,odds,blurb,sort) values ($1,$2,$3,$4,$5)`, [marketId, label.trim(), n, blurb?.trim() || null, s]);
  });
}

export async function updateOption(id: number, f: { label?: string; odds?: number; blurb?: string | null; active?: boolean }) {
  return tx(async (c) => {
    const o = (await c.query(`select o.*, m.title from fd_options o join fd_markets m on m.id=o.market_id where o.id=$1 for update of o`, [id])).rows[0];
    if (!o) throw new UserError('Pick not found.');
    const odds = f.odds !== undefined ? checkOdds(f.odds) : o.odds;
    await c.query(`update fd_options set label=$2, odds=$3, blurb=$4, active=$5 where id=$1`, [
      id, f.label?.trim() || o.label, odds, f.blurb !== undefined ? f.blurb || null : o.blurb, f.active ?? o.active,
    ]);
    if (odds !== o.odds)
      await feed(c, 'move', `LINE MOVE: ${o.label} ${fmtOdds(o.odds)} → ${fmtOdds(odds)} on "${o.title}"`, { market: o.market_id });
  });
}

export async function boostOption(id: number, boostOdds: number | null, minutes: number) {
  return tx(async (c) => {
    const o = (await c.query(`select o.*, m.title from fd_options o join fd_markets m on m.id=o.market_id where o.id=$1`, [id])).rows[0];
    if (!o) throw new UserError('Pick not found.');
    if (boostOdds == null) {
      await c.query(`update fd_options set boost_odds=null, boost_until=null where id=$1`, [id]);
      return;
    }
    const b = checkOdds(boostOdds);
    const mins = Math.max(5, Math.min(24 * 60, Math.round(minutes || 60)));
    await c.query(`update fd_options set boost_odds=$2, boost_until=now() + ($3 || ' minutes')::interval where id=$1`, [id, b, String(mins)]);
    await feed(c, 'boost', `DARIO BOOST: ${o.label} on "${o.title}" ${fmtOdds(o.odds)} → ${fmtOdds(b)} for ${mins} min`, { market: o.market_id });
  });
}

export async function adjustAll(delta: number, note: string) {
  if (!Number.isInteger(delta) || delta === 0) throw new UserError('Enter an amount.');
  return tx(async (c) => {
    const r = await c.query(`update fd_players set balance = balance + $1 where not removed`, [delta]);
    await feed(c, 'adjust', `The commish ${delta > 0 ? 'gave everyone' : 'docked everyone'} ${fmtMoney(Math.abs(delta))} Dario Bucks${note ? ` — ${note}` : ''}`);
    return { players: r.rowCount };
  });
}

export async function adjustBalance(playerId: number, delta: number, note: string) {
  if (!Number.isInteger(delta) || delta === 0) throw new UserError('Enter an amount.');
  return tx(async (c) => {
    const p = (await c.query(`update fd_players set balance = balance + $2 where id=$1 returning name`, [playerId, delta])).rows[0];
    if (!p) throw new UserError('Player not found.');
    await feed(c, 'adjust', `${p.name} ${delta > 0 ? 'got' : 'was docked'} ${fmtMoney(Math.abs(delta))} Dario Bucks${note ? ` — ${note}` : ''}`, { player: playerId });
  });
}
