-- Migration: energy_events table for WHOOP-derived energy schedule
-- Keeps per-segment windows (peaks, dips, etc.) with upsert-friendly key.

-- Create enum type if it doesn't exist (PostgreSQL doesn't support CREATE TYPE IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    INNER JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'energy_event_category' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE energy_event_category AS ENUM (
      'peak',
      'dip',
      'groggy',
      'wind_down',
      'melatonin'
    );
  END IF;
END $$;

create table if not exists public.energy_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  category energy_event_category not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  label text not null,
  source text not null default 'whoop',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint energy_events_start_before_end check (end_at >= start_at)
);

-- Unique per user per segment start/category to enable idempotent upserts.
create unique index if not exists energy_events_user_start_category_idx
  on public.energy_events (user_id, start_at, category);

-- Helpful for day-range queries.
create index if not exists energy_events_user_start_idx
  on public.energy_events (user_id, start_at);

comment on table public.energy_events is 'WHOOP-derived energy segments (peaks/dips/etc.).';
comment on column public.energy_events.user_id is 'WHOOP user id (kept even for single-user setups).';
comment on column public.energy_events.category is 'Segment category (peak/dip/groggy/wind_down/melatonin).';
comment on column public.energy_events.start_at is 'Segment start timestamp with timezone.';
comment on column public.energy_events.end_at is 'Segment end timestamp with timezone.';
comment on column public.energy_events.label is 'Human-readable label (e.g., Morning Peak).';
comment on column public.energy_events.source is 'Data source identifier (e.g., whoop).';

