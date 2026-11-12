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
await db.exec(await fs.readFile('supabase/migrations/20261112110000_club_live.sql', 'utf8'))

const leader = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const club = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
await db.exec(`insert into auth.users(id) values ('${leader}');
insert into clubs(id,owner_id,name,join_code,visibility) values ('${club}','${leader}','Test Club','12345678','public');
set role authenticated; set request.jwt.claim.sub='${leader}';`)
const payload = {name:'Race',track:'Track',stage:'',status:'live',rows:[{pos:1,name:'Alice',laps:2,best_ms:11000,transponder:'SECRET'}]}
const saved = await db.query('select desktop_publish_club_live($1,$2,$3) value',[club,'quick',payload])
assert.equal(saved.rows[0].value.seq,1)
await db.exec('set role anon')
const publicRow = (await db.query('select payload from club_live_state where club_id=$1',[club])).rows[0]
assert.equal(publicRow.payload.rows[0].name,'Alice')
assert.equal(publicRow.payload.rows[0].transponder,undefined)
await assert.rejects(db.query('select desktop_publish_club_live($1,$2,$3)',[club,'quick',payload]),/permission denied/)
await db.exec(`reset role; update clubs set visibility='private' where id='${club}'; set role anon; set request.jwt.claim.sub='';`)
assert.equal((await db.query('select count(*)::int n from club_live_state')).rows[0].n,0)
console.log('PASS: Live leader publish, public read, payload sanitization, private club hidden')
await db.close()
