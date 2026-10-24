# Emperor

Team tracking for to-dos, daily check-ins, orders, QPV status, legs, chat and meetings.
Built with Next.js 15, Tailwind and Supabase (Auth, Postgres, Row Level Security, Realtime, pg_cron). Installable on phones as an app.

- `src/`: the app
- `supabase/migrations/001_schema.sql`: the original database (already run on your project)
- `supabase/migrations/002_app_support.sql`: **run this once** (see step 1)
- `design/`: the Claude Design prototype and handoff notes this app was built from

---

## Go live: step by step

### 1. Update the database (2 minutes)
1. Supabase → **SQL Editor → New query**.
2. Paste all of `supabase/migrations/002_app_support.sql` and click **Run**. You should see "Success. No rows returned".

It fixes and adds:
- **Meetings:** the old access rules referred to each other and made meetings fail to load.
- **Security:** members could call internal functions directly (for example to promote themselves). They no longer can.
- **Notifications:** sponsors are now told about new orders, tasks, issues, achievements and meeting invites.
- **Sign-up:** QPV and earnings entered at sign-up now count, and people who use Google sign-in pick their sponsor.
- **New tools:** sponsor search on the sign-up page, and the queue that sends emails.

### 2. Deploy on Vercel
1. vercel.com → **Add New → Project** → import `EmperorTeam` → Framework **Next.js** (detected automatically).
2. Under **Environment Variables** add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wzcqqewhstdubpqbkuit.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key (Supabase → Settings → API) |
| `NEXT_PUBLIC_SITE_URL` | your live address, e.g. `https://emperor.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (**secret**) |
| `RESEND_API_KEY` | from resend.com → API Keys (**secret**) |
| `EMAIL_FROM` | e.g. `Emperor <onboarding@resend.dev>` (or your own domain once verified) |
| `CRON_SECRET` | any long random string |

3. Click **Deploy**.

The last four are only needed for emails (meeting invites, new tasks and 9 PM reminders). Without them the app still works fully in-app.

### 3. Point Supabase at your live address
Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:** `https://your-app.vercel.app/**`

### 4. Google sign-in (optional)
Google Cloud → your OAuth client → **Authorised JavaScript origins** → add `https://your-app.vercel.app`.
The redirect URI `https://wzcqqewhstdubpqbkuit.supabase.co/auth/v1/callback` is already set.
To let anyone use Google sign-in (not only test users), fill in the Branding page with your home page and `https://your-app.vercel.app/privacy`, then **Publish app**.

### 5. First sign-up
1. Open the live link and **sign up yourself first, with no sponsor**. You become the top leader.
2. Copy your invite link from the Dashboard or Settings (`/join/<your id>`) and send it to your direct legs.
3. Each person signs up with that link, so their sponsor is already filled in, and picks the status they already hold.

On phones: Safari → Share → **Add to Home Screen** (iPhone), or Chrome → ⋮ → **Install app** (Android).

---

## How the rules work
- **Status ladder (monthly QPV):** Member 0–99 · Distributor 100–499 · Manager 500–999 · Senior Manager 1,000–1,999 · Executive Manager 2,000–3,999 · Director 4,000+ · Emerald Director (set by a sponsor).
- **Total QPV** = your own QPV + everyone below you, this month. It is ranked by the database whenever anyone adds QPV.
- **Status never goes down.** QPV and earnings restart at 0 on the 1st (Lagos time). If this month's total ranks lower, the app shows "This month: Distributor" next to the real status. Only an upline's **Correct status** can lower it.
- **Step-ups** add an achievement automatically and notify the person and everyone above them.
- **Team earnings** = your non-cancelled orders + everyone below you.
- **Who sees what:** you see yourself and everyone below you. Your uplines see you. The top leader sees everyone. Achievements and names are visible to the whole team. Every rule is enforced by the database, not just by hiding buttons.
- **9:00 PM Lagos daily check** (pg_cron, already scheduled) sends notices to anyone with no check-in or no to-do list today. After 7 days without activity they get a reminder; at 2, 3 and 4 weeks they are told they are inactive. Emails go out at 9:10 PM through the Vercel cron in `vercel.json`. Meeting and task emails are sent straight away.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill in the two NEXT_PUBLIC_SUPABASE values
npm run dev
```
To run against a local database instead: `npx supabase start` (needs Docker; applies both migrations), then use the URL and anon key it prints.

`npm test` runs the rule tests (ladder, team counts, week/month dates). `npm run typecheck` checks types.

## Not built yet
- **Phone push notifications.** Alerts show inside the app (pop-up plus bell) and by email, but not as phone notifications when the app is closed. That needs web-push keys and a sender.
- **Automatic Google Meet links.** Hosts paste a Meet link. Creating links automatically needs Google's Calendar permission and app verification.
- **Emerald Director threshold.** For now only a sponsor can set it.
