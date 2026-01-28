'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { DataCacheProvider } from '@/contexts/DataCacheContext';
import { Navbar } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { PageLoading } from '@/components';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { loading, error, user } = useAuth();
  const { isCollapsed } = useSidebar();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-[#061E26]/5 to-black/5">
        <PageLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-[#061E26]/5 to-black/5 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-black/10 p-8 text-center">
          <div className="text-red-500 mb-6">
            <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-black mb-3">Access Denied</h2>
          <p className="text-black/70 mb-6 text-lg">{error}</p>
          <p className="text-sm text-black/50">Please contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-[#061E26]/5 to-black/5">
        <PageLoading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#061E26]/5 to-black/5">
      <Navbar />
      <main className={`pt-16 lg:pt-0 transition-all duration-300 ${isCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DataCacheProvider>
      <AuthProvider>
        <SidebarProvider>
          <LayoutContent>{children}</LayoutContent>
        </SidebarProvider>
      </AuthProvider>
    </DataCacheProvider>
  );
}
