import 'server-only';

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getStorage, Storage } from 'firebase-admin/storage';

// Firebase Admin configuration from environment variables
// Parse the private key - handle various escaping formats
function parsePrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  
  let parsed = key;
  
  // Remove surrounding quotes if present (common when copying from JSON)
  parsed = parsed.trim();
  if ((parsed.startsWith('"') && parsed.endsWith('"')) || 
      (parsed.startsWith("'") && parsed.endsWith("'"))) {
    parsed = parsed.slice(1, -1);
  }
  
  // Replace escaped newlines with actual newlines
  // Handle both \\n (double-escaped) and \n (single-escaped as literal characters)
  parsed = parsed.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  
  // Validate key format
  if (!parsed.includes('-----BEGIN PRIVATE KEY-----') || !parsed.includes('-----END PRIVATE KEY-----')) {
    console.error('[firebase-admin] Private key does not appear to be in valid PEM format');
    console.error('[firebase-admin] Key starts with:', parsed.substring(0, 50));
    return undefined;
  }
  
  return parsed;
}

const adminConfig = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: parsePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
};

const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

// Initialize Firebase Admin app (singleton pattern)
let adminApp: App | null = null;
let adminStorage: Storage | null = null;

function getAdminApp(): App | null {
  if (!adminConfig.projectId || !adminConfig.clientEmail || !adminConfig.privateKey) {
    console.warn('Firebase Admin not configured. Missing:', {
      projectId: !adminConfig.projectId,
      clientEmail: !adminConfig.clientEmail,
      privateKey: !adminConfig.privateKey,
    });
    return null;
  }

  if (!adminApp && getApps().length === 0) {
    try {
      adminApp = initializeApp({
        credential: cert({
          projectId: adminConfig.projectId,
          clientEmail: adminConfig.clientEmail,
          privateKey: adminConfig.privateKey,
        }),
        storageBucket,
      });
    } catch (error) {
      console.error('[firebase-admin] Failed to initialize app:', error);
      // Log key info for debugging (without exposing the full key)
      const key = adminConfig.privateKey;
      console.error('[firebase-admin] Key length:', key.length);
      console.error('[firebase-admin] Key has BEGIN:', key.includes('-----BEGIN PRIVATE KEY-----'));
      console.error('[firebase-admin] Key has END:', key.includes('-----END PRIVATE KEY-----'));
      console.error('[firebase-admin] Key has actual newlines:', key.includes('\n'));
      console.error('[firebase-admin] Key has escaped newlines:', key.includes('\\n'));
      throw error;
    }
  } else if (!adminApp) {
    adminApp = getApps()[0];
  }

  return adminApp;
}

export function getAdminStorage(): Storage | null {
  const app = getAdminApp();
  if (!app) return null;

  if (!adminStorage) {
    adminStorage = getStorage(app);
  }

  return adminStorage;
}

/**
 * Download a file from Firebase Storage as a Buffer
 * Used for archiving to Google Drive
 * @param filePath The path of the file in Firebase Storage
 * @returns Promise with the file buffer or null if failed
 */
export async function downloadFileFromFirebase(filePath: string): Promise<Buffer | null> {
  const storage = getAdminStorage();
  
  if (!storage) {
    console.error('Firebase Admin Storage not configured');
    return null;
  }

  try {
    const bucket = storage.bucket();
    const file = bucket.file(filePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      console.error(`File does not exist: ${filePath}`);
      return null;
    }

    const [buffer] = await file.download();
    return buffer;
  } catch (error) {
    console.error('Error downloading file from Firebase:', error);
    return null;
  }
}

/**
 * Delete a file from Firebase Storage (server-side)
 * @param filePath The path of the file to delete
 * @returns Promise indicating success or failure
 */
export async function deleteFileFromFirebaseAdmin(filePath: string): Promise<boolean> {
  const storage = getAdminStorage();
  
  if (!storage) {
    console.error('Firebase Admin Storage not configured');
    return false;
  }

  try {
    const bucket = storage.bucket();
    const file = bucket.file(filePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`File does not exist (already deleted?): ${filePath}`);
      return true; // Consider it a success if the file doesn't exist
    }

    await file.delete();
    return true;
  } catch (error) {
    console.error('Error deleting file from Firebase:', error);
    return false;
  }
}

/**
 * Get file metadata from Firebase Storage
 * @param filePath The path of the file
 * @returns Promise with file metadata or null
 */
export async function getFileMetadata(filePath: string): Promise<{
  name: string;
  contentType: string;
  size: number;
} | null> {
  const storage = getAdminStorage();
  
  if (!storage) {
    console.error('Firebase Admin Storage not configured');
    return null;
  }

  try {
    const bucket = storage.bucket();
    const file = bucket.file(filePath);
    
    const [metadata] = await file.getMetadata();
    
    return {
      name: metadata.name || filePath.split('/').pop() || 'video',
      contentType: metadata.contentType || 'video/mp4',
      size: parseInt(metadata.size as string, 10) || 0,
    };
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return null;
  }
}

/**
 * Check if Firebase Admin is properly configured
 */
export function isFirebaseAdminConfigured(): boolean {
  return !!(
    adminConfig.projectId &&
    adminConfig.clientEmail &&
    adminConfig.privateKey &&
    storageBucket
  );
}
