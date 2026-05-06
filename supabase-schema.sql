-- ─────────────────────────────────────────────────────────────────
-- Stakeholder Update Composer — Supabase Schema
-- Run this in your Supabase project's SQL Editor:
--   Dashboard → SQL Editor → New query → paste → Run
-- ─────────────────────────────────────────────────────────────────

-- Enable UUID generation (already enabled in most Supabase projects)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Table: sprint_updates ────────────────────────────────────────
-- Stores saved sprint update sessions (form data + generated outputs)
CREATE TABLE IF NOT EXISTS sprint_updates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  project_name TEXT,
  sprint      TEXT,
  form_data   JSONB       NOT NULL    DEFAULT '{}',
  outputs     JSONB       NOT NULL    DEFAULT '{}',
  label       TEXT                    -- optional user-defined name, e.g. "Sprint 8 final"
);

-- Index for fast lookup by project + sprint
CREATE INDEX IF NOT EXISTS idx_sprint_updates_project ON sprint_updates (project_name, sprint);
CREATE INDEX IF NOT EXISTS idx_sprint_updates_created ON sprint_updates (created_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────
-- This config allows anyone with your anon key to read/write.
-- If you add Supabase Auth later, tighten this to auth.uid() checks.
ALTER TABLE sprint_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read"   ON sprint_updates FOR SELECT USING (true);
CREATE POLICY "Allow anon insert" ON sprint_updates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon delete" ON sprint_updates FOR DELETE USING (true);

-- ─── Optional: clean up old entries automatically ─────────────────
-- Uncomment the lines below to auto-delete entries older than 90 days
-- (requires pg_cron extension — enable it in Supabase Dashboard → Extensions)

-- SELECT cron.schedule(
--   'delete-old-sprint-updates',
--   '0 2 * * *',  -- runs at 2am UTC daily
--   $$DELETE FROM sprint_updates WHERE created_at < NOW() - INTERVAL '90 days';$$
-- );
