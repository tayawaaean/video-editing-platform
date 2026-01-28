import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { getAuthUser } from '@/lib/auth-helper';

// Only use dev mode if explicitly enabled
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

function getRoleDashboardPath(role: string): string {
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

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApiRoute = path.startsWith('/api');
  const isAuthRoute = path.startsWith('/auth');
  const isLoginPage = path === '/login';

  // Allow API routes and auth routes to pass through
  if (isApiRoute || isAuthRoute) {
    return NextResponse.next();
  }

  // #region agent log
  const logData = {path, isLoginPage, cookies: Object.fromEntries(request.cookies.getAll().map(c => [c.name, c.value?.substring(0,20)+'...']))};
  fetch('http://127.0.0.1:7246/ingest/124e22f8-f142-4503-b883-06c83e5aa8c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:24',message:'Middleware entry',data:logData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'2,4,5,6'})}).catch(()=>{});
  // #endregion

  // In production mode, update Supabase session first to ensure cookies are available
  let response: NextResponse;
  let supabaseUser: { id: string; email?: string } | null = null;
  let supabase: any = null;

  if (!DEV_MODE) {
    // Initialize response first
    response = NextResponse.next({ request });

    // Create Supabase client to get user directly from session
    const { createServerClient } = await import('@supabase/ssr');
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // #region agent log
    const cookieNames = request.cookies.getAll().map(c => c.name);
    const supabaseCookieNames = cookieNames.filter(name => name.includes('supabase') || name.includes('sb-'));
    console.log('Middleware: Available cookies:', cookieNames);
    console.log('Middleware: Supabase cookies:', supabaseCookieNames);
    fetch('http://127.0.0.1:7246/ingest/124e22f8-f142-4503-b883-06c83e5aa8c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:52',message:'Before Supabase getSession',data:{cookieNames,supabaseCookieNames,cookieCount:request.cookies.getAll().length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'2,5'})}).catch(()=>{});
    // #endregion

    // First get session to refresh it, then get user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Middleware: getSession result:', { hasSession: !!session, hasUser: !!session?.user, error: sessionError?.message });
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/124e22f8-f142-4503-b883-06c83e5aa8c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:69',message:'Supabase getSession result',data:{hasSession:!!session,hasUser:!!session?.user,userId:session?.user?.id,userEmail:session?.user?.email,sessionError:sessionError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'2,5,6'})}).catch(()=>{});
    // #endregion
    
    if (session?.user) {
      supabaseUser = session.user;
    } else {
      // Fallback: try getUser directly
      const { data: { user: sessionUser }, error: getUserError } = await supabase.auth.getUser();
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/124e22f8-f142-4503-b883-06c83e5aa8c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:77',message:'Supabase getUser fallback',data:{hasUser:!!sessionUser,userId:sessionUser?.id,userEmail:sessionUser?.email,getUserError:getUserError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'2,5,6'})}).catch(()=>{});
      // #endregion
      supabaseUser = sessionUser || null;
    }
  } else {
    response = NextResponse.next();
  }

  // Get authenticated user (after session is updated)
  // Fetch user from Airtable (simple approach)
  let user, authError;
  if (supabaseUser && !DEV_MODE) {
    // Fetch user from Airtable
    try {
      const { getUserBySupabaseUid } = await import('@/lib/airtable');
      const userData = await getUserBySupabaseUid(supabaseUser.id);

      if (!userData) {
        user = null;
        authError = 'User not provisioned in Airtable';
      } else {
        user = userData;
        authError = undefined;
      }
    } catch (error) {
      user = null;
      authError = 'Failed to fetch user from Airtable';
    }
  } else {
    // No Supabase user or dev mode, try getAuthUser (which handles dev mode)
    const authResult = await getAuthUser();
    user = authResult.user;
    authError = authResult.error;
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/124e22f8-f142-4503-b883-06c83e5aa8c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:107',message:'Final getAuthUser result',data:{hasUser:!!user,userId:user?.id,userRole:user?.role,userEmail:user?.email,authError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'3,4,6'})}).catch(()=>{});
  // #endregion

  // Block /dashboard route - redirect to role-based dashboard or login
  if (path === '/dashboard') {
    if (user) {
      const redirectPath = getRoleDashboardPath(user.role);
      const url = request.nextUrl.clone();
      url.pathname = redirectPath;
      return NextResponse.redirect(url);
    } else {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  // Protected routes that require authentication
  const protectedPaths = ['/admin', '/reviewer', '/submitter', '/submissions', '/settings'];
  const isProtectedPath = protectedPaths.some(p => path.startsWith(p));

  if (isProtectedPath) {
    if (!user) {
      console.error('Middleware: Protected path accessed without user:', { path, authError });
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

    // Restrict /submissions/new to submitters only
    if (path === '/submissions/new' && user.role !== 'submitter') {
      const url = request.nextUrl.clone();
      url.pathname = getRoleDashboardPath(user.role);
      return NextResponse.redirect(url);
    }
  }

  // If on login page and already authenticated, redirect to role-based dashboard
  if (isLoginPage && user) {
    const redirectPath = getRoleDashboardPath(user.role);
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/124e22f8-f142-4503-b883-06c83e5aa8c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:98',message:'User on login page, redirecting to role dashboard',data:{userRole:user.role,redirectPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'4'})}).catch(()=>{});
    // #endregion
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
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
  
  // Production mode: return the response from updateSession (already called above)
  return response;
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
