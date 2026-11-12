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
await db.exec(await fs.readFile('supabase/migrations/20261113090000_club_schedule.sql', 'utf8'))

const leader = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const member = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const club = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const eventId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const classId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const approvedEntry = '11111111-1111-4111-8111-111111111111'
const waitingEntry = '22222222-2222-4222-8222-222222222222'

await db.exec(`insert into auth.users(id) values ('${leader}'),('${member}');
insert into clubs(id,owner_id,name,join_code) values ('${club}','${leader}','Test Club','12345678');
insert into club_members(club_id,user_id,role,status) values ('${club}','${member}','member','active');
set role authenticated; set request.jwt.claim.sub='${leader}';`)

const document = {
  id: eventId, club_id: club, name: 'Series 1', status: 'running', revision: 1,
  classes: [{ id: classId, name: 'Buggy' }],
  entries: [
    { id: approvedEntry, class_id: classId, name: 'Driver Name', nick: 'Driver', transponder: '12345', approved: true, checked_in: true },
    { id: waitingEntry, class_id: classId, name: 'Waiting Driver', nick: '', transponder: '22222', approved: false, checked_in: false },
  ],
  stages: [{ id: 's1', class_id: classId, kind: 'qualifying', name: 'Kualifikasi 1', group: 'Grup A', status: 'planned', entry_ids: [approvedEntry, waitingEntry] }],
  plans: [{ id: 'p1', class_id: classId, kind: 'qualifying', order: 1, max_group_size: 8 }],
  schedule_scheme: { type: 'sequential', finals_by_group: false },
  start_at: 1794500000,
  schedule: [{
    stage_id: 's1', class_id: classId, class_name: 'Buggy', group: 'Grup A',
    kind: 'qualifying', name: 'Kualifikasi 1', status: 'planned',
    start_ms: 1794500000000, duration_ms: 120000, gap_ms: 600000, seed_source: 'Roster',
    drivers: [
      { entry_id: approvedEntry, name: 'Driver Name', nick: 'Driver', transponder: '12345' },
      { entry_id: waitingEntry, name: 'Waiting Driver', nick: '', transponder: '22222' },
    ],
  }],
}

const save = async (base, doc) => (await db.query('select save_club_event($1,$2,$3,$4) value',
  [club, eventId, base, doc])).rows[0].value
const result = await save(0, document)
assert.equal(result.record.revision, 1)
assert.equal(result.record.document.schedule.length, 1)

// Jadwal yang bukan array harus ditolak server.
await assert.rejects(save(1, { ...document, schedule: 'bukan array' }), /Invalid event document/)
// Plans juga harus berupa array.
await assert.rejects(save(1, { ...document, plans: {} }), /Invalid event document/)

// Anggota club melihat seluruh peserta yang sudah disetujui.
await db.exec(`set request.jwt.claim.sub='${member}'`)
const memberView = (await db.query('select list_visible_club_events($1) value', [club])).rows[0].value
assert.equal(memberView.schedule.length, 1)
assert.equal(memberView.schedule[0].seed_source, 'Roster')
assert.equal(memberView.schedule[0].start_ms, 1794500000000)
assert.equal(memberView.schedule[0].drivers.length, 1)
assert.equal(memberView.schedule[0].drivers[0].name, 'Driver Name')
// Transponder tidak dibuka ke daftar yang terlihat publik (pola Event).
assert.equal(memberView.schedule[0].drivers[0].transponder, undefined)

// Tamu club publik hanya melihat peserta yang disetujui DAN check-in.
await db.exec(`set role anon; set request.jwt.claim.sub=''`)
const publicView = (await db.query('select list_visible_club_events($1) value', [club])).rows[0].value
assert.equal(publicView.schedule.length, 1)
assert.equal(publicView.schedule[0].drivers.length, 1)
assert.equal(publicView.schedule[0].drivers[0].nick, 'Driver')
assert.equal(publicView.schedule[0].drivers[0].transponder, undefined)

// Club privat tidak boleh dibaca tamu.
await db.exec(`set role authenticated; set request.jwt.claim.sub='${leader}';
update clubs set visibility='private' where id='${club}';`)
await db.exec(`set role anon; set request.jwt.claim.sub=''`)
const privateView = await db.query('select list_visible_club_events($1) value', [club])
assert.equal(privateView.rows.length, 0)

console.log('PASS: jadwal event disimpan, divalidasi, dan hanya menampilkan peserta yang disetujui + check-in')
await db.close()
