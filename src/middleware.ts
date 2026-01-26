import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { getAuthUser } from '@/lib/auth-helper';

// Check for explicit dev mode flag first, then fall back to environment checks
const DEV_MODE = 
  process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
  process.env.NEXT_ENV === 'development' ||
  process.env.NODE_ENV === 'development';

function getRoleDashboardPath(role: string): string {
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

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApiRoute = path.startsWith('/api');
  const isAuthRoute = path.startsWith('/auth');
  const isLoginPage = path === '/login';

  // Allow API routes and auth routes to pass through
  if (isApiRoute || isAuthRoute) {
    return NextResponse.next();
  }

  // Get authenticated user
  const { user } = await getAuthUser();

  // Redirect /dashboard to role-based dashboard
  if (path === '/dashboard' && user) {
    const url = request.nextUrl.clone();
    url.pathname = getRoleDashboardPath(user.role);
    return NextResponse.redirect(url);
  }

  // Protected routes that require authentication
  const protectedPaths = ['/admin', '/reviewer', '/submitter', '/submissions'];
  const isProtectedPath = protectedPaths.some(p => path.startsWith(p));

  if (isProtectedPath) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Role-based route protection
    if (path.startsWith('/admin/') && user.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = getRoleDashboardPath(user.role);
      return NextResponse.redirect(url);
    }

    if (path.startsWith('/reviewer/') && user.role !== 'reviewer') {
      const url = request.nextUrl.clone();
      url.pathname = getRoleDashboardPath(user.role);
      return NextResponse.redirect(url);
    }

    if (path.startsWith('/submitter/') && user.role !== 'submitter') {
      const url = request.nextUrl.clone();
      url.pathname = getRoleDashboardPath(user.role);
      return NextResponse.redirect(url);
    }
  }

  // If on login page and already authenticated, redirect to role-based dashboard
  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = getRoleDashboardPath(user.role);
    return NextResponse.redirect(url);
  }

  // In dev mode, use simple cookie check for other protected routes
  if (DEV_MODE) {
    const devUserUid = request.cookies.get('dev_user_uid')?.value;
    
    if (isProtectedPath && !devUserUid) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }
  
  // Production mode: use Supabase session management
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
