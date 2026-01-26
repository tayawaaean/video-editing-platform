# Video Review Platform

A professional video review and feedback platform built with Next.js, Supabase Auth, and Airtable.

## Features

- **Role-based Access Control**: Submitter, Reviewer, and Admin roles
- **Video Submissions**: Submit videos via Google Drive links
- **Timestamped Comments**: Add comments at specific video timestamps
- **Threaded Discussions**: Reply to comments for contextual conversations
- **Reviewer Annotations**: Private notes for reviewers at specific timestamps
- **Status Workflow**: Pending → Reviewing → Completed status flow
- **Admin User Management**: Manage users and their roles

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Authentication**: Supabase Auth
- **Database**: Airtable
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Video Hosting**: Google Drive (embed)

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (for authentication)
- Airtable account (for data storage)

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
3. Go to **Authentication > Providers** and enable Email provider
4. Create test users in **Authentication > Users**

### 3. Airtable Setup

1. Create a new base in [Airtable](https://airtable.com)
2. Create the following tables with these fields:

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
| title | Single line text |
| description | Long text |
| google_drive_url | URL |
| embed_url | Single line text |
| submitter_uid | Single line text |
| status | Single select (pending, reviewing, completed) |
| created_at | Date |
| updated_at | Date |

#### Comments Table
| Field | Type |
|-------|------|
| submission_id | Single line text |
| user_uid | Single line text |
| timestamp_seconds | Number |
| content | Long text |
| parent_comment_id | Single line text |
| created_at | Date |

#### Annotations Table
| Field | Type |
|-------|------|
| submission_id | Single line text |
| reviewer_uid | Single line text |
| timestamp_seconds | Number |
| note | Long text |
| created_at | Date |

3. Get your Airtable credentials:
   - Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
   - Create a new Personal Access Token with these scopes:
     - `data.records:read`
     - `data.records:write`
   - Copy the Base ID from your base URL: `https://airtable.com/appXXXXXXXX/...`

### 4. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Airtable Configuration (Server-side only)
AIRTABLE_API_KEY=pat_xxxxxxxxxxxx
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TABLE_USERS=Users
AIRTABLE_TABLE_SUBMISSIONS=Submissions
AIRTABLE_TABLE_COMMENTS=Comments
AIRTABLE_TABLE_ANNOTATIONS=Annotations

# App Configuration
NEXT_PUBLIC_APP_NAME=Video Review Platform
APP_ENV=local
```

### 5. Provision Your First User

After setting up Supabase Auth users, you need to add them to the Airtable Users table:

1. Create a user in Supabase Auth
2. Copy their UUID from Supabase Dashboard > Authentication > Users
3. Add a record to the Airtable Users table with:
   - `supabase_uid`: The UUID from step 2
   - `email`: User's email
   - `role`: `admin` (for your first user)
   - `created_at`: Today's date

### 6. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected routes with navbar
│   │   ├── admin/users/      # Admin user management
│   │   ├── dashboard/        # Main dashboard
│   │   └── submissions/      # Submission pages
│   │       ├── new/          # Create submission
│   │       └── [id]/         # Submission detail
│   ├── api/                  # API routes
│   │   ├── admin/users/      # Admin endpoints
│   │   ├── annotations/      # Annotations CRUD
│   │   ├── comments/         # Comments CRUD
│   │   ├── me/               # Current user
│   │   └── submissions/      # Submissions CRUD
│   ├── auth/                 # Auth helpers
│   └── login/                # Login page
├── components/               # Reusable UI components
├── contexts/                 # React contexts
├── lib/                      # Utilities and API clients
│   ├── supabase/            # Supabase client setup
│   ├── airtable.ts          # Airtable server module
│   ├── google-drive.ts      # Google Drive URL parsing
│   └── validations.ts       # Zod schemas
├── types/                    # TypeScript types
└── middleware.ts             # Auth middleware
```

## Roles & Permissions

| Action | Submitter | Reviewer | Admin |
|--------|-----------|----------|-------|
| Create submissions | ✅ | ✅ | ✅ |
| View own submissions | ✅ | ✅ | ✅ |
| View all submissions | ❌ | ✅ | ✅ |
| Add comments | Own only | ✅ | ✅ |
| Add annotations | ❌ | ✅ | ✅ |
| Update status | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ✅ |

## Google Drive Video Setup

For videos to work properly:

1. Upload your video to Google Drive
2. Right-click → Share → Change to "Anyone with the link"
3. Copy the sharing link
4. Paste it when creating a submission

Supported URL formats:
- `https://drive.google.com/file/d/{FILE_ID}/view?...`
- `https://drive.google.com/open?id={FILE_ID}`
- `https://drive.google.com/uc?id={FILE_ID}`

## API Routes

All API routes require authentication and validate user roles server-side.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/me` | Get current user | All |
| GET | `/api/submissions` | List submissions | All (filtered) |
| POST | `/api/submissions` | Create submission | All |
| GET | `/api/submissions/[id]` | Get submission | Owner/Reviewer/Admin |
| PATCH | `/api/submissions/[id]` | Update status | Reviewer/Admin |
| GET | `/api/comments` | List comments | Owner/Reviewer/Admin |
| POST | `/api/comments` | Create comment | Owner/Reviewer/Admin |
| GET | `/api/annotations` | List annotations | Owner/Reviewer/Admin |
| POST | `/api/annotations` | Create annotation | Reviewer/Admin |
| GET | `/api/admin/users` | List users | Admin |
| POST | `/api/admin/users` | Create user | Admin |
| PATCH | `/api/admin/users/[id]` | Update user role | Admin |

## Security

- Airtable API key is server-side only (never exposed to browser)
- All API routes verify Supabase session
- Role-based access control enforced at API level
- Middleware protects all routes except `/login`

## Development

```bash
# Start development server
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
