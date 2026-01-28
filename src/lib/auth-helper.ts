// Server-side auth helper that works in both dev and production mode

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { DEV_MODE, getDevUserByUid, DEV_USERS } from '@/lib/dev-mode';
import type { User } from '@/types';

export interface AuthResult {
  user: User | null;
  supabaseUid: string | null;
  error?: string;
}

export async function getAuthUser(request?: { cookies: { getAll: () => Array<{ name: string; value: string }> } }): Promise<AuthResult> {
  if (DEV_MODE) {
    // Dev mode - check cookie
    const cookieStore = await cookies();
    const devUid = cookieStore.get('dev_user_uid')?.value;
    
    if (!devUid) {
      return { user: null, supabaseUid: null, error: 'Not authenticated' };
    }
    
    const user = getDevUserByUid(devUid);
    if (!user) {
      return { user: null, supabaseUid: devUid, error: 'User not found' };
    }
    
    return { user, supabaseUid: devUid };
  }

  // Production mode - use Supabase for auth and user data
  // If request is provided (API route), use it directly. Otherwise use cookies() (Server Component)
  let cookieGetter: () => Array<{ name: string; value: string }>;
  
  if (request) {
    // API route - use request cookies
    cookieGetter = () => request.cookies.getAll();
  } else {
    // Server Component - use Next.js cookies()
    const cookieStore = await cookies();
    cookieGetter = () => cookieStore.getAll();
  }

  // Create Supabase client with the appropriate cookie source
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: cookieGetter,
        setAll() {
          // Can't set cookies in API routes, but that's OK
        },
      },
    }
  );
  
  // Use getUser() directly (recommended by Supabase for security)
  const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
  
  console.log('getAuthUser: getUser result:', { 
    hasUser: !!supabaseUser, 
    userId: supabaseUser?.id,
    userEmail: supabaseUser?.email,
    error: authError?.message,
    errorCode: authError?.status,
    fullError: authError ? JSON.stringify(authError, Object.getOwnPropertyNames(authError), 2) : null
  });
  
  if (authError || !supabaseUser) {
    console.error('getAuthUser: Supabase auth error:', authError?.message || 'No user found');
    console.error('getAuthUser: Auth error code:', authError?.status);
    if (authError) {
      console.error('getAuthUser: Full auth error:', JSON.stringify(authError, Object.getOwnPropertyNames(authError), 2));
    }
    
    // Check if it's a JWT expiration issue
    if (authError?.message?.includes('JWT') || authError?.message?.includes('expired') || authError?.message?.includes('token')) {
      return { user: null, supabaseUid: null, error: 'Session expired. Please log in again.' };
    }
    
    return { user: null, supabaseUid: null, error: authError?.message || 'Not authenticated' };
  }
  
  console.log('getAuthUser: Supabase user found:', supabaseUser.id);

  // Fetch user from Supabase users table
  try {
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('id, supabase_uid, email, role, created_at')
      .eq('supabase_uid', supabaseUser.id)
      .single();

    if (dbError || !userData) {
      console.error('getAuthUser: Database error:', dbError?.message || 'User not found in users table');
      return { user: null, supabaseUid: supabaseUser.id, error: dbError?.message || 'User not provisioned in database' };
    }

    return { 
      user: {
        id: userData.id,
        supabase_uid: userData.supabase_uid,
        email: userData.email,
        role: userData.role,
        created_at: userData.created_at,
      }, 
      supabaseUid: supabaseUser.id 
    };
  } catch (error) {
    console.error('Error fetching user from Supabase:', error);
    return { user: null, supabaseUid: supabaseUser.id, error: 'Failed to fetch user from database' };
  }
}

// Get all users (for admin)
export async function getUsers(): Promise<User[]> {
  if (DEV_MODE) {
    return DEV_USERS;
  }

  // Fetch users from Supabase
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Can't set cookies in Server Components, but that's OK
        },
      },
    }
  );
  const { data: users, error } = await supabase
    .from('users')
    .select('id, supabase_uid, email, role, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users from Supabase:', error);
    return [];
  }

  return users || [];
}
