import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client the same way middleware does
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Can't set cookies in API routes, but that's OK
          },
        },
      }
    );

    // Get user directly (same as middleware)
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !supabaseUser) {
      return NextResponse.json(
        { error: authError?.message || 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user from Airtable (simple approach)
    const { getUserBySupabaseUid } = await import('@/lib/airtable');
    const userData = await getUserBySupabaseUid(supabaseUser.id);

    if (!userData) {
      return NextResponse.json(
        { error: 'User not provisioned in Airtable' },
        { status: 403 }
      );
    }

    const body = {
      data: {
        id: userData.id,
        supabase_uid: userData.supabase_uid,
        email: userData.email,
        role: userData.role,
        created_at: userData.created_at,
      },
    };
    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'private, max-age=300',
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
