import 'server-only';

import { google } from 'googleapis';
import { Readable } from 'stream';

// Google Drive API configuration
// Using drive scope for full access including Shared Drives
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Get credentials from environment variables
function getCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  // Shared Drive ID - required for service accounts without storage quota
  const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID;

  if (!email || !privateKey) {
    return null;
  }

  return { email, privateKey, rootFolderId, sharedDriveId };
}

// Create authenticated Google Drive client
function getDriveClient() {
  const credentials = getCredentials();
  if (!credentials) {
    throw new Error('Google Drive credentials not configured');
  }

  const auth = new google.auth.JWT({
    email: credentials.email,
    key: credentials.privateKey,
    scopes: SCOPES,
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Check if Google Drive is properly configured
 */
export function isGoogleDriveConfigured(): boolean {
  const credentials = getCredentials();
  return !!(credentials?.email && credentials?.privateKey);
}

/**
 * Get or create a folder by name within a parent folder
 * Supports both regular Drive and Shared Drives
 */
async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string,
  sharedDriveId?: string
): Promise<string> {
  // Search for existing folder
  const query = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
    // Required for Shared Drive support
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(sharedDriveId && { driveId: sharedDriveId, corpora: 'drive' }),
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  }

  // Create folder if it doesn't exist
  const folderMetadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  // Set parent - for Shared Drive root, use the drive ID as parent
  if (parentId) {
    folderMetadata.parents = [parentId];
  } else if (sharedDriveId) {
    folderMetadata.parents = [sharedDriveId];
  }

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id',
    supportsAllDrives: true,
  });

  return folder.data.id!;
}

/**
 * Create year/month folder structure and return the target folder ID
 * Structure: Root Folder / 2026 / 01
 */
async function getOrCreateDateFolder(
  drive: ReturnType<typeof google.drive>,
  rootFolderId?: string,
  sharedDriveId?: string
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');

  // Create or get year folder
  // If using Shared Drive without a specific folder, use Shared Drive root
  const yearFolderId = await getOrCreateFolder(drive, year, rootFolderId || sharedDriveId, sharedDriveId);

  // Create or get month folder within year
  const monthFolderId = await getOrCreateFolder(drive, month, yearFolderId, sharedDriveId);

  return monthFolderId;
}

/**
 * Make a file publicly viewable and return the shareable link
 */
async function makeFilePublic(
  drive: ReturnType<typeof google.drive>,
  fileId: string
): Promise<void> {
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  });
}

export interface UploadToGoogleDriveResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  embedUrl?: string;
  error?: string;
}

/**
 * Upload a video file to Google Drive
 * Organizes files in year/month folder structure
 * Supports both regular Drive and Shared Drives
 */
export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string = 'video/mp4'
): Promise<UploadToGoogleDriveResult> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        success: false,
        error: 'Google Drive credentials not configured',
      };
    }

    // Service accounts need a Shared Drive to upload files
    if (!credentials.sharedDriveId && !credentials.rootFolderId) {
      return {
        success: false,
        error: 'Google Drive Shared Drive ID or folder ID not configured. Service accounts require a Shared Drive.',
      };
    }

    const drive = getDriveClient();

    // Get or create the date-based folder structure
    const targetFolderId = await getOrCreateDateFolder(
      drive, 
      credentials.rootFolderId, 
      credentials.sharedDriveId
    );

    // Create a readable stream from the buffer
    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null);

    // Upload the file with Shared Drive support
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const fileId = response.data.id;
    if (!fileId) {
      return {
        success: false,
        error: 'Failed to get file ID after upload',
      };
    }

    // Make the file publicly viewable
    await makeFilePublic(drive, fileId);

    // Construct the embed URL
    const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;

    return {
      success: true,
      fileId,
      webViewLink,
      embedUrl,
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Delete a file from Google Drive
 */
export async function deleteFromGoogleDrive(fileId: string): Promise<boolean> {
  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId, supportsAllDrives: true });
    return true;
  } catch (error) {
    console.error('Error deleting from Google Drive:', error);
    return false;
  }
}

/**
 * Get file metadata from Google Drive
 */
export async function getGoogleDriveFileInfo(fileId: string): Promise<{
  name: string;
  mimeType: string;
  size: string;
} | null> {
  try {
    const drive = getDriveClient();
    const response = await drive.files.get({
      fileId,
      fields: 'name, mimeType, size',
      supportsAllDrives: true,
    });

    return {
      name: response.data.name || 'Unknown',
      mimeType: response.data.mimeType || 'video/mp4',
      size: response.data.size || '0',
    };
  } catch (error) {
    console.error('Error getting Google Drive file info:', error);
    return null;
  }
}
