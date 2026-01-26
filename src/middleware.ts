import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const DEV_MODE = process.env.NEXT_ENV === 'development';

export async function middleware(request: NextRequest) {
  // In dev mode, check for dev_user_uid cookie for protected routes
  if (DEV_MODE) {
    const devUserUid = request.cookies.get('dev_user_uid')?.value;
    const path = request.nextUrl.pathname;
    
    // Protected routes that require authentication
    const protectedPaths = ['/dashboard', '/submissions', '/admin'];
    const isProtectedPath = protectedPaths.some(p => path.startsWith(p));
    
    if (isProtectedPath && !devUserUid) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    
    // If on login page and already authenticated, redirect to dashboard
    if (path === '/login' && devUserUid) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
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
