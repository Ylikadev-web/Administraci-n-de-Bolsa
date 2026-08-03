# AGENTS

## Cursor Cloud specific instructions

This repo is a **Next.js 14 (App Router) + TypeScript** frontend ("Bolsas") backed by
**Supabase** (Postgres + Auth + RLS). There is a single web app plus a local Supabase
stack it talks to. Standard scripts live in `package.json` (`dev`, `build`, `lint`,
`typecheck`); the DB migrations live in `supabase/migrations/`.

The update script only runs `npm install`. Docker and the Supabase stack are **not**
started automatically — start them per session as described below.

### Services

| Service | How to run | Notes |
|---|---|---|
| Local Supabase (Postgres/Auth/Studio) | `npx supabase start` | Needs the Docker daemon running first. Applies `supabase/migrations/` automatically. |
| Next.js dev server | `npm run dev` (http://localhost:3000) | Reads `.env.local`. |

### One-time-per-session startup (fresh VM has no running containers)

1. Start the Docker daemon (no systemd in this VM), then wait a few seconds:
   `sudo dockerd > /tmp/dockerd.log 2>&1 &`
   The daemon is preconfigured for `fuse-overlayfs` + iptables-legacy in `/etc/docker/daemon.json`.
   If `docker` needs sudo, run `sudo chmod 666 /var/run/docker.sock` once.
2. Start Supabase: `npx supabase start` (first run pulls images; subsequent runs are fast).
   Get keys anytime with `npx supabase status`.
3. Create `.env.local` (gitignored) pointing at the local stack. The local anon/service keys
   are the well-known Supabase demo keys (safe, not real secrets):
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `npx supabase status`>
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `npx supabase status`>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
4. Seed users + Bolsa General:
   `docker exec -i supabase_db_bolsas psql -U postgres -d postgres < supabase/scripts/bootstrap_completo.sql`
5. **Required grants workaround (see gotcha below):**
   ```bash
   docker exec -i supabase_db_bolsas psql -U postgres -d postgres <<'SQL'
   grant all on all tables in schema public to anon, authenticated, service_role;
   grant all on all sequences in schema public to anon, authenticated, service_role;
   grant all on all functions in schema public to anon, authenticated, service_role;
   alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
   alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
   SQL
   ```
6. `npm run dev` and open http://localhost:3000.

### GOTCHA: "permission denied for table bolsas" on the dashboard

The migrations create tables owned by the `postgres` role and contain **no GRANT
statements**. In the local Supabase CLI stack, the default privileges for
`postgres`-owned public tables only grant `TRUNCATE/REFERENCES/TRIGGER` to
`anon`/`authenticated` (not `SELECT/INSERT/UPDATE/DELETE`), so authenticated reads fail
with `permission denied` even though RLS policies are correct. Hosted Supabase grants
these automatically, which is why the app works there. Apply the grants in step 5 above
after every fresh `npx supabase start` / DB reset. RLS stays enabled, so row-level
access is still enforced. Do not "fix" this in the migrations unless asked.

### Test credentials (from `bootstrap_completo.sql`)

- `nesim@bolsa.com` / `nesim-bolsa-2026` (admin)
- `moises@bolsa.com` / `moises-bolsa-2026`
- `itzyk@bolsa.com` / `itzyk-bolsa-2026`

Log in via the **Contraseña** tab. Magic Link works too but emails land in Mailpit at
http://localhost:54324, not a real inbox.

### Notes

- `NEXT_PUBLIC_*` values are inlined at build time; changing `.env.local` requires
  restarting `npm run dev`.
- Supabase Studio is at http://localhost:54323; the DB container is `supabase_db_bolsas`.
- `Resend`/`Telegram`/`Twilio` env vars are optional and unused for core local dev.
