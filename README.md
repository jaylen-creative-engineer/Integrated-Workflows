# Integrated-Workflows

## Supabase energy storage

The WHOOP webhook (`src/app/api/whoop/webhook/route.js`) now upserts the computed energy schedule into Supabase.

### Required env (server-only)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHOOP_USER_ID` (optional; used when the webhook payload lacks `user_id`, defaults to `self`)
- `SUPABASE_ENERGY_FAIL_OPEN` (optional, default `true`; set to `false` to make the webhook return 502 on storage failure)

### Schema

The `energy_events` table stores WHOOP-derived energy segments with a unique constraint on `(user_id, start_at, category)` for idempotent upserts.

Columns: `id`, `user_id`, `category` (enum), `start_at`, `end_at`, `label`, `source`, `created_at`, `updated_at`.

#### Running the Migration

**Option 1: Supabase Dashboard (Recommended)**

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/energy_events.sql`
4. Paste and execute the SQL
5. Verify the table was created (see verification queries below)

**Option 2: Supabase CLI**

If you have Supabase CLI set up:
```bash
supabase db push
```

**Note**: PostgreSQL doesn't support `CREATE TYPE IF NOT EXISTS` syntax, so the migration uses a `DO` block to conditionally create the enum type. This is already handled in the migration file.

#### Verification Queries

After running the migration, verify the setup:

1. **Check table exists:**
```sql
SELECT * FROM information_schema.tables 
WHERE table_name = 'energy_events';
```

2. **Check enum type exists:**
```sql
SELECT * FROM pg_type 
WHERE typname = 'energy_event_category';
```

3. **Check indexes exist:**
```sql
SELECT * FROM pg_indexes 
WHERE tablename = 'energy_events';
```

4. **Verify table structure:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'energy_events'
ORDER BY ordinal_position;
```

### Query example (today, UTC or your TZ bounds)
```sql
select *
from energy_events
where user_id = '<your user>'
  and start_at >= '<today start ISO>'
  and start_at <  '<tomorrow start ISO>'
order by start_at;
```

## Creative OS Agent POC (Hybrid TS)

New files:
- `tsconfig.json` / `next-env.d.ts` enable TypeScript with `allowJs`.
- `src/agents/*.ts` scaffold root + domain agents (Projects, Tasks, Meetings, Ideas).
- `src/app/api/agents/creative-os/route.ts` POST handler for the root agent.

Route behavior:
- Defaults to `dryRun: true`, returns available tool names without calling the LLM.
- To actually invoke the agent, set `GOOGLE_GENAI_API_KEY` and send `dryRun: false`.

Example (dry run):
```bash
curl -X POST http://localhost:3000/api/agents/creative-os \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Draft a daily brief for today"}'
```

Example (live, requires `GOOGLE_GENAI_API_KEY`):
```bash
curl -X POST http://localhost:3000/api/agents/creative-os \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Draft a daily brief for today","dryRun":false}'
```
