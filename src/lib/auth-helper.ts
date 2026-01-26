// Server-side auth helper that works in both dev and production mode

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { DEV_MODE, getDevUserByUid, DEV_USERS } from '@/lib/dev-mode';
import { getUserBySupabaseUid, getAllUsers } from '@/lib/airtable';
import type { User } from '@/types';

export interface AuthResult {
  user: User | null;
  supabaseUid: string | null;
  error?: string;
}

export async function getAuthUser(): Promise<AuthResult> {
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

  // Production mode - use Supabase
  const supabase = await createClient();
  const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !supabaseUser) {
    return { user: null, supabaseUid: null, error: 'Not authenticated' };
  }

  const user = await getUserBySupabaseUid(supabaseUser.id);
  if (!user) {
    return { user: null, supabaseUid: supabaseUser.id, error: 'User not provisioned' };
  }

  return { user, supabaseUid: supabaseUser.id };
}

// Get all users (for admin)
export async function getUsers(): Promise<User[]> {
  if (DEV_MODE) {
    return DEV_USERS;
  }
  return getAllUsers();
}
