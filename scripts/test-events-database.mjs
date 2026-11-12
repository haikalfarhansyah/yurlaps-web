import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'

const db = new PGlite()
await db.exec(`create role anon; create role authenticated;
create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
const schema = await fs.readFile('supabase/schema.sql', 'utf8')
await db.exec(schema.slice(0, schema.indexOf('-- Avatars storage bucket')))
await db.exec(await fs.readFile('supabase/community.sql', 'utf8'))
await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated; grant select on public.clubs to anon;')
await db.exec(await fs.readFile('supabase/migrations/20261112090000_club_events.sql', 'utf8'))

const leader = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const driver = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const club = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const eventId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const classId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
await db.exec(`insert into auth.users(id) values ('${leader}'),('${driver}');
insert into clubs(id,owner_id,name,join_code) values ('${club}','${leader}','Test Club','12345678');
update profiles set full_name='Driver Name',nickname='Driver',tts_name='Driver' where id='${driver}';
insert into transponders(user_id,transponder_id,rc_class,rc_brand)
values ('${driver}','12345','Buggy','Test RC');
set role authenticated; set request.jwt.claim.sub='${leader}';`)
const document = { id: eventId, club_id: club, name: 'Series 1', status: 'registration',
  classes: [{ id: classId, name: 'Buggy' }], entries: [], stages: [], revision: 1 }
const save = async (base, doc) => (await db.query('select save_club_event($1,$2,$3,$4) value',
  [club, eventId, base, doc])).rows[0].value
let result = await save(0, document)
assert.equal(result.record.revision, 1)
assert.equal((await save(0, document)).conflict, true)

await db.exec(`set request.jwt.claim.sub='${driver}'`)
const application = (await db.query('select apply_club_event($1,$2,$3) value',
  [eventId, classId, '12345'])).rows[0].value
assert.equal(application.approved, false)
assert.equal(application.name, 'Driver Name')
await assert.rejects(db.query('select apply_club_event($1,$2,$3)',
  [eventId, classId, '12345']), /One car per driver per class/)
await assert.rejects(save(2, { ...document, status: 'completed' }), /Active club leader required/)

await db.exec(`set request.jwt.claim.sub='${leader}'`)
result = await save(1, document)
assert.equal(result.conflict, true)
const remote = (await db.query('select document,revision from club_events where id=$1', [eventId])).rows[0]
assert.equal(remote.revision, 2)
assert.equal(remote.document.entries.length, 1)
const approved = { ...remote.document, entries: [{ ...remote.document.entries[0], approved: true, checked_in: true }],
  status: 'running', revision: remote.document.revision + 1,
  published_standings: [{ class_id: classId, group: 'A', drivers: [{
    entry_id: application.id, name: 'Driver Name', nick: 'Driver', transponder: '12345', points: 25, position: 1,
  }] }] }
result = await save(2, approved)
assert.equal(result.record.revision, 3)
await db.exec('set role anon')
await assert.rejects(db.query('select apply_club_event($1,$2,$3)',
  [eventId, classId, '12345']), /permission denied/)
await assert.rejects(db.query('select count(*)::int n from club_events'), /permission denied/)
const publicEvents = (await db.query('select list_visible_club_events($1) value', [club])).rows
assert.equal(publicEvents.length, 1)
assert.equal(publicEvents[0].value.entries[0].transponder, undefined)
assert.equal(publicEvents[0].value.published_standings[0].drivers[0].transponder, undefined)
console.log('PASS: Event save, revision conflict, account registration, one car per class, leader approval, public read')
await db.close()
