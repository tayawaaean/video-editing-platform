import 'server-only';

import { google } from 'googleapis';
import { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

type AuthMode = 'service_account' | 'oauth2';

interface DriveCredentials {
  mode: AuthMode;
  rootFolderId?: string;
}

function getServiceAccountCredentials(): DriveCredentials | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!email || !privateKey) return null;
  return { mode: 'service_account', rootFolderId: rootFolderId || undefined };
}

function getOAuth2Credentials(): (DriveCredentials & {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return {
    mode: 'oauth2',
    clientId,
    clientSecret,
    refreshToken,
    rootFolderId: rootFolderId || undefined,
  };
}

/** When true, use OAuth2 even if service account is set (e.g. org policy iam.disableServiceAccountKeyCreation). */
function forceOAuth2(): boolean {
  const v = process.env.GOOGLE_DRIVE_USE_OAUTH2;
  return v === 'true' || v === '1';
}

/** Prefer Service Account when allowed; otherwise use OAuth2. */
function getCredentials(): DriveCredentials | null {
  if (!forceOAuth2()) {
    const sa = getServiceAccountCredentials();
    if (sa) return sa;
  }
  return getOAuth2Credentials();
}

function getDriveClient(): ReturnType<typeof google.drive> {
  const useOAuth2 = forceOAuth2();
  const sa = useOAuth2 ? null : getServiceAccountCredentials();
  if (sa) {
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey || undefined,
      },
      scopes: SCOPES,
    });
    return google.drive({ version: 'v3', auth });
  }

  const oauth = getOAuth2Credentials();
  if (!oauth) {
    throw new Error(
      'Google Drive not configured. Set either (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY) or (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN).'
    );
  }

  const oauth2Client = new google.auth.OAuth2(oauth.clientId, oauth.clientSecret);
  oauth2Client.setCredentials({ refresh_token: oauth.refreshToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Check if Google Drive is properly configured (Service Account or OAuth2).
 */
export function isGoogleDriveConfigured(): boolean {
  return !!getCredentials();
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
 * Create or get a single folder by name under the root folder.
 */
async function getOrCreateNamedFolder(
  drive: ReturnType<typeof google.drive>,
  folderName: string,
  rootFolderId?: string
): Promise<string> {
  return getOrCreateFolder(drive, folderName, rootFolderId);
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
 * Organizes files in year/month folder structure.
 * Uses Service Account (no refresh token) or OAuth2.
 */
export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string = 'video/mp4',
  folderName?: string
): Promise<UploadToGoogleDriveResult> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        success: false,
        error:
          'Google Drive not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY + GOOGLE_DRIVE_FOLDER_ID, or OAuth2 (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).',
      };
    }

    const drive = getDriveClient();

    console.log('[google-drive] Upload mode:', credentials.mode);
    console.log('[google-drive] Root folder ID:', credentials.rootFolderId || 'My Drive root');

    const targetFolderId = folderName
      ? await getOrCreateNamedFolder(drive, folderName, credentials.rootFolderId)
      : await getOrCreateNamedFolder(drive, 'Archive', credentials.rootFolderId);

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
