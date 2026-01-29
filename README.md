# Video Review Platform

A professional video review and feedback platform built with Next.js, enabling collaborative video reviews with role-based access, timestamped feedback, frame annotations, version history, and cloud storage integration.

## Features

- **Role-Based Access Control** - Submitter, Reviewer, and Admin roles with granular permissions
- **Video Uploads** - Direct upload to Firebase Storage with progress tracking and file size limits
- **Google Drive Integration** - Submit videos via Google Drive links or archive approved videos to Drive
- **Timestamped Feedback** - Frame-accurate comments linked to specific moments in the video
- **Frame Annotations** - Pin-point annotations on video frames (Loom-style) with coordinate tracking
- **Threaded Discussions** - Reply to feedback for contextual conversations
- **Reviewer Notes** - Private annotations visible only to reviewers and admins
- **Revision Workflow** - Request revisions, track revision rounds, and link feedback to specific rounds
- **Version History** - Full version tracking across resubmissions with metadata preservation
- **Video Archival** - Automatic archival from Firebase to Google Drive after approval
- **Storage Quota Management** - Configurable storage limits with usage tracking per Firebase bucket
- **Metadata Editing** - In-place editing of submission title and description
- **Admin Dashboard** - User management, submission stats, and batch operations

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Compiler, Turbopack)
- **Language**: TypeScript 5
- **Authentication**: NextAuth (JWT strategy) + Supabase Auth
- **Database**: Airtable
- **Video Storage**: Firebase Storage (uploads) + Google Drive (archival)
- **File Storage**: Supabase Storage (attachments)
- **Styling**: Tailwind CSS 4
- **Validation**: Zod
- **Video Processing**: FFmpeg (server-side frame extraction)

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (authentication + attachment storage)
- Airtable account (data storage)
- Firebase project (video uploads)
- Google Cloud service account (Drive archival, optional)

## Setup Instructions

### 1. Clone and Install

```bash
cd video-editing
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy:
   - Project URL
   - Anon public key
   - Service role key
3. Create a **public** storage bucket for attachments (used for frame annotation images)

### 3. Airtable Setup

1. Create a new base in [Airtable](https://airtable.com)
2. Create the following tables:

#### Users Table
| Field | Type |
|-------|------|
| supabase_uid | Single line text |
| email | Email |
| role | Single select (submitter, reviewer, admin) |
| created_at | Date |

#### Submissions Table
| Field | Type |
|-------|------|
| title | Single line text (max 200 chars) |
| description | Long text (max 5000 chars) |
| embed_url | Single line text |
| google_drive_url | URL |
| submitter_uid | Single line text |
| status | Single select (pending, reviewing, approved, revision_requested) |
| video_source | Single select (firebase, google_drive) |
| firebase_video_path | Single line text |
| firebase_video_url | URL |
| firebase_video_size | Number (integer) |
| revision_round | Number (integer) |
| revision_requested_at | Date |
| created_at | Date |
| updated_at | Date |

#### Feedback Table
| Field | Type |
|-------|------|
| submission_id | Single line text |
| user_uid | Single line text |
| timestamp_seconds | Number |
| content | Long text |
| parent_comment_id | Single line text |
| attachment_url | Long text |
| attachment_pin_x | Number (0-1 normalized) |
| attachment_pin_y | Number (0-1 normalized) |
| attachment_pin_comment | Long text |
| revision_round | Number (integer) |
| created_at | Date |

#### Versions Table
| Field | Type |
|-------|------|
| submission_id | Single line text |
| root_submission_id | Single line text |
| version_number | Number |
| video_source | Single select (firebase, google_drive) |
| embed_url | Single line text |
| google_drive_url | URL |
| firebase_video_url | URL |
| firebase_video_path | Single line text |
| firebase_video_size | Number |
| created_at | Date |

#### Annotations Table
| Field | Type |
|-------|------|
| submission_id | Single line text |
| reviewer_uid | Single line text |
| timestamp_seconds | Number |
| note | Long text |
| created_at | Date |

3. Create a Personal Access Token at [airtable.com/create/tokens](https://airtable.com/create/tokens) with scopes:
   - `data.records:read`
   - `data.records:write`

### 4. Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Storage** and create a default bucket
3. Go to **Project Settings > General** and copy the web app config values
4. Go to **Project Settings > Service Accounts** and generate a new private key (for server-side access)
5. Set CORS on your Firebase Storage bucket using `cors.json`:
   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD"],
       "responseHeader": ["Content-Range"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

### 5. Google Drive Setup (Optional - for video archival)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API** under APIs & Services > Library
4. Create OAuth2 credentials:
   - Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**
   - Application type: **Web application**
   - Add authorized redirect URI: `http://localhost:3001`
   - Copy the **Client ID** and **Client Secret**
5. Run the refresh token script to authorize Drive access:
   ```bash
   npx tsx scripts/get-google-refresh-token.ts
   ```
   This opens a browser for Google authorization and returns a refresh token.
6. (Optional) Create a folder in Google Drive to store archived videos and copy its folder ID from the URL:
   `https://drive.google.com/drive/folders/{FOLDER_ID}`

### 6. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Below is every environment variable the app uses, where to find each value, and whether it's required.

---

#### Supabase (Required)

| Variable | Where to Find It |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard > **Settings > API** > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard > **Settings > API** > `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard > **Settings > API** > `service_role` key (keep secret) |

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

> **Where:** [supabase.com](https://supabase.com) > select your project > Settings > API.
> The anon key is safe to expose client-side. The service role key has full admin access -- never commit it.

---

#### Airtable (Required)

| Variable | Where to Find It |
|----------|-----------------|
| `AIRTABLE_API_KEY` | [airtable.com/create/tokens](https://airtable.com/create/tokens) > Create a Personal Access Token with `data.records:read` and `data.records:write` scopes |
| `AIRTABLE_BASE_ID` | Open your base in Airtable. The Base ID is in the URL: `https://airtable.com/appXXXXXXXXXXXXXX/...` |
| `AIRTABLE_TABLE_USERS` | The name of your Users table in Airtable (default: `Users`) |
| `AIRTABLE_TABLE_SUBMISSIONS` | The name of your Submissions table (default: `Submissions`) |
| `AIRTABLE_TABLE_FEEDBACK` | The name of your Feedback table (default: `Feedback`) |
| `AIRTABLE_TABLE_VERSIONS` | The name of your Versions table (default: `Versions`) |
| `AIRTABLE_TABLE_ANNOTATIONS` | The name of your Annotations table (default: `Annotations`) |

```env
AIRTABLE_API_KEY=pat_xxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TABLE_USERS=Users
AIRTABLE_TABLE_SUBMISSIONS=Submissions
AIRTABLE_TABLE_FEEDBACK=Feedback
AIRTABLE_TABLE_VERSIONS=Versions
AIRTABLE_TABLE_ANNOTATIONS=Annotations
```

> **Where:** Go to [airtable.com/create/tokens](https://airtable.com/create/tokens).
> Click **Create new token**, give it a name, add scopes `data.records:read` + `data.records:write`, and grant access to your base.
> The Base ID starts with `app` and is in your Airtable base URL.

---

#### Firebase - Client Side (Required)

| Variable | Where to Find It |
|----------|-----------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console > **Project Settings > General** > Your apps > Web app > `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Same location > `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Same location > `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Same location > `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Same location > `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Same location > `appId` |

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

> **Where:** [Firebase Console](https://console.firebase.google.com) > select your project > gear icon > **Project Settings** > **General** tab > scroll to "Your apps".
> If no web app exists, click **Add app** (web icon `</>`) and register one. The config object will be displayed with all these values.

---

#### Firebase - Server Side (Required)

| Variable | Where to Find It |
|----------|-----------------|
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Console > **Project Settings > General** > Project ID (same as client `projectId`) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Console > **Project Settings > Service Accounts** > Firebase service account email, or from the downloaded JSON key (`client_email` field) |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Console > **Project Settings > Service Accounts** > click **Generate new private key** > open the downloaded JSON > copy the `private_key` field |
| `FIREBASE_STORAGE_LIMIT_BYTES` | Set manually. Total storage quota in bytes. Default: `1073741824` (1 GB). Max per-file: 150 MB |

```env
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_LIMIT_BYTES=1073741824
```

> **Where:** [Firebase Console](https://console.firebase.google.com) > Project Settings > **Service Accounts** tab > **Generate new private key**.
> This downloads a JSON file. Open it and copy `project_id`, `client_email`, and `private_key`.
> The private key must be wrapped in double quotes in `.env.local` and newlines must be literal `\n` characters.

---

#### Google Drive - OAuth2 (Optional - for video archival)

| Variable | Where to Find It |
|----------|-----------------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console > **APIs & Services > Credentials** > your OAuth 2.0 Client > Client ID |
| `GOOGLE_CLIENT_SECRET` | Same location > Client Secret |
| `GOOGLE_REFRESH_TOKEN` | Generated by running the included script (see below) |
| `GOOGLE_DRIVE_FOLDER_ID` | The ID from your Google Drive folder URL: `https://drive.google.com/drive/folders/{THIS_PART}` |

```env
GOOGLE_CLIENT_ID=123456789012-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

> **How to get the refresh token:**
> 1. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` first
> 2. Run the helper script:
>    ```bash
>    npx tsx scripts/get-google-refresh-token.ts
>    ```
> 3. A browser window opens -- sign in and authorize the app
> 4. The script prints the refresh token to your terminal; copy it into `.env.local`
>
> If you've authorized before and don't get a token, revoke the app at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and run the script again.

---

#### NextAuth (Required)

| Variable | Where to Find It |
|----------|-----------------|
| `NEXTAUTH_SECRET` | Generate a random string. Used to sign/encrypt JWT tokens |
| `NEXTAUTH_URL` | The base URL of your app. Only needed in production or non-standard setups |

```env
NEXTAUTH_SECRET=your-random-secret-at-least-32-characters
NEXTAUTH_URL=http://localhost:3000
```

> **How to generate a secret:**
> ```bash
> openssl rand -base64 32
> ```
> Or use any random string generator. This value must stay secret and consistent across deploys.

---

#### App Configuration

| Variable | Where to Find It | Required |
|----------|-----------------|----------|
| `NEXT_PUBLIC_APP_NAME` | Set to whatever you want the app to be called in the UI | No (defaults to `Video Review Platform`) |
| `APP_ENV` | Set to `local`, `development`, `staging`, or `production` | No |
| `NEXT_PUBLIC_DEV_MODE` | Set to `true` to enable development helpers | No |

```env
NEXT_PUBLIC_APP_NAME=Video Review Platform
APP_ENV=local
NEXT_PUBLIC_DEV_MODE=false
```

---

#### Complete `.env.local` Template

```env
# ======================
# SUPABASE (Required)
# ======================
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ======================
# AIRTABLE (Required)
# ======================
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
AIRTABLE_TABLE_USERS=Users
AIRTABLE_TABLE_SUBMISSIONS=Submissions
AIRTABLE_TABLE_FEEDBACK=Feedback
AIRTABLE_TABLE_VERSIONS=Versions
AIRTABLE_TABLE_ANNOTATIONS=Annotations

# ======================
# FIREBASE CLIENT (Required)
# ======================
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# ======================
# FIREBASE SERVER (Required)
# ======================
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=""
FIREBASE_STORAGE_LIMIT_BYTES=1073741824

# ======================
# GOOGLE DRIVE (Optional)
# ======================
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=

# ======================
# NEXTAUTH (Required)
# ======================
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# ======================
# APP CONFIG (Optional)
# ======================
NEXT_PUBLIC_APP_NAME=Video Review Platform
APP_ENV=local
NEXT_PUBLIC_DEV_MODE=false
```

### 7. Create Your First User

**Option 1: Admin Panel (Recommended)**
- After initial setup, create the first admin user manually in Supabase Auth and Airtable (see Option 2)
- Then log in and use the Admin > Users page to create additional users

**Option 2: Manual Setup**
1. Create a user in Supabase Auth (Dashboard > Authentication > Users)
2. Copy their UUID
3. Add a record to the Airtable Users table:
   - `supabase_uid`: The UUID from step 2
   - `email`: User's email
   - `role`: `admin`
   - `created_at`: Today's date

### 8. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/                    # Protected routes with sidebar
│   │   ├── admin/
│   │   │   ├── dashboard/              # Admin stats overview
│   │   │   └── users/                  # User management
│   │   ├── reviewer/dashboard/         # Reviewer queue
│   │   ├── submitter/dashboard/        # Submitter's submissions
│   │   ├── settings/                   # Account settings
│   │   └── submissions/
│   │       ├── new/                    # Create submission (upload)
│   │       └── [id]/                   # Submission detail view
│   ├── api/
│   │   ├── auth/[...nextauth]/         # NextAuth handlers
│   │   ├── admin/users/                # User CRUD (admin only)
│   │   ├── submissions/                # Submission CRUD + archive/resubmit/frame/versions
│   │   ├── comments/                   # Feedback CRUD
│   │   ├── upload/                     # Attachment uploads (Supabase)
│   │   ├── firebase-storage/           # Storage usage info
│   │   └── settings/                   # Password change
│   └── login/                          # Login page
├── components/                         # UI components
│   ├── VideoPlayer.tsx                 # Video playback
│   ├── FrameAnnotationEditor.tsx       # Frame pin annotations
│   ├── Sidebar.tsx                     # Navigation sidebar
│   ├── FirebaseStorageUsage.tsx        # Storage quota display
│   └── ...
├── contexts/                           # React contexts
│   ├── AuthContext.tsx                 # Auth state
│   ├── DataCacheContext.tsx            # Data caching
│   └── SidebarContext.tsx              # Sidebar state
├── lib/
│   ├── airtable.ts                     # Airtable client (server-only)
│   ├── auth.ts                         # NextAuth config
│   ├── firebase.ts                     # Firebase client uploads
│   ├── firebase-admin.ts              # Firebase server operations
│   ├── google-drive.ts                # Drive URL parsing
│   ├── google-drive-upload.ts         # Drive archival uploads
│   ├── archive-video.ts              # Video archival pipeline
│   ├── frame-extract.ts              # FFmpeg frame extraction
│   └── validations.ts                # Zod schemas
├── types/                             # TypeScript definitions
└── middleware.ts                      # Auth & route protection
```

## Roles & Permissions

| Action | Submitter | Reviewer | Admin |
|--------|-----------|----------|-------|
| Create submissions | Yes | - | Yes |
| View own submissions | Yes | Yes | Yes |
| View all submissions | - | Yes | Yes |
| Edit own submission metadata | Yes | - | Yes |
| Delete own submissions | Yes | - | Yes |
| Resubmit after revision | Yes | - | Yes |
| Add top-level feedback | - | Yes | Yes |
| Reply to feedback | Yes | Yes | Yes |
| Add frame annotations | - | Yes | Yes |
| Add private reviewer notes | - | Yes | Yes |
| Update submission status | - | Yes | Yes |
| Archive videos to Drive | - | - | Yes |
| Manage users | - | - | Yes |

## Submission Status Workflow

```
pending --> reviewing --> approved
                 |
                 +--> revision_requested --> (resubmit) --> pending
```

- **pending** - Newly created, awaiting review
- **reviewing** - Automatically set when first feedback is posted
- **approved** - Reviewer/admin marks as approved (can trigger archival)
- **revision_requested** - Changes requested; submitter can resubmit a new version

## API Routes

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/me` | Current user info | All |
| GET | `/api/submissions` | List submissions | All (filtered by role) |
| POST | `/api/submissions` | Create submission | Submitter/Admin |
| GET | `/api/submissions/[id]` | Get submission | Owner/Reviewer/Admin |
| PATCH | `/api/submissions/[id]` | Update status/metadata | Varies |
| DELETE | `/api/submissions/[id]` | Delete submission | Owner/Admin |
| POST | `/api/submissions/[id]/resubmit` | Resubmit after revision | Submitter |
| POST | `/api/submissions/[id]/archive` | Archive to Google Drive | Admin |
| GET | `/api/submissions/[id]/frame` | Extract video frame | Reviewer/Admin |
| GET | `/api/submissions/[id]/versions` | Get version history | All |
| GET | `/api/comments` | List feedback | Owner/Reviewer/Admin |
| POST | `/api/comments` | Create feedback | Varies by role |
| DELETE | `/api/comments/[id]` | Delete feedback | Owner/Admin |
| GET | `/api/admin/users` | List users | Admin |
| POST | `/api/admin/users` | Create user | Admin |
| PATCH | `/api/admin/users/[id]` | Update user role | Admin |
| POST | `/api/upload` | Upload attachment | All |
| GET | `/api/firebase-storage` | Storage usage info | All |
| POST | `/api/settings/change-password` | Change password | All |

## Security

- Airtable and Firebase Admin credentials are server-side only (marked with `server-only`)
- All API routes verify JWT session tokens
- Role-based access control enforced at both middleware and API level
- Passwords hashed with bcrypt
- Input validation on all endpoints via Zod schemas
- Airtable client implements rate limiting with exponential backoff
- Storage quotas enforced before uploads (default 1GB bucket, 150MB per file)

## Development

```bash
# Start development server (Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## License

Internal use only.
