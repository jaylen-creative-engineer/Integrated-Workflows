# Integrated-Workflows

## Supabase energy storage

The WHOOP webhook (`src/app/api/whoop/webhook/route.js`) now upserts the computed energy schedule into Supabase.

### Required env (server-only)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHOOP_USER_ID` (optional; used when the webhook payload lacks `user_id`, defaults to `self`)
- `SUPABASE_ENERGY_FAIL_OPEN` (optional, default `true`; set to `false` to make the webhook return 502 on storage failure)

### Schema
Run `supabase/migrations/energy_events.sql` in your project (Supabase SQL editor or `supabase db push`). It creates `energy_events` with a unique constraint on `(user_id, start_at, category)` for idempotent upserts.

Columns: `id`, `user_id`, `category` (enum), `start_at`, `end_at`, `label`, `source`, `created_at`, `updated_at`.

### Query example (today, UTC or your TZ bounds)
```sql
select *
from energy_events
where user_id = '<your user>'
  and start_at >= '<today start ISO>'
  and start_at <  '<tomorrow start ISO>'
order by start_at;
```
