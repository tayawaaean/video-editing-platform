// Google Drive URL parsing and validation utilities

export interface GoogleDriveParseResult {
  success: boolean;
  fileId?: string;
  embedUrl?: string;
  error?: string;
}

/**
 * Extracts the file ID from various Google Drive URL formats
 * Supported formats:
 * - https://drive.google.com/file/d/{FILE_ID}/view?...
 * - https://drive.google.com/open?id={FILE_ID}
 * - https://drive.google.com/uc?id={FILE_ID}
 * - https://drive.google.com/file/d/{FILE_ID}/preview
 */
export function parseGoogleDriveUrl(url: string): GoogleDriveParseResult {
  if (!url || typeof url !== 'string') {
    return {
      success: false,
      error: 'Please provide a valid URL',
    };
  }

  // Trim and clean the URL
  const cleanUrl = url.trim();

  // Check if it's a Google Drive URL
  if (!cleanUrl.includes('drive.google.com')) {
    return {
      success: false,
      error: 'URL must be a Google Drive link',
    };
  }

  let fileId: string | null = null;

  // Pattern 1: /file/d/{FILE_ID}/
  const filePattern = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const fileMatch = cleanUrl.match(filePattern);
  if (fileMatch) {
    fileId = fileMatch[1];
  }

  // Pattern 2: ?id={FILE_ID} or &id={FILE_ID}
  if (!fileId) {
    const idPattern = /[?&]id=([a-zA-Z0-9_-]+)/;
    const idMatch = cleanUrl.match(idPattern);
    if (idMatch) {
      fileId = idMatch[1];
    }
  }

  // Pattern 3: /folders/{FOLDER_ID} - reject folders
  if (cleanUrl.includes('/folders/')) {
    return {
      success: false,
      error: 'Folder links are not supported. Please provide a direct file link.',
    };
  }

  if (!fileId) {
    return {
      success: false,
      error: 'Could not extract file ID from the URL. Please use a direct file sharing link.',
    };
  }

  // Validate file ID format (alphanumeric with underscores and hyphens)
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return {
      success: false,
      error: 'Invalid file ID format',
    };
  }

  // Generate embed URL
  const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

  return {
    success: true,
    fileId,
    embedUrl,
  };
}

/**
 * Validates a Google Drive URL and returns the embed URL
 */
export function getEmbedUrl(googleDriveUrl: string): string | null {
  const result = parseGoogleDriveUrl(googleDriveUrl);
  return result.success ? result.embedUrl! : null;
}

/**
 * Formats seconds into a readable timestamp (MM:SS or HH:MM:SS)
 */
export function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parses a timestamp string (MM:SS or HH:MM:SS) into seconds
 */
export function parseTimestamp(timestamp: string): number | null {
  const parts = timestamp.split(':').map(p => parseInt(p, 10));
  
  if (parts.some(isNaN)) {
    return null;
  }

  if (parts.length === 2) {
    // MM:SS format
    const [mins, secs] = parts;
    if (mins < 0 || secs < 0 || secs >= 60) return null;
    return mins * 60 + secs;
  } else if (parts.length === 3) {
    // HH:MM:SS format
    const [hrs, mins, secs] = parts;
    if (hrs < 0 || mins < 0 || mins >= 60 || secs < 0 || secs >= 60) return null;
    return hrs * 3600 + mins * 60 + secs;
  }

  return null;
}
