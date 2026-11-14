
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4242;

const stripeKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl =
  process.env.APP_URL?.replace(/\/+$/, '');
const cronSecret =
  process.env.RESERVATION_CRON_SECRET;

if (!stripeKey?.startsWith('sk_test_')) {
  throw new Error('Missing Stripe TEST secret key');
}

if (!webhookSecret?.startsWith('whsec_')) {
  throw new Error(
    'Missing hosted STRIPE_WEBHOOK_SECRET'
  );
}

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase backend credentials'
  );
}

if (!appUrl || !/^https?:\/\/[^/]+$/.test(appUrl)) {
  throw new Error('Invalid APP_URL');
}

const stripe = new Stripe(stripeKey);

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const SHIPPING_CENTS = 599;
const RESERVATION_SECONDS = 30 * 60;

type LineItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
};

type Customer = {
  name?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
};

async function authenticate(
  header: string | undefined
) {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  const { data, error } =
    await supabase.auth.getUser(header.slice(7));

  return error ? null : data.user;
}

async function rpcRequired<T = unknown>(
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  const { data, error } =
    await supabase.rpc(name, args);

  if (error) {
    throw new Error(`${name}: ${error.message}`);
  }

  return data as T;
}

// Attach Stripe session to reserved order
async function attach(
  session: Stripe.Checkout.Session,
  orderId: string
) {
  await rpcRequired(
    'attach_cardvault_checkout_session',
    {
      p_order_id: orderId,
      p_session_id: session.id,
      p_expires_at: new Date(
        session.expires_at * 1000
      ).toISOString(),
    }
  );
}

// Complete a successfully paid reservation
async function completePaidSession(
  session: Stripe.Checkout.Session,
  eventId: string
) {
  const orderId = session.metadata?.order_id;

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

  if (
    session.mode !== 'payment' ||
    session.payment_status !== 'paid' ||
    session.currency?.toLowerCase() !== 'usd' ||
    !orderId ||
    !paymentIntentId ||
    !Number.isSafeInteger(session.amount_total) ||
    !session.amount_total ||
    session.amount_total < SHIPPING_CENTS
  ) {
    throw new Error(
      `Invalid paid Stripe session ${session.id}`
    );
  }

  const { data: order, error: orderError } =
    await supabase
      .from('orders')
      .select(
        'reservation_state,stripe_checkout_session_id,payment_status'
      )
      .eq('id', orderId)
      .single();

  if (orderError) throw orderError;

  if (
    order.reservation_state === 'held' &&
    !order.stripe_checkout_session_id
  ) {
    await attach(session, orderId);
  }

  const result = await rpcRequired<string>(
    'complete_cardvault_stripe_order',
    {
      p_order_id: orderId,
      p_session_id: session.id,
      p_payment_intent_id: paymentIntentId,
      p_amount_cents: session.amount_total,
      p_event_id: eventId,
    }
  );

  console.log(
    'CardVault paid order:',
    orderId,
    result
  );
}

// Release stock for expired or failed checkout
async function releaseStripeSession(
  session: Stripe.Checkout.Session
) {
  const orderId = session.metadata?.order_id;

  if (!orderId) {
    throw new Error(
      `Missing order metadata: ${session.id}`
    );
  }

  if (session.payment_status === 'paid') {
    throw new Error(
      'Cannot release a paid Checkout session'
    );
  }

  const { data: existing, error } =
    await supabase
      .from('orders')
      .select(
        'reservation_state,stripe_checkout_session_id'
      )
      .eq('id', orderId)
      .single();

  if (error) throw error;

  if (
    existing.reservation_state === 'held' &&
    !existing.stripe_checkout_session_id
  ) {
    await attach(session, orderId);
  }

  const result = await rpcRequired<string>(
    'release_cardvault_reservation',
    {
      p_order_id: orderId,
      p_session_id: session.id,
    }
  );

  console.log(
    'CardVault reservation released:',
    orderId,
    result
  );
}

// ==========================================
// STRIPE WEBHOOK
// Must be before express.json middleware.
// ==========================================

app.post(
  '/stripe-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.header(
      'stripe-signature'
    );

    if (!signature) {
      res.status(400).send(
        'Missing Stripe signature'
      );
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (error) {
      console.error(
        'Invalid webhook signature:',
        error
      );

      res.status(400).send(
        'Invalid webhook signature'
      );
      return;
    }

    try {
      if (
        event.type ===
        'checkout.session.completed' ||
        event.type ===
        'checkout.session.async_payment_succeeded'
      ) {
        const session =
          event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === 'paid') {
          await completePaidSession(
            session,
            event.id
          );
        } else {
          console.log(
            'Checkout awaiting payment:',
            session.id
          );
        }
      } else if (
        event.type === 'checkout.session.expired'
      ) {
        await releaseStripeSession(
          event.data.object as Stripe.Checkout.Session
        );
      } else if (
        event.type ===
        'checkout.session.async_payment_failed'
      ) {
        const session =
          event.data.object as Stripe.Checkout.Session;

        if (session.payment_status !== 'paid') {
          await releaseStripeSession(session);
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error(
        'ACTION REQUIRED: Stripe webhook failed:',
        event.id,
        error
      );

      // Stripe should retry failed processing.
      res.status(500).send(
        'Webhook processing failed'
      );
    }
  }
);

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CardVault payments',
  });
});

// ==========================================
// MARKET PRICE LOOKUP
// ==========================================

app.get('/market-price', async (req, res) => {
  try {
    const apiKey = process.env.TCGAPI_KEY;

    if (!apiKey) {
      res.status(500).json({
        error: 'Market price API is not configured',
      });
      return;
    }

    const query =
      typeof req.query.q === 'string'
        ? req.query.q.trim()
        : '';

    const setName =
      typeof req.query.set === 'string'
        ? req.query.set.trim()
        : '';

    const number =
      typeof req.query.number === 'string'
        ? req.query.number.trim()
        : '';

    if (query.length < 2) {
      res.status(400).json({
        error: 'Enter at least two characters',
      });
      return;
    }

    const params = new URLSearchParams({
      q: query,
      game: 'pokemon',
      per_page: '20',
    });

    const response = await fetch(
      `https://api.tcgapi.dev/v1/search?${params}`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    if (!response.ok) {
      res.status(502).json({
        error: 'Market price lookup failed',
      });
      return;
    }

    const result = (await response.json()) as {
      data?: {
        id: number;
        name: string;
        set_name?: string;
        number?: string;
        rarity?: string;
        market_price?: number | null;
        market_price_as_of?: string;
        price_updated_at?: string;
        printing?: string;
        image_url?: string;
      }[];
    };

    let matches = result.data ?? [];

    if (setName) {
      matches = matches.filter(
        card =>
          card.set_name?.toLowerCase() ===
          setName.toLowerCase()
      );
    }

    if (number) {
      matches = matches.filter(
        card =>
          card.number?.toLowerCase() ===
          number.toLowerCase()
      );
    }

    res.json({
      data: matches.map(card => ({
        id: card.id,
        name: card.name,
        setName: card.set_name ?? null,
        cardNumber: card.number ?? null,
        rarity: card.rarity ?? null,
        printing: card.printing ?? null,
        marketPrice:
          card.market_price ?? null,
        priceAsOf:
          card.market_price_as_of ??
          card.price_updated_at ??
          null,
        imageUrl:
          card.image_url ?? null,
      })),
    });
  } catch (error) {
    console.error(
      'Market price lookup failed:',
      error
    );

    res.status(500).json({
      error: 'Unable to retrieve market prices',
    });
  }
});

// ==========================================
// INVENTORY CONNECTION TEST
// ==========================================

app.get('/inventory-test', async (req, res) => {
  try {
    const user = await authenticate(
      req.headers.authorization
    );

    if (!user) {
      res.status(401).json({
        error: 'Sign in required',
      });
      return;
    }

    const { data, error } = await supabase
      .from('inventory')
      .select(
        'id,name,price,quantity,reserved_quantity'
      )
      .limit(10);

    if (error) throw error;

    res.json({
      connected: true,
      inventory: data,
    });
  } catch (error) {
    console.error(
      'Inventory test failed:',
      error
    );

    res.status(500).json({
      error: 'Inventory test failed',
    });
  }
});

// ==========================================
// DISABLE LEGACY PAYMENT INTENTS
// ==========================================

// Older payment-intent checkout does not
// reserve stock. Use hosted Stripe Checkout.

app.post(
  '/create-payment-intent',
  (_req, res) => {
    res.status(410).json({
      error:
        'Use /create-checkout-session for reserved CardVault orders',
    });
  }
);

// ==========================================
// CREATE STRIPE CHECKOUT SESSION
// ==========================================

app.post(
  '/create-checkout-session',
  async (req, res) => {
    let orderId: string | undefined;
    let startedStripeCreation = false;

    try {
      const user = await authenticate(
        req.headers.authorization
      );

      if (!user) {
        res.status(401).json({
          error: 'Sign in before checkout',
        });
        return;
      }

      const customer =
        (req.body?.customer ?? {}) as Customer;

      if (
        !customer.name?.trim() ||
        !customer.email?.trim() ||
        !customer.address?.trim() ||
        !customer.city?.trim() ||
        !customer.state?.trim() ||
        !customer.zip?.trim()
      ) {
        res.status(400).json({
          error: 'Complete shipping details',
        });
        return;
      }

      // Supabase atomically checks stock,
      // reserves inventory, and creates
      // a pending order and its items.

      const held = await rpcRequired<{
        order_id: string;
        total_cents: number;
      }>(
        'reserve_cardvault_order',
        {
          p_user_id: user.id,
          p_items: req.body.items,
          p_customer_name: customer.name,
          p_email: customer.email,
          p_address: customer.address,
          p_city: customer.city,
          p_state: customer.state,
          p_zip: customer.zip,
        }
      );

      orderId = held.order_id;

      const { data: lines, error: linesError } =
        await supabase
          .from('order_items')
          .select(
            'product_id,name,price,quantity'
          )
          .eq('order_id', orderId);

      if (linesError) throw linesError;

      const items =
        (lines ?? []) as LineItem[];

      if (!items.length) {
        throw new Error(
          'Reserved order has no items'
        );
      }

      // Stripe prices use trusted
      // database snapshots, not cart prices.

      const lineItems:
        Stripe.Checkout.SessionCreateParams.LineItem[] =
        items.map(line => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: line.name,
            },
            unit_amount: Math.round(
              Number(line.price) * 100
            ),
          },
          quantity: line.quantity,
        }));

      const expectedTotal = items.reduce(
        (sum, item) =>
          sum +
          Math.round(Number(item.price) * 100) *
          item.quantity,
        SHIPPING_CENTS
      );

      if (
        expectedTotal !==
        Number(held.total_cents)
      ) {
        throw new Error(
          'Order total does not match database snapshot'
        );
      }

      // Stripe requires the expiration
      // to be at least 30 minutes ahead.
      // Small buffer avoids request latency
      // making the expiry too early.
      const expiresAt =
        Math.floor(Date.now() / 1000) +
        RESERVATION_SECONDS +
        60;

      startedStripeCreation = true;

      const stripeSession =
        await stripe.checkout.sessions.create(
          {
            mode: 'payment',

            customer_email:
              customer.email.trim(),

            line_items: lineItems,

            expires_at: expiresAt,

            shipping_options: [
              {
                shipping_rate_data: {
                  type: 'fixed_amount',
                  fixed_amount: {
                    amount: SHIPPING_CENTS,
                    currency: 'usd',
                  },
                  display_name:
                    'Standard shipping',
                },
              },
            ],

            success_url:
              `${appUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,

            cancel_url:
              `${appUrl}/checkout`,

            client_reference_id:
              user.id,

            metadata: {
              order_id: orderId,
              customer_id: user.id,
              environment: 'test',
            },

            payment_intent_data: {
              metadata: {
                order_id: orderId,
                customer_id: user.id,
                environment: 'test',
              },
            },
          },
          {
            idempotencyKey:
              `cv-reservation-${orderId}`,
          }
        );

      if (!stripeSession.url) {
        throw new Error(
          'Stripe did not return a checkout URL'
        );
      }

      await attach(
        stripeSession,
        orderId
      );

      res.json({
        url: stripeSession.url,
        orderId,
        expiresAt:
          stripeSession.expires_at,
      });
    } catch (error) {
      console.error(
        'Create checkout failed:',
        { orderId, error }
      );

      // Release only if Stripe session
      // creation was never attempted.
      // A network timeout could mean
      // Stripe created a session.

      if (
        orderId &&
        !startedStripeCreation
      ) {
        try {
          await rpcRequired(
            'release_cardvault_reservation',
            {
              p_order_id: orderId,
              p_session_id: null,
            }
          );
        } catch (releaseError) {
          console.error(
            'Reservation cleanup failed:',
            releaseError
          );
        }
      }

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to start checkout',
      });
    }
  }
);

// ==========================================
// SECURE CRON AUTHENTICATION
// ==========================================

function secretMatches(
  actual: string | undefined,
  expected: string
) {
  if (!actual) return false;

  const a = Buffer.from(actual);
  const b = Buffer.from(expected);

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

// ==========================================
// RECONCILE EXPIRED RESERVATIONS
// ==========================================

app.post(
  '/internal/reconcile-reservations',
  async (req, res) => {
    if (
      !cronSecret ||
      !secretMatches(
        req.header('x-cron-secret'),
        cronSecret
      )
    ) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    try {
      const { data, error } =
        await supabase
          .from('orders')
          .select(
            'id,stripe_checkout_session_id,reservation_expires_at'
          )
          .eq('reservation_state', 'held')
          .lt(
            'reservation_expires_at',
            new Date().toISOString()
          )
          .order(
            'reservation_expires_at',
            { ascending: true }
          )
          .limit(40);

      if (error) throw error;

      const results: {
        order: string;
        result: string;
      }[] = [];

      for (const order of data ?? []) {
        try {
          if (
            !order.stripe_checkout_session_id
          ) {
            console.error(
              'ACTION REQUIRED: unlinked reservation',
              order.id
            );

            results.push({
              order: order.id,
              result: 'manual_review_unlinked',
            });

            continue;
          }

          let stripeSession =
            await stripe.checkout.sessions.retrieve(
              order.stripe_checkout_session_id
            );

          if (
            stripeSession.payment_status === 'paid'
          ) {
            await completePaidSession(
              stripeSession,
              `reconcile-${stripeSession.id}`
            );

            results.push({
              order: order.id,
              result: 'paid_finalized',
            });
          } else if (
            stripeSession.status === 'expired'
          ) {
            await releaseStripeSession(
              stripeSession
            );

            results.push({
              order: order.id,
              result: 'released',
            });
          } else if (
            stripeSession.status === 'open' &&
            stripeSession.expires_at <=
            Math.floor(Date.now() / 1000)
          ) {
            // Expire in Stripe first,
            // then release database stock.

            stripeSession =
              await stripe.checkout.sessions.expire(
                stripeSession.id
              );

            await releaseStripeSession(
              stripeSession
            );

            results.push({
              order: order.id,
              result: 'expired_and_released',
            });
          } else {
            results.push({
              order: order.id,
              result:
                'awaiting_payment_or_expiry',
            });
          }
        } catch (error) {
          console.error(
            'ACTION REQUIRED: reconciliation error',
            order.id,
            error
          );

          results.push({
            order: order.id,
            result: 'error_manual_review',
          });
        }
      }

      res.json({
        checked: results.length,
        results,
      });
    } catch (error) {
      console.error(
        'Reservation reconciliation failed:',
        error
      );

      res.status(500).json({
        error: 'Reconciliation failed',
      });
    }
  }
);

// ==========================================
// START CARDVAULT BACKEND
// ==========================================

app.listen(port, '0.0.0.0', () => {
  console.log(
    `CardVault payment server listening on port ${port}`
  );
});