import { Suspense } from 'react';
import { StoreProvider } from '@/components/Store';
import { Shell } from '@/components/Shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <Shell><Suspense>{children}</Suspense></Shell>
    </StoreProvider>
  );
}
