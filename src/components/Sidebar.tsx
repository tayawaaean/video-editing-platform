'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { RoleBadge } from './RoleBadge';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    roles: ['admin'],
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    roles: ['admin'],
  },
  {
    label: 'Dashboard',
    href: '/reviewer/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    roles: ['reviewer'],
  },
  {
    label: 'Review',
    href: '/reviewer/review',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    roles: ['reviewer'],
  },
  {
    label: 'Dashboard',
    href: '/submitter/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    roles: ['submitter'],
  },
  {
    label: 'My Submissions',
    href: '/submissions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    roles: ['submitter'],
  },
  {
    label: 'New Submission',
    href: '/submissions/new',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    roles: ['submitter'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'reviewer':
      return '/reviewer/dashboard';
    case 'submitter':
      return '/submitter/dashboard';
    default:
      return '/admin/dashboard';
  }
}

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse } = useSidebar();

  if (!user) return null;

  const roleDashboardPath = getRoleDashboardPath(user.role);
  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  const isActive = (href: string) => {
    if (pathname === href) return true;

    if (href.includes('/dashboard')) {
      return pathname === href;
    }

    // Reviewer's Review page: highlight on /reviewer/review and on submission detail /submissions/[id]
    if (href === '/reviewer/review') {
      if (pathname === '/reviewer/review') return true;
      // Also highlight when viewing a submission detail (for reviewers)
      if (user?.role === 'reviewer' && pathname.startsWith('/submissions/') && pathname !== '/submissions/new') return true;
      return false;
    }

    // Submitter's My Submissions: highlight on /submissions list and on submission detail /submissions/[id]
    if (href === '/submissions') {
      if (pathname === '/submissions') return true;
      // Only highlight for submitters on submission detail
      if (user?.role === 'submitter' && pathname.startsWith('/submissions/') && pathname !== '/submissions/new') return true;
      return false;
    }

    if (href === '/submissions/new') {
      return pathname === '/submissions/new';
    }

    return pathname.startsWith(href + '/');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`flex items-center border-b border-black/10 flex-shrink-0 bg-gradient-to-r from-white to-black/5 ${isCollapsed ? 'justify-center py-4 px-2' : 'justify-between p-4 gap-2'}`}>
        {isCollapsed ? (
          <Link
            href={roleDashboardPath}
            className="flex-shrink-0 p-2 rounded-xl hover:bg-black/5 transition-colors"
            title={process.env.NEXT_PUBLIC_APP_NAME || 'Video Review Platform'}
          >
            <svg className="w-6 h-6 text-[#061E26]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </Link>
        ) : (
          <>
            <Link
              href={roleDashboardPath}
              className="font-bold text-lg bg-gradient-to-r from-[#061E26] to-black bg-clip-text text-transparent flex-1 min-w-0 hover:from-[#061E26]/80 hover:to-black/80 transition-all"
            >
              {process.env.NEXT_PUBLIC_APP_NAME || 'Video Review Platform'}
            </Link>
          </>
        )}
        <button
          onClick={onMobileClose}
          className="lg:hidden flex-shrink-0 p-2 rounded-lg text-black/40 hover:text-black/60 hover:bg-black/5 transition-colors"
          aria-label="Close sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className={`flex-1 overflow-y-auto ${isCollapsed ? 'space-y-2 py-4 px-2' : 'space-y-1 p-4'}`}>
        {filteredNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={`group flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                isCollapsed
                  ? 'justify-center p-3 w-full'
                  : 'gap-3 px-4 py-3'
              } ${
                active
                  ? 'bg-gradient-to-r from-[#061E26] to-black text-white shadow-lg shadow-[#061E26]/30'
                  : 'text-black/70 hover:bg-black/5 hover:text-black'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-black/40 group-hover:text-black/60'} transition-colors`}>
                {item.icon}
              </span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-black/10 space-y-3 flex-shrink-0 ${isCollapsed ? 'py-4 px-2' : 'p-4'}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-white to-black/5 rounded-xl">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#061E26] to-black flex items-center justify-center shadow-md">
                <span className="text-sm font-semibold text-white">
                  {user.email.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-black truncate">{user.email}</p>
              <RoleBadge role={user.role} />
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center w-full">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#061E26] to-black flex items-center justify-center shadow-md">
              <span className="text-sm font-semibold text-white">
                {user.email.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className={`group w-full flex items-center justify-center rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-md hover:shadow-lg transition-all duration-200 ${
            isCollapsed ? 'p-3' : 'gap-2 px-4 py-3'
          }`}
          title={isCollapsed ? 'Sign out' : undefined}
        >
          <svg className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!isCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-black/10 fixed left-0 top-0 bottom-0 z-30 transition-all duration-300 shadow-sm ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
        
        {/* Toggle button positioned outside the sidebar */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-6 p-1.5 rounded-full text-black/40 hover:text-black/60 hover:bg-black/5 transition-colors border border-black/20 bg-white shadow-md z-40 hover:shadow-lg"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5l-7 7 7 7" />
            )}
          </svg>
        </button>
      </aside>

      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
            onClick={onMobileClose}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-black/10 z-50 lg:hidden shadow-2xl">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

