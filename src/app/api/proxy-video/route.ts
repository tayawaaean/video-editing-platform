import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint to stream Google Drive videos
 * Tries multiple URL formats to maximize compatibility
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json({ error: 'Missing fileId parameter' }, { status: 400 });
  }

  // Validate fileId format (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return NextResponse.json({ error: 'Invalid fileId format' }, { status: 400 });
  }

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // List of URL formats to try (in order of likelihood to work)
  const urlsToTry = [
    // Google's media content endpoint (often works for public files)
    `https://lh3.googleusercontent.com/d/${fileId}`,
    // Direct download with export
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    // View format
    `https://drive.google.com/uc?id=${fileId}&export=view`,
  ];

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'video/*,*/*',
        },
        redirect: 'follow',
      });

      // Check if we got actual video content (not HTML error page)
      const contentType = response.headers.get('content-type') || '';
      
      if (response.ok && contentType.startsWith('video/')) {
        // Success! Stream the video
        const headers = new Headers();
        headers.set('Content-Type', contentType);
        const contentLength = response.headers.get('content-length');
        if (contentLength) headers.set('Content-Length', contentLength);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Cache-Control', 'public, max-age=3600');

        return new NextResponse(response.body, {
          status: 200,
          headers,
        });
      }

      // If HTML, check for confirmation page (large files)
      if (response.ok && contentType.includes('text/html')) {
        const html = await response.text();
        const confirmMatch = html.match(/confirm=([^&"]+)/);
        
        if (confirmMatch) {
          const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`;
          const confirmResponse = await fetch(confirmUrl, {
            headers: { 'User-Agent': userAgent },
            redirect: 'follow',
          });

          const confirmContentType = confirmResponse.headers.get('content-type') || '';
          if (confirmResponse.ok && confirmContentType.startsWith('video/')) {
            const headers = new Headers();
            headers.set('Content-Type', confirmContentType);
            const cl = confirmResponse.headers.get('content-length');
            if (cl) headers.set('Content-Length', cl);
            headers.set('Accept-Ranges', 'bytes');
            headers.set('Cache-Control', 'public, max-age=3600');

            return new NextResponse(confirmResponse.body, {
              status: 200,
              headers,
            });
          }
        }
      }
    } catch {
      // Try next URL format
      continue;
    }
  }

  // All attempts failed
  return NextResponse.json(
    { 
      error: 'Video not accessible',
      message: 'This video cannot be streamed directly. Please ensure the Google Drive file sharing is set to "Anyone with the link" and downloads are enabled.'
    },
    { status: 403 }
  );
}
