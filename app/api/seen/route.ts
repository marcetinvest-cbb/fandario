import { q } from '@/lib/db';
import { currentPlayerId } from '@/lib/auth';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return handle(async () => {
    const id = await currentPlayerId();
    if (id) await q(`update fd_bets set seen_at = now() where player_id = $1 and id = any($2) and status <> 'open'`, [id, (body.ids ?? []).map(Number)]);
    return { ok: true };
  });
}
