# Supabase deployment checklist

Run both migrations in `supabase/migrations/` before publishing the site:

- `20261106180000_yurlaps_release_bucket.sql` creates the public release bucket and policies.
- `20261106193000_yurlaps_activity_and_club_avatar.sql` adds club photos and private/public practice sessions.

The website never contains a Supabase service-role key. GitHub Actions uploads Windows release files using that secret, while Vercel rewrites `/releases/*` to the public storage bucket.
