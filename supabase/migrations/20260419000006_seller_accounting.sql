-- ─────────────────────────────────────────────────────────────────────────────
-- Seller Accounting: VAT fields on profiles, invoice_number on orders
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. VAT fields on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vat_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_number      varchar(20);

-- 2. Invoice number on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS invoice_number varchar(30) UNIQUE;

-- 3. Sequence for invoice numbers (per calendar year)
--    We store a global counter and derive the year from the current date at
--    generation time. Simple and reliable across concurrent requests.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- 4. Function to generate the next invoice number (FT-{YEAR}-{5-digit})
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS varchar(30)
LANGUAGE plpgsql
AS $$
DECLARE
  v_year  text;
  v_seq   bigint;
  v_num   varchar(30);
BEGIN
  v_year := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY');
  v_seq  := nextval('invoice_number_seq');
  v_num  := 'FT-' || v_year || '-' || lpad(v_seq::text, 5, '0');
  RETURN v_num;
END;
$$;
