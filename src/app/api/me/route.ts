import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helper';

export async function GET() {
  try {
    const { user, error } = await getAuthUser();

    if (!user) {
      const status = error === 'User not provisioned' ? 403 : 401;
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status }
      );
    }

    return NextResponse.json({
      data: {
        id: user.id,
        supabase_uid: user.supabase_uid,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
