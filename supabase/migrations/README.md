# Deployment order

1. `20261013185309_family_hub.sql`: additive Hub tables and restrictive Knowledge/Storage fences.
2. `20261013200054_family_hub_runtime.sql`: live-session enforcement and private push outbox.
3. `20261013201144_family_hub_rpc_hardening.sql`: invoker RPC wrappers/private implementations.
4. `20261013202206_family_hub_extraction_limits.sql`: database-enforced extraction quota.
5. `20261013202642_knowledge_media_owner_paths.sql`: worker-safe photo ownership/path constraint.

Deployment also stores newly generated VAPID/cron credentials in Supabase Vault and
registers a one-minute cron job; credential values are never committed. Existing
Knowledge data and Storage metadata are snapshotted in a non-exposed backup schema
before the first live application. Real profiles are created explicitly by users.
