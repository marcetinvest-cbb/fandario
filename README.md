# FanDario — Keep Austin Betting

Fake-money sportsbook for Dario's Austin weekend. Everyone starts with $50 Dario Bucks; straights or parlays up to 3 legs.

- App: `/` — pick your name + 4-digit PIN
- Commish: `/admin` — needs `ADMIN_PIN`

## Setup (Vercel, free)
1. Import this repo in Vercel (Next.js preset, no changes).
2. Project → Storage → Create → **Neon** (free) → connect to the project. This adds `DATABASE_URL`.
3. Project → Settings → Environment Variables → `ADMIN_PIN` = your secret PIN.
4. Redeploy. Tables + the opening board are created automatically on first visit.

Odds lock at bet time. Editing odds never changes placed bets. Grading pays instantly; "Undo result" reverses payouts.
