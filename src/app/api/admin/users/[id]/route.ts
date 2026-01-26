import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helper';
import { updateUserRole } from '@/lib/airtable';
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

    // Update user role (id here is the Airtable record ID)
    const updatedUser = await updateUserRole(id, role);

    return NextResponse.json({ data: updatedUser });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
