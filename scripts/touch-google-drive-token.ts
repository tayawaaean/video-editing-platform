/**
 * Touch the Google Drive OAuth2 refresh token so it is not revoked for inactivity.
 * Google may revoke refresh tokens that are unused for about 6 months.
 *
 * Run this script periodically (e.g. weekly via cron or Task Scheduler):
 *   npx tsx scripts/touch-google-drive-token.ts
 *
 * Requires in .env.local: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.
 * Optional: GOOGLE_DRIVE_FOLDER_ID (used for a minimal list call).
 */

import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config({ path: '.env.local' });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function main(): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error(
      'Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN in .env.local'
    );
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    if (FOLDER_ID) {
      await drive.files.list({
        q: `'${FOLDER_ID}' in parents and trashed = false`,
        pageSize: 1,
        fields: 'files(id)',
      });
    } else {
      await drive.files.list({
        pageSize: 1,
        fields: 'files(id)',
      });
    }
    console.log('Refresh token touched successfully.');
  } catch (err) {
    console.error('Touch failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
