-- Phase 19b: Microsoft assignee identity mappings for staff assignment resolution.
-- Safe to review: no destructive changes, no existing data affected.
-- Administrators explicitly map Microsoft user IDs to CG Dynamics staff profiles,
-- enabling Planner task assignee resolution without guessing names client-side.

CREATE TABLE IF NOT EXISTS microsoft_user_mappings (
  microsoft_user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  mail TEXT,
  cg_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE microsoft_user_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read microsoft_user_mappings"
  ON microsoft_user_mappings FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can insert microsoft_user_mappings"
  ON microsoft_user_mappings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can update microsoft_user_mappings"
  ON microsoft_user_mappings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE OR REPLACE FUNCTION update_microsoft_user_mapping_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_microsoft_user_mapping_timestamp
  BEFORE UPDATE ON microsoft_user_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_microsoft_user_mapping_timestamp();
