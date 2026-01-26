'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from './RoleBadge';

export function Navbar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive(path)
        ? 'bg-blue-100 text-blue-700'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="font-semibold text-lg text-gray-900">
              {process.env.NEXT_PUBLIC_APP_NAME || 'Video Review'}
            </Link>
            
            <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
              <Link href="/dashboard" className={linkClass('/dashboard')}>
                Dashboard
              </Link>
              <Link href="/submissions/new" className={linkClass('/submissions/new')}>
                New Submission
              </Link>
              {user?.role === 'admin' && (
                <Link href="/admin/users" className={linkClass('/admin/users')}>
                  Users
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user && (
              <>
                <div className="hidden sm:flex items-center space-x-3">
                  <span className="text-sm text-gray-600">{user.email}</span>
                  <RoleBadge role={user.role} />
                </div>
                <button
                  onClick={signOut}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="sm:hidden border-t border-gray-200 px-4 py-3 space-y-2">
        <Link href="/dashboard" className={`block ${linkClass('/dashboard')}`}>
          Dashboard
        </Link>
        <Link href="/submissions/new" className={`block ${linkClass('/submissions/new')}`}>
          New Submission
        </Link>
        {user?.role === 'admin' && (
          <Link href="/admin/users" className={`block ${linkClass('/admin/users')}`}>
            Users
          </Link>
        )}
        {user && (
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-600">{user.email}</span>
            <RoleBadge role={user.role} />
          </div>
        )}
      </div>
    </nav>
  );
}
