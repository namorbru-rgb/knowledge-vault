import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

test('full-text search matches across fields, pages transcripts and respects ownership', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table kv_videos (id uuid primary key, user_id uuid, title text, url text, description text, notes text, created_at timestamptz);
      create table kv_video_segments (id uuid primary key default gen_random_uuid(), video_id uuid, user_id uuid, text text, start_time float8);
      create table kv_links (id uuid primary key default gen_random_uuid(), user_id uuid, title text, url text, description text, summary text, main_text text, notes text, created_at timestamptz);
      create table kv_photos (id uuid primary key default gen_random_uuid(), user_id uuid, filename text, description text, ocr_text text, objects_detected text[], created_at timestamptz);
      create table kv_notes (id uuid primary key default gen_random_uuid(), user_id uuid, content text, created_at timestamptz);
      grant select on all tables in schema public to authenticated;
      insert into kv_videos(id,user_id,title) values
        ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','Video'),
        ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000002','Fremdes Video');
      insert into kv_video_segments(video_id,user_id,text,start_time)
        select v.id,v.user_id,'Ein Server verarbeitet Solarstrom und Speicherdaten',n
        from kv_videos v cross join generate_series(1,31) n;
      insert into kv_links(user_id,title,main_text)
        values ('00000000-0000-0000-0000-000000000001','Solarstrom','Hier stehen die Speicherdaten.');
      insert into kv_photos(user_id,filename,ocr_text)
        values ('00000000-0000-0000-0000-000000000001','Foto','Messung am Zähler');
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20261122080000_knowledge_full_text_search.sql', import.meta.url), 'utf8'))
    await db.exec("set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001'")
    async function search(query, types = null, offset = 0) {
      const { rows } = await db.query('select kv_full_text_search($1,$2,$3) as result', [query, types, offset])
      return rows[0].result
    }
    const first = await search('Speicherdaten Solarstrom', ['videos'])
    const second = await search('Speicherdaten Solarstrom', ['videos'], 30)
    assert.equal(first.has_more, true)
    assert.equal(first.results.length, 30)
    assert.equal(second.has_more, false)
    assert.equal(second.results.length, 1)
    assert.equal(new Set([...first.results, ...second.results].map(row => row.id)).size, 31)
    assert.ok(first.results.every(row => row.title === 'Video' && row.start_time > 0 && row.content.includes('Solarstrom')))
    assert.equal((await search('Speicherdaten Solarstrom', ['links'])).results[0].type, 'link')
    assert.equal((await search('"am Zähler"')).results[0].type, 'photo')
    assert.deepEqual((await search('"Solarstrom Speicherdaten"', ['videos'])).results, [])
    assert.deepEqual((await search('???')).results, [])
    await db.exec('reset role; set role anon')
    await assert.rejects(search('Solarstrom'), /permission denied/)
  } finally {
    await db.close()
  }
})
