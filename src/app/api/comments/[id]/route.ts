import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCommentById, deleteComment, getCommentsBySubmission } from '@/lib/airtable';

// DELETE /api/comments/[id] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId, role } = session.user;
    const { id: commentId } = await params;

    // Get the comment to check ownership
    const comment = await getCommentById(commentId);
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only the comment author or admin can delete
    const isAdmin = role === 'admin';
    const isOwner = comment.user_uid === userId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 });
    }

    // Check if this comment has replies - if so, don't allow deletion (or cascade delete)
    const allComments = await getCommentsBySubmission(comment.submission_id);
    const hasReplies = allComments.some(c => c.parent_comment_id === commentId);

    if (hasReplies) {
      // Delete all replies first (cascade delete)
      const replies = allComments.filter(c => c.parent_comment_id === commentId);
      for (const reply of replies) {
        await deleteComment(reply.id);
      }
    }

    // Delete the comment
    await deleteComment(commentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
