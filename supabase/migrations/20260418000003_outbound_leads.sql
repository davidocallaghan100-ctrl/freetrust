-- Outbound leads table for cold email sequences
CREATE TABLE IF NOT EXISTS outbound_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text,
  last_name text,
  business_name text,
  icp_category text,
  source text,  -- 'linkedin' | 'google_maps' | 'manual'
  status text DEFAULT 'new',  -- 'new' | 'enrolled' | 'contacted' | 'replied' | 'booked' | 'unsubscribed'
  sequence_step int DEFAULT 0,  -- 0=not started, 1=email1 sent, 2=email2 sent, 3=email3 sent
  last_sent_at timestamptz,
  enrolled_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS outbound_leads_email_idx ON outbound_leads(email);
CREATE INDEX IF NOT EXISTS outbound_leads_status_idx ON outbound_leads(status);
CREATE INDEX IF NOT EXISTS outbound_leads_icp_idx ON outbound_leads(icp_category);
CREATE INDEX IF NOT EXISTS outbound_leads_sequence_idx ON outbound_leads(sequence_step, enrolled_at);
