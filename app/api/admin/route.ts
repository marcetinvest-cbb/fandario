import { isAdmin, hashPin } from '@/lib/auth';
import { handle, fail } from '@/lib/http';
import { q, UserError } from '@/lib/db';
import * as G from '@/lib/game';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return fail('Admin only', 401);
  return handle(async () => ({
    ...(await G.getState(null, { admin: true })),
    allBets: await G.loadBets([], true),
    pitches: await q(`select p.id, p.title, p.options, p.status, p.created_at, pl.name from fd_pitches p join fd_players pl on pl.id = p.player_id order by (p.status = 'pending') desc, p.id desc limit 40`),
    pins: Object.fromEntries((await q<{ id: number; pin: string | null }>(`select id, pin from fd_players where not removed`)).map((r) => [r.id, r.pin])),
  }));
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return fail('Admin only', 401);
  const b = await req.json().catch(() => ({}));
  const n = (v: unknown) => Number(v);
  return handle(async () => {
    switch (b.action) {
      case 'createMarket': return G.createMarket(b.title, b.subtitle, b.lockAt, b.options ?? []);
      case 'updateMarket': return G.updateMarket(n(b.id), { title: b.title, subtitle: b.subtitle, lockAt: b.lockAt, status: b.status });
      case 'addOption': return G.addOption(n(b.marketId), b.label, b.odds, b.blurb);
      case 'updateOption': return G.updateOption(n(b.id), { label: b.label, odds: b.odds === undefined ? undefined : b.odds, blurb: b.blurb, active: b.active });
      case 'boost': return G.boostOption(n(b.id), b.odds == null || b.odds === '' ? null : b.odds, n(b.minutes));
      case 'settle': return G.settleMarket(n(b.id), b.winner == null ? null : n(b.winner));
      case 'approvePitch': return G.approvePitch(n(b.id), b.title, (b.options ?? []));
      case 'rejectPitch': await q(`update fd_pitches set status='rejected' where id=$1 and status='pending'`, [n(b.id)]); return { ok: true };
      case 'reopen': return G.reopenMarket(n(b.id));
      case 'adjust': return G.adjustBalance(n(b.playerId), Math.round(n(b.amount) * 100), String(b.note ?? '').slice(0, 80));
      case 'adjustAll': return G.adjustAll(Math.round(n(b.amount) * 100), String(b.note ?? '').slice(0, 80));
      case 'betFor': return G.placeBet(n(b.playerId), b.legs ?? [], Math.round(n(b.stake) * 100), null, true);
      case 'resetPin': {
        if (!/^\d{4}$/.test(String(b.pin))) throw new UserError('PIN must be 4 digits.');
        await q(`update fd_players set pin_hash=$2, pin=$3 where id=$1`, [n(b.playerId), hashPin(String(b.pin)), String(b.pin)]);
        return { ok: true };
      }
      case 'removePlayer': {
        const open = await q(`select 1 from fd_bets where player_id=$1 and status='open'`, [n(b.playerId)]);
        if (open.length) throw new UserError('They still have open bets.');
        await q(`update fd_players set removed=true where id=$1`, [n(b.playerId)]);
        return { ok: true };
      }
      default: throw new UserError('Unknown action.');
    }
  });
}
