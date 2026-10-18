-- Family Hub: allow specifically delegated family members to record health
-- events for canonical family profiles. Existing private records and storage
-- remain private; no broad cross-account SELECT policies are introduced.

create table if not exists public.fh_profile_care (
  person_id uuid not null references public.kv_persons(id) on delete cascade,
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (person_id, caregiver_id)
);
create index if not exists fh_profile_care_actor_idx on public.fh_profile_care(caregiver_id);
alter table public.fh_profile_care enable row level security;
drop policy if exists fh_care_select on public.fh_profile_care;
create policy fh_care_select on public.fh_profile_care for select to authenticated using (
  fh_private.live_session() and (
    caregiver_id = auth.uid() or exists (
      select 1 from public.kv_persons p where p.id = person_id and p.user_id = auth.uid()
    )
  )
);
drop policy if exists fh_care_insert on public.fh_profile_care;
create policy fh_care_insert on public.fh_profile_care for insert to authenticated with check (
  fh_private.live_session()
  and exists (
    select 1 from public.kv_persons p
    join public.fh_members owner_m on owner_m.user_id = p.user_id
    join public.fh_members guest_m on guest_m.family_id = owner_m.family_id and guest_m.user_id = caregiver_id
    where p.id = person_id and p.user_id = auth.uid()
      and p.fh_kind in ('self','child') and caregiver_id <> auth.uid()
  )
);
drop policy if exists fh_care_delete on public.fh_profile_care;
create policy fh_care_delete on public.fh_profile_care for delete to authenticated using (
  fh_private.live_session() and exists (
    select 1 from public.kv_persons p where p.id = person_id and p.user_id = auth.uid()
  )
);
-- No client UPDATE privileges or policy.
revoke all on public.fh_profile_care from anon;
grant select,insert,delete on public.fh_profile_care to authenticated;

create or replace function fh_private.can_record_for(p_person uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select fh_private.live_session() and exists (
    select 1 from public.kv_persons p
    where p.id = p_person and p.fh_kind in ('self','child') and (
      p.user_id = auth.uid()
      or exists (
        select 1 from public.fh_profile_care c
        join public.fh_members mine on mine.user_id = auth.uid()
        join public.fh_members owner_member on owner_member.user_id = p.user_id
          and owner_member.family_id = mine.family_id
        where c.person_id = p.id and c.caregiver_id = auth.uid()
      )
    )
  );
$$;
revoke all on function fh_private.can_record_for(uuid) from public,anon,authenticated;

create or replace function public.fh_selectable_profiles()
returns table (id uuid, name text, fh_kind text, profile_owner_id uuid)
language sql stable security definer set search_path = ''
as $$
  select p.id,p.name,p.fh_kind,p.user_id
  from public.kv_persons p
  where p.fh_kind in ('self','child')
    and fh_private.can_record_for(p.id)
  order by case when p.user_id = auth.uid() and p.fh_kind = 'self' then 0
                when p.fh_kind = 'self' then 1 else 2 end,p.name;
$$;
revoke all on function public.fh_selectable_profiles() from public,anon;
grant execute on function public.fh_selectable_profiles() to authenticated;

create or replace function public.fh_create_for_person(
  p_person uuid, p_kind text, p_title text,
  p_at timestamptz, p_intensity integer, p_details jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_record uuid;
begin
  if not fh_private.can_record_for(p_person) then
    raise exception 'Für dieses Profil ist keine Freigabe vorhanden.' using errcode='42501';
  end if;
  select user_id into v_owner from public.kv_persons where id = p_person;
  if v_owner is null then raise exception 'Profil nicht vorhanden.'; end if;
  if p_kind not in ('symptom','case','visit','hospital','examination','prescription','medication','nutrition','reminder')
    or length(btrim(coalesce(p_title,''))) not between 1 and 200
    or p_at is null
    or p_at > now() + interval '5 years'
    or p_at < now() - interval '100 years'
    or jsonb_typeof(p_details) is distinct from 'object'
    or length(p_details::text) > 20000
    or (p_kind = 'symptom' and (p_intensity is null or p_intensity not between 0 and 10))
  then raise exception 'Ungültiger Gesundheitseintrag.'; end if;

  insert into public.fh_resources (
    owner_id,person_id,kind,title,occurred_at,intensity,details
  ) values (
    v_owner,p_person,p_kind,btrim(p_title),p_at,p_intensity,
    p_details || jsonb_build_object('entered_by',auth.uid())
  ) returning id into v_record;

  -- Only this single newly created entry is shared with the person who
  -- recorded it. Older, unrelated health records remain private.
  if v_owner <> auth.uid() then
    insert into public.fh_grants(resource_id,recipient_id,permission)
    values(v_record,auth.uid(),'edit')
    on conflict(resource_id,recipient_id) do nothing;
  end if;
  return v_record;
end;
$$;
revoke all on function public.fh_create_for_person(uuid,text,text,timestamptz,integer,jsonb) from public,anon;
grant execute on function public.fh_create_for_person(uuid,text,text,timestamptz,integer,jsonb) to authenticated;

-- Initial family request: Roman and Katarina may make entries for each other
-- and for the two children. Other adult accounts (for example Luzia) receive
-- no delegated access automatically.
insert into public.fh_profile_care(person_id,caregiver_id)
select p.id, caregiver.id from public.kv_persons p
join auth.users owner on owner.id=p.user_id
join public.fh_members owner_m on owner_m.user_id=owner.id
join public.fh_members guest_m on guest_m.family_id=owner_m.family_id
join auth.users caregiver on caregiver.id=guest_m.user_id
where p.fh_kind in ('self','child')
  and (
    (lower(owner.email)='roman.bruderer@kama-gmbh.ch' and lower(caregiver.email)='katarina.bruderer@kama-gmbh.ch')
    or
    (lower(owner.email)='katarina.bruderer@kama-gmbh.ch' and lower(caregiver.email)='roman.bruderer@kama-gmbh.ch')
  )
  and p.user_id<>caregiver.id
on conflict(person_id,caregiver_id) do nothing;

comment on table public.fh_profile_care is
  'Explicit delegated write access only. Does not expose existing health records.';
