import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'

const db = new PGlite()
const leader = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const visitor = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const member = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const club = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const trackA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const trackB = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
const preset = '11111111-1111-4111-8111-111111111111'
const raceId = '22222222-2222-4222-8222-222222222222'
const practiceId = '33333333-3333-4333-8333-333333333333'

const signIn = (user) => db.exec(`set role authenticated; set request.jwt.claim.sub='${user}';`)
const value = async (sql, params = []) => (await db.query(sql, params)).rows[0]?.result
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`)
  const schema = await fs.readFile('supabase/schema.sql', 'utf8')
  await db.exec(schema.slice(0, schema.indexOf('-- Avatars storage bucket')))
  await db.exec(await fs.readFile('supabase/community.sql', 'utf8'))
  await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated;')
  const migrations = [
    '20261106045457_desktop_club_sync.sql',
    '20261106193000_yurlaps_activity_and_club_avatar.sql',
    '20261106200000_yurlaps_activity_access.sql',
    '20261106210000_yurlaps_track_timing_settings.sql',
    '20261107140000_public_club_results.sql',
    '20261107180000_production_timing_contract.sql',
  ]
  for (const migration of migrations) await db.exec(await fs.readFile(`supabase/migrations/${migration}`, 'utf8'))
  // The new additive migration is safe to reapply during a manual update.
  await db.exec(await fs.readFile(`supabase/migrations/${migrations.at(-1)}`, 'utf8'))
  await db.exec(`insert into auth.users(id) values ('${leader}'),('${visitor}'),('${member}');
    update profiles set full_name='Visiting Driver',nickname='Guest',tts_name='Guest TTS' where id='${visitor}';
    insert into transponders(user_id,transponder_id,rc_class,rc_brand) values ('${visitor}','123','Touring','Tamiya');
    insert into clubs(id,owner_id,name,visibility) values ('${club}','${leader}','Private test club','private');
    insert into club_members(club_id,user_id,role,status) values ('${club}','${member}','member','active');`)
  await signIn(leader)
  const sync = (kind, id, data, base = 0, mutation = id, deleted = false) => value(
    'select desktop_sync_entity($1,$2,$3,$4,$5,$6,$7) result', [kind, club, id, base, mutation, data, deleted])
  const config = { name: 'Staggered qualifying', target: 'time', value: 150, rank: 'consecutive',
    start_mode: 'staggered', cd: 5, sound: 1, random_delay_max: 3,
    target_time_ms: 150500, finish_current_lap: true, stagger_mode: 'auto', stagger_gap_ms: 5000 }
  const saved = await sync('preset', preset, config)
  for (const [key, expected] of Object.entries(config)) assert.equal(saved.record[key], expected, key)
  const position = await sync('preset', preset, { ...config, rank: 'position' }, saved.record.revision, raceId)
  assert.equal(position.record.rank, 'position')
  await sync('track', trackA, { name: 'Track A', min_lap_ms: 5000, loop_width_m: .3, is_active: true })
  await sync('track', trackB, { name: 'Track B', min_lap_ms: 6000, loop_width_m: .4, is_active: true })
  assert.deepEqual((await db.query('select id from club_tracks where is_active')).rows, [{ id: trackB }])
  const track = (await db.query('select * from club_tracks where id=$1', [trackB])).rows[0]
  await sync('track', trackB, { name: 'Track B', is_active: true }, track.revision, practiceId, true)
  assert.equal((await db.query('select is_active from club_tracks where id=$1', [trackB])).rows[0].is_active, false)

  const visitors = await value('select desktop_resolve_drivers($1,$2) result', [club, ['123']])
  assert.equal(visitors[0].id, visitor)
  assert.equal(visitors[0].tts_name, 'Guest TTS')
  assert.deepEqual(visitors[0].transponder_details, [{ user_id: visitor, transponder_id: '123', rc_class: 'Touring', rc_brand: 'Tamiya' }])
  assert.equal('email' in visitors[0], false)
  await assert.rejects(value('select desktop_resolve_drivers($1,$2) result', [club, ['4294967296']]), /numeric transponder/)
  await assert.rejects(value('select desktop_resolve_drivers($1,$2) result', [club, ['bad']]), /numeric transponder/)

  await value('select desktop_upload_race($1) result', [{ id: raceId, club_id: club, name: 'Guest final',
    source_race_id: 'local-guest-final', track_name: 'Track A', raced_at: '2026-11-07T10:00:00Z',
    results: [{ user_id: visitor, name: 'Visiting Driver', laps_ms: [10000] }], session_data: {} }])
  const practice = { id: practiceId, club_id: club, user_id: visitor, track_id: trackA,
    track_name: 'Track A', started_at: '2026-11-07T09:00:00Z', laps: [{ lap_ms: [10000] }], visibility: 'public' }
  await value('select desktop_upload_practice($1) result', [practice])
  // Club membership alone does not reveal a private practice log.
  assert.equal((await db.query('select * from practice_sessions')).rows.length, 0)
  await signIn(visitor)
  assert.equal((await db.query('select * from list_personal_races()')).rows.length, 1)
  assert.equal((await db.query('select visibility from practice_sessions')).rows[0].visibility, 'private')
  await db.exec("update practice_sessions set visibility='public'")
  await assert.rejects(db.exec("update practice_sessions set track_name='Tampered'"), /permission denied/)
  await signIn(member)
  assert.equal((await db.query('select * from list_personal_races()')).rows.length, 0)
  await assert.rejects(value('select desktop_resolve_drivers($1,$2) result', [club, ['123']]), /Active leader/)
  await signIn(leader)
  await value('select desktop_upload_practice($1) result', [{ ...practice, visibility: 'private', track_name: 'Wrong track', laps: [{ lap_ms: [10000, 11000] }] }])
  const updated = (await db.query('select * from practice_sessions')).rows[0]
  assert.equal(updated.visibility, 'public')
  assert.equal(updated.track_name, 'Track A')
  assert.deepEqual(updated.laps[0].lap_ms, [10000, 11000])
  await assert.rejects(value('select desktop_upload_practice($1) result', [{ ...practice, user_id: member }]), /identity does not match/)
  await db.exec(`reset role; update transponders set user_id='${member}' where transponder_id='123';
    delete from club_members where user_id='${member}';`)
  await signIn(visitor)
  assert.equal((await db.query('select * from list_personal_races()')).rows.length, 1)
  await signIn(member)
  assert.equal((await db.query('select * from races')).rows.length, 0)
  await signIn(visitor)
  await db.exec("update practice_sessions set visibility='private'")
  await signIn(member)
  assert.equal((await db.query('select * from practice_sessions')).rows.length, 0)
  await db.exec('set role anon')
  await assert.rejects(value('select desktop_resolve_drivers($1,$2) result', [club, ['123']]), /permission denied/)
  console.log('PASS: production timing migration, all preset fields, one active track, private practice ownership, visibility retries, participant history without membership, transponder transfer, leader-only visitor lookup')
} finally {
  await db.close()
}
