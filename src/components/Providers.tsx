'use client';

import { SessionProvider } from 'next-auth/react';
import { DataCacheProvider } from '@/contexts/DataCacheContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/contexts/SidebarContext';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <DataCacheProvider>
        <AuthProvider>
          <SidebarProvider>
            {children}
          </SidebarProvider>
        </AuthProvider>
      </DataCacheProvider>
    </SessionProvider>
  );
}
