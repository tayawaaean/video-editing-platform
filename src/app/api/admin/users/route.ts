import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserBySupabaseUid, getAllUsers, updateUserRole, createUser } from '@/lib/airtable';
import { updateUserRoleSchema, createUserSchema } from '@/lib/validations';

// GET /api/admin/users - List all users (admin only)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const airtableUser = await getUserBySupabaseUid(user.id);
    if (!airtableUser) {
      return NextResponse.json({ error: 'User not provisioned' }, { status: 403 });
    }

    // Only admins can access this endpoint
    if (airtableUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const users = await getAllUsers();

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/users - Create a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const airtableUser = await getUserBySupabaseUid(user.id);
    if (!airtableUser) {
      return NextResponse.json({ error: 'User not provisioned' }, { status: 403 });
    }

    // Only admins can create users
    if (airtableUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { supabase_uid, email, role } = validationResult.data;

    // Check if user already exists
    const existingUser = await getUserBySupabaseUid(supabase_uid);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this Supabase UID already exists' },
        { status: 409 }
      );
    }

    const newUser = await createUser({
      supabase_uid,
      email,
      role,
    });

    return NextResponse.json({ data: newUser }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
