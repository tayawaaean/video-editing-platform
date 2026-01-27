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
    label: 'New Submission',
    href: '/submissions/new',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    roles: ['submitter'],
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
      return '/dashboard';
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
    // Exact match for current page
    if (pathname === href) {
      return true;
    }
    
    // For dashboard links, also highlight when viewing submission details
    if (href.includes('/dashboard')) {
      // If we're on a submission detail page (/submissions/:id), highlight the dashboard
      if (pathname.startsWith('/submissions/') && !pathname.endsWith('/new')) {
        return true;
      }
      return false;
    }
    
    // For "New Submission" link, only highlight on exact match
    if (href === '/submissions/new') {
      return false;
    }
    
    // For other routes, match if pathname starts with the href
    return pathname.startsWith(href + '/');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`flex items-center border-b border-slate-200 flex-shrink-0 bg-gradient-to-r from-slate-50 to-white ${isCollapsed ? 'justify-center py-4 px-2' : 'justify-between p-4 gap-2'}`}>
        {isCollapsed ? (
          <Link
            href={roleDashboardPath}
            className="flex-shrink-0 p-2 rounded-xl hover:bg-slate-100 transition-colors"
            title={process.env.NEXT_PUBLIC_APP_NAME || 'Video Review Platform'}
          >
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </Link>
        ) : (
          <>
            <Link
              href={roleDashboardPath}
              className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex-1 min-w-0 hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              {process.env.NEXT_PUBLIC_APP_NAME || 'Video Review Platform'}
            </Link>
          </>
        )}
        <button
          onClick={onMobileClose}
          className="lg:hidden flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} transition-colors`}>
                {item.icon}
              </span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-slate-200 space-y-3 flex-shrink-0 ${isCollapsed ? 'py-4 px-2' : 'p-4'}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                <span className="text-sm font-semibold text-white">
                  {user.email.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
              <RoleBadge role={user.role} />
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center w-full">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
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
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200 fixed left-0 top-0 bottom-0 z-30 transition-all duration-300 shadow-sm ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
        
        {/* Toggle button positioned outside the sidebar */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-6 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors border border-slate-300 bg-white shadow-md z-40 hover:shadow-lg"
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
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 z-50 lg:hidden shadow-2xl">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

