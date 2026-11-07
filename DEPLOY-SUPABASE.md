# Supabase deployment checklist

Run the migrations in `supabase/migrations/` before publishing the site. This
repository is the deployment input; it does not prove that a remote project
has already been changed. Apply files in filename order and verify the RPCs,
RLS policies, and public/owner visibility with a test account.

- `20261106045457_desktop_club_sync.sql` creates desktop track/preset sync and race upload RPCs.
- `20261106180000_yurlaps_release_bucket.sql` creates the public release bucket and policies.
- `20261106193000_yurlaps_activity_and_club_avatar.sql` adds club photos and private/public practice sessions.
- `20261107140000_public_club_results.sql` allows anonymous visitors to read race results and race-only track records for public clubs.
- `20261107180000_production_timing_contract.sql` adds complete preset timing fields, immutable personal race access, practice privacy-safe retry, active-track rules, and visiting-driver resolution.

The website never contains a Supabase service-role key. GitHub Actions uploads Windows release files using that secret, while Vercel rewrites `/releases/*` to the public storage bucket.
