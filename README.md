# ProofPay
**AI that negotiates the deal, holds the money, and verifies the work.**

Built for the **PayPal AI Hackathon 2026**.

Freelancers and small clients don't trust each other: clients fear paying upfront, freelancers fear not getting paid, and loosely agreed terms end in "that's not what we agreed." ProofPay fixes the whole deal lifecycle:

1. **AI Deal Room** – the freelancer's AI agent negotiates price, scope, deadline and milestones with the client, within the freelancer's **private limits** (floor price enforced in code, never revealed).
2. **AI contract** – the agreed conversation becomes a milestone contract with **objective, machine-checkable acceptance criteria**.
3. **PayPal escrow** – the client funds each milestone. PayPal **authorizes and holds** the money (Orders v2, `intent: AUTHORIZE`).
4. **AI verification** – the freelancer submits a GitHub repo, a live URL or text. The AI checks each criterion against real evidence (file tree, source files, live page).
   - All pass → **PayPal capture** → money released to the freelancer.
   - Gaps → detailed gap report, freelancer fixes and resubmits.
   - Deal cancelled → **PayPal void**, client never charged.
5. **AG Grid dashboard** – every milestone, amount held/released, AI score, attempts and PayPal IDs.

---

## How PayPal is used
| Step | PayPal API |
|---|---|
| Fund milestone | `POST /v2/checkout/orders` (intent `AUTHORIZE`, `payee` = freelancer) + PayPal JS SDK buttons |
| Hold funds (escrow) | `POST /v2/checkout/orders/{id}/authorize` |
| Release after AI approval | `POST /v2/payments/authorizations/{id}/capture` |
| Cancel deal | `POST /v2/payments/authorizations/{id}/void` |
| Keep state in sync | Webhooks `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.AUTHORIZATION.VOIDED` with signature verification (`/v1/notifications/verify-webhook-signature`) |

## How AI is used
| Feature | What the AI decides | Guardrails |
|---|---|---|
| Negotiation agent | Next message + updated offer | Floor price, min deadline enforced in code. Floor never leaked in chat |
| Contract generator | Milestones, split, due dates, acceptance criteria | Amounts always sum exactly to the agreed price |
| Work verifier | Pass/fail per criterion with cited evidence | All criteria must pass to release money. Prompt-injection inside evidence ignored |

AI: **Google Gemini** (JSON mode, validated with zod, one retry). Without a key, a rule-based fallback runs so the app still works locally.

## Currency
All prices are in **Indian rupees (₹)**. Since April 2021 PayPal doesn't process domestic INR payments in India; Indian accounts send and receive international payments in USD. ProofPay therefore shows and stores amounts in INR and converts to USD when it creates the PayPal order (`INR_PER_USD`, default 88; update it to the current rate). If both sandbox accounts are registered in India you can set `PAYPAL_CURRENCY=INR` to skip the conversion.

## Tech stack
Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · PayPal Orders v2 + JS SDK · Gemini API · AG Grid · zod · JSON-file datastore · Render

---

## Run locally
```bash
git clone <this repo> && cd proofpay
npm install
cp .env.example .env      # optional: add keys (see below)
npm run dev               # http://localhost:3000
```
With no keys it runs in local mode (simulated PayPal, rule-based fallback for the AI). The sidebar shows which mode is active.

### Add real keys
1. **PayPal sandbox** – https://developer.paypal.com/dashboard/applications/sandbox → create app → copy Client ID & Secret into `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`.
   Under **Sandbox → Accounts** you have a Personal (buyer) and Business account. Put the **business** email in *Agent Settings → PayPal email* (or `DEMO_FREELANCER_PAYPAL_EMAIL`) so captures are paid to it.
2. **Gemini** – https://aistudio.google.com/apikey → `GEMINI_API_KEY`.
3. *(Optional)* **Webhooks** – in your PayPal app add webhook `https://<your-domain>/api/webhooks/paypal`, subscribe to Payment authorization + capture events, put its ID in `PAYPAL_WEBHOOK_ID`.
4. *(Optional)* `GITHUB_TOKEN` raises the GitHub API rate limit for the verifier.

Reset demo data any time: **Reset demo** link on the home page, or `npm run seed`.

## Deploy (Render)
1. Push to GitHub → Render → **New → Blueprint** → pick the repo (uses `render.yaml`).
2. Fill the secret env vars. Health check: `/api/health`.
> The free tier has an ephemeral disk, so demo data resets on redeploy (it re-seeds automatically).

---

## Judge walkthrough (2 minutes)
> Use the account switcher in the sidebar (**Demo accounts**) to act as the client or the freelancer.

1. Open the app. You're signed in as **Riya (client)**. Go to **Deals** and open *"Landing page for my home-baking business"*.
2. Negotiate: try `Can you do it for ₹12,000?` → `16k is my max` → `ok 18500`. The agent concedes slowly and never goes below Arjun's floor (₹15,000).
3. Click **Accept terms** → the AI drafts the milestone contract with acceptance criteria.
4. Fund milestone 1 with PayPal (sandbox buyer login) → status **In escrow**.
5. Switch to **Arjun (freelancer)** under **Demo accounts** in the sidebar → submit work:
   - weak text like `Made the hero section only` → gap report, money stays held
   - a real repo/URL meeting the criteria → review passed → **captured and paid**
6. As Riya, fund milestone 2, then **Cancel and release hold** → PayPal void.
7. Open **Payments** for the AG Grid escrow view. As Arjun, open **Agent settings** for the private limits.

**PayPal sandbox test buyer:** use the Personal sandbox account from your PayPal developer dashboard (Sandbox → Accounts).

## Project structure
```
src/app/api/                 REST endpoints (thin handlers, validation with zod)
src/lib/services/deals.ts    Negotiation and contract creation
src/lib/services/milestones.ts  Escrow state machine: fund, authorize, submit, capture, void
src/lib/services/webhooks.ts PayPal webhook handling
src/lib/paypal.ts            PayPal Orders v2 client
src/lib/ai/negotiate.ts      Negotiation agent and server-side limits
src/lib/ai/contract.ts       Agreed terms → milestone contract
src/lib/ai/verify.ts         Evidence collection (GitHub / URL / text) and review
src/lib/llm.ts               Gemini client with schema validation
src/lib/db.ts                Datastore (JSON file, swap for Postgres)
src/app/                     Pages
src/components/              UI components (deal room, milestone card, AG Grid table)
```

## Roadmap
Payouts API for tips/bonuses · re-authorization for long milestones · multi-freelancer marketplace · AI-mediated disputes using the PayPal Disputes API.

## License
MIT
