-- Outbound leads table for cold email sequences
-- NOTE: email is nullable — Google Maps leads have phone but no email
-- Leads without email are stored for manual outreach (phone/website)
-- Only leads WITH email are enrolled in automated sequences
CREATE TABLE IF NOT EXISTS outbound_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,  -- nullable: Google Maps leads often have no email
  first_name text,
  last_name text,
  business_name text,
  phone text,
  website text,
  icp_category text,
  source text,  -- 'LinkedIn' | 'Google Maps' | 'manual'
  status text DEFAULT 'new',  -- 'new' | 'enrolled' | 'contacted' | 'replied' | 'booked' | 'unsubscribed'
  sequence_step int DEFAULT 0,  -- 0=not started, 1=email1 sent, 2=email2 sent, 3=email3 sent
  last_sent_at timestamptz,
  enrolled_at timestamptz DEFAULT now(),
  notes text
);

-- Only unique constraint on non-null emails
CREATE UNIQUE INDEX IF NOT EXISTS outbound_leads_email_idx ON outbound_leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS outbound_leads_status_idx ON outbound_leads(status);
CREATE INDEX IF NOT EXISTS outbound_leads_icp_idx ON outbound_leads(icp_category);
CREATE INDEX IF NOT EXISTS outbound_leads_sequence_idx ON outbound_leads(sequence_step, enrolled_at);
