import 'server-only';
import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';
import { SEED } from './seed';

export const START_BALANCE = 5000; // $50 Dario Bucks

const g = globalThis as unknown as { __fdPool?: Pool; __fdReady?: Promise<void> };

function url() {
  const u = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!u) throw new Error('No database configured (DATABASE_URL). Add Neon under Vercel → Storage.');
  return u;
}

export function pool(): Pool {
  if (!g.__fdPool) {
    const connectionString = url();
    const local = /localhost|127\.0\.0\.1|\/var\/run/.test(connectionString);
    g.__fdPool = new Pool({
      connectionString: connectionString.replace(/[?&]sslmode=[^&]*/, '').replace(/[?&]channel_binding=[^&]*/, ''),
      ssl: local ? false : { rejectUnauthorized: true },
      max: 3,
    });
  }
  return g.__fdPool;
}

const SCHEMA = `
create table if not exists fd_meta (key text primary key, value text not null);
create table if not exists fd_players (
  id serial primary key,
  name text not null,
  pin_hash text not null,
  balance int not null default ${START_BALANCE},
  removed boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists fd_players_name on fd_players (lower(name)) where not removed;
create table if not exists fd_markets (
  id serial primary key,
  title text not null,
  subtitle text,
  sort int not null default 0,
  status text not null default 'open', -- open | locked | settled | void
  lock_at timestamptz,
  winner_option_id int,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create table if not exists fd_options (
  id serial primary key,
  market_id int not null references fd_markets(id),
  label text not null,
  blurb text,
  odds int not null,
  boost_odds int,
  boost_until timestamptz,
  sort int not null default 0,
  active boolean not null default true
);
create table if not exists fd_bets (
  id serial primary key,
  player_id int not null references fd_players(id),
  stake int not null,
  potential int not null,
  status text not null default 'open', -- open | won | lost | void
  payout int not null default 0,
  tailed_from int,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  seen_at timestamptz
);
create table if not exists fd_legs (
  id serial primary key,
  bet_id int not null references fd_bets(id),
  market_id int not null references fd_markets(id),
  option_id int not null references fd_options(id),
  odds int not null,
  boosted boolean not null default false,
  result text not null default 'open' -- open | won | lost | void
);
create index if not exists fd_legs_market on fd_legs (market_id);
create index if not exists fd_legs_bet on fd_legs (bet_id);
create table if not exists fd_feed (
  id serial primary key,
  kind text not null,
  player_id int,
  bet_id int,
  market_id int,
  text text not null,
  created_at timestamptz not null default now()
);
`;

async function init() {
  const c = await pool().connect();
  try {
    await c.query('begin');
    await c.query('select pg_advisory_xact_lock(424242)');
    await c.query(SCHEMA);
    await c.query(
      `insert into fd_meta (key, value) values ('secret', $1) on conflict (key) do nothing`,
      [crypto.randomBytes(32).toString('hex')],
    );
    const seeded = await c.query(`select 1 from fd_meta where key = 'seeded'`);
    if (!seeded.rowCount) {
      let ms = 0;
      for (const m of SEED) {
        ms += 10;
        const r = await c.query(
          `insert into fd_markets (title, subtitle, sort) values ($1, $2, $3) returning id`,
          [m.title, m.subtitle ?? null, ms],
        );
        let os = 0;
        for (const [label, odds, blurb] of m.options) {
          os += 10;
          await c.query(
            `insert into fd_options (market_id, label, odds, blurb, sort) values ($1,$2,$3,$4,$5)`,
            [r.rows[0].id, label, odds, blurb, os],
          );
        }
      }
      await c.query(`insert into fd_meta (key, value) values ('seeded', now()::text)`);
    }
    await c.query('commit');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export function ready(): Promise<void> {
  if (!g.__fdReady) g.__fdReady = init().catch((e) => { g.__fdReady = undefined; throw e; });
  return g.__fdReady;
}

export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const r = await pool().query(text, params as any[]);
  return r.rows as T[];
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ready();
  const c = await pool().connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export class UserError extends Error {
  constructor(msg: string, public extra?: Record<string, unknown>) { super(msg); }
}
