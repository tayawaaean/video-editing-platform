import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import {
  getUserBySupabaseUid,
  updateUserRole,
  deleteAirtableUser,
  getSubmissionsByUser,
  deleteCommentsByUser,
  deleteCommentsBySubmission,
  deleteVersionsBySubmission,
  deleteSubmission,
  getFirebasePathsForSubmission,
} from '@/lib/airtable';
import { deleteFileFromFirebaseAdmin } from '@/lib/firebase-admin';
import { updateUserRoleSchema } from '@/lib/validations';

// Get Supabase admin client for database operations
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// PATCH /api/admin/users/[id] - Update user role (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can update user roles
    if (session.user.role !== 'admin') {
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

    // Update user role in Supabase users table
    const supabase = getSupabaseAdmin();
    
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select('id, email, role, created_at')
      .single();

    if (updateError) {
      console.error('Error updating user role:', updateError);
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    // Sync role to Airtable (id is Supabase user id; Airtable links via supabase_uid)
    try {
      const airtableUser = await getUserBySupabaseUid(id);
      if (airtableUser) {
        await updateUserRole(airtableUser.id, role);
      }
    } catch (airtableError) {
      console.warn('Airtable role sync failed:', airtableError);
    }

    return NextResponse.json({
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        created_at: updatedUser.created_at,
      },
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - Delete a user with cascade (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can delete users
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Prevent self-deletion
    if (session.user.id === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    
    // Verify user exists in Supabase
    const { data: supabaseUser, error: findError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', id)
      .single();

    if (findError || !supabaseUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[Delete User] Starting cascade delete for user: ${supabaseUser.email} (${id})`);

    // Track deletion stats for response
    const stats = {
      submissions: 0,
      comments: 0,
      versions: 0,
      firebaseFiles: 0,
    };

    // 1. Get all submissions by this user
    let userSubmissions: Awaited<ReturnType<typeof getSubmissionsByUser>> = [];
    try {
      userSubmissions = await getSubmissionsByUser(id);
      console.log(`[Delete User] Found ${userSubmissions.length} submissions to delete`);
    } catch (err) {
      console.warn('[Delete User] Failed to get user submissions from Airtable:', err);
    }

    // 2. For each submission, delete related data
    for (const submission of userSubmissions) {
      try {
        // Get Firebase paths before deleting (includes versions)
        const firebasePaths = await getFirebasePathsForSubmission(submission.id);
        
        // Delete comments on this submission
        await deleteCommentsBySubmission(submission.id);
        stats.comments++;
        
        // Delete versions
        await deleteVersionsBySubmission(submission.id);
        stats.versions++;
        
        // Delete Firebase files
        for (const path of firebasePaths) {
          const deleted = await deleteFileFromFirebaseAdmin(path);
          if (deleted) {
            stats.firebaseFiles++;
            console.log(`[Delete User] Deleted Firebase file: ${path}`);
          }
        }
        
        // Delete the submission itself
        await deleteSubmission(submission.id);
        stats.submissions++;
        
        console.log(`[Delete User] Deleted submission: ${submission.id}`);
      } catch (submissionError) {
        console.error(`[Delete User] Error deleting submission ${submission.id}:`, submissionError);
        // Continue with other submissions
      }
    }

    // 3. Delete user's comments on OTHER submissions
    try {
      await deleteCommentsByUser(id);
      console.log('[Delete User] Deleted user comments on other submissions');
    } catch (err) {
      console.warn('[Delete User] Failed to delete user comments:', err);
    }

    // 4. Delete Airtable user record
    try {
      const airtableUser = await getUserBySupabaseUid(id);
      if (airtableUser) {
        await deleteAirtableUser(airtableUser.id);
        console.log('[Delete User] Deleted Airtable user record');
      }
    } catch (err) {
      console.warn('[Delete User] Failed to delete Airtable user:', err);
    }

    // 5. Delete Supabase user record (last step)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting user from Supabase:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete user from database' },
        { status: 500 }
      );
    }

    console.log(`[Delete User] Successfully deleted user ${supabaseUser.email}`, stats);

    return NextResponse.json({
      success: true,
      deleted: {
        user: supabaseUser.email,
        ...stats,
      },
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
