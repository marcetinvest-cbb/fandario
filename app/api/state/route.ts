import { getState } from '@/lib/game';
import { currentPlayerId } from '@/lib/auth';
import { handle } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET() {
  return handle(async () => getState(await currentPlayerId()));
}
