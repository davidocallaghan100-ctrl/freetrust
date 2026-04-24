-- Add investment_intent JSONB column to organisations table
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS investment_intent JSONB DEFAULT NULL;

-- Create index for filtering orgs seeking investment
CREATE INDEX IF NOT EXISTS idx_organisations_seeking_investment
  ON organisations ((investment_intent->>'isSeekingInvestment'))
  WHERE investment_intent IS NOT NULL;
