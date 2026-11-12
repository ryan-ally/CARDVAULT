import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';

dotenv.config();
const app = express();
const port = Number(process.env.PORT) || 4242;
const stripeKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL?.replace(/\/+$/, '');

if (!stripeKey?.startsWith('sk_test_')) throw new Error('Set a valid Stripe test secret key');
if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase backend credentials');
if (!appUrl || !/^https?:\/\/[^/]+/.test(appUrl)) throw new Error('Missing or invalid APP_URL');
if (!webhookSecret) console.warn('STRIPE_WEBHOOK_SECRET is missing: payment confirmation will fail');

const stripe = new Stripe(stripeKey);
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const SHIPPING_CENTS = 599;

// IMPORTANT: webhook MUST receive the raw body, before express.json().
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!webhookSecret) { res.status(503).send('Webhook secret not configured'); return; }
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') { res.status(400).send('Missing Stripe signature'); return; }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    res.status(400).send('Invalid signature');
    return;
  }

  if (event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded') {
    res.json({ received: true, ignored: true });
    return;
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

    if (session.mode !== 'payment' || session.payment_status !== 'paid' ||
      session.currency?.toLowerCase() !== 'usd' ||
      !orderId || !paymentIntentId ||
      !Number.isSafeInteger(session.amount_total) || session.amount_total! < 1) {
      throw new Error(`Unverifiable paid session ${session.id}`);
    }

    // SQL RPC locks the order, checks total, deducts stock and marks paid
    // in one transaction. Repeated events return already_paid.
    const { data, error } = await supabase.rpc('complete_cardvault_stripe_order', {
      p_order_id: orderId,
      p_session_id: session.id,
      p_payment_intent_id: paymentIntentId,
      p_amount_cents: session.amount_total,
      p_event_id: event.id,
    });
    if (error) throw error;
    console.log('Stripe order result:', { orderId, result: data });
    res.json({ received: true });
  } catch (error) {
    // Return non-2xx so Stripe retries. Alert/resolve paid-but-out-of-stock
    // cases; never silently mark them fulfilled.
    console.error('ACTION REQUIRED: paid checkout could not be finalized:', event.id, error);
    res.status(500).send('Order processing failed');
  }
});

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'CardVault payments' }));

app.get('/market-price', async (req, res) => {
  try {
    const apiKey = process.env.TCGAPI_KEY;
    if (!apiKey) { res.status(500).json({ error: 'Market price API is not configured' }); return; }
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const setName = typeof req.query.set === 'string' ? req.query.set.trim() : '';
    const cardNumber = typeof req.query.number === 'string' ? req.query.number.trim() : '';
    if (query.length < 2) { res.status(400).json({ error: 'Enter at least two characters' }); return; }
    const params = new URLSearchParams({ q: query, game: 'pokemon', per_page: '20' });
    const response = await fetch(`https://api.tcgapi.dev/v1/search?${params}`, {
      headers: { 'X-API-Key': apiKey },
    });
    if (!response.ok) { res.status(502).json({ error: 'Market price lookup failed' }); return; }
    const result = await response.json() as {
      data?: Array<{
        id: number; name: string; set_name?: string; number?: string;
        rarity?: string; market_price?: number | null; market_price_as_of?: string | null;
        price_updated_at?: string | null; printing?: string; image_url?: string;
      }>
    };
    let matches = result.data ?? [];
    if (setName) matches = matches.filter(c => c.set_name?.toLowerCase() === setName.toLowerCase());
    if (cardNumber) matches = matches.filter(c => c.number?.toLowerCase() === cardNumber.toLowerCase());
    res.json({
      data: matches.map(c => ({
        id: c.id, name: c.name, setName: c.set_name ?? null,
        cardNumber: c.number ?? null, rarity: c.rarity ?? null,
        printing: c.printing ?? null, marketPrice: c.market_price ?? null,
        priceAsOf: c.market_price_as_of ?? c.price_updated_at ?? null,
        imageUrl: c.image_url ?? null,
      }))
    });
  } catch (error) {
    console.error('Market price error:', error);
    res.status(500).json({ error: 'Unable to retrieve market prices' });
  }
});

async function authenticate(authorization: string | undefined) {
  if (!authorization?.startsWith('Bearer ')) return null;
  const { data, error } = await supabase.auth.getUser(authorization.slice(7));
  return error ? null : data.user;
}

app.get('/inventory-test', async (req, res) => {
  try {
    const user = await authenticate(req.headers.authorization);
    if (!user) { res.status(401).json({ error: 'Please sign in before checking inventory' }); return; }
    const { data, error } = await supabase.from('inventory').select('id, name, price, quantity').limit(10);
    if (error) throw error;
    res.json({ connected: true, inventory: data });
  } catch (error) {
    console.error('Inventory connection error:', error);
    res.status(500).json({ error: 'Inventory connection failed' });
  }
});

type CartInput = { id: string; quantity: number };
type InventoryCard = {
  id: string; name: string; price: number | string; quantity: number; is_active: boolean;
  set_name: string; card_number: string; image: string; condition: string; category: string;
};

async function verifyCart(input: unknown) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 50) throw new Error('Invalid cart');
  const quantities = new Map<string, number>();
  for (const item of input as CartInput[]) {
    if (!item || typeof item.id !== 'string' || !item.id.trim() ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      throw new Error('Invalid cart item');
    }
    const next = (quantities.get(item.id) ?? 0) + item.quantity;
    if (next > 20) throw new Error('Quantity limit exceeded');
    quantities.set(item.id, next);
  }
  const { data, error } = await supabase.from('inventory')
    .select('id,name,price,quantity,is_active,set_name,card_number,image,condition,category')
    .in('id', [...quantities.keys()]);
  if (error) throw error;
  const cards = (data ?? []) as InventoryCard[];
  if (cards.length !== quantities.size) throw new Error('One or more cards are unavailable');
  let subtotalCents = 0;
  const lines = cards.map(card => {
    const quantity = quantities.get(card.id)!;
    if (card.is_active !== true || !Number.isInteger(card.quantity) || card.quantity < quantity) {
      throw new Error(`${card.name} is sold out or unavailable`);
    }
    const price = Number(card.price);
    const unitCents = Math.round(price * 100);
    if (!Number.isFinite(price) || !Number.isSafeInteger(unitCents) || unitCents <= 0) {
      throw new Error('Invalid inventory price');
    }
    subtotalCents += unitCents * quantity;
    return { card, quantity, unitCents };
  });
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents + SHIPPING_CENTS > 99999999) {
    throw new Error('Invalid payment total');
  }
  return { lines, subtotalCents };
}

// Kept for compatibility with your earlier native payment-intent test.
app.post('/create-payment-intent', async (req, res) => {
  try {
    const user = await authenticate(req.headers.authorization);
    if (!user) { res.status(401).json({ error: 'Please sign in before checkout' }); return; }
    const { subtotalCents } = await verifyCart(req.body?.items);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: subtotalCents + SHIPPING_CENTS, currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { customer_id: user.id, environment: 'test', flow: 'legacy_payment_intent' },
    });
    res.json({ clientSecret: paymentIntent.client_secret, totalCents: subtotalCents + SHIPPING_CENTS });
  } catch (error) {
    console.error('Payment intent error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to initialize payment' });
  }
});

app.post('/create-checkout-session', async (req, res) => {
  let pendingOrderId: string | null = null;
  let stripeSessionCreated = false;
  try {
    const user = await authenticate(req.headers.authorization);
    if (!user) { res.status(401).json({ error: 'Please sign in first' }); return; }
    const customer = req.body?.customer;
    if (!customer || typeof customer.name !== 'string' || !customer.name.trim() ||
      typeof customer.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) ||
      typeof customer.address !== 'string' || !customer.address.trim() ||
      typeof customer.city !== 'string' || !customer.city.trim() ||
      typeof customer.state !== 'string' || !/^[A-Za-z]{2}$/.test(customer.state.trim()) ||
      typeof customer.zip !== 'string' || !/^\d{5}(-\d{4})?$/.test(customer.zip.trim())) {
      res.status(400).json({ error: 'Invalid shipping details' }); return;
    }

    const { lines, subtotalCents } = await verifyCart(req.body?.items);
    const orderId = randomUUID();
    const orderNumber = `CV-${orderId.slice(0, 8).toUpperCase()}`;
    const totalCents = subtotalCents + SHIPPING_CENTS;

    const { error: orderError } = await supabase.from('orders').insert({
      id: orderId, user_id: user.id, order_number: orderNumber,
      customer_name: customer.name.trim(), email: customer.email.trim(),
      total: totalCents / 100, status: 'processing', payment_status: 'pending',
      shipping_address: customer.address.trim(), shipping_city: customer.city.trim(),
      shipping_state: customer.state.trim().toUpperCase(), shipping_postal_code: customer.zip.trim(),
    });
    if (orderError) throw orderError;
    pendingOrderId = orderId;

    const { error: itemsError } = await supabase.from('order_items').insert(
      lines.map(({ card, quantity, unitCents }) => ({
        order_id: orderId, product_id: card.id, name: card.name,
        set_name: card.set_name, card_number: card.card_number,
        price: unitCents / 100, quantity, image: card.image,
        condition: card.condition, category: card.category,
      }))
    );
    if (itemsError) throw itemsError;

    const session = await stripe.checkout.sessions.create({
mode:'payment',
      customer_email: customer.email.trim(),
      line_items: lines.map(({ card, quantity, unitCents }) => ({
        price_data: { currency: 'usd', product_data: { name: card.name }, unit_amount: unitCents },
        quantity,
      })),
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount', fixed_amount: { amount: SHIPPING_CENTS, currency: 'usd' },
          display_name: 'Standard shipping',
        }
      }],
      success_url: `${appUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout`,
      client_reference_id: user.id,
      metadata: { order_id: orderId, customer_id: user.id, environment: 'test' },
      payment_intent_data: { metadata: { order_id: orderId, customer_id: user.id, environment: 'test' } },
    }, { idempotencyKey: `cardvault-checkout-${orderId}` });
    stripeSessionCreated = true;
    if (!session.url) throw new Error('Stripe did not return a checkout URL');

    const { error: linkError } = await supabase.from('orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', orderId).eq('payment_status', 'pending');
    if (linkError) throw linkError;

    res.json({ url: session.url, orderId });
  } catch (error) {
    console.error('Checkout session error:', error);
    // Clean up only if no Stripe session was created. Once created,
    // leave pending records for reconciliation rather than deleting them.
    if (pendingOrderId && !stripeSessionCreated) {
      const { error: cleanupError } = await supabase.from('orders').delete()
        .eq('id', pendingOrderId).eq('payment_status', 'pending');
      if (cleanupError) console.error('Pending-order cleanup failed:', cleanupError);
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Could not start Stripe Checkout' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`CardVault payment server listening on port ${port}`);
});