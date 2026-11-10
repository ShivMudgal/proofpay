# ProofPay
**AI that negotiates the deal, holds the money, and verifies the work.**

Built for the **PayPal AI Hackathon 2026**.

**Live demo: https://proofpay-no0a.onrender.com**

> It runs on Render's free tier, so the first request after a quiet spell can take **about 50 seconds** while the server wakes up. After that it's fast.
> No sign-up needed: use the **Demo accounts** switcher in the sidebar to act as the client (Riya) or the freelancer (Arjun).

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
Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · PayPal Orders v2 + JS SDK · Gemini API · AG Grid · zod · Neon Postgres · Render

## Data storage
With `DATABASE_URL` set, ProofPay stores its data in **Neon Postgres**. The app state is one JSONB document in the `proofpay_state` table. The table is created and seeded automatically on first start. Every write runs in a transaction that locks that row (`SELECT … FOR UPDATE`), so concurrent requests and multiple instances can't overwrite each other, and data survives redeploys. Without `DATABASE_URL`, the app falls back to a local `data/db.json` file so it still runs with no setup. The sidebar and `/api/health` show which one is in use.

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
5. *(Optional)* **Neon Postgres**: create a project at https://console.neon.tech and put its pooled connection string in `DATABASE_URL`.

Reset demo data any time with the **Reset demo data** link on the home page. A reset keeps the two demo accounts and Arjun's agent settings, and restores the two showcase deals (see below). The link and `POST /api/reset` only work when `ENABLE_DEMO_RESET=true`. It's on in `.env.example` for local use and off on the live site, where the link is hidden and the API returns 403. Without a database, `npm run seed` also resets the local file.

### Showcase deals
Every fresh database includes two ready-made deals, so there's something to explore right away:
- **Portfolio website for a wedding photographer**: agreed at ₹32,000, contract with 2 unfunded milestones and checkable acceptance criteria. Fund it with PayPal to start the escrow flow.
- **Social media launch kit for a cafe**: still negotiating, with the agent's offer of ₹18,500 on the table. Reply to keep haggling.

To add them to an existing database without touching anything else, run:
```bash
npm run showcase
```
It uses `DATABASE_URL` from `.env` (or `data/db.json` without it), only adds deals that aren't there yet, and is safe to run again. The showcase data has no PayPal IDs: every order, authorization and capture ID in the app comes from a real sandbox call.

### Reliability
- **AI calls** time out after 12 s per attempt and 20 s in total (`AI_ATTEMPT_TIMEOUT_MS`, `AI_TOTAL_TIMEOUT_MS`), then fall back to the rule engine, so negotiation, contract drafting and review never hang.
- **Expired PayPal holds**: authorizations expire after a few days. If a capture fails because the hold expired or is no longer valid, ProofPay voids what's left, resets the milestone to unfunded, logs "Hold expired, please fund again" in its timeline and shows a notice instead of an error. Cancelling an expired hold also succeeds. In local mode, an authorization ID containing `EXPIRED` simulates this.
- **API errors** are always JSON `{ "error": "..." }` with a fitting status: 400 bad input, 403 not allowed, 422/502 PayPal problems, 504 timeouts.

## Deploy (Render)
1. Push to GitHub → Render → **New → Blueprint** → pick the repo (uses `render.yaml`).
2. Fill the secret env vars. Health check: `/api/health`.
> Set `DATABASE_URL` so data is kept in Neon across redeploys. Without it, the free tier's ephemeral disk resets the demo data on every redeploy.

---

## Judge walkthrough (about 3 minutes)
**Open the live app: https://proofpay-no0a.onrender.com** (allow about 50 seconds for the first load while the free-tier server wakes up).

> **Demo accounts:** there's no sign-up. Use the **Demo accounts** switcher at the bottom of the sidebar to act as **Riya (client)** or **Arjun (freelancer)** and try both sides of a deal. You start as Riya.

The live app has three sample deals, one at each stage:

| Deal | Stage | What to try |
|---|---|---|
| **Landing page for Riya's Bakes** | Completed | The full story: negotiation, AI contract, both milestones funded through PayPal, work verified by AI, payment captured. Open it to see the timeline and the real sandbox order, authorization and capture IDs. |
| **Portfolio website for a wedding photographer** | Active contract | Agreed at ₹32,000 with 2 unfunded milestones. Fund one with PayPal and run the escrow flow yourself. |
| **Social media launch kit for a cafe** | Negotiating | The agent has offered ₹18,500. Reply in the chat to keep haggling. |

1. **See a finished deal.** On **Overview**, open *Landing page for Riya's Bakes*. Expand **Activity** on each milestone to see money held, then released, with PayPal IDs.
2. **Negotiate.** Open *Social media launch kit for a cafe* and reply, for example `Can you do it for ₹14,000?`, then `ok 17000`. The agent concedes step by step and never goes below Arjun's private floor (₹15,000). Click **Accept terms** when you're happy, and the AI drafts a milestone contract with acceptance criteria.
3. **Fund with PayPal.** Open *Portfolio website for a wedding photographer*, click the PayPal button on milestone 1 and log in with the sandbox buyer below. The milestone moves to **In escrow**: the money is authorized and held, not charged.
4. **Submit work as the freelancer.** Switch to **Arjun** under **Demo accounts** and submit work on the funded milestone:
   - weak text like `Made the homepage only` → gap report, the money stays held
   - a real repo or live URL that meets the criteria → review passed → **captured and paid**
5. **Cancel a hold.** As Riya, fund milestone 2, then click **Cancel and release hold** → PayPal voids the authorization and the client isn't charged.
6. **Start from scratch.** Click **New deal** and post any job with a budget, then negotiate it in the Deal Room.
7. Open **Payments** for the AG Grid escrow view. As Arjun, open **Agent settings** to see and change the private limits.

### PayPal sandbox test buyer
Funding a milestone opens PayPal's **sandbox** checkout. No real money moves. Log in with this test buyer account (a PayPal **sandbox** Personal account, US, for testing only):

| Field | Value |
|---|---|
| Email | `sb-fn5o553820530@personal.example.com` |
| Password | `u/Sw^.S0` |

1. As **Riya (client)**, open the contract and click the yellow **PayPal** button on a milestone.
2. In the PayPal pop-up, click **Log in** and enter the sandbox email and password above. Don't use a real PayPal account.
3. Click **Continue** / **Complete purchase** to approve. The pop-up closes and the milestone moves to **In escrow**. The money is authorized and held, not yet captured.
4. If the pop-up doesn't open, allow pop-ups for the site and try again.

The freelancer's payee is a sandbox Business account. Its balance is visible only in the PayPal developer dashboard.

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
src/lib/db.ts                Datastore: Neon Postgres (row-locked JSONB) or local JSON file
src/app/                     Pages
src/components/              UI components (deal room, milestone card, AG Grid table)
```

## Roadmap
Payouts API for tips/bonuses · re-authorization for long milestones · multi-freelancer marketplace · AI-mediated disputes using the PayPal Disputes API.

## Team
- **Shiv Mudgal** ([@ShivMudgal](https://github.com/ShivMudgal))
- **Aditya Awale** ([@adi18107-debug](https://github.com/adi18107-debug))

## License
MIT. Copyright (c) 2026 Shiv Mudgal and Aditya Awale. See [LICENSE](LICENSE).
