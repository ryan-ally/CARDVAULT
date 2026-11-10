
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import Stripe from 'stripe';


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = Number(process.env.PORT) || 4242;
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY in backend/.env");
}

const stripe = new Stripe(secretKey);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "CardVault payments" });
});

app.post("/create-payment-intent", async (_req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 100,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(500).json({ error: "Unable to initialize payment" });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`CardVault payment server listening on port ${port}`);
});
