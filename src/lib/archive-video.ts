import 'server-only';

import {
  getSubmissionById,
  updateSubmissionAfterArchive,
  getFirebasePathsForSubmission,
  clearVersionsFirebaseFields,
} from '@/lib/airtable';
import { downloadFileFromFirebase, deleteFileFromFirebaseAdmin, getFileMetadata } from '@/lib/firebase-admin';
import { uploadToGoogleDrive, isGoogleDriveConfigured } from '@/lib/google-drive-upload';

export interface ArchiveResult {
  success: boolean;
  googleDriveFileId?: string;
  googleDriveUrl?: string;
  embedUrl?: string;
  firebaseDeleted?: boolean;
  firebaseFilesDeleted?: number;
  error?: string;
}

/**
 * Archive a submission's video from Firebase Storage to Google Drive.
 * Downloads from Firebase, uploads to Google Drive, updates Airtable, and deletes from Firebase.
 *
 * @param submissionId - The Airtable record ID for the submission
 * @param logPrefix - Optional prefix for log messages (e.g. "[auto-archive]")
 */
export async function archiveVideoToGoogleDrive(
  submissionId: string,
  logPrefix = '[archive]'
): Promise<ArchiveResult> {
  if (!isGoogleDriveConfigured()) {
    return { success: false, error: 'Google Drive is not configured' };
  }

  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    return { success: false, error: 'Submission not found' };
  }

  if (submission.video_source !== 'firebase') {
    return { success: false, error: 'Submission is not using Firebase storage' };
  }

  if (!submission.firebase_video_path) {
    return { success: false, error: 'Firebase video path is missing' };
  }

  // Collect all Firebase paths BEFORE updating Airtable (once we update, submission loses firebase path)
  const allFirebasePaths = await getFirebasePathsForSubmission(submissionId);
  console.log(`${logPrefix} Found ${allFirebasePaths.length} Firebase file(s) to delete`);

  // Get file metadata
  const metadata = await getFileMetadata(submission.firebase_video_path);
  if (!metadata) {
    return { success: false, error: 'Could not get video metadata from Firebase' };
  }

  // Download video from Firebase
  console.log(`${logPrefix} Downloading video from Firebase: ${submission.firebase_video_path}`);
  const videoBuffer = await downloadFileFromFirebase(submission.firebase_video_path);
  if (!videoBuffer) {
    return { success: false, error: 'Failed to download video from Firebase' };
  }

  // Generate filename for Google Drive
  const sanitizedTitle = submission.title.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
  const extension = metadata.name.split('.').pop() || 'mp4';
  const driveFileName = `${sanitizedTitle}_${submissionId}.${extension}`;

  // Upload to Google Drive
  console.log(`${logPrefix} Uploading to Google Drive: ${driveFileName}`);
  const uploadResult = await uploadToGoogleDrive(
    videoBuffer,
    driveFileName,
    metadata.contentType
  );

  if (!uploadResult.success || !uploadResult.embedUrl) {
    return { success: false, error: uploadResult.error || 'Failed to upload to Google Drive' };
  }

  // Update Airtable with new Google Drive URL
  console.log(`${logPrefix} Updating Airtable submission ${submissionId}`);
  await updateSubmissionAfterArchive(
    submissionId,
    uploadResult.webViewLink || uploadResult.embedUrl,
    uploadResult.embedUrl
  );

  // Delete all Firebase files (current + versions)
  let deletedCount = 0;
  for (const path of allFirebasePaths) {
    console.log(`${logPrefix} Deleting from Firebase: ${path}`);
    const deleted = await deleteFileFromFirebaseAdmin(path);
    if (deleted) {
      deletedCount++;
    } else {
      console.warn(`${logPrefix} Warning: Failed to delete ${path} from Firebase.`);
    }
  }

  // Clear Firebase fields from versions in Airtable
  console.log(`${logPrefix} Clearing Firebase fields from versions`);
  await clearVersionsFirebaseFields(submissionId);

  console.log(`${logPrefix} Archive complete for submission ${submissionId}. Deleted ${deletedCount}/${allFirebasePaths.length} Firebase files.`);

  return {
    success: true,
    googleDriveFileId: uploadResult.fileId,
    googleDriveUrl: uploadResult.webViewLink,
    embedUrl: uploadResult.embedUrl,
    firebaseDeleted: deletedCount > 0,
    firebaseFilesDeleted: deletedCount,
  };
}
