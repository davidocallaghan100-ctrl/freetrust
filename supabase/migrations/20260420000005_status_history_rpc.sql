-- Migration: 20260420000005_status_history_rpc.sql
-- RPC function to append a status change entry to orders.status_history.
-- Called by the orders PATCH API after every status transition.

CREATE OR REPLACE FUNCTION public.append_order_status_history(
  p_order_id uuid,
  p_status   text,
  p_actor_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status_history = status_history || jsonb_build_object(
    'status',    p_status,
    'timestamp', now()::text,
    'actor_id',  p_actor_id::text
  )::jsonb
  WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_order_status_history TO authenticated;
