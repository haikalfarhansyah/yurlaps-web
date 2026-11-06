import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite()
await db.exec(`create role anon; create role authenticated;
create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
const schema = await fs.readFile('supabase/schema.sql','utf8')
await db.exec(schema.slice(0,schema.indexOf('-- Avatars storage bucket')))
await db.exec(await fs.readFile('supabase/community.sql','utf8'))
await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated;')
const migration = (await fs.readdir('supabase/migrations')).find(x=>x.endsWith('_desktop_club_sync.sql'))
await db.exec(await fs.readFile('supabase/migrations/'+migration,'utf8'))
const leader='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',club='cccccccc-cccc-4ccc-8ccc-cccccccccccc',track='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
await db.exec(`insert into auth.users(id) values ('${leader}'),('${other}'); insert into clubs(id,owner_id,name,join_code) values ('${club}','${leader}','Test','12345678'); set role authenticated; set request.jwt.claim.sub='${leader}';`)
const data={name:'Circuit',address:'',width_m:null,note:'',best_ms:null,holder:null}
async function sync(base,mutation,payload=data){return (await db.query('select desktop_sync_entity($1,$2,$3,$4,$5,$6,$7) result',['track',club,track,base,mutation,payload,false])).rows[0].result}
let r=await sync(0,leader);assert.equal(r.record.revision,1)
r=await sync(0,leader);assert.equal(r.record.revision,1)
r=await sync(0,other,{...data,name:'Conflict'});assert.equal(r.conflict,true)
r=await sync(1,other,{...data,name:'Changed'});assert.equal(r.record.revision,2)
const race = {id:track,club_id:club,name:'Final',track_name:'Circuit',raced_at:'2026-11-05T10:00:00Z',
  source_race_id:'local-race',results:[{driver:'Driver',laps_ms:[1000,1100]}],session_data:{schema_version:1}}
const upload = payload => db.query('select desktop_upload_race($1) result',[payload])
assert.equal((await upload(race)).rows[0].result.id,track)
await upload(race)
assert.equal((await db.query('select count(*)::int n from races')).rows[0].n,1)
await assert.rejects(upload({...race,results:[]}),/different content/)
await db.exec(`update club_tracks set deleted_at=now() where id='${track}'`)
assert.equal((await db.query('select revision,deleted_at from club_tracks')).rows[0].revision,3)
await db.exec(`set request.jwt.claim.sub='${other}'`)
await assert.rejects(sync(2,club),/Active leader required/)
await assert.rejects(upload(race),/Active leader required/)
assert.equal((await db.query('select * from club_tracks')).rows.length,0)
await db.exec('set role anon')
await assert.rejects(sync(2,club),/permission denied/)
console.log('PASS: migration, leader sync, retry, revision conflict, soft delete, race upload deduplication, race content collision, unauthorized user, RLS isolation, anonymous denial')
await db.close()
