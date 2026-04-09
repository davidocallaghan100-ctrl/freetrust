-- Organisation Members
CREATE TABLE IF NOT EXISTS organisation_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  title           text,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, user_id)
);

-- Index for fast lookup by org
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organisation_members(organisation_id);
-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organisation_members(user_id);

-- RLS: public can read members
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view organisation members"
  ON organisation_members FOR SELECT
  USING (true);

CREATE POLICY "Org owner or admin can insert members"
  ON organisation_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = organisation_members.organisation_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM organisations o
      WHERE o.id = organisation_members.organisation_id
        AND o.creator_id = auth.uid()
    )
  );

CREATE POLICY "Members can update their own record"
  ON organisation_members FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Org owner or admin can delete members"
  ON organisation_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = organisation_members.organisation_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
