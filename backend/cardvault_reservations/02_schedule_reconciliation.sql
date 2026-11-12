-- RUN ONLY AFTER creating Supabase Vault secrets in Dashboard:
--   cardvault_backend_url     = https://cardvault-3-n36q.onrender.com
--   cardvault_cron_secret     = random 32+ character secret
-- and setting identical RESERVATION_CRON_SECRET in Render Environment.
-- This SQL never includes plaintext credentials.
-- In Supabase enable pg_cron and pg_net extensions if not already enabled.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Every 2 minutes, POST to backend; backend calls Stripe to confirm expiry.
-- DO NOT release inventory based on a DB timestamp alone: paid webhook
-- notifications may be delayed and asynchronous payments may be in progress.
SELECT cron.schedule(
  'cardvault-reservation-reconciliation-v1',
  '*/2 * * * *',
  $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'cardvault_backend_url') || '/internal/reconcile-reservations',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets
                         WHERE name = 'cardvault_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

-- Inspect last job runs using Supabase Cron UI, or:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 15;
-- To disable: SELECT cron.unschedule('cardvault-reservation-reconciliation-v1');
