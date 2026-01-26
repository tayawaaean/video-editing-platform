'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PageLoading } from '@/components';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const getRoleDashboardPath = (role: string) => {
    switch (role) {
      case 'admin':
        return '/admin/dashboard';
      case 'reviewer':
        return '/reviewer/dashboard';
      case 'submitter':
        return '/submitter/dashboard';
      default:
        return '/login';
    }
  };

  useEffect(() => {
    if (!loading && user) {
      const rolePath = getRoleDashboardPath(user.role);
      router.replace(rolePath);
    } else if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  return <PageLoading />;
}
