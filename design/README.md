# Handoff: TeamFlow — Team Productivity, Sales & Commission Management

## Overview
TeamFlow is a responsive web app for one team (1 leader, 11–50 members) to manage tasks, goals, daily check-ins, sales, commissions, payouts, achievements, notifications and reports. Africa/Lagos timezone, NGN currency only (v1). The app name is configurable.

The full product/engineering brief (stack, RLS, schema, API, tests, roadmap) is in `SPEC.md`. **SPEC.md is the source of truth for backend behaviour; this README is the source of truth for UI.**

## About the Design Files
`TeamFlow.dc.html` is a **design reference built in HTML**: an interactive prototype with in-memory demo data that shows the intended look and behaviour. It is not production code. Rebuild it in the target stack (React + TypeScript + Tailwind + Supabase per SPEC.md) using that stack's patterns. Open the file in a browser (keep `support.js` next to it).

Everything in the prototype is client-side and resets on reload. In production every number must come from the database, and every privileged transition (verify sale, calculate/approve commission, record payout, role changes) must run server-side with RLS. Never calculate authoritative money in JS floats; the prototype uses integer kobo only to show the expected results.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii, copy and interactions are final. Recreate them using the chosen component library (e.g. shadcn/ui) restyled to these tokens.

## Global Layout
- **Sidebar**: 236px wide (68px collapsed), full height, sticky, `--panel` background, 1px right border `--line`. Header 60px: 28×28 accent logo tile (radius 8, initial letter) + app name 16/700. Nav items: 38px tall, radius 9, 10px gap, 22×22 outlined glyph box + label; active = `--acc-soft` bg, `--acc-text` text, 600 weight; hover = `--sunk`. Count badges: 20px pill, accent bg, white 11/700. Footer: avatar + name + role.
- **Below 960px** the sidebar becomes an off-canvas drawer (slides from left −260px → 0, 200ms) with a scrim (`--scrim`). The hamburger toggles drawer on narrow screens and collapse on wide.
- **Top bar**: 60px, sticky, `--panel`, bottom border. Contents: menu button (36×36, radius 9, 1px `--line2`), page title 15/600, role switcher (prototype-only “view as” control, segmented, `--sunk` track), dark-mode toggle, notification bell with red unread count.
- **Main**: max-width 1240, centred, padding 28px 32px 60px (18px 14px on <640px), 20px vertical gap between blocks.
- **Cards**: `--panel`, 1px `--line`, radius 14, padding 16–20. No shadows except modals/toasts.
- **Grids**: metric grids `repeat(auto-fill, minmax(170–190px, 1fr))` gap 12; content rows `repeat(auto-fit, minmax(min(100%,300–340px),1fr))` gap 16. Tables scroll horizontally inside their card on small screens (min-width 560–820px).

## Navigation (permission-aware)
Dashboard · My Tasks / Team Tasks · Goals & Progress · Sales & Earnings · Team Members · Daily Check-ins · Achievements · Notifications · Reports · Settings. Labels and actions change by role; see each screen.

## Screens

### 1. Leader Dashboard
- H1 “Good morning, {first}” 24/700, −0.02em; sub “Thursday, 22 October 2026 · Lagos HH:MM” in `--mut`.
- **9 metric cards** (clickable buttons → filtered views): Team members (active · onboarding · invited) → Team; New this month → Team/Onboarding; Verified sales · month (sub: today · week) → Sales filtered Verified; Awaiting verification → Sales filtered Submitted; Commission pending approval → Commissions tab; Approved · unpaid → Payouts tab; Tasks (done; overdue · blocked) → Tasks filtered Overdue; Check-ins today (rate) → Check-ins; Team goal attainment → Goals. Card: label 12.5/500 `--mut`, value 22/700 tabular-nums, sub 12 `--mut`; hover border `--line2`.
- **Verified sales, October** bar chart (spans 2 columns on wide): 160px tall, one bar per day, radius 4/4/1/1, `--acc-soft`, today in `--acc`; tooltip “Oct 12 · ₦420,000”; axis labels 11.5 `--mut`.
- **Commission, October**: three 8px progress bars: Earned (accent), Approved unpaid (info), Paid (ok), widths relative to earned. Footnote: “Approved is not paid. Paid amounts come from recorded payout batches.”
- Row of three lists: **Sales awaiting verification** (ref · net, seller · product · date, primary “Verify” button), **Members requesting support** (blocked tasks with blocker text), **Upcoming deadlines** (date column red if overdue).

### 2. Member Dashboard
- Same greeting.
- 5 metric cards: My verified sales · Oct, Commission pending (estimated), Approved (not yet paid), Paid, Overdue tasks.
- **Today’s top priorities**: top 3 open tasks sorted by priority then deadline, numbered 22px circles, status badge. Buttons: “All my tasks”, “Report a blocker / ask for help” (red text) → blocker modal.
- **Daily check-in card**: accent-soft background when not submitted; CTA “Submit check-in” / “View check-in”.
- **My goals** (progress bars), **Announcements**, **Feedback from your lead**.

### 3. Tasks
- Title “Team Tasks” (leader) / “My Tasks” (member) with summary line (completed · pending · blocked · overdue). Primary button “Assign task” / “Add task”.
- Filter chips (32px pills, selected = ink bg/inverse text, count at 70% opacity): All, To do, In progress, Blocked, Submitted, Completed, Overdue.
- Rows: avatar, title 600, owner · due label (red “Overdue · 21 Oct”) · “review required”, blocker line in red, priority badge, status badge (min-width 84), action buttons (30px, radius 8).
- **Actions**: owner — Start (To do), Complete or Submit for review (In progress, depending on review flag), Blocked (opens blocker modal), Resume (Blocked). Leader on others’ tasks — Approve / Return (Submitted), Reopen (Completed). Completion counts are derived from current status so reopening never double-counts.
- Assign-task modal: title, assignee (leader only), priority, deadline, “Requires review” checkbox. Notifies assignee.

### 4. Goals & Progress
- Explainer: “Attainment = actual ÷ target. Goals can exceed 100%; a zero target shows no attainment.” Bars clamp at 100%, labels don’t (e.g. 112%). Zero target → “—”.
- Team goal cards (value 26/700): October verified sales vs ₦6,000,000; new members fully onboarded vs 3; daily check-in rate vs 90%.
- Member goals list: Monthly verified sales vs ₦1,000,000 (calculated from verified sales) and custom “Client calls logged”. Owners get an inline number input + “Log progress”.

### 5. Sales & Earnings (tabs: Sales · Commissions · Payouts)
- 4 summary cards. Leader: verified month, pending approval, approved unpaid, paid. Member: my verified, estimated (pending), approved, paid. Commission values use 2 decimals.
- Tabs: 40px, active = 2px accent underline.
- **Sales**: search + status chips (All, Submitted, Verified, Rejected, Refunded). Table columns: Reference, Seller, Product, Date, Gross, Net, Status, actions. Leader actions: Verify + Reject (Submitted, never on own sale), Refund (Verified). Rejection/refund reason shows as status tooltip.
- **Submit a sale** (member): ref, product, date, gross, discount, customer ref, notes. Live calc box: “Net sales: ₦X” + “Estimated commission at 5%: ₦Y · final amount set on verification”. Validation: ref required and unique; gross > 0; 0 ≤ discount ≤ gross; date not in future.
- **Verify**: creates exactly one Pending commission entry per sale (idempotent), using the rate in effect on the sale date, and stores a snapshot of rate and basis. Toast: “SO-1042 verified · ₦5,000.00 commission at 5%”. This is the ₦100,000 × 5% = ₦5,000 test case from SPEC §19.
- **Refund**: sale → Refunded (record kept). Unpaid commission → Reversed. Paid commission → new negative “Reversal” entry (Pending) deducted from the next payout.
- **Commissions** table: Entry (ref, Earned/Reversal · date), Beneficiary, Basis (net), Rate (2dp), Commission (negative in red), Status (Pending/Approved/Paid/Reversed), Approve. “Approve all pending (n)”. Formula note shown above table.
- **Payouts**: leader banner “Ready for payout: ₦X” → “Record payout batch” modal (bank payment reference required; copy warns to record only after transfer is confirmed). Moves Approved → Paid with batch id. Batch table: Batch, Paid on, Payment reference · confirmed by, Items, Total. Members see only their own items.

### 6. Team Members
- Search + chips (All, Active, Onboarding, Invited, Deactivated; members can’t see Deactivated).
- Card grid (min 280px): 42px avatar, name, title · joined, status badge, email · open tasks, onboarding checklist bar (info colour, “n of 10”) for invited/onboarding.
- Leader actions: Mark accepted (invited → onboarding, assigns starter task), Complete onboarding (→ active), Deactivate (history preserved, card at 60% opacity), Reactivate. “Invite member” modal: full name, email (format + uniqueness validation).

### 7. Daily Check-ins
- Member form (6 textareas in auto-fit grid): Today’s plan (required), Top priorities, Completed work, Progress toward goals, Challenges/blockers & support needed, Plan for tomorrow. One per Lagos date. After submit: read-only card with “Submitted HH:MM · edited HH:MM” and Edit. A blocker notifies the leader.
- Leader: “Today · x of y submitted (z%)”, “Remind n missing” button, list with plan, blocker (red), status badge (Submitted HH:MM / Missing).

### 8. Achievements
- Leaderboard (October, verified data only, no amounts) with toggle Verified sales / Tasks; current user bolded.
- Recent awards with kind badge (Sales, Consistency, Tasks, Recognition, Team). Awards are de-duplicated by key (e.g. `m1:{member}:2026-10` for “₦1M verified sales in October”, given automatically on verification). Leader: “Recognise a member” modal.

### 9. Notifications
- Unread rows: `--acc-soft` background, accent dot, 600 weight. Click marks read and navigates to the related page. “Mark all as read”. Meta line notes delivery channel (in-app + email).
- Triggers in prototype: sale submitted/verified/rejected/refunded, commission approved, payout recorded, task assigned/submitted/approved/returned, blocker reported, check-in reminder, recognition. Full list in SPEC §12.

### 10. Reports
- Filters: Period (This week / This month), Member (leader only). “Export CSV” (members get only their own row).
- 6 cards: Task completion rate, On-time completion, Check-in rate, Verified sales volume (“not profit”), Commission approved (+pending), Commission paid.
- Per-member table: Member, Tasks done, On-time, Overdue, Verified sales, Comm. pending, Comm. approved, Comm. paid.

### 11. Settings
- Commission plan: current rate (30/700), history list (Current / Scheduled / Superseded). Leader form: new rate (0.01–100), effective date (must be after today). Copy: past commissions are never recalculated.
- Commission policy panel: Basis, Rounding (half-up to kobo, NUMERIC in DB), Rate changes, Refunds, Approval vs payment.
- Audit log (leader): time, actor, action. Every privileged action in the prototype writes here.

## Interactions & States
- Toasts: bottom-centre, ink bg / bg-colour text, radius 10, auto-dismiss 2.8s, `role="status"`.
- Modals: scrim click or Cancel closes; max-width 480, radius 16, inline validation error (`role="alert"`, `--bad`) clears on edit. Destructive submit buttons use `--bad`.
- Empty states: “Queue is clear.”, “Nobody is blocked.”, “No tasks match this filter.”, “No sales match.”, “You’re all caught up.”
- Still to design for production: loading skeletons (use the card shapes with `--sunk` blocks), pagination for sales/commissions/audit (25 per page), date-range picker for reports, notification preferences, announcements composer, task detail drawer (description, checklist, comments, attachments, history), sale detail with evidence upload.
- Focus ring: 2px `--acc`, 1px offset. All controls are real buttons/inputs.

## State (production mapping)
Prototype state → tables: `members` → profiles + memberships; `tasks` → tasks (+ task_events); `sales` → sales; `comms` → commission_entries / commission_adjustments; `batches` → payout_batches / payout_items; `plans` → commission_plans; `checkins` → daily_checkins (unique member+date); `goals` → goals / goal_updates; `achievements` → member_achievements (unique key); `notifs` → notifications; `audit` → audit_logs. Current user role comes from `memberships.role`, never from user metadata.

## Design Tokens
Light / Dark:
- `--bg` #f5f5f3 / #131312 · `--panel` #ffffff / #1c1c1a · `--sunk` #f0efec / #242422
- `--line` #e6e4df / #2d2d2a · `--line2` #d6d3cd / #3c3c38
- `--ink` #1b1a19 / #ecebe8 · `--mut` #64615b / #a29f99
- `--acc` #6a4fd8 / #7258e2 · `--acc-soft` #eeeafc / #2a2541 · `--acc-text` #5238c4 / #bcaefa
- ok #1c6a3e on #e5f3ea / #82d4a3 on #17321f
- warn #835200 on #fdf1dc / #f0c46e on #382b12
- bad #a3302a on #fbe8e7 / #f2a199 on #3b1d1b
- info #2a539f on #e7eefb / #9fbef5 on #1a2944
- neutral #57544f on #efeeeb / #c0bdb6 on #2a2a27
- Avatars: `oklch(0.9 0.05 H)` bg, `oklch(0.4 0.12 H)` initials, hue per member.

Status → tone: Submitted/Pending/invited/High = warn · Verified/Paid/Completed/active = ok · Rejected/Reversed/Blocked/Urgent = bad · In progress/onboarding/Normal = info · Approved = accent · To do/Refunded/deactivated/Low = neutral.

Type: Instrument Sans (Google Fonts) 400/500/600/700. Scale: 24/700 H1 (−0.02em), 22/700 metric, 15/600 card title, 14 body (1.45), 13 secondary, 12.5 meta/buttons, 12 badges/labels, 11 small. Money and counts use `font-variant-numeric: tabular-nums`.

Spacing: 4, 6, 8, 10, 12, 14, 16, 20, 28, 32. Radii: 6 (badges), 8 (small buttons), 9 (buttons/inputs), 14 (cards), 16 (pills/modals). Control heights: 30 small, 34–36 default, 38 modal, 40 tabs. Shadow only on modal `0 20px 60px rgba(0,0,0,.25)` and toast.

Formatting: `Intl.NumberFormat('en-NG', {style:'currency', currency:'NGN'})`, 0dp for sales and 2dp for commission. Dates `en-GB` “22 Oct”. Times `Africa/Lagos` 24h.

## Assets
No images or icon set; nav glyphs are letter placeholders. Swap in an icon library (e.g. Lucide) at the same 22px box size. Profile photos fall back to initials avatars.

## Files
- `TeamFlow.dc.html`: interactive prototype (props: `appName`, `dark`, `startPage`). Logic is in the `<script data-dc-script>` class; demo seed data is in `seed()`.
- `support.js`: runtime needed to open the prototype.
- `SPEC.md`: the full product and engineering requirements.
