# PaddlePass

Court booking for **Undefeated Pickleball** (Undefeated Fitness Center, Manila).

Customers open a Facebook link, see which hours are free, and send a booking
request. Staff confirm over Messenger, record cash/GCash payments, move sessions
when it rains, and keep the logbook — the same seven columns the paper one had.

- **Public**: `/` calendar → `/book/<date>` slot picker + request form → `/r/<ref>?t=<token>` status page
- **Admin** (`/admin`, staff sign-in): today's desk, approval queue, logbook + CSV export,
  booking detail with payments / reschedules / arrivals, closures, settings (owner), staff roster (owner)
- **Database**: Postgres on Supabase. Double-booking is impossible by constraint, not by code.

## Stack

Next.js 16 (App Router, `proxy.ts`, Server Actions) · React 19 · Tailwind 4 · Supabase
(`@supabase/ssr`) · Zod 4 · Vitest.

> This is **not** the Next.js you may know — read `node_modules/next/dist/docs/` before
> changing framework-level code. See [AGENTS.md](AGENTS.md).

## Setup

### 1. Supabase project

Create a project at [supabase.com](https://supabase.com) (the free tier is fine), then
link and push the schema:

```bash
npm install
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/* in order
```

`db push` prints a **notice** if `pg_cron` was scheduled, or a **warning** if it was not
available. If you see the warning, wire up the cron route in step 4.

### 2. Environment

```bash
cp .env.example .env.local    # already done in this checkout
```

Fill in from *Project Settings → API*:

| Variable | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | everywhere |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | browser + server, safe only because of RLS |
| `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) | **server only**: staff invites, cron route |
| `NEXT_PUBLIC_SITE_URL` | absolute URLs in invite / reset emails |
| `CRON_SECRET` | guards `/api/cron/expire-holds` (generated for you) |

In Supabase, *Authentication → URL Configuration*: set **Site URL** to your deployment
URL and add `http://localhost:3000/auth/confirm` and `https://<your-domain>/auth/confirm`
to **Redirect URLs**.

### 3. First owner

There is no public sign-up. Bootstrap the first owner once:

1. *Authentication → Users → Add user*: email + password, **Auto Confirm** on.
   The `on_auth_user_created` trigger creates a `public.staff` row as `staff`.
2. Promote it in the SQL editor:
   ```sql
   update public.staff set role = 'owner' where id = '<that user's uuid>';
   ```
3. Sign in at `/login`, open **Settings**, and set the hourly rate. Online booking stays
   closed until the rate is above zero.

Every further owner or staffer is invited from **Staff** in the admin.

### 4. Hold expiry

A pending request blocks its slot until `hold_minutes` pass. Something on a clock must
flip it to `expired`:

- **pg_cron** (default) — scheduled by the last migration, runs `expire_stale_holds()`
  every minute inside Postgres. Nothing to configure.
- **Vercel Cron** (fallback) — add to `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron/expire-holds", "schedule": "*/5 * * * *" }] }
  ```
  and set `CRON_SECRET` in the Vercel project. (Hobby plans allow daily crons only;
  per-minute needs Pro — another reason pg_cron is the default.)

Even with neither running, `create_booking()` sweeps lapsed holds for the day being
booked and `get_availability()` never renders a lapsed hold as busy.

## Run

```bash
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit (run `npx next typegen` first on a fresh clone)
npm test            # vitest — pure domain logic, no DOM, no network
npm run lint
npm run build
```

## Deploy (Vercel)

Import the repo, add every variable from `.env.example`, mark `SUPABASE_SECRET_KEY` and
`CRON_SECRET` **Sensitive**, set `NEXT_PUBLIC_SITE_URL` to the production URL. Nothing
else is required; the app has no build-time data dependency.

## How it's put together

```
src/
  app/
    (public)/            calendar, /book/[date], /r/[reference]   — Server Components, force-dynamic
    login/               staff sign-in (+ forgot password)
    auth/confirm/        where invite & reset emails land
    admin/               layout gate + pages; each page's actions.ts holds its Server Actions
    api/logbook.csv/     CSV export, same filters as the logbook page
    api/cron/expire-holds/  secret-guarded fallback sweep
  components/            calendar (SVG, zero JS), booking/SlotPicker, admin, ui
  lib/
    domain/              PURE: time (Manila), money (centavos), pricing, availability, status,
                         reference codes, error-code → sentence mapping, CSV. Fully unit-tested.
    data/                server-only reads through the SSR client (RLS applies)
    auth/                requireStaff / requireOwner, sign-in actions, safe redirect
    supabase/            server / browser / admin clients, env, proxy session refresh
  proxy.ts               session refresh + /admin redirect (UX only — not the security boundary).
                         Must live in src/ — at the project root Next ignores it.
supabase/migrations/     the schema, in order; every rule is commented where it lives
```

### Rules worth knowing before you change anything

- **Time is Manila wall-clock.** `src/lib/domain/time.ts` is the only module allowed to
  build a `Date` from a calendar date. Vercel runs in UTC; at 00:30 Manila it is still
  yesterday there.
- **Money is integer centavos.** Pesos exist only at input and display.
- **Rates are snapshotted onto bookings.** Raising the rate never rewrites the logbook.
- **Paddle rental is a flat fee per paddle per booking**, not per hour.
- **`anon` has zero table privileges.** The public sees only what four `SECURITY DEFINER`
  functions return — when the court is busy, never who booked it.
- **The EXCLUDE constraint is the double-booking guarantee.** App-side checks exist so the
  UI never offers an invalid choice; they are not what makes it safe.
- **`requireStaff()` inside every Server Action** is the real gate. `proxy.ts` is a redirect
  for humans and would keep nothing safe on its own.
- **Payments are voided, never deleted.** `received_by` is always the session user.

## Status

Built 20 Sep 2026. Schema, domain logic, public flow and admin are complete; the
database has not yet been pushed to a Supabase project from this machine — follow *Setup*.
Not yet built: staff-created (walk-in) bookings, marking a booking `completed`
(no RPC exists for it yet), partial-day closures, a second court.
