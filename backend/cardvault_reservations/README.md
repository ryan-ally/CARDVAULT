# CardVault — 30-minute Checkout stock reservations

## Deployment order (important)

**Keep Stripe in TEST mode. Back up database and backend file first.** This package has been aligned to the supplied Supabase schema, but has NOT been executed against your production database or Render backend. Test on staging before taking real payments.

1. In Supabase SQL Editor run `01_reservations.sql` **before** deploying the backend. This adds `orders.reservation_state` and `orders.reservation_expires_at`, retains the already-added `inventory.reserved_quantity`, creates atomic reservation/attach/release routines and **replaces the existing `complete_cardvault_stripe_order`** routine. Earlier orders remain unchanged and do not receive retroactive holds.
2. Back up and replace `backend/server.ts` with the included `server.ts`, then deploy to Render. Retain Render's `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, and optionally `TCGAPI_KEY`.
3. Stripe destination in the **same sandbox** as Render's secret key: subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and **`checkout.session.expired`**. Set `STRIPE_WEBHOOK_SECRET` in Render to this destination's `whsec_...`, NOT a Mac CLI signing secret.
4. Create a random scheduler secret locally with `openssl rand -hex 32`. In Render Environment set `RESERVATION_CRON_SECRET` to this value. In Supabase Dashboard > Vault, add the secrets named `cardvault_backend_url` (value: `https://cardvault-3-n36q.onrender.com`) and `cardvault_cron_secret` (same random secret). Do not commit it. Run `02_schedule_reconciliation.sql`. Supabase Cron invokes the HTTPS backend every two minutes. If your Render instance sleeps, some runs may be delayed; monitor cron results and use always-on hosting for real payments.
5. Existing Checkout page can remain as-is: it POSTs `items` and `customer` to `/create-checkout-session`. Stock validation and prices are trusted **only from the database**. $5.99 shipping stays the same. Do not use the legacy `/create-payment-intent` flow; it is disabled (410).
6. On the public product listing and Sell page, use `quantity - reserved_quantity` when reporting **currently available** units; don't display a reserved card as available. RLS still governs seller editing; inventory CHECK constraint prevents lowering stock below holds.

## 30-minute lifecycle

- `reserve_cardvault_order`: Postgres row-locks cards, checks available stock and snapshots price, creates order + line items, increments `reserved_quantity` atomically. A 32-minute provisional expiry covers the seconds required to create a Stripe session.
- The hosted Stripe Checkout Session is set to **30 minutes** from session creation (`expires_at`). `attach_cardvault_checkout_session` records the Stripe expiry on the order.
- `checkout.session.completed` with `payment_status=paid` (or `async_payment_succeeded`) completes the order: `quantity -= purchased`, `reserved_quantity -= purchased`, status `paid/processing`, atomically, **once**.
- `checkout.session.expired` (or `async_payment_failed`) releases the held reservation and sets payment status to `failed` once.
- Cron rechecks overdue Stripe Sessions via the Stripe API to recover from lost webhook deliveries. It will expire an overdue open Session **at Stripe first** and only then release DB inventory. Unlinked session records are logged for manual investigation; they are **never blindly released** because a timed-out Stripe create call may have actually succeeded.

## Launch tests (use test cards, without actual shipping)

- Card with 1 available unit: customer A starts Checkout; customer B cannot reserve the same unit.
- Stripe test payment succeeds: `orders.payment_status='paid'`, `reservation_state='consumed'`, `quantity` and `reserved_quantity` each decrease by 1. Duplicate webhook should return HTTP 200 with no additional deduction.
- Abandon a 30-minute Checkout: Stripe sends `checkout.session.expired`; order is `failed/released` and `reserved_quantity` returns to 0. Cron is a fallback and should also be tested by temporary webhook delivery disruption.
- Failed or delayed payment: verify no premature stock release. Test Stripe events from **same account** as Render.
- Confirm working customer Orders, Seller Dashboard shipping/email functions, market-price endpoint, Supabase seller listing edits, and Render `/health` endpoint after deployment.

## Monitor / recover

`SELECT order_number,payment_status,reservation_state,reservation_expires_at,stripe_checkout_session_id FROM public.orders ORDER BY created_at DESC LIMIT 25;`

`SELECT id,name,quantity,reserved_quantity,quantity-reserved_quantity AS available FROM public.inventory ORDER BY created_at DESC LIMIT 25;`

Never mark a Stripe order paid manually or release a linked reservation without first checking the **same Stripe account** for its actual Checkout Session state. Paid-but-unfulfillable sessions require manual review/refund. The three older pending orders (CV-05486F09, CV-44AF2319, CV-619D198F) are deliberately not changed by this migration.

## Important security limits

- SQL RPC functions are restricted to `service_role`. Keep Supabase service-role and Stripe secret keys **server-side only**.
- `owner_id` RLS and table/column grants must still be enforced independently for customers and sellers. Do not grant client access to these reservation RPCs.
- The database schema constraint `reserved_quantity <= quantity` stops a seller from lowering stock below holds, but a seller can change prices or make a listing inactive while an existing hold exists. The held purchase uses the **price snapshot**, and completion is allowed for the held unit.
- If the Stripe Session create call times out ambiguously before the session ID is saved, the order remains held and is **flagged for manual review**, instead of risking a paid-but-released order. This is an intentional fail-safe; a production system should add operational alerting.
- The scheduler endpoint is authenticated by `RESERVATION_CRON_SECRET`; use an unguessable value, don't expose it to the browser.
