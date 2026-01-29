---
name: Video Upload Workflow
overview: Implement a video upload workflow where submitters upload to Firebase Storage, and upon approval, videos are archived to Google Drive with automatic cleanup.
todos:
  - id: firebase-setup
    content: Set up Firebase project and Storage bucket
    status: completed
  - id: firebase-lib
    content: Create Firebase config and storage utilities
    status: completed
  - id: types-update
    content: Add video_source and firebase_video_path to Submission types
    status: completed
  - id: upload-api
    content: Create /api/upload endpoint for Firebase Storage uploads
    status: completed
  - id: submission-form
    content: Add file upload component with drag-drop and progress
    status: completed
  - id: google-service-account
    content: Set up Google Drive Service Account and env vars
    status: completed
  - id: drive-upload-lib
    content: Create google-drive-upload.ts with upload and folder functions
    status: completed
  - id: archive-api
    content: Create /api/submissions/[id]/archive endpoint
    status: completed
  - id: finalize-button
    content: Add Finalize button to submission detail page
    status: completed
  - id: videoplayer-update
    content: Update VideoPlayer to detect and handle both sources
    status: completed
  - id: airtable-update
    content: Update Airtable functions for new submission fields
    status: completed
isProject: false
---

# Video Upload and Archive Workflow

## Overview

Implement a complete video submission workflow:

1. Submitter uploads video directly to Firebase Storage (5GB free, no file size limit)
2. Reviewer watches and reviews the video
3. On approval, admin clicks "Finalize" to archive to Google Drive
4. Firebase file is deleted, submission switches to Google Drive embed

## Architecture

```mermaid
flowchart LR
    subgraph submit [Submission Phase]
        A[Submitter] -->|Upload| B[Firebase Storage]
        B --> C[Create Submission in Airtable]
    end
    
    subgraph review [Review Phase]
        D[Reviewer] -->|Watch from Firebase URL| E[Review and Approve]
    end
    
    subgraph archive [Archive Phase]
        F[Admin clicks Finalize] --> G[Upload to Google Drive]
        G --> H[Update Airtable with Drive URL]
        H --> I[Delete from Firebase]
    end
    
    submit --> review
    review --> archive
```



## Implementation Steps

### Phase 1: Firebase Setup

**1.1 Create Firebase Project**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project (or use existing)
3. Go to "Build" > "Storage"
4. Click "Get Started" and choose production mode
5. Select a location (us-central1 recommended)

**1.2 Configure Storage Rules**
In Firebase Console > Storage > Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /videos/{allPaths=**} {
      allow read: if true;  // Public read for video playback
      allow write: if request.auth != null;  // Auth required for upload
    }
  }
}
```

**1.3 Get Firebase Config**

- Go to Project Settings > General > Your apps
- Add a Web app if not exists
- Copy the config object

**1.4 Environment Variables**
Add to `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**1.5 Create Firebase Library** - `src/lib/firebase.ts`

- Initialize Firebase app
- Export storage instance
- Helper functions for upload/delete

**1.6 Update Types** - `[src/types/index.ts](src/types/index.ts)`

- Add `video_source: 'firebase' | 'google_drive'` to Submission interface
- Add `firebase_video_path?: string` for Firebase file reference

### Phase 2: Video Upload in Submission Form

**2.1 Create Upload API** - `src/app/api/upload/route.ts`

- Handle multipart form upload
- Upload to Firebase Storage using Admin SDK
- Return public URL and file path

**2.2 Update Submission Form** - `[src/app/(dashboard)/submissions/new/page.tsx](src/app/(dashboard)`/submissions/new/page.tsx)

- Add file input with drag-and-drop support
- Show upload progress bar
- Toggle between "Upload Video" and "Google Drive URL" modes
- Preview uploaded video before submitting

**2.3 Update Submission API** - `[src/app/api/submissions/route.ts](src/app/api/submissions/route.ts)`

- Accept either `supabase_video_url` or `google_drive_url`
- Set `video_source` field accordingly

### Phase 3: Google Drive Service Account Setup

**3.1 Create Service Account**

- Go to Google Cloud Console
- Create new project or use existing
- Enable Google Drive API
- Create Service Account with Drive access
- Download JSON credentials

**3.2 Environment Variables**
Add to `.env.local`:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_DRIVE_FOLDER_ID=root_folder_id_for_approved_videos
```

**3.3 Create Google Drive Upload Library** - `src/lib/google-drive-upload.ts`

- Initialize Google Drive API with service account
- Create year/month folder structure
- Upload file function
- Return shareable link

### Phase 4: Finalize/Archive Workflow

**4.1 Create Archive API** - `src/app/api/submissions/[id]/archive/route.ts`

- Download video from Supabase Storage
- Upload to Google Drive (organized by date: `/2026/01/filename.mp4`)
- Update Airtable submission:
  - Set `google_drive_url` to new Drive link
  - Set `video_source` to `'google_drive'`
  - Clear `supabase_video_path`
- Delete file from Supabase Storage
- Return new embed URL

**4.2 Add Finalize Button** - `[src/app/(dashboard)/submissions/[id]/SubmissionDetailClient.tsx](src/app/(dashboard)`/submissions/[id]/SubmissionDetailClient.tsx)

- Show "Finalize and Archive" button for admin when:
  - Submission status is `approved`
  - Video source is `supabase`
- Show progress during archive process
- Refresh page after successful archive

### Phase 5: VideoPlayer Updates

**5.1 Update VideoPlayer** - `[src/components/VideoPlayer.tsx](src/components/VideoPlayer.tsx)`

- Detect video source type (Supabase URL vs Google Drive)
- Use native HTML5 video for Supabase URLs (auto-capture works!)
- Use iframe embed for Google Drive URLs

## File Changes Summary


| File                                                              | Action                                       |
| ----------------------------------------------------------------- | -------------------------------------------- |
| `src/types/index.ts`                                              | Add video_source, supabase_video_path fields |
| `src/app/api/upload/route.ts`                                     | NEW - Video upload to Supabase               |
| `src/app/(dashboard)/submissions/new/page.tsx`                    | Add file upload UI                           |
| `src/app/api/submissions/route.ts`                                | Handle both upload types                     |
| `src/lib/google-drive-upload.ts`                                  | NEW - Google Drive API upload                |
| `src/app/api/submissions/[id]/archive/route.ts`                   | NEW - Archive to Drive                       |
| `src/app/(dashboard)/submissions/[id]/SubmissionDetailClient.tsx` | Add Finalize button                          |
| `src/components/VideoPlayer.tsx`                                  | Handle both video sources                    |
| `src/lib/airtable.ts`                                             | Update submission fields                     |


## Google Drive Service Account Setup Instructions

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select a project
3. Enable "Google Drive API"
4. Go to "Credentials" > "Create Credentials" > "Service Account"
5. Download the JSON key file
6. Share your Google Drive folder with the service account email
7. Copy credentials to `.env.local`

## Benefits

- **Auto-capture works** for Supabase-hosted videos (native HTML5)
- **Cost-efficient** - Videos only stored temporarily in Supabase
- **Organized archive** - Google Drive folders by date
- **Flexible** - Submitters can still use Google Drive URL if preferred

