import { APP_NAME } from '@/lib/config';

export const metadata = { title: `Privacy policy · ${APP_NAME}` };

export default function Privacy() {
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-10" style={{ lineHeight: 1.6 }}>
      <h1 className="h1">{APP_NAME} privacy policy</h1>
      <p className="muted">Last updated 23 October 2026</p>
      <p>{APP_NAME} is a private team-tracking app used by members of the {APP_NAME} team. This page explains what we collect and why.</p>
      <h2 className="card-title">What we collect</h2>
      <ul className="list-disc pl-6">
        <li>Your name, email address and, if you sign in with Google, your Google account email and name.</li>
        <li>Who your sponsor is, your status, the QPV you enter, the orders and earnings you log, your daily check-ins, to-do lists, tasks, issues, achievements, chat messages and meetings.</li>
        <li>When you were last active in the app.</li>
      </ul>
      <h2 className="card-title">Who can see it</h2>
      <p>You can see your own records and those of everyone in your team below you. Your sponsor and everyone above them in your sponsor line can see your records. The top leader can see everyone. Achievements and member names are visible to the whole team. Private chats are visible only to the two people in them.</p>
      <h2 className="card-title">How we use it</h2>
      <p>Only to run the app: showing dashboards and team totals, sending in-app notifications and reminder or meeting emails. We do not sell your data or use it for advertising.</p>
      <h2 className="card-title">Where it is stored</h2>
      <p>Data is stored with Supabase (database and sign-in) and the app is hosted on Vercel. Emails are sent through our email provider. Google sign-in only shares your basic profile and email with us.</p>
      <h2 className="card-title">Your choices</h2>
      <p>Ask the top leader to correct or delete your account and data at any time.</p>
    </main>
  );
}
