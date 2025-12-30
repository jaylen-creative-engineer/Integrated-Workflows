-- Migration: Add formatted time columns to energy_events table
-- Adds human-readable formatted time strings alongside existing timestamp columns

-- Add formatted string columns for start_at and end_at
ALTER TABLE public.energy_events
  ADD COLUMN IF NOT EXISTS start_at_formatted text,
  ADD COLUMN IF NOT EXISTS end_at_formatted text;

-- Add comments for the new columns
COMMENT ON COLUMN public.energy_events.start_at_formatted IS 'Human-readable formatted start time (e.g., "Saturday, December 27th 1:12PM") in US EST timezone.';
COMMENT ON COLUMN public.energy_events.end_at_formatted IS 'Human-readable formatted end time (e.g., "Saturday, December 27th 1:12PM") in US EST timezone.';



