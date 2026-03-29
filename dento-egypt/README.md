# Dento Egypt — Clinic Manager
### Full deployment guide: database + SMS reminders + hosting

---

## What's included

| File | Purpose |
|------|---------|
| `sql/schema.sql` | Database tables (run once in Supabase) |
| `app/page.tsx` | Main clinic app (patients, appointments, payments, profiles) |
| `app/api/patients/route.ts` | Patients API |
| `app/api/appointments/route.ts` | Appointments API |
| `app/api/payments/route.ts` | Payments API |
| `app/api/sms-reminder/route.ts` | SMS reminders via Twilio |
| `lib/supabase.ts` | Supabase client |
| `.env.local.example` | Environment variables template |

---

## Step 1 — Set up Supabase (free database)

1. Go to https://supabase.com and create a free account
2. Click **New Project** → give it a name (e.g. "dento-egypt") → choose a region near Egypt (eu-central-1 Frankfurt is closest)
3. Once created, go to **SQL Editor** (left sidebar)
4. Paste the entire contents of `sql/schema.sql` and click **Run**
5. Go to **Settings → API** and copy:
   - Project URL → paste as `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → paste as `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

---

## Step 2 — Set up Twilio (SMS reminders)

1. Go to https://twilio.com and create a free account
2. Verify your phone number during signup
3. From the Console Dashboard, copy:
   - **Account SID** → paste as `TWILIO_ACCOUNT_SID`
   - **Auth Token** → paste as `TWILIO_AUTH_TOKEN`
4. Get a Twilio phone number (free trial gives you one):
   - Go to **Phone Numbers → Manage → Buy a number**
   - Copy the number → paste as `TWILIO_PHONE_NUMBER`

> **Note for Egypt:** Twilio trial accounts can only send SMS to verified numbers.
> To send to any Egyptian number (01XXXXXXXXX), upgrade to a paid Twilio account (~$15/month for ~1000 SMS).
> Alternatively, use a local Egyptian SMS provider like Unifonic (unifonic.com) or Conneckio — they offer Arabic SMS at lower rates. The API integration is similar.

---

## Step 3 — Deploy to Vercel (free hosting)

### Option A: One-click (easiest)

1. Push this folder to a GitHub repository
2. Go to https://vercel.com → **New Project** → import your GitHub repo
3. During setup, add your environment variables (from `.env.local.example`)
4. Click **Deploy** — your app will be live at `https://your-app.vercel.app` in ~2 minutes

### Option B: Local development first

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase and Twilio keys

# 3. Run locally
npm run dev
# Open http://localhost:3000

# 4. Deploy when ready
npx vercel --prod
```

---

## Step 4 — Set up daily SMS reminders (optional)

To automatically send SMS reminders every day at 9am for next day's appointments:

1. Go to https://vercel.com → your project → **Settings → Cron Jobs**
2. Add a cron job:
   - **Path:** `/api/sms-reminder`
   - **Schedule:** `0 7 * * *` (runs at 7am UTC = 9am Cairo time)

Or use a free cron service like https://cron-job.org to call your `/api/sms-reminder` URL daily.

---

## Staff access

Once deployed, share the Vercel URL with your staff. All data is stored in Supabase and syncs in real time across all devices.

To add login/password protection (so only your staff can access), go to:
- Vercel → your project → **Settings → Password Protection** (Pro plan)
- Or add Supabase Auth — let me know and I'll generate that code too.

---

## Costs

| Service | Free tier | Paid |
|---------|-----------|------|
| Supabase | 500MB database, 50k rows — plenty for a clinic | $25/month for more |
| Vercel | Unlimited deployments, custom domain | $20/month for teams |
| Twilio SMS | Free for verified numbers only | ~$0.01–0.05 per SMS to Egypt |

**For a single clinic, everything runs free or near-free.**

---

## Questions?

Come back to this chat and ask — I can add login screens, staff roles, multi-doctor scheduling, WhatsApp integration, or anything else.
