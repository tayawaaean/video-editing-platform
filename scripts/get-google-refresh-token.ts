/**
 * Script to get Google OAuth2 refresh token for Google Drive API
 * 
 * Prerequisites:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com/
 * 2. Create a new project or select existing one
 * 3. Enable Google Drive API: APIs & Services > Library > Google Drive API > Enable
 * 4. Create OAuth2 credentials:
 *    - APIs & Services > Credentials > Create Credentials > OAuth client ID
 *    - Application type: Web application
 *    - Add authorized redirect URI: http://localhost:3000/api/auth/callback/google
 *    - Also add: http://localhost:3001 (for this script)
 * 5. Download the credentials and get Client ID and Client Secret
 * 
 * Usage:
 * 1. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env.local
 * 2. Run: npx ts-node scripts/get-google-refresh-token.ts
 * 3. Open the URL in your browser
 * 4. Authorize the application
 * 5. Copy the refresh token and add it to .env.local as GOOGLE_REFRESH_TOKEN
 */

import http from 'http';
import { URL, URLSearchParams } from 'url';
import open from 'open';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local\n');
  console.log('Steps to get these credentials:');
  console.log('1. Go to https://console.cloud.google.com/');
  console.log('2. Create a new project or select existing one');
  console.log('3. Enable Google Drive API: APIs & Services > Library > Google Drive API');
  console.log('4. Create OAuth2 credentials: APIs & Services > Credentials > Create Credentials > OAuth client ID');
  console.log('5. Application type: Web application');
  console.log('6. Add authorized redirect URI: http://localhost:3001');
  console.log('7. Copy Client ID and Client Secret to your .env.local\n');
  process.exit(1);
}

// Generate auth URL
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES.join(' '));
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token

console.log('\n🔐 Google Drive OAuth2 Setup\n');
console.log('Opening browser for authorization...\n');
console.log('If the browser does not open, visit this URL manually:');
console.log(authUrl.toString());
console.log('\n');

// Start local server to receive the callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  
  if (url.pathname === '/' && url.searchParams.has('code')) {
    const code = url.searchParams.get('code')!;
    
    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID!,
          client_secret: CLIENT_SECRET!,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json() as { refresh_token?: string; access_token?: string; error?: string; error_description?: string };

      if (tokens.error) {
        throw new Error(`${tokens.error}: ${tokens.error_description}`);
      }

      if (!tokens.refresh_token) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
              <h1>⚠️ No Refresh Token</h1>
              <p>Google did not return a refresh token. This usually happens if you've already authorized this app before.</p>
              <p>To fix this:</p>
              <ol>
                <li>Go to <a href="https://myaccount.google.com/permissions">Google Account Permissions</a></li>
                <li>Find and remove this app's access</li>
                <li>Run this script again</li>
              </ol>
            </body>
          </html>
        `);
        console.log('\n⚠️ No refresh token received. See browser for instructions.\n');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
              <h1>✅ Success!</h1>
              <p>Add this to your <code>.env.local</code> file:</p>
              <pre style="background: #f0f0f0; padding: 15px; border-radius: 5px; overflow-x: auto; word-break: break-all;">GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</pre>
              <p>You can close this window now.</p>
            </body>
          </html>
        `);

        console.log('\n✅ Success! Add this to your .env.local:\n');
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: sans-serif; padding: 40px;">
            <h1>❌ Error</h1>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          </body>
        </html>
      `);
      console.error('\n❌ Error:', error);
    }

    // Close server after handling request
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 1000);
  } else if (url.searchParams.has('error')) {
    const error = url.searchParams.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: sans-serif; padding: 40px;">
          <h1>❌ Authorization Denied</h1>
          <p>Error: ${error}</p>
        </body>
      </html>
    `);
    console.error('\n❌ Authorization denied:', error);
    server.close();
    process.exit(1);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>Waiting for authorization...</body></html>');
  }
});

server.listen(3001, () => {
  console.log('Listening on http://localhost:3001 for callback...\n');
  
  // Open browser
  open(authUrl.toString()).catch(() => {
    console.log('Could not open browser automatically. Please open the URL above manually.');
  });
});
