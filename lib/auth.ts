import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { q } from './db';

const g = globalThis as unknown as { __fdSecret?: string };
async function secret(): Promise<string> {
  if (!g.__fdSecret) {
    const r = await q<{ value: string }>(`select value from fd_meta where key = 'secret'`);
    g.__fdSecret = r[0].value;
  }
  return g.__fdSecret;
}
async function mac(v: string) {
  return crypto.createHmac('sha256', await secret()).update(v).digest('base64url').slice(0, 32);
}
const YEAR = 60 * 60 * 24 * 30;
const opts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: YEAR };

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(12).toString('hex');
  return `${salt}:${crypto.scryptSync(pin, salt, 32).toString('hex')}`;
}
export function checkPin(pin: string, stored: string): boolean {
  const [salt, h] = stored.split(':');
  const a = crypto.scryptSync(pin, salt, 32);
  const b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function setPlayerCookie(id: number) {
  cookies().set('fd_s', `${id}.${await mac('p:' + id)}`, opts);
}
export function clearPlayerCookie() {
  cookies().delete('fd_s');
}
export async function currentPlayerId(): Promise<number | null> {
  const v = cookies().get('fd_s')?.value;
  if (!v) return null;
  const [id, sig] = v.split('.');
  if (!id || sig !== (await mac('p:' + id))) return null;
  const r = await q(`select id from fd_players where id = $1 and not removed`, [Number(id)]);
  return r.length ? Number(id) : null;
}

function adminPin() {
  return process.env.ADMIN_PIN || '';
}
export async function setAdminCookie() {
  cookies().set('fd_a', await mac('a:' + adminPin()), { ...opts, maxAge: 60 * 60 * 24 * 7 });
}
export async function isAdmin(): Promise<boolean> {
  if (!adminPin()) return false;
  const v = cookies().get('fd_a')?.value;
  return !!v && v === (await mac('a:' + adminPin()));
}
export function adminPinMatches(pin: string) {
  const a = Buffer.from(pin), b = Buffer.from(adminPin());
  return adminPin().length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
