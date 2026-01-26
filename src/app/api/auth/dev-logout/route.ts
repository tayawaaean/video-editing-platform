import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DEV_MODE } from '@/lib/dev-mode';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/dev-logout - Development mode logout
export async function POST() {
  if (DEV_MODE) {
    const cookieStore = await cookies();
    cookieStore.delete('dev_user_uid');
    return NextResponse.json({ success: true });
  }

  // Production mode
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
