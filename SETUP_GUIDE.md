# GlimseConnect — Complete Setup Guide

This guide walks you through getting **every API key** and configuring everything so your app runs smoothly end-to-end.

---

## Table of Contents

1. [Create the `.env` file](#1-create-the-env-file)
2. [Supabase Setup (Database + Auth + Storage + Realtime)](#2-supabase-setup)
3. [Supabase OAuth — Google Login](#3-supabase-oauth--google-login)
4. [Supabase OAuth — GitHub Login](#4-supabase-oauth--github-login)
5. [Google AdSense (Ads)](#5-google-adsense-ads)
6. [WebRTC STUN/TURN Servers](#6-webrtc-stunturn-servers)
7. [Run the Database Schema](#7-run-the-database-schema)
8. [Create the Storage Bucket](#8-create-the-storage-bucket)
9. [Enable Realtime](#9-enable-realtime)
10. [Final Checklist](#10-final-checklist)

---

## 1. Create the `.env` file

Copy the example file and fill in your real keys:

```bash
cp .env.example .env
```

Your `.env` file will look like this (fill in values as you follow the steps below):

```dotenv
# Supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...your-anon-key

# Google AdSense
VITE_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX

# WebRTC STUN/TURN
VITE_STUN_URL=stun:stun.l.google.com:19302
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_PASSWORD=

# App
VITE_APP_URL=http://localhost:8080
VITE_APP_NAME=GlimseConnect
```

> ⚠️ **Never commit your `.env` file.** It's already in `.gitignore`.

---

## 2. Supabase Setup

Supabase is the entire backend — database, authentication, file storage, and realtime subscriptions.

### Step-by-step:

1. Go to [https://supabase.com](https://supabase.com) and **Sign Up** (free tier is fine).
2. Click **"New Project"**.
3. Choose an organization (or create one), give your project a name (e.g., `connectlive`), set a **database password** (save it somewhere), and pick a region close to your users.
4. Wait ~2 minutes for the project to finish provisioning.
5. Once ready, go to **Settings → API** (left sidebar → ⚙️ Settings → API).
6. You'll see:
   - **Project URL** → Copy this → paste as `VITE_SUPABASE_URL`
   - **anon / public key** → Copy this → paste as `VITE_SUPABASE_ANON_KEY`

```dotenv
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> 💡 The `anon` key is safe to use on the frontend — Row Level Security (RLS) policies protect your data.

---

## 3. Supabase OAuth — Google Login

The app supports **Sign in with Google**. Here's how to set it up:

### A. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **new project** (or select an existing one).
3. Go to **APIs & Services → Credentials**.
4. Click **"+ CREATE CREDENTIALS" → "OAuth client ID"**.
5. If prompted, configure the **OAuth Consent Screen** first:
   - User type: **External**
   - App name: `GlimseConnect`
   - Support email: your email
   - Authorized domain: `supabase.co` (add your production domain later too)
   - Save and continue through Scopes & Test Users.
6. Back on Credentials → Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `GlimseConnect`
   - Authorized redirect URIs → Add:
     ```
     https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
     ```
     (Replace `YOUR_PROJECT_ID` with your actual Supabase project ID from the URL.)
7. Click **Create** → Copy the **Client ID** and **Client Secret**.

### B. Add to Supabase

1. In your Supabase dashboard, go to **Authentication → Providers**.
2. Find **Google** and toggle it **ON**.
3. Paste your **Client ID** and **Client Secret**.
4. Save.

---

## 4. Supabase OAuth — GitHub Login

The app also supports **Sign in with GitHub**.

### A. Create GitHub OAuth App

1. Go to [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers).
2. Click **"New OAuth App"**.
3. Fill in:
   - **Application name:** `GlimseConnect`
   - **Homepage URL:** `http://localhost:8080` (change to production URL later)
   - **Authorization callback URL:**
     ```
     https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
     ```
4. Click **Register Application**.
5. Copy the **Client ID**.
6. Click **"Generate a new client secret"** → Copy the **Client Secret**.

### B. Add to Supabase

1. In Supabase dashboard → **Authentication → Providers**.
2. Find **GitHub** and toggle it **ON**.
3. Paste your **Client ID** and **Client Secret**.
4. Save.

---

## 5. Google AdSense (Ads)

> 💡 **This is optional.** The app works fine without it — ad placeholders will show instead. You can skip this until you're ready to monetize.

1. Go to [Google AdSense](https://www.google.com/adsense/start/).
2. Sign up with a Google account.
3. Add your website URL (your production domain — AdSense doesn't work on `localhost`).
4. Once approved, go to **Account → Account Information**.
5. Copy your **Publisher ID** (starts with `ca-pub-`).
6. Paste into `.env`:

```dotenv
VITE_ADSENSE_CLIENT_ID=ca-pub-1234567890123456
```

> ⚠️ AdSense requires a live, public domain with real content. It won't work during local development. You can leave the placeholder value during development.

---

## 6. WebRTC STUN/TURN Servers

STUN/TURN servers help establish peer-to-peer video connections, especially when users are behind firewalls or NATs.

### STUN (Free — already configured)

The default Google STUN server is free and works for most cases:

```dotenv
VITE_STUN_URL=stun:stun.l.google.com:19302
```

### TURN (Needed for ~15-20% of users behind strict firewalls)

STUN alone won't work for all users. For production, you need a TURN server. Options:

#### Option A: Metered.ca (Recommended — Free tier available)

1. Go to [https://www.metered.ca](https://www.metered.ca/stun-turn) and sign up.
2. Create a new **TURN App**.
3. You'll get credentials. Add to `.env`:

```dotenv
VITE_TURN_URL=turn:a.]relay.metered.ca:443
VITE_TURN_USERNAME=your-username
VITE_TURN_PASSWORD=your-password
```

#### Option B: Twilio (Pay-as-you-go)

1. Sign up at [https://www.twilio.com](https://www.twilio.com).
2. Go to **Voice → TURN/STUN** or use the Network Traversal API.
3. Grab the TURN URL, username, and credential.

#### Option C: Self-hosted (Advanced)

Install [coturn](https://github.com/coturn/coturn) on a VPS with a public IP.

> 💡 **For local development**, STUN alone is fine. TURN is only needed in production for users on restrictive networks.

---

## 7. Run the Database Schema

This creates all the tables, indexes, RLS policies, and realtime subscriptions.

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar).
2. Click **"New Query"**.
3. Copy the **entire contents** of `src/lib/schema.sql` and paste it into the editor.
4. Click **"Run"** (or Cmd+Enter).
5. You should see `Success. No rows returned` — that means all tables were created.

### Verify it worked:

- Go to **Table Editor** in the sidebar — you should see these tables:
  - `profiles`
  - `follows`
  - `messages`
  - `reports`
  - `blocks`
  - `notifications`
  - `user_settings`
  - `stream_sessions`
  - `contact_messages`

---

## 8. Create the Storage Bucket

The app uploads user avatars and chat images to Supabase Storage.

1. In Supabase dashboard, go to **Storage** (left sidebar).
2. Click **"New Bucket"**.
3. Create a bucket named: **`avatars`**
   - Toggle **"Public bucket"** → **ON** (so avatar URLs are publicly accessible)
   - Click **Create**.
4. (Optional) Create another bucket named **`chat-images`** for chat media:
   - Toggle **"Public bucket"** → **ON**
   - Click **Create**.

### Add Storage Policies:

1. Click on the **`avatars`** bucket → **Policies** tab.
2. Click **"New Policy"** → **"For full customization"**.
3. Add these policies:

**Policy 1 — Anyone can view avatars:**

- Name: `Public avatar access`
- Allowed operation: `SELECT`
- Target roles: (leave default)
- Policy: `true`

**Policy 2 — Users can upload their own avatar:**

- Name: `Users can upload avatars`
- Allowed operation: `INSERT`
- Policy: `(bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])`

**Policy 3 — Users can update their own avatar:**

- Name: `Users can update avatars`
- Allowed operation: `UPDATE`
- Policy: `(bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])`

> 💡 Quick alternative: You can use the SQL Editor and run:
>
> ```sql
> INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
>
> CREATE POLICY "Public avatar access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
> CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
> CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
> ```

---

## 9. Enable Realtime

The schema.sql already runs `ALTER PUBLICATION supabase_realtime ADD TABLE ...`, but verify it's working:

1. In Supabase dashboard, go to **Database → Replication**.
2. Under **"supabase_realtime"**, make sure these tables have the toggle **ON**:
   - `messages`
   - `notifications`
   - `profiles`

This enables real-time message delivery and live notification updates.

---

## 10. Final Checklist

Run through this checklist before starting the dev server:

| #   | Task                                                                        | Status |
| --- | --------------------------------------------------------------------------- | ------ |
| 1   | Created `.env` file from `.env.example`                                     | ☐      |
| 2   | Supabase project created                                                    | ☐      |
| 3   | `VITE_SUPABASE_URL` added to `.env`                                         | ☐      |
| 4   | `VITE_SUPABASE_ANON_KEY` added to `.env`                                    | ☐      |
| 5   | Database schema executed in SQL Editor                                      | ☐      |
| 6   | `avatars` storage bucket created (public)                                   | ☐      |
| 7   | Storage policies added                                                      | ☐      |
| 8   | Realtime enabled for messages, notifications, profiles                      | ☐      |
| 9   | Google OAuth configured (optional)                                          | ☐      |
| 10  | GitHub OAuth configured (optional)                                          | ☐      |
| 11  | Supabase Auth → URL Configuration → Site URL set to `http://localhost:8080` | ☐      |
| 12  | TURN server configured (optional, for production)                           | ☐      |

### One extra Supabase setting:

Go to **Authentication → URL Configuration** and set:

- **Site URL:** `http://localhost:8080` (or your production URL)
- **Redirect URLs:** Add `http://localhost:8080/**` (and your production domain)

This ensures OAuth redirects and password reset emails point to the right place.

---

## Start the App

```bash
npm ci --ignore-scripts
npm run dev
```

The app will be running at **http://localhost:8080**.

---

## Production Deployment Notes

When deploying to production (Vercel, Netlify, etc.):

1. Set all `VITE_*` environment variables in your hosting provider's dashboard.
2. Change `VITE_APP_URL` to your production domain.
3. Update Supabase **Site URL** and **Redirect URLs** to your production domain.
4. Update Google OAuth & GitHub OAuth **redirect URIs** to:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
5. Set up a TURN server for reliable video connections.
6. Apply for Google AdSense approval with your live domain.

---

## Troubleshooting

| Problem                                   | Solution                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| "Invalid API key" on page load            | Double-check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`                                     |
| Google/GitHub login doesn't redirect back | Make sure the callback URL in OAuth provider matches `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback` |
| Avatar upload fails                       | Ensure the `avatars` bucket exists and is public, with correct storage policies                             |
| Messages not appearing in real-time       | Check that Realtime is enabled for the `messages` table in Supabase → Database → Replication                |
| Video calls fail for some users           | You likely need a TURN server — STUN alone doesn't work behind strict firewalls                             |
| "relation 'profiles' does not exist"      | You haven't run the schema.sql yet — paste it in the SQL Editor and run it                                  |
| OAuth redirect shows blank page           | Go to Supabase → Auth → URL Configuration and add your app URL to "Redirect URLs"                           |
