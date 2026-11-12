-- CardVault: 30-minute Stripe Checkout reservations. Apply BEFORE deploying new server.
-- Existing paid/pending orders remain untouched. No reservations created retroactively.
BEGIN;
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inventory_reserved_quantity_check' AND conrelid='public.inventory'::regclass) THEN
  ALTER TABLE public.inventory ADD CONSTRAINT inventory_reserved_quantity_check
   CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity);
 END IF;
END $$;
ALTER TABLE public.orders
 ADD COLUMN IF NOT EXISTS reservation_state text,
 ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_reservation_state_check' AND conrelid='public.orders'::regclass) THEN
  ALTER TABLE public.orders ADD CONSTRAINT orders_reservation_state_check
   CHECK (reservation_state IS NULL OR reservation_state IN ('held','consumed','released'));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS orders_active_reservations_idx
 ON public.orders(reservation_expires_at)
 WHERE reservation_state='held';

-- One atomic DB transaction: lock products in deterministic order, snapshot prices,
-- reserve units, create pending order and order_items.
CREATE OR REPLACE FUNCTION public.reserve_cardvault_order(
 p_user_id uuid,
 p_items jsonb,
 p_customer_name text,
 p_email text,
 p_address text,
 p_city text,
 p_state text,
 p_zip text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_order_id uuid := gen_random_uuid();
 v_item jsonb;
 v_line record;
 v_card public.inventory%ROWTYPE;
 v_subtotal bigint := 0;
 v_cents bigint;
 v_total bigint;
 v_rows int := 0;
BEGIN
 IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user_id) THEN
  RAISE EXCEPTION 'Invalid authenticated customer';
 END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
   OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
  RAISE EXCEPTION 'Invalid cart';
 END IF;
 IF nullif(trim(p_customer_name),'') IS NULL OR length(p_customer_name)>200
  OR p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(p_email)>254
  OR nullif(trim(p_address),'') IS NULL OR length(p_address)>400
  OR nullif(trim(p_city),'') IS NULL OR length(p_city)>100
  OR p_state !~ '^[A-Za-z]{2}$'
  OR p_zip !~ '^\d{5}(-\d{4})?$' THEN
   RAISE EXCEPTION 'Invalid shipping information';
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(v_item) <> 'object'
    OR jsonb_typeof(v_item->'id') <> 'string'
    OR nullif(trim(v_item->>'id'),'') IS NULL
    OR length(v_item->>'id')>150
    OR jsonb_typeof(v_item->'quantity') <> 'number'
    OR (v_item->>'quantity') !~ '^[0-9]+$'
    OR (v_item->>'quantity')::numeric NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Invalid cart item';
  END IF;
 END LOOP;

 INSERT INTO public.orders (
  id,user_id,order_number,customer_name,email,total,status,payment_status,
  shipping_address,shipping_city,shipping_state,shipping_postal_code,
  reservation_state,reservation_expires_at
 ) VALUES (
  v_order_id,p_user_id,'CV-'||upper(substr(replace(v_order_id::text,'-',''),1,12)),
  trim(p_customer_name),trim(p_email),0,'processing','pending',
  trim(p_address),trim(p_city),upper(trim(p_state)),trim(p_zip),
  'held',now()+interval '32 minutes'
 );

 -- Sorting avoids deadlocks when two checkouts contain the same cards in different order.
 FOR v_line IN
  SELECT item->>'id' AS id, sum((item->>'quantity')::int)::int AS qty
  FROM jsonb_array_elements(p_items) item
  GROUP BY item->>'id' ORDER BY item->>'id'
 LOOP
  IF v_line.qty > 20 THEN RAISE EXCEPTION 'Quantity limit exceeded'; END IF;
  SELECT * INTO v_card FROM public.inventory
  WHERE id=v_line.id FOR UPDATE;
  IF NOT FOUND OR v_card.is_active IS DISTINCT FROM true
     OR v_card.quantity-v_card.reserved_quantity < v_line.qty THEN
   RAISE EXCEPTION 'Card unavailable: %', v_line.id;
  END IF;
  v_cents := round(v_card.price*100)::bigint;
  IF v_cents <= 0 OR v_cents > 99999999
     OR v_card.price <> round(v_card.price,2) THEN
   RAISE EXCEPTION 'Invalid card price: %',v_line.id;
  END IF;
  v_subtotal := v_subtotal + v_cents*v_line.qty;
  IF v_subtotal+599 > 99999999 THEN RAISE EXCEPTION 'Order total too large'; END IF;
  UPDATE public.inventory SET reserved_quantity=reserved_quantity+v_line.qty,
    updated_at=now() WHERE id=v_card.id;
  INSERT INTO public.order_items(
   order_id,product_id,name,set_name,card_number,price,quantity,image,condition,category
  ) VALUES (
   v_order_id,v_card.id,v_card.name,v_card.set_name,v_card.card_number,
   v_cents::numeric/100,v_line.qty,v_card.image,v_card.condition,v_card.category
  );
  v_rows := v_rows+1;
 END LOOP;
 IF v_rows=0 THEN RAISE EXCEPTION 'Empty order'; END IF;
 v_total := v_subtotal + 599; -- flat $5.99 shipping
 UPDATE public.orders SET total=v_total::numeric/100 WHERE id=v_order_id;
 RETURN jsonb_build_object('order_id',v_order_id,'total_cents',v_total);
END; $$;

-- Associate the Stripe Session with a held order. Webhook can call this too,
-- so fast webhooks don't race the original HTTP request.
CREATE OR REPLACE FUNCTION public.attach_cardvault_checkout_session(
 p_order_id uuid, p_session_id text, p_expires_at timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_order.reservation_state <> 'held' THEN
  RAISE EXCEPTION 'No active reservation for order';
 END IF;
 IF v_order.stripe_checkout_session_id IS NOT NULL
    AND v_order.stripe_checkout_session_id <> p_session_id THEN
  RAISE EXCEPTION 'Stripe session mismatch';
 END IF;
 UPDATE public.orders SET stripe_checkout_session_id=p_session_id,
  reservation_expires_at=p_expires_at WHERE id=p_order_id;
 RETURN 'attached';
END; $$;

-- Release exactly once: on Stripe-verified expiry/failed checkout,
-- or immediate create-session failure BEFORE a session exists.
CREATE OR REPLACE FUNCTION public.release_cardvault_reservation(
 p_order_id uuid, p_session_id text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_order public.orders%ROWTYPE; v_item record;
BEGIN
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF v_order.reservation_state='released' THEN RETURN 'already_released'; END IF;
 IF v_order.reservation_state='consumed' OR v_order.payment_status='paid' THEN
  RETURN 'already_paid';
 END IF;
 IF v_order.reservation_state <> 'held' OR v_order.payment_status <> 'pending' THEN
  RAISE EXCEPTION 'Order is not an active pending reservation';
 END IF;
 IF v_order.stripe_checkout_session_id IS NOT NULL THEN
  IF p_session_id IS DISTINCT FROM v_order.stripe_checkout_session_id THEN
   RAISE EXCEPTION 'Stripe session mismatch';
  END IF;
 ELSIF p_session_id IS NOT NULL THEN
  RAISE EXCEPTION 'Unlinked checkout cannot be released by session ID';
 END IF;
 FOR v_item IN
  SELECT product_id,sum(quantity)::int qty FROM public.order_items
  WHERE order_id=p_order_id GROUP BY product_id ORDER BY product_id
 LOOP
  UPDATE public.inventory SET reserved_quantity=reserved_quantity-v_item.qty,
   updated_at=now() WHERE id=v_item.product_id
   AND reserved_quantity>=v_item.qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation counter mismatch'; END IF;
 END LOOP;
 UPDATE public.orders SET reservation_state='released',payment_status='failed'
 WHERE id=p_order_id;
 RETURN 'released';
END; $$;

-- Replace the OLD completion routine. Previously it decremented quantity but
-- did not reduce reserved_quantity. This version does both, once, atomically.
CREATE OR REPLACE FUNCTION public.complete_cardvault_stripe_order(
 p_order_id uuid, p_session_id text, p_payment_intent_id text,
 p_amount_cents bigint,p_event_id text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_order public.orders%ROWTYPE; v_item record;
BEGIN
 SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF v_order.payment_status='paid' THEN
  IF v_order.stripe_checkout_session_id <> p_session_id
     OR v_order.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id THEN
   RAISE EXCEPTION 'Paid order Stripe identity mismatch';
  END IF;
  RETURN 'already_paid';
 END IF;
 IF v_order.reservation_state <> 'held' OR v_order.payment_status <> 'pending'
    OR v_order.stripe_checkout_session_id IS DISTINCT FROM p_session_id THEN
  RAISE EXCEPTION 'No matching held Stripe order: manual payment review required';
 END IF;
 IF p_payment_intent_id IS NULL OR p_payment_intent_id=''
    OR p_event_id IS NULL OR p_event_id='' OR p_amount_cents IS NULL
    OR round(v_order.total*100)::bigint <> p_amount_cents THEN
  RAISE EXCEPTION 'Invalid payment identity or amount';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=p_order_id) THEN
  RAISE EXCEPTION 'Order has no items';
 END IF;
 FOR v_item IN
  SELECT product_id,sum(quantity)::int qty FROM public.order_items
  WHERE order_id=p_order_id GROUP BY product_id ORDER BY product_id
 LOOP
  UPDATE public.inventory
  SET quantity=quantity-v_item.qty,
      reserved_quantity=reserved_quantity-v_item.qty,
      is_active=CASE WHEN quantity-v_item.qty=0 THEN false ELSE is_active END,
      updated_at=now()
  WHERE id=v_item.product_id AND reserved_quantity>=v_item.qty
        AND quantity>=v_item.qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserved inventory missing for %',v_item.product_id; END IF;
 END LOOP;
 UPDATE public.orders SET payment_status='paid',status='processing',
  reservation_state='consumed',stripe_payment_intent_id=p_payment_intent_id
 WHERE id=p_order_id;
 INSERT INTO public.stripe_events(event_id,event_type,checkout_session_id)
 VALUES(p_event_id,'checkout.session.completed',p_session_id)
 ON CONFLICT(event_id) DO NOTHING;
 RETURN 'completed';
END; $$;

-- Lock down financial operations to backend service role.
REVOKE ALL ON FUNCTION public.reserve_cardvault_order(uuid,jsonb,text,text,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.attach_cardvault_checkout_session(uuid,text,timestamptz)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_cardvault_reservation(uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_cardvault_stripe_order(uuid,text,text,bigint,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_cardvault_order(uuid,jsonb,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_cardvault_checkout_session(uuid,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_cardvault_reservation(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_cardvault_stripe_order(uuid,text,text,bigint,text) TO service_role;

-- Ensure old paid orders aren't backfilled as holds:
-- SELECT id, reservation_state FROM public.orders ORDER BY created_at DESC LIMIT 20;

COMMIT;
