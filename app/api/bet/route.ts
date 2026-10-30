import { placeBet } from '@/lib/game';
import { currentPlayerId } from '@/lib/auth';
import { handle } from '@/lib/http';
import { UserError } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return handle(async () => {
    const id = await currentPlayerId();
    if (!id) throw new UserError('Sign in first.');
    return placeBet(id, body.legs, Math.round(Number(body.stake) * 100), body.tailedFrom ? Number(body.tailedFrom) : null);
  });
}
