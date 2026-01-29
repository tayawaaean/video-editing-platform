'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  FirebaseStorage,
  UploadTaskSnapshot,
} from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase app (singleton pattern)
let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey || !firebaseConfig.storageBucket) {
    console.warn('Firebase not configured. Please add Firebase environment variables.');
    return null;
  }

  if (!app && getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else if (!app) {
    app = getApps()[0];
  }

  return app;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  if (!storage) {
    storage = getStorage(firebaseApp);
  }

  return storage;
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number; // 0-100
  state: 'running' | 'paused' | 'success' | 'canceled' | 'error';
}

export interface UploadResult {
  success: boolean;
  downloadUrl?: string;
  filePath?: string;
  error?: string;
}

/**
 * Upload a video file to Firebase Storage with progress tracking
 * @param file The file to upload
 * @param onProgress Callback for upload progress updates
 * @returns Promise with upload result
 */
export async function uploadVideoToFirebase(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const storageInstance = getFirebaseStorage();
  
  if (!storageInstance) {
    return {
      success: false,
      error: 'Firebase Storage not configured. Please add Firebase environment variables.',
    };
  }

  // Generate unique file path: videos/{timestamp}_{originalFilename}
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `videos/${timestamp}_${sanitizedFilename}`;
  
  const storageRef = ref(storageInstance, filePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve) => {
    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        
        if (onProgress) {
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            progress,
            state: snapshot.state as UploadProgress['state'],
          });
        }
      },
      (error) => {
        console.error('Upload error:', error);
        resolve({
          success: false,
          error: error.message || 'Upload failed',
        });
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            success: true,
            downloadUrl,
            filePath,
          });
        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get download URL',
          });
        }
      }
    );
  });
}

/**
 * Delete a video file from Firebase Storage
 * @param filePath The path of the file to delete
 * @returns Promise indicating success or failure
 */
export async function deleteVideoFromFirebase(filePath: string): Promise<boolean> {
  const storageInstance = getFirebaseStorage();
  
  if (!storageInstance) {
    console.error('Firebase Storage not configured');
    return false;
  }

  try {
    const storageRef = ref(storageInstance, filePath);
    await deleteObject(storageRef);
    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
}

/**
 * Check if Firebase is properly configured
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.storageBucket &&
    firebaseConfig.projectId
  );
}

/**
 * Get the Firebase Storage bucket URL for display purposes
 */
export function getStorageBucketName(): string | null {
  return firebaseConfig.storageBucket || null;
}
