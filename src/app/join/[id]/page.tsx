import { redirect } from 'next/navigation';

// Invite links: emperor.app/join/{memberId} → sign-up with that sponsor filled in.
export default async function Join({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/login?sponsor=${encodeURIComponent(id)}`);
}
