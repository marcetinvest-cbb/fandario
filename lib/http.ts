import 'server-only';
import { NextResponse } from 'next/server';
import { UserError } from './db';

export function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data, { headers: { 'cache-control': 'no-store' } });
}
export function fail(msg: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: msg, ...extra }, { status, headers: { 'cache-control': 'no-store' } });
}
export async function handle(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof UserError) return fail(e.message, 400, e.extra);
    console.error(e);
    const msg = e instanceof Error && /DATABASE_URL/.test(e.message) ? e.message : 'Something broke — try again.';
    return fail(msg, 500);
  }
}
