import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'

const db = new PGlite()
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`)
  const schema = await fs.readFile('supabase/schema.sql', 'utf8')
  await db.exec(schema.slice(0, schema.indexOf('-- Avatars storage bucket')))
  await db.exec(await fs.readFile('supabase/community.sql', 'utf8'))
  await db.exec(await fs.readFile('supabase/migrations/20261106045457_desktop_club_sync.sql', 'utf8'))
  await db.exec(await fs.readFile('supabase/migrations/20261107140000_public_club_results.sql', 'utf8'))
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const publicClub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const privateClub = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  await db.exec(`insert into auth.users(id) values ('${owner}');
    insert into clubs(id,owner_id,name,visibility) values
      ('${publicClub}','${owner}','Public club','public'),
      ('${privateClub}','${owner}','Private club','private');
    insert into club_tracks(club_id,name,created_by) values
      ('${publicClub}','Public track','${owner}'),
      ('${privateClub}','Private track','${owner}');
    insert into club_tracks(club_id,name,created_by,deleted_at) values
      ('${publicClub}','Archived track','${owner}',now());
    insert into races(club_id,name,created_by) values
      ('${publicClub}','Public race','${owner}'),
      ('${privateClub}','Private race','${owner}');
    set role anon;`)
  assert.deepEqual((await db.query('select name from club_tracks')).rows.map((row) => row.name), ['Public track'])
  assert.deepEqual((await db.query('select name from races')).rows.map((row) => row.name), ['Public race'])
  await assert.rejects(db.exec("update races set name='Changed'"), /permission denied|row-level security/)
  await db.exec('reset role')
  await db.exec(`update clubs set visibility='private' where id='${publicClub}'; set role anon;`)
  assert.equal((await db.query('select * from races')).rows.length, 0)
  assert.equal((await db.query('select * from club_tracks')).rows.length, 0)
  console.log('PASS: public club races/tracks are readable anonymously; private, archived and write access stay protected')
} finally {
  await db.close()
}
