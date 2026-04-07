
  # Gamified Productivity Web App

  This is a code bundle for Gamified Productivity Web App. The original project is available at https://www.figma.com/design/XdDOD1f3gol3DLV4nHgVT3/Gamified-Productivity-Web-App.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Stripe billing (4 tiers)

  This app supports 4 tiers: **Free**, **Starter**, **Pro**, **Elite** (Stripe subscriptions for the paid tiers).

  ### Required env vars

  Set these in `.env` (see `env.example`) or in your hosting provider:

  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_STARTER` (Stripe **Price ID** like `price_...`, not `$9.99`)
  - `STRIPE_PRICE_PRO` (Stripe **Price ID** like `price_...`, not `$9.99`)
  - `STRIPE_PRICE_ELITE` (Stripe **Price ID** like `price_...`, not `$19.99`)

  ### Endpoints

  - `POST /api/billing/checkout` — starts a Stripe Checkout session (requires auth)
  - `POST /api/billing/portal` — opens Stripe Billing Portal (requires auth)
  - `POST /api/billing/webhook` — Stripe webhook to sync subscription → user tier
  - `POST /api/billing/refresh` — manual sync (pulls subscription state from Stripe). Useful if webhooks aren’t configured yet.
  