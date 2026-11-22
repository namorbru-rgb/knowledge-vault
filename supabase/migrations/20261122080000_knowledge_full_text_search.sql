-- Index the largest collection and keep search within the caller's existing RLS.
create index if not exists kv_segments_search_idx on public.kv_video_segments
  using gin (to_tsvector('pg_catalog.simple', coalesce(text, '')));

create or replace function public.kv_full_text_search(
  p_query text, p_types text[] default null, p_offset integer default 0
) returns jsonb language sql stable security invoker set search_path = ''
as $$
  with input as (
    select websearch_to_tsquery('pg_catalog.simple', left(btrim(p_query), 200)) as query,
           greatest(coalesce(p_offset, 0), 0) as page_offset,
           auth.uid() as owner_id
  ), documents as (
    select 'video' as type, v.id, null::uuid as video_id, coalesce(v.title, v.url) as title,
           v.url, null::float8 as start_time, v.created_at,
           concat_ws(' ', v.title, v.description, v.notes, v.url) as body
    from public.kv_videos v, input i where v.user_id = i.owner_id
      and (p_types is null or 'videos' = any(p_types))
    union all
    select 'link', l.id, null, coalesce(l.title, l.url), l.url, null, l.created_at,
           concat_ws(' ', l.title, l.description, l.summary, l.main_text, l.notes, l.url)
    from public.kv_links l, input i where l.user_id = i.owner_id
      and (p_types is null or 'links' = any(p_types))
    union all
    select 'photo', p.id, null, coalesce(p.filename, 'Foto'), null, null, p.created_at,
           concat_ws(' ', p.filename, p.description, p.ocr_text, array_to_string(p.objects_detected, ' '))
    from public.kv_photos p, input i where p.user_id = i.owner_id
      and (p_types is null or 'photos' = any(p_types))
    union all
    select 'note', n.id, null, left(n.content, 80), null, null, n.created_at, n.content
    from public.kv_notes n, input i where n.user_id = i.owner_id
      and (p_types is null or 'notes' = any(p_types))
  ), hits as (
    select d.*, ts_rank_cd(doc.vector, i.query, 32) as score
    from documents d cross join input i
    cross join lateral (select to_tsvector('pg_catalog.simple', coalesce(d.body, '')) as vector) doc
    where numnode(i.query) > 0 and doc.vector @@ i.query
    union all
    select 'video_segment', s.id, v.id, coalesce(v.title, v.url), v.url, s.start_time,
           v.created_at, s.text, ts_rank_cd(to_tsvector('pg_catalog.simple', coalesce(s.text, '')), i.query, 32)
    from public.kv_video_segments s
    join public.kv_videos v on v.id = s.video_id and v.user_id = s.user_id
    cross join input i
    where s.user_id = i.owner_id and (p_types is null or 'videos' = any(p_types))
      and numnode(i.query) > 0 and to_tsvector('pg_catalog.simple', coalesce(s.text, '')) @@ i.query
  ), page as (
    select * from hits
    order by score desc, created_at desc nulls last, type, id
    limit 31 offset (select page_offset from input)
  )
  select jsonb_build_object(
    'results', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type', type, 'id', id, 'video_id', video_id, 'title', title, 'url', url,
          'start_time', start_time,
          'content', ts_headline('pg_catalog.simple', body, i.query,
            'StartSel="", StopSel="", MaxFragments=2, MaxWords=24, MinWords=8')
        ) order by score desc, created_at desc nulls last, type, id
      )
      from (select * from page order by score desc, created_at desc nulls last, type, id limit 30) p
      cross join input i
    ), '[]'::jsonb),
    'has_more', (select count(*) > 30 from page)
  );
$$;

revoke all on function public.kv_full_text_search(text, text[], integer) from public, anon;
grant execute on function public.kv_full_text_search(text, text[], integer) to authenticated;
