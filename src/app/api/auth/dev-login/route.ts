import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DEV_MODE, DEV_PASSWORD, getDevUserByEmail } from '@/lib/dev-mode';

// POST /api/auth/dev-login - Development mode login
export async function POST(request: NextRequest) {
  if (!DEV_MODE) {
    return NextResponse.json({ error: 'Dev mode not enabled' }, { status: 403 });
  }

  try {
    const { email, password } = await request.json();

    if (password !== DEV_PASSWORD) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const user = getDevUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Set dev session cookie
    const cookieStore = await cookies();
    cookieStore.set('dev_user_uid', user.supabase_uid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
