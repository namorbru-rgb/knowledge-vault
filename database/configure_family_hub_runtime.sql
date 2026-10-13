-- VAPID/cron values must already be provisioned privately in Supabase Vault.
-- The cron name is stable; reapplying updates the job, not duplicate deliveries.
do $$begin
 if (select count(*) from vault.secrets where name in ('family_hub_vapid_public','family_hub_vapid_private','family_hub_cron'))<>3 then
  raise exception 'Provision the three private Vault secrets before enabling reminders';
 end if;
end $$;
select cron.schedule('family-hub-reminders','* * * * *', $cron$
 select net.http_post(
  url:='https://nixakeaiibzhesdwtelw.supabase.co/functions/v1/family-api',
  headers:=jsonb_build_object('Content-Type','application/json','x-cron-token',(select decrypted_secret from vault.decrypted_secrets where name='family_hub_cron')),
  body:='{"action":"dispatch"}'::jsonb
 );
$cron$);
