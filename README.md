# YurLaps Web

YurLaps product landing page built with React, Vite, Tailwind CSS, and Lucide.

## Local development

```bash
npm install
npm run dev
```

## Windows download and updates

The `/download` page reads the latest stable GitHub Release and exposes only the
versioned `YurLaps-Setup-<version>.exe` asset. Drafts, prereleases, missing assets,
and malformed release metadata are hidden. Installed Windows builds can check,
download, and install a release from the in-app **Pembaruan** menu without an
uninstall; the app restarts briefly while program files are replaced.

## Production build

```bash
npm run build
npm run preview
```

## Vercel

Import this repository into Vercel. Vercel detects Vite automatically:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`

The `/login` route is included and handled by the Vercel rewrite configuration. Login uses email and password, and both login and registration are protected by CAPTCHA. New accounts are signed in immediately, so account verification is skipped for now. Signed-in users get an account bar under the navbar with shortcuts to `/dashboard` and, when they belong to a club, `/club`.

Community routes are also included:

- `/community` — browse public clubs, join with an 8-digit code, or create a club.
- `/club` and `/club/:id` — club dashboard with Home, Race, Member, Track, and Setting tabs.

Copy `.env.example` to `.env.local` for local development and fill in the Supabase project URL and anon/publishable key. Add the same variables to Vercel for Production, Preview, and Development environments. Enable **Email** under Supabase **Authentication → Providers**, and configure the site URL and redirect URLs to include your Vercel domain.

## Account dashboard setup

Run `supabase/schema.sql` in **Supabase → SQL Editor**. The script creates:

- `profiles` — full name, nickname, TTS driver name, and avatar URL per user.
- `transponders` — transponder ID, RC class, and RC brand per user.
- Row-level security policies so users can only read and change their own rows.
- A trigger that creates a profile automatically after signup.
- A public `avatars` storage bucket with per-user upload/update/delete policies.

The dashboard is available at `/dashboard` and includes profile photo upload, account details, TTS preview, and transponder management.

## Community and club setup

After `supabase/schema.sql`, run `supabase/community.sql` in **Supabase → SQL Editor**. The script creates:

- `clubs` — name, description, address, visibility (`public` / `private`), apply method (`open` / `approval`), an 8-digit join code, and per-role permissions.
- `club_members` — membership with `leader`, `co_leader`, `officer`, or `member` roles and `active` / `pending` status.
- `club_tracks` — tracks owned by a club.
- `races` — race history with date, track, location, and a JSONB results payload prepared for the YurLaps app integration.
- RPCs for joining, reviewing join requests, updating roles, managing settings, and regenerating join codes.
- Row-level security plus policies that let club mates read each other's profile and transponders for the member list.

Club behaviour:

- Public clubs appear in the community list. Private clubs are joined with their 8-digit code.
- The club leader is added automatically and always has every permission.
- Co-leader and officer permissions can be toggled by the leader in **Setting**.
- Only the leader sees the **Setting** tab, including privacy, apply method, join code, and the permission matrix.
- Tracks are managed by leaders and co-leaders by default.
- Race results are shown per club and can be exported as CSV from the race detail view.

## Automatic account verification

Open **Supabase → Authentication → Sign In / Providers → Email** and turn off **Confirm email**. With confirmation disabled, `signUp` returns an active session and the account is verified automatically right after registration.

If email confirmation stays enabled, Supabase will not create a session on signup and the app will show a message asking you to disable it. Existing unconfirmed users can be confirmed manually from **Supabase → Authentication → Users**.

## YURLAPS AUTH email

Email templates are still used for password reset and other account emails. Customize them from **Supabase → Authentication → Email Templates**. Suggested values:

- **Sender name:** `YURLAPS AUTH`
- **Reset password subject:** `YURLAPS AUTH — reset your password`

Configure the same URLs under **Authentication → URL Configuration**:

- `http://127.0.0.1:5173`
- Your Vercel production URL

## Login and registration CAPTCHA

CAPTCHA is required for both login and registration. Create a Cloudflare Turnstile widget and set its site key as `VITE_TURNSTILE_SITE_KEY` in `.env.local` and Vercel. Add the same hostname(s) to the Turnstile widget configuration. Then enable CAPTCHA in **Supabase → Authentication → Bot and Abuse Protection** and enter the Turnstile secret key there. The secret key must never be added to Vite environment variables or frontend code.

## Desktop integration (requires matching YurLaps desktop release)

Apply the migration in `supabase/migrations/*_desktop_club_sync.sql` after the
existing account and community schema, before deploying this website release.
It adds versioned track metadata, club presets, soft deletions and leader-only
RPCs for desktop synchronization and idempotent race uploads. Existing
membership and transponder ownership policies remain in force.

The desktop opens `/desktop-login` with a random state and a loopback callback.
This page uses the website's existing CAPTCHA configuration and creates an
independent desktop session. Tokens are POSTed only to `127.0.0.1`, never put in
the URL or stored in this page's browser storage. The desktop must validate the
state, origin, expiration and returned Supabase user before accepting a session.
Do not send a link with a callback to another person; start login from the app.

Club race results refresh every 15 seconds while the dashboard is visible.
Track deletion now keeps a tombstone so offline clients can observe deletions.
The desktop should retain local changes on revision conflicts and request an
operator choice, never silently overwrite them.

Validation: `npm test`, `npm run test:db` (isolated PGlite database), `npm run build`.

Deployment note: the desktop sync migration was applied and verified on the connected YurLaps Supabase project on 2026-11-06. Do not manually re-run it on that project. Other environments must apply it before deploying this release.
