import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APP_NAME, SITE_URL } from '@/lib/config';

// Sends queued notification emails (meeting invites, new tasks, 9 PM reminders) through Resend.
// GET: daily Vercel cron (vercel.json), authorised by CRON_SECRET.
// POST: called by the app right after scheduling a meeting so invites go out immediately.
// Each email is claimed once in the database, so overlapping runs never send twice.

type Row = { id: string; email: string; name: string; body: string; page: string; link: string | null };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function html(r: Row, site: string) {
  const first = esc(r.name.split(' ')[0] || '');
  const btn = (href: string, label: string) => `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#6a4fd8;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p>`;
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1b1a19">
  <h2 style="margin:0 0 12px">Hi ${first}</h2>
  <p>${esc(r.body)}</p>
  ${r.link ? btn(r.link, 'Join Google Meet') : ''}
  ${site ? btn(`${site}/${r.page === 'day' ? 'day' : r.page}`, `Open ${esc(APP_NAME)}`) : ''}
  <p style="color:#64615b;font-size:13px">You get this email because you're a member of ${esc(APP_NAME)}.</p>
</div>`;
}

async function flush(origin: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, resend = process.env.RESEND_API_KEY;
  if (!url || !key || !resend) return { sent: 0, skipped: 'Email is not configured (SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY).' };
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const from = process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`;
  const site = SITE_URL || origin;
  let sent = 0, failed = 0;
  for (let round = 0; round < 10; round++) {
    const { data, error } = await admin.rpc('claim_email_batch', { max_rows: 50 });
    if (error) return { sent, failed, error: error.message };
    const rows = (data || []) as Row[];
    if (!rows.length) break;
    for (const r of rows) {
      const subject = r.link ? `Meeting invite · ${APP_NAME}` : r.page === 'tasks' ? `New task · ${APP_NAME}` : `${APP_NAME} reminder`;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json', 'Idempotency-Key': `notif-${r.id}` },
        body: JSON.stringify({ from, to: r.email, subject, html: html(r, site), text: r.body + (r.link ? `\n\nJoin: ${r.link}` : '') })
      }).catch(() => null);
      if (res && res.ok) sent++;
      else {
        failed++;
        // Put it back in the queue for the next run; the in-app notification is unaffected.
        await admin.from('notifications').update({ emailed_at: null }).eq('id', r.id);
      }
    }
    if (failed) break;
  }
  return { sent, failed };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await flush(req.nextUrl.origin));
}

export async function POST(req: NextRequest) {
  // Any signed-in member may trigger a send; it only delivers emails already queued by the database.
  const auth = req.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('auth-token'));
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await flush(req.nextUrl.origin));
}
