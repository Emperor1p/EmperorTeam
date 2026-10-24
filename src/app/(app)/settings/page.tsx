'use client';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useReady } from '@/components/Store';
import { monthLine } from '@/components/ProfileDrawer';
import { InviteLink } from '@/components/InviteLink';
import { Avatar, PageHead } from '@/components/ui';
import { RANKS, RT, TH } from '@/lib/logic';
import { APP_NAME } from '@/lib/config';

const PHOTO_PX = 320;

/** Crops the picked image to a centred square and re-encodes it as a small JPEG. */
async function squareJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('decode')); i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PHOTO_PX;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
    return await new Promise<Blob>((ok, bad) => canvas.toBlob(b => (b ? ok(b) : bad(new Error('encode'))), 'image/jpeg', 0.86));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Path of a stored photo inside the avatars bucket, from its public URL. */
const storagePath = (url: string | null) => (url && url.includes('/avatars/') ? url.split('/avatars/')[1] : null);

export default function Settings() {
  const s = useReady();
  const { me, uid } = s;
  const isRoot = !me.sponsor_id;
  const [name, setName] = useState(me.name);
  const [outside, setOutside] = useState(me.external_sponsor || '');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().split(/\s+/).length < 2) return s.say('Enter your first and last name.');
    await s.run(s.sb.from('profiles').update({ name: name.trim() }).eq('id', uid), 'Name saved', 'profiles', 'names');
  };

  const saveOutside = async (e: FormEvent) => {
    e.preventDefault();
    const v = outside.trim();
    if (v.length > 80) return s.say('Keep the name under 80 characters.');
    await s.run(s.sb.from('profiles').update({ external_sponsor: v || null }).eq('id', uid), v ? 'Sponsor saved' : 'Sponsor removed', 'profiles');
  };

  const pickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return s.say('Choose a photo (JPG or PNG).');
    if (file.size > 15 * 1024 * 1024) return s.say('That photo is too large. Choose one under 15 MB.');
    setBusy(true);
    try {
      let blob: Blob;
      try { blob = await squareJpeg(file); } catch { setBusy(false); return s.say('That photo format isn’t supported. Try a JPG or PNG.'); }
      const path = `${uid}/${Date.now()}.jpg`;
      const up = await s.sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
      if (up.error) { setBusy(false); return s.say('Upload failed. Check your connection and try again.'); }
      const url = s.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const old = storagePath(me.avatar_url);
      const ok = await s.run(s.sb.from('profiles').update({ avatar_url: url }).eq('id', uid), 'Photo updated', 'profiles', 'names');
      if (ok && old) await s.sb.storage.from('avatars').remove([old]);
      if (!ok) await s.sb.storage.from('avatars').remove([path]);
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    const old = storagePath(me.avatar_url);
    setBusy(true);
    const ok = await s.run(s.sb.from('profiles').update({ avatar_url: null }).eq('id', uid), 'Photo removed', 'profiles', 'names');
    if (ok && old) await s.sb.storage.from('avatars').remove([old]);
    setBusy(false);
  };

  const rows = [['Email', me.email], ['Status', `${me.rLabel}${me.mr < me.status_rank ? ` (this month: ${RANKS[me.mr]})` : ''}`], ['QPV this month', `${me.teamQ} (own ${me.q})`], ['Sponsor', me.sponsorName], ['Month line', monthLine(me)]];
  return (
    <>
      <PageHead title="Settings" sub={`${APP_NAME} · Africa/Lagos · USD`} />
      <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))' }}>
        <div className="card flex flex-col gap-2.5" style={{ padding: 20 }}>
          <span className="card-title">Profile</span>
          <div className="flex flex-wrap items-center gap-3.5" style={{ paddingBottom: 6 }}>
            <Avatar p={me} size={72} font={22} />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-s btn-md" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Saving…' : me.avatar_url ? 'Change photo' : 'Add photo'}</button>
                {me.avatar_url && <button type="button" className="btn btn-d btn-md" disabled={busy} onClick={removePhoto}>Remove</button>}
              </div>
              <span className="muted" style={{ fontSize: 12 }}>Shown to your team. Cropped to a square.</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} hidden aria-label="Profile photo" />
          </div>
          <form onSubmit={saveName} className="flex gap-2">
            <input className="input" style={{ flex: 1, height: 36 }} value={name} onChange={e => setName(e.target.value)} aria-label="Name" />
            <button type="submit" className="btn btn-s">Save</button>
          </form>
          {isRoot && (
            <form onSubmit={saveOutside} className="flex flex-col gap-1.5" style={{ paddingTop: 6 }}>
              <label className="field">My sponsor (outside the app)
                <div className="flex gap-2">
                  <input className="input" style={{ flex: 1, height: 36 }} value={outside} onChange={e => setOutside(e.target.value)} placeholder="e.g. Ngozi Eze" maxLength={80} />
                  <button type="submit" className="btn btn-s">Save</button>
                </div>
                <span className="hint">As top leader, your sponsor isn’t a member here. Their name shows on your profile only. They won’t appear in the sign-up list or count in any team.</span>
              </label>
            </form>
          )}
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13.5 }}><span className="muted">{k}</span><span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span></div>)}
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--line)' }}><InviteLink id={uid} /></div>
        </div>
        <div className="card flex flex-col gap-3" style={{ padding: 20 }}>
          <span className="card-title">Install on your phone</span>
          <span className="muted" style={{ fontSize: 13 }}>iPhone: open this site in Safari, tap Share → Add to Home Screen. Android: open in Chrome, tap ⋮ → Install app. It then opens like a normal app.</span>
          <span className="card-title" style={{ paddingTop: 6 }}>Meetings</span>
          <span className="muted" style={{ fontSize: 13 }}>Hosts paste a Google Meet link when scheduling. Everyone invited gets the link by email and in their notifications.</span>
        </div>
        <div className="card flex flex-col gap-2" style={{ padding: 20 }}>
          <span className="card-title">Status ladder (QPV in a month)</span>
          {RANKS.map((r, i) => (
            <div key={r} className="flex items-center justify-between" style={{ padding: '7px 0', borderTop: '1px solid var(--line)' }}>
              <span className="badge" style={{ fontWeight: 700, background: RT[i][0], color: RT[i][1] }}>{r}</span>
              <span className="tnum muted" style={{ fontWeight: 600 }}>{i === 0 ? '0–99 QPV' : i === 5 ? '4,000+ QPV' : i === 6 ? 'Set by sponsor' : `${TH[i].toLocaleString()}–${(TH[i + 1] - 1).toLocaleString()} QPV`}</span>
            </div>
          ))}
          <span className="muted" style={{ fontSize: 12.5, paddingTop: 4 }}>QPV = your own + everyone in your team, and resets to 0 on the 1st (earnings too). Status never goes down. If a Manager&apos;s total is under 500 this month, they stay Manager, and the app also shows &quot;This month: Distributor&quot;. Sponsors can correct a downline&apos;s status.</span>
        </div>
      </div>
    </>
  );
}
