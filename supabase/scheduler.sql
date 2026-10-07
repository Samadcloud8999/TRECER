-- OPTIONAL: minute scheduler inside Supabase, compatible with a Vercel Hobby site.
-- First enable pg_cron, pg_net and Vault in the Supabase dashboard.
-- Replace ONLY the two placeholders below. Never commit the filled-in file.
-- Run once via SQL Editor as the project database owner.
begin;
revoke all on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;
revoke all on schema vault from public,anon,authenticated;
revoke all on vault.decrypted_secrets from public,anon,authenticated;
do $$declare site text='https://REPLACE_WITH_YOUR_VERCEL_DOMAIN';secret text='REPLACE_WITH_THE_SAME_CRON_SECRET_AS_VERCEL';begin
 if site like '%REPLACE_%' or secret like 'REPLACE_%' then raise exception 'Replace both placeholders before running this SQL';end if;
 if site !~ '^https://[a-zA-Z0-9.-]+(:443)?$' or length(secret)<32 then raise exception 'Use an HTTPS domain without a path and a strong CRON_SECRET';end if;
 if exists(select 1 from vault.decrypted_secrets where name in('karman_site_url','karman_cron_secret')) then raise exception 'Secrets already exist. Update them in Vault instead of running this setup again';end if;
 perform vault.create_secret(site,'karman_site_url');perform vault.create_secret(secret,'karman_cron_secret');end$$;
select cron.schedule('karman-push-every-minute','* * * * *',$job$
 select net.http_get(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='karman_site_url')||'/api/cron',
 headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='karman_cron_secret')),
 timeout_milliseconds:=10000
 );
$job$);
commit;
-- Inspect runs from the owner-only Cron dashboard. HTTP results also appear in Vercel Logs.
-- Stop only this job when needed: select cron.unschedule('karman-push-every-minute');
