-- A single, explicit consent action for the owner's whole Knowledge library.
-- The grant includes app read access and the read-only Knowledge MCP.
-- Nobody may use this function to grant another person's records.
create or replace function public.fh_set_full_knowledge_access(
  p_recipient uuid,
  p_enabled boolean
)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
  v_owner uuid := auth.uid();
begin
  if not fh_private.live_session() or v_owner is null or
     p_recipient is null or p_recipient=v_owner then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  if not exists (
    select 1 from public.fh_members me
    join public.fh_members other
      on other.family_id=me.family_id
    where me.user_id=v_owner and other.user_id=p_recipient
  ) then
    raise exception 'Recipient is not a member of this family'
      using errcode='42501';
  end if;

  if p_enabled then
    insert into public.fh_knowledge_shares(owner_id,recipient_id)
      values(v_owner,p_recipient)
      on conflict(owner_id,recipient_id) do nothing;
    insert into public.kv_mcp_shares(owner_id,recipient_id)
      values(v_owner,p_recipient)
      on conflict(owner_id,recipient_id) do nothing;
  else
    delete from public.fh_knowledge_shares
      where owner_id=v_owner and recipient_id=p_recipient;
    delete from public.kv_mcp_shares
      where owner_id=v_owner and recipient_id=p_recipient;
  end if;
  return true;
end;
$fn$;
revoke all on function public.fh_set_full_knowledge_access(uuid,boolean)
  from public,anon;
grant execute on function public.fh_set_full_knowledge_access(uuid,boolean)
  to authenticated;
comment on function public.fh_set_full_knowledge_access(uuid,boolean) is
  'Owner-confirmed reciprocal Family Hub and MCP full Knowledge grant; never grants Health or private documents.';
