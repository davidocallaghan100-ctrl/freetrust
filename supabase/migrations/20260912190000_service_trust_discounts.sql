-- ============================================================================
-- Service checkout TrustCoin discounts
--
-- A service buyer may reserve TrustCoin before Stripe Checkout is created.
-- The fixed conversion is 100 TrustCoin = EUR 1.00, so one TrustCoin is one
-- euro cent of discount. The reservation and balance debit happen in one
-- transaction, and reversal is idempotent for failed/expired checkouts.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gross_amount integer,
  ADD COLUMN IF NOT EXISTS trust_discount_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_discount_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trust_discount_refunded_at timestamptz;

UPDATE public.orders
   SET gross_amount = amount
 WHERE gross_amount IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'orders_trust_discount_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_trust_discount_status_check CHECK (
        trust_discount_status IN ('none', 'reserved', 'spent', 'refunded')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_trust_discount_reserved_idx
  ON public.orders (trust_discount_status)
  WHERE trust_discount_status = 'reserved';

-- Reserve and debit TrustCoin against one pending order. The order row is
-- locked before the balance row, so retries for the same order cannot debit
-- twice and concurrent orders cannot overspend the buyer's balance.
CREATE OR REPLACE FUNCTION public.reserve_service_discount(
  p_order_id uuid,
  p_user_id uuid,
  p_amount_tokens integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount integer;
  v_buyer_id uuid;
  v_status text;
  v_existing_tokens integer;
  v_balance integer;
  v_new_balance integer;
BEGIN
  IF p_amount_tokens IS NULL OR p_amount_tokens <= 0 OR MOD(p_amount_tokens, 100) <> 0 THEN
    RAISE EXCEPTION 'invalid_discount: TrustCoin discounts must be positive multiples of 100'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT buyer_id, amount, trust_discount_status, trust_discount_tokens
    INTO v_buyer_id, v_amount, v_status, v_existing_tokens
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found: %', p_order_id USING ERRCODE = 'P0001';
  END IF;

  IF v_buyer_id <> p_user_id THEN
    RAISE EXCEPTION 'order_forbidden: %', p_order_id USING ERRCODE = 'P0001';
  END IF;

  -- Idempotent retry: the same reservation for the same order is a no-op.
  IF v_status = 'reserved' AND v_existing_tokens = p_amount_tokens THEN
    SELECT balance INTO v_balance
      FROM public.trust_balances
     WHERE user_id = p_user_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  IF v_status <> 'none' THEN
    RAISE EXCEPTION 'discount_state: order % is already in state %', p_order_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Keep at least Stripe's EUR minimum charge (EUR 0.50) payable by card.
  IF v_amount IS NULL OR v_amount < 50 OR p_amount_tokens > v_amount - 50 THEN
    RAISE EXCEPTION 'discount_too_large: order amount does not leave the Stripe minimum'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT balance INTO v_balance
    FROM public.trust_balances
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_balance, 0) < p_amount_tokens THEN
    RAISE EXCEPTION 'insufficient_funds: requested %, available %', p_amount_tokens, COALESCE(v_balance, 0)
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.trust_balances
     SET balance = balance - p_amount_tokens,
         updated_at = now()
   WHERE user_id = p_user_id
   RETURNING balance INTO v_new_balance;

  INSERT INTO public.trust_ledger (user_id, amount, type, reference_id, description)
  VALUES (
    p_user_id,
    -p_amount_tokens,
    'service_discount_reserved',
    p_order_id,
    format('Service checkout discount reserved — ₮%s = €%s', p_amount_tokens, to_char(p_amount_tokens / 100.0, 'FM999999990.00'))
  );

  UPDATE public.orders
     SET gross_amount = COALESCE(gross_amount, amount),
         amount = amount - p_amount_tokens,
         trust_discount_tokens = p_amount_tokens,
         trust_discount_cents = p_amount_tokens,
         trust_discount_status = 'reserved',
         updated_at = now()
   WHERE id = p_order_id;

  RETURN v_new_balance;
END;
$$;

-- Mark a successful Stripe Checkout as spent. Repeated webhook deliveries are
-- harmless because a spent/none order is already in its terminal discount state.
CREATE OR REPLACE FUNCTION public.confirm_service_discount(
  p_order_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT trust_discount_status INTO v_status
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found: %', p_order_id USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'reserved' THEN
    UPDATE public.orders
       SET trust_discount_status = 'spent', updated_at = now()
     WHERE id = p_order_id;
    RETURN true;
  END IF;

  RETURN v_status IN ('none', 'spent');
END;
$$;

-- Return a reservation exactly once. A completed/spent discount is deliberately
-- not reversed here; post-payment refunds require a separate business rule.
CREATE OR REPLACE FUNCTION public.reverse_service_discount(
  p_order_id uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id uuid;
  v_tokens integer;
  v_status text;
BEGIN
  SELECT buyer_id, trust_discount_tokens, trust_discount_status
    INTO v_buyer_id, v_tokens, v_status
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found: %', p_order_id USING ERRCODE = 'P0001';
  END IF;

  IF v_status IN ('none', 'refunded') OR COALESCE(v_tokens, 0) <= 0 THEN
    RETURN true;
  END IF;

  IF v_status <> 'reserved' THEN
    RETURN false;
  END IF;

  -- issue_trust and this order update are in the same transaction. If either
  -- fails, neither the compensating ledger entry nor the state transition is
  -- committed, so a retried webhook can safely try again.
  PERFORM public.issue_trust(
    v_buyer_id,
    v_tokens,
    'service_discount_refund',
    p_order_id,
    COALESCE(NULLIF(trim(p_reason), ''), 'Service checkout discount reversed')
  );

  UPDATE public.orders
     SET trust_discount_status = 'refunded',
         trust_discount_refunded_at = now(),
         updated_at = now()
   WHERE id = p_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_service_discount(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_service_discount(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reverse_service_discount(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_service_discount(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_service_discount(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_service_discount(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
