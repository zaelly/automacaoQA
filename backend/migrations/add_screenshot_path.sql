-- Run this in your Supabase SQL Editor to enable per-step screenshots
-- Dashboard → SQL Editor → New Query → paste this → Run

ALTER TABLE execution_steps
  ADD COLUMN IF NOT EXISTS screenshot_path text DEFAULT NULL;
