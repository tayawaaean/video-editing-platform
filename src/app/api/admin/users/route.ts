import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helper';
import { getAllUsers, createUser, getUserBySupabaseUid } from '@/lib/airtable';
import { updateUserRoleSchema, createUserSchema } from '@/lib/validations';
import { DEV_MODE, DEV_USERS } from '@/lib/dev-mode';
import type { User } from '@/types';

// In-memory store for dev mode
let devUsers = [...DEV_USERS];

// GET /api/admin/users - List all users (admin only)
export async function GET() {
  try {
    const { user } = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can access this endpoint
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (DEV_MODE) {
      return NextResponse.json({ data: devUsers });
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
    const { user } = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can create users
    if (user.role !== 'admin') {
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
    if (DEV_MODE) {
      const existingUser = devUsers.find(u => u.supabase_uid === supabase_uid);
      if (existingUser) {
        return NextResponse.json(
          { error: 'User with this Supabase UID already exists' },
          { status: 409 }
        );
      }
      const newUser: User = {
        id: `user-${Date.now()}`,
        supabase_uid,
        email,
        role,
        created_at: new Date().toISOString().split('T')[0],
      };
      devUsers.push(newUser);
      return NextResponse.json({ data: newUser }, { status: 201 });
    }

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
