# Handoff v2: Emperor (team, QPV, orders and activity tracking)

`Emperor.dc.html` replaces v1 (sales/commission). The visual system (tokens, type, layout shell, cards, modals, toasts, light/dark) is unchanged. See `README.md` → Design Tokens / Global Layout. This file covers v2 behaviour and is the source of truth.

The HTML file is a **design reference with in-memory demo data**. Build it as a real-time web app (responsive and installable as a PWA so members can use it on their phones). Suggested stack: React + TypeScript + Supabase (Auth, Postgres, Realtime, RLS, Edge Functions, pg_cron) + Google OAuth (Calendar API for Meet links and Gmail invites) + an email provider for reminders.

## Access
- **Sign in** with email/password or Google. **Sign up** asks for name, email (Gmail recommended), password, **sponsor** (picked, or prefilled from the invite link `emperor.app/join/{memberId}`), their **current status** (any of the 7, since the status they already hold never goes down), optional QPV this month, and optional earnings already made this month (saved as an opening order so it counts toward the sponsor line's team earnings). A distributor must enter current-month QPV ≥ 100, and their starting status comes from the ladder.
- On sign-up every upline (sponsor → … → top leader) is notified. If they joined as a distributor, the step-up notifications below also fire.
- Visibility: everyone sees themselves and their whole downline (all levels). The top leader (root, no sponsor) sees everyone. Enforce this with RLS on a closure table / recursive CTE over `sponsor_id`.

## Status ladder (monthly QPV)
| Status | QPV in a month |
|---|---|
| Member | 0–99 |
| Distributor | 100–499 |
| Manager | 500–999 |
| Senior Manager | 1,000–1,999 |
| Executive Manager | 2,000–3,999 |
| Director | 4,000+ |
| Emerald Director | set by sponsor (threshold TBD) |

- **QPV is cumulative up the sponsor line:** a person's Total QPV = their own QPV + the QPV of everyone in their team (all levels). Status is ranked on Total QPV. When anyone adds QPV (or signs up with QPV), re-check their status and every upline's.
- **Monthly reset:** QPV and earnings are counted per calendar month (Africa/Lagos) and start from 0 on the 1st. History is kept; only the current-month totals reset.
- **Status never goes down.** `status = max(stored status, rank(month Total QPV))`.
- Separately show **"This month: X"** when month QPV ranks below the stored status (e.g. a Manager with 260 QPV shows "Manager · This month: Distributor").
- Everyone can add QPV (dashboard card). Non-distributors see "Become a distributor · n more QPV".
- **Step-up event** (QPV added, sign-up, or status correction raised): update status, auto-add an achievement "Stepped up to X", and notify the person plus **every** upline. Direct sponsor: "You have a new distributor: G" / "Your direct leg G stepped up to Manager". Higher uplines: "New distributor in F's team: G" / "G (F's team) stepped up to …".
- **Status correction:** any upline can set a downline's status from the profile drawer (to match the website). Lowering it notifies the person only.

## Team structure
- Team of X = X + everyone below X on all levels. Example: C→A→B gives A a team of 2 and C a team of 3. Adding D under C makes C's team 4. T under D makes D's team 2 and C's team 5.
- **My Team / Organisation** page: breadcrumb of nested teams, a summary card (team size, direct legs, distributors+, members, team earnings, team QPV), and status breakdown chips. A collapsible **tree** shows indent 22px per level, status and "this month" note, QPV, team size (click to drill in), personal earnings, team earnings and activity dot. Filters: Tree, Members, Distributors, Managers+, Inactive, plus search.
- Clicking a leg (from the dashboard or the leg cards on My Team) opens that leg's team: its own direct legs, the full tree with Own QPV, Total QPV, Orders count, personal and team earnings, and an **Orders in this team** table ("x of y people have orders"). Clicking a person opens their profile with their orders this month.
- The dashboard lists **direct legs** with team size, distributors+, team QPV and team earnings.

## Orders & earnings (USD)
- Order: project, platform (Fiverr, Upwork, Direct client, Other), amount, date (not in the future), status Active / Completed / Cancelled. Cancelled orders stay on record but don't count.
- **Personal earnings** = own non-cancelled orders in the period. **Team earnings** = personal earnings of everyone in the team (including self), so team equals personal when there's no downline.
- Cards and filters: week (Mon–Sun) / month. Shows orders count and amount, and the number of **people who collected orders**, for My orders and Team orders.

## My Day
- **To-do list** for today: add, tick, remove.
- **Daily check-in** (one per Lagos date, editable with an "edited" stamp): Fiverr messages, Upwork messages, orders today, cancellations today (whole numbers ≥ 0), daily progress (required), optional issue (creates an Issue for the upline) and the book being read this month.
- Last 7 days table: check-in status, counts and to-dos done.

## Tasks, meetings, issues, achievements
- **Tasks:** anyone with a downline can assign to direct legs (labelled) or deeper. Tabs: Assigned to me / I assigned. Completing a task notifies the assigner.
- **Meetings:** host picks the audience. Options: direct legs, a particular leg's team (that person and their downline), or the entire team (whole downline; the whole org for the root). Meet link is auto-generated (requires Google connected) or pasted and validated as `https://meet.google.com/…`. Every invitee gets a Google Calendar invite in Gmail and an in-app notification. A Join button sits on the dashboard and the Meetings page.
- **Issues:** visible to the author and all uplines. Uplines can reply and mark them resolved, and the author is notified.
- **Achievements:** step-ups are auto-added. Anyone can add their own (e.g. new tool), and uplines can add for their downline. The feed is visible to the whole org, and the person and their uplines are notified.

## Activity & automations (daily 9:00 PM Africa/Lagos)
- Missed check-in or no to-do list today → notification + email: "You missed today's daily check-in and to-do list".
- Last activity 7–13 days ago → **Idle**, reminder sent.
- 14+ days (2–4 weeks) → **Inactive**, message "You are now an inactive member…". Shown in the Inactive list until they check in again.
- Activity = any check-in, to-do, order, QPV entry or sign-in.
- The Activity page (for anyone with a downline) shows counts and lists for each group. "Run today's check now" exists only in the prototype.

## Real-time
Subscribe to Supabase Realtime on notifications, orders, members, logs, issues and meetings filtered to the viewer's visible subtree. Update counters, the tree and the bell instantly. The prototype's "view as" switcher only demonstrates that one user's action appears for the others.

## Suggested tables
`profiles(id, name, email, sponsor_id, status_rank, joined_at, last_active_at)`, `qpv_entries(member_id, date, amount)`, `orders`, `daily_logs(member_id, date unique, fiverr_msgs, upwork_msgs, orders, cancellations, progress)`, `books(member_id, month, title)`, `todos`, `tasks`, `meetings` + `meeting_invitees`, `issues`, `achievements(unique member+kind+key for step-ups)`, `notifications`, `status_changes` (audit), `google_connections`.

## Chat
- Team group chat per sponsor: `team:{id}` = that person + their whole downline. Each user sees their own team chat (if they have a downline) and every upline's team chat.
- Private 1:1 chats with anyone in your line (uplines and downline). Start one from "New message to…", a profile's "Message" button, or "Chat" on an issue.
- Unread counts per conversation, shown on the nav and the mobile tab bar. Use Supabase Realtime on `messages(conversation_id, sender_id, body, created_at)` + `conversation_reads(member_id, conversation_id, last_read_at)`.

## To-do tracking
- Day strip for the last 7 days (done/total per day, green when all done). Past days are read-only, and unfinished items can be "Moved to today" (the original shows "Moved to today").
- Stats: today done/total, % done over 7 days, days with a list, all-done streak. Each item records the time it was ticked.
- Sponsor and uplines see the member's today list in the profile drawer. The 9 PM job flags missing lists.

## Responsive
- Under 640px: bottom tab bar (Home, My Day, Chat, Team, More → drawer). The team tree, orders and team orders switch from tables to stacked cards. Chat shows the list or the thread one at a time with a back button. Page padding is 16/12 with 96px at the bottom for the tab bar.

## Status persistence (clarified)
- Status is permanent: a Distributor stays Distributor next month even at 0 QPV. A Manager whose team total this month is 250 shows "Manager · 250 QPV · This month: Distributor". Only a sponsor's manual correction can lower it.
- QPV and earnings reset to 0 on the 1st. Status does not.

## Notification alerts
- Any new notification for the signed-in user appears as a pop-up in the top-right for 6 seconds (click to open it) and in the bell. In production, also send a web push / PWA notification for: step-ups, new team member, issue raised, meeting invite, task assigned, missed check-in or to-do list, and inactivity.
