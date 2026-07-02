-- Phase 11b — Add "No Instagram account" status to meta_client_assets
-- Review in Supabase SQL editor before applying.
-- Run: ALTER TABLE meta_client_assets ADD COLUMN ...

ALTER TABLE meta_client_assets
  ADD COLUMN IF NOT EXISTS instagram_not_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_not_applicable_reason text,
  ADD COLUMN IF NOT EXISTS instagram_not_applicable_updated_at timestamptz;

COMMENT ON COLUMN meta_client_assets.instagram_not_applicable IS
  'True when the client intentionally has no Instagram account — suppresses missing-Instagram warnings and disables IG sync for this client.';
COMMENT ON COLUMN meta_client_assets.instagram_not_applicable_reason IS
  'Optional staff note explaining why Instagram is not applicable (e.g. "Business does not have an Instagram account").';
COMMENT ON COLUMN meta_client_assets.instagram_not_applicable_updated_at IS
  'Timestamp of the last time the not-applicable status was set or cleared.';
