# PaddlePass

Court booking for **Undefeated Pickleball** (Undefeated Fitness Center, Manila).

**The flow**

1. **Public calendar** (`/`) shows which hours are open. Tapping a day opens **Facebook
   Messenger** (`m.me/<page>`) with the date already typed. That's the whole public side —
   no form, no account.
2. **Staff** agree the booking in the chat, sign in at `/login` (username + password), and
   record it in the **admin**: new booking → record the GCash/cash payment → copy the
   customer's status link into the chat. Reschedules, arrivals, no-shows and the logbook
   all live there too.
3. **Customers** get a private link `/r/<ref>?t=<token>` showing their status, total and
   balance.

**Hours:** 3:00 PM – 12:00 midnight (editable in Settings).

## Stack

Next.js 16 (App Router, `src/proxy.ts`, Server Actions) · React 19 · Tailwind 4 · Supabase
(`@supabase/ssr`) · Zod 4 · Vitest.

> This is **not** the Next.js you may know — read `node_modules/next/dist/docs/` before
> changing framework-level code. See [AGENTS.md](AGENTS.md).

## Setup

### 1. Supabase project

```bash
npm install
npx supabase login                       # PowerShell: use npx.cmd, or Set-ExecutionPolicy RemoteSigned
npx supabase link --project-ref <ref>
npx supabase db push                     # applies supabase/migrations/* in order
```

pg_cron is scheduled by the migrations; verify with
`npx supabase db query --linked "select jobname, schedule, active from cron.job"`.

### 2. Environment

`cp .env.example .env.local` and fill in from *Project Settings → API*:

| Variable | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | everywhere |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `…_ANON_KEY`) | browser + server; safe only because of RLS |
| `SUPABASE_SECRET_KEY` (or legacy `…_SERVICE_ROLE_KEY`) | **server only**: staff invites, cron route, bootstrap script |
| `NEXT_PUBLIC_SITE_URL` | absolute URLs in emailed links and the customer status link |
| `CRON_SECRET` | guards `/api/cron/expire-holds` |

The CLI can print the keys — pass `--reveal` or the secret comes back masked:
`npx supabase projects api-keys --project-ref <ref> --reveal`.

In Supabase, *Authentication → URL Configuration*: set **Site URL** to your deployment URL
and add `<site>/auth/confirm` to **Redirect URLs**.

### 3. Staff accounts

There is no public sign-up. Staff sign in with a **username** (mapped to
`<username>@undefeated.local` behind the scenes) or a real email address.

Create the first owner:

```bash
node scripts/create-staff.mjs admin <password> "Admin" owner
```

Further staff are invited from **Staff** in the admin (real email → they set a password
from the link), or created with the same script. Owners can change settings and manage
the roster; staff can take bookings and payments.

> Username-only accounts have no inbox, so "Forgot password" can't reach them. An owner
> resets them by running the script again after deleting the user in the dashboard, or by
> setting a new password in *Authentication → Users*.

### 4. Pricing and hours

Sign in → **Settings**. Hourly rate, downpayment, paddle fee and stock, opening hours,
closed weekdays, hold time, Facebook page handle. Bookings snapshot the rate at the time
they're made; changing it never rewrites the logbook.

### 5. Hold expiry

`pending` requests (from the public `create_booking` RPC, currently unused by the UI, or
anything that sets a hold) block their slot until `hold_minutes` pass. pg_cron runs
`expire_stale_holds()` every minute. If a project can't run pg_cron, point Vercel Cron at
`/api/cron/expire-holds` with `CRON_SECRET` set — see the route's comments.

## Run

```bash
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit (run `npx next typegen` first on a fresh clone)
npm test            # vitest — pure domain logic, no DOM, no network
npm run lint
npm run build
```

## Deploy (Vercel)

Import `tristan689/PaddlePass`, production branch `main`. Add every variable from
`.env.example`; mark `SUPABASE_SECRET_KEY` and `CRON_SECRET` **Sensitive**; set
`NEXT_PUBLIC_SITE_URL` to the production URL. `branch1` / `branch2` are working branches
and get preview deployments.

## Layout

```
src/
  app/
    (public)/            calendar (Messenger deep links), /r/[reference] status page
    login/               staff sign-in (username or email) + forgot password
    auth/confirm/        where invite & reset emails land
    admin/               layout gate + pages; each area's actions.ts holds its Server Actions
      bookings/new       staff-entered booking (create_staff_booking RPC)
    api/logbook.csv/     CSV export, same filters as the logbook page
    api/cron/expire-holds/  secret-guarded fallback sweep
  components/            calendar (SVG, zero JS), admin, auth, ui
  lib/
    domain/              PURE, unit-tested: Manila time, centavo money, pricing, availability,
                         status wording, reference codes, error-code → sentence, CSV, m.me links
    data/                server-only reads through the SSR client (RLS applies)
    auth/                requireStaff / requireOwner, sign-in actions, username mapping, safe redirect
    supabase/            server / browser / admin clients, env
  proxy.ts               session refresh + /admin redirect (UX only — not the security boundary).
                         Must live in src/ — at the project root Next ignores it.
scripts/create-staff.mjs bootstrap a staff account from the terminal
supabase/migrations/     the schema, in order; every rule is commented where it lives
```

### Rules worth knowing before you change anything

- **Time is Manila wall-clock.** `src/lib/domain/time.ts` is the only module allowed to
  build a `Date` from a calendar date. Vercel runs in UTC.
- **Money is integer centavos.** Pesos exist only at input and display.
- **Rates are snapshotted onto bookings.** Raising the rate never rewrites the logbook.
- **Paddle rental is a flat fee per paddle per booking**, not per hour.
- **`anon` has zero table privileges.** The public sees only what a few `SECURITY DEFINER`
  functions return — when the court is busy, never who booked it.
- **The EXCLUDE constraint is the double-booking guarantee**, for public and staff bookings alike.
- **`requireStaff()` inside every Server Action and every admin page** is the real gate.
  `src/proxy.ts` is a redirect for humans.
- **Payments are voided, never deleted.** `received_by` is always the session user.

## Status

Live against Supabase project `ilpikehoeufqqelzxelq` with the admin account created and
hours set to 3 PM – midnight. Hourly rate is still ₱0 — set it in Settings before taking
money. Not built: marking a booking `completed` (no RPC yet), partial-day closures, a
second court. The removed self-serve request flow (slot picker + `/book/<date>`) is in git
history at commit `6d6f073` if it is ever wanted back.
