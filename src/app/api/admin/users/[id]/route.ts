import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helper';
import { createClient } from '@/lib/supabase/server';
import { updateUserRoleSchema } from '@/lib/validations';
import { DEV_MODE, DEV_USERS } from '@/lib/dev-mode';
import type { User } from '@/types';

// In-memory store for dev mode
let devUsers = [...DEV_USERS];

// PATCH /api/admin/users/[id] - Update user role (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can update user roles
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = updateUserRoleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { role } = validationResult.data;

    if (DEV_MODE) {
      const index = devUsers.findIndex(u => u.id === id);
      if (index === -1) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      devUsers[index] = { ...devUsers[index], role };
      return NextResponse.json({ data: devUsers[index] });
    }

    // Update user role in Supabase (id here is the UUID from users table)
    const supabase = await createClient();
    const { data: updatedUserData, error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select('id, supabase_uid, email, role, created_at')
      .single();

    if (updateError || !updatedUserData) {
      console.error('Error updating user role:', updateError);
      return NextResponse.json(
        { error: updateError?.message || 'User not found' },
        { status: updateError?.code === 'PGRST116' ? 404 : 500 }
      );
    }

    const updatedUser: User = {
      id: updatedUserData.id,
      supabase_uid: updatedUserData.supabase_uid,
      email: updatedUserData.email,
      role: updatedUserData.role as User['role'],
      created_at: updatedUserData.created_at,
    };

    return NextResponse.json({ data: updatedUser });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
