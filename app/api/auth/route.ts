import { q, UserError, START_BALANCE } from '@/lib/db';
import { handle } from '@/lib/http';
import { adminPinMatches, checkPin, clearPlayerCookie, hashPin, setAdminCookie, setPlayerCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => ({
    players: await q(`select id, name from fd_players where not removed order by lower(name)`),
  }));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return handle(async () => {
    const pin = String(body.pin ?? '');
    switch (body.action) {
      case 'join': {
        const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
        if (name.length < 2 || name.length > 20) throw new UserError('Name should be 2–20 characters.');
        if (!/^\d{4}$/.test(pin)) throw new UserError('PIN must be 4 digits.');
        const exists = await q(`select 1 from fd_players where lower(name) = lower($1) and not removed`, [name]);
        if (exists.length) throw new UserError(`"${name}" is taken — tap your name to sign in instead.`);
        const r = await q<{ id: number }>(`insert into fd_players (name, pin_hash, pin, balance) values ($1,$2,$3,$4) returning id`, [name, hashPin(pin), pin, START_BALANCE]);
        await q(`insert into fd_feed (kind, text, player_id) values ('join', $1, $2)`, [`${name} pulled up with $50 Dario Bucks`, r[0].id]);
        await setPlayerCookie(r[0].id);
        return { ok: true };
      }
      case 'login': {
        const r = await q<{ id: number; pin_hash: string }>(`select id, pin_hash from fd_players where id = $1 and not removed`, [Number(body.playerId)]);
        if (!r.length || !checkPin(pin, r[0].pin_hash)) {
          await wait(600);
          throw new UserError('Wrong PIN. Ask the commish to reset it if you forgot.');
        }
        // Commish can see PINs (Jay's call — fake money). Backfill for players who joined before this existed.
        await q(`update fd_players set pin = $2 where id = $1 and pin is null`, [r[0].id, pin]);
        await setPlayerCookie(r[0].id);
        return { ok: true };
      }
      case 'logout':
        clearPlayerCookie();
        return { ok: true };
      case 'admin':
        if (!adminPinMatches(pin)) {
          await wait(800);
          throw new UserError(process.env.ADMIN_PIN ? 'Wrong admin PIN.' : 'ADMIN_PIN is not set in Vercel yet.');
        }
        await setAdminCookie();
        return { ok: true };
      default:
        throw new UserError('Unknown action.');
    }
  });
}
