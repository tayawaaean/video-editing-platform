import 'server-only';

import { google } from 'googleapis';
import { Readable } from 'stream';

// Google Drive API configuration
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// OAuth2 credentials from environment variables
function getOAuth2Credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken, rootFolderId };
}

// Create authenticated Google Drive client using OAuth2
function getDriveClient() {
  const credentials = getOAuth2Credentials();
  if (!credentials) {
    throw new Error('Google Drive OAuth2 credentials not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.');
  }

  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: credentials.refreshToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Helper to get credentials for other functions
function getCredentials() {
  return getOAuth2Credentials();
}

/**
 * Check if Google Drive is properly configured
 */
export function isGoogleDriveConfigured(): boolean {
  const credentials = getCredentials();
  return !!(credentials?.clientId && credentials?.clientSecret && credentials?.refreshToken);
}

/**
 * Get or create a folder by name within a parent folder
 */
async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string
): Promise<string> {
  // Search for existing folder
  const query = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  }

  // Create folder if it doesn't exist
  const folderMetadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    folderMetadata.parents = [parentId];
  }

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id',
  });

  return folder.data.id!;
}

/**
 * Create year/month folder structure and return the target folder ID
 * Structure: Root Folder / 2026 / 01
 */
async function getOrCreateDateFolder(
  drive: ReturnType<typeof google.drive>,
  rootFolderId?: string
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');

  // Create or get year folder
  const yearFolderId = await getOrCreateFolder(drive, year, rootFolderId);

  // Create or get month folder within year
  const monthFolderId = await getOrCreateFolder(drive, month, yearFolderId);

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
 * Uses OAuth2 to upload to the authenticated user's Drive
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
        error: 'Google Drive OAuth2 credentials not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.',
      };
    }

    const drive = getDriveClient();

    console.log('[google-drive] Starting upload with OAuth2');
    console.log('[google-drive] Root folder ID:', credentials.rootFolderId || 'My Drive root');

    // Get or create the date-based folder structure
    const targetFolderId = await getOrCreateDateFolder(drive, credentials.rootFolderId);

    console.log('[google-drive] Target folder ID for upload:', targetFolderId);

    // Create a readable stream from the buffer
    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null);

    console.log('[google-drive] Uploading file:', fileName, 'Size:', fileBuffer.length);

    // Upload the file
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
    await drive.files.delete({ fileId });
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
