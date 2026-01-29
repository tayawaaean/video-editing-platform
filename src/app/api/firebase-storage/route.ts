import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFirebaseStorageUsed } from '@/lib/airtable';

const DEFAULT_LIMIT_BYTES = 1073741824; // 1 GB

/**
 * GET /api/firebase-storage
 * Returns current Firebase temporary storage usage and limit for display on dashboards.
 * Available to all authenticated users (admin, reviewer, submitter).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const used = await getFirebaseStorageUsed();
    const limit = Number(process.env.FIREBASE_STORAGE_LIMIT_BYTES) || DEFAULT_LIMIT_BYTES;

    return NextResponse.json({
      used,
      limit,
      usedFormatted: formatBytes(used),
      limitFormatted: formatBytes(limit),
      percentUsed: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0,
    });
  } catch (error) {
    console.error('Error fetching Firebase storage usage:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch storage usage' },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
