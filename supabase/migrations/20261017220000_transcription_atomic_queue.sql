-- Atomic, resumable private KnowledgeVault video transcription queue.
-- Only service_role may run these routines. Never expose to user JWTs.
alter table public.kv_videos
  add column if not exists transcript_claim_token uuid,
  add column if not exists transcript_claimed_at timestamptz,
  add column if not exists transcript_next_attempt_at timestamptz;
create index if not exists kv_videos_transcription_queue
 on public.kv_videos (transcript_status, transcript_next_attempt_at, created_at);

create or replace function public.kv_transcription_claim()
returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare item public.kv_videos%rowtype;
begin
  select * into item
  from public.kv_videos v
  where (
    (v.transcript_status in ('pending','error') and coalesce(v.transcript_retry_count,0)<4
       and (v.transcript_next_attempt_at is null or v.transcript_next_attempt_at<=now()))
    or (v.transcript_status='done' and not exists
       (select 1 from public.kv_video_segments s where s.video_id=v.id and nullif(btrim(s.text),'') is not null))
    or (v.transcript_status='processing' and v.transcript_claimed_at < now()-interval '2 hours'
        and coalesce(v.transcript_retry_count,0)<4)
  )
  order by case v.transcript_status when 'pending' then 0 when 'done' then 1 else 2 end,
      v.created_at asc
  for update of v skip locked limit 1;
  if not found then return null; end if;

  update public.kv_videos v set
    transcript_status='processing', transcript_claimed_at=now(),
    transcript_claim_token=gen_random_uuid(), transcript_next_attempt_at=null,
    transcript_retry_count=case when item.transcript_status='processing'
         then least(coalesce(item.transcript_retry_count,0)+1,4)
         else coalesce(item.transcript_retry_count,0) end
  where v.id=item.id
  returning * into item;

  return jsonb_build_object('id',item.id,'user_id',item.user_id,'url',item.url,
    'claim_token',item.transcript_claim_token,'attempt',coalesce(item.transcript_retry_count,0)+1);
end;
$$;

create or replace function public.kv_transcription_heartbeat(p_id uuid,p_claim uuid)
returns boolean language plpgsql security invoker set search_path=''
as $$
begin
  update public.kv_videos set transcript_claimed_at=now()
    where id=p_id and transcript_claim_token=p_claim and transcript_status='processing';
  return found;
end;
$$;

create or replace function public.kv_transcription_finalize(
  p_id uuid,p_claim uuid,p_segments jsonb,p_info jsonb default '{}'::jsonb
) returns integer language plpgsql security invoker set search_path=''
as $$
declare
  owner uuid;
  n integer;
begin
  if jsonb_typeof(p_segments) <> 'array'
     or jsonb_array_length(p_segments)=0 or jsonb_array_length(p_segments)>3000 then
    raise exception 'Transcript must contain 1 to 3000 segments';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_segments) s
    where jsonb_typeof(s) <> 'object'
      or btrim(coalesce(s->>'text',''))=''
      or length(s->>'text')>12000
      or coalesce(s->>'start','') !~ '^[0-9]+(\.[0-9]+)?$'
      or coalesce(s->>'end','') !~ '^[0-9]+(\.[0-9]+)?$'
  ) then raise exception 'Invalid transcript segment'; end if;
  select user_id into owner from public.kv_videos
    where id=p_id and transcript_claim_token=p_claim and transcript_status='processing'
    for update;
  if not found then raise exception 'Transcript claim expired'; end if;
  delete from public.kv_video_segments where video_id=p_id;
  insert into public.kv_video_segments(video_id,user_id,start_time,end_time,text)
    select p_id,owner,(s->>'start')::float8,(s->>'end')::float8,btrim(s->>'text')
      from jsonb_array_elements(p_segments) s;
  get diagnostics n=row_count;
  if n<1 then raise exception 'No transcript saved'; end if;
  update public.kv_videos set
      title=coalesce(nullif(left(btrim(p_info->>'title'),300),''),title),
      description=coalesce(nullif(left(btrim(p_info->>'description'),2000),''),description),
      thumbnail_url=coalesce(nullif(left(btrim(p_info->>'thumbnail'),2000),''),thumbnail_url),
      duration_seconds=case when (p_info->>'duration') ~ '^[0-9]{1,8}$'
           then (p_info->>'duration')::integer else duration_seconds end,
      transcript_status='done',transcript_error=null,transcript_retry_count=0,
      transcript_claim_token=null,transcript_claimed_at=null,transcript_next_attempt_at=null
    where id=p_id and transcript_claim_token=p_claim;
  if not found then raise exception 'Transcript claim expired'; end if;
  return n;
end;
$$;

create or replace function public.kv_transcription_fail(
  p_id uuid,p_claim uuid,p_reason text,p_permanent boolean default false
) returns text language plpgsql security invoker set search_path=''
as $$
declare n integer; s text;
begin
  select coalesce(transcript_retry_count,0)+1 into n from public.kv_videos
    where id=p_id and transcript_claim_token=p_claim and transcript_status='processing' for update;
  if not found then return 'stale_claim'; end if;
  s:=case when p_permanent or n>=4 then 'error' else 'pending' end;
  update public.kv_videos set transcript_status=s,
    transcript_retry_count=n,
    transcript_error=left(coalesce(nullif(p_reason,''),'Unknown transcription failure'),500),
    transcript_claim_token=null,transcript_claimed_at=null,
    transcript_next_attempt_at=case when s='pending' then
      now()+case when n=1 then interval '5 minutes'
                 when n=2 then interval '30 minutes'
                 else interval '3 hours' end
      else null end
    where id=p_id and transcript_claim_token=p_claim;
  return s;
end;
$$;

revoke all on function public.kv_transcription_claim() from public,anon,authenticated;
revoke all on function public.kv_transcription_heartbeat(uuid,uuid) from public,anon,authenticated;
revoke all on function public.kv_transcription_finalize(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.kv_transcription_fail(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.kv_transcription_claim() to service_role;
grant execute on function public.kv_transcription_heartbeat(uuid,uuid) to service_role;
grant execute on function public.kv_transcription_finalize(uuid,uuid,jsonb,jsonb) to service_role;
grant execute on function public.kv_transcription_fail(uuid,uuid,text,boolean) to service_role;