# Environment Variables Setup Guide

## Required Environment Variables

Your app needs these **2 environment variables**:

### 1. `EXPO_PUBLIC_SUPABASE_URL`
- **What it is**: Your Supabase project URL
- **Format**: `https://xxxxxxxxxxxxx.supabase.co`
- **Where to find it**: 
  - Go to your Supabase project dashboard
  - Click on **Settings** → **API**
  - Look for **Project URL** or **API URL**
  - Copy the URL (it looks like: `https://mvvzqouqxrtyzuzqbeud.supabase.co`)

### 2. `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **What it is**: Your Supabase anonymous/public API key
- **Format**: A long string starting with `eyJ...`
- **Where to find it**:
  - Go to your Supabase project dashboard
  - Click on **Settings** → **API**
  - Look for **anon public** key under **Project API keys**
  - Copy the entire key (it's a very long string)

## How to Set Environment Variables

### Option 1: For Local Development (Create `.env` file)

Create a `.env` file in the root of your project:

```bash
# .env file
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12dnpxb3VxeHJ0eXp1enFiZXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTIxMjM0NTYsImV4cCI6MjAyNzY5OTQ1Nn0.your-actual-key-here
```

**Important**: 
- Replace `your-project-id` with your actual Supabase project ID
- Replace the key with your actual anon key
- Never commit `.env` to git (it should be in `.gitignore`)

### Option 2: For EAS Builds (Recommended - Use EAS Secrets)

Set environment variables as secrets in EAS (more secure):

```bash
# Set Supabase URL
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project-id.supabase.co"

# Set Supabase Anon Key
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Benefits**:
- ✅ Secure (encrypted)
- ✅ Available for all builds automatically
- ✅ No need to add to `eas.json`

### Option 3: Add to `eas.json` (Less Secure)

You can also add them directly to `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_NEW_ARCH_ENABLED": "1",
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project-id.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key-here"
      }
    }
  }
}
```

⚠️ **Warning**: This is less secure because the values are visible in your code repository.

## Quick Steps to Get Your Values

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project** (or create one if you don't have it)
3. **Click Settings** (gear icon) in the left sidebar
4. **Click API** in the settings menu
5. **Copy these values**:
   - **Project URL** → Use for `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → Use for `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Verify Your Setup

After setting up, verify your environment variables:

```bash
# For local development
npm run env:check

# For EAS builds
eas secret:list
```

## Example Values (Format Only - Use Your Own!)

```bash
# Example format - DO NOT USE THESE VALUES
EXPO_PUBLIC_SUPABASE_URL=https://mvvzqouqxrtyzuzqbeud.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12dnpxb3VxeHJ0eXp1enFiZXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTIxMjM0NTYsImV4cCI6MjAyNzY5OTQ1Nn0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Security Notes

- ✅ The **anon key** is safe to use in client-side code (it's public)
- ✅ It's protected by Row Level Security (RLS) policies in Supabase
- ✅ Never share your **service_role** key (that's for server-side only)
- ✅ Always use EAS secrets for production builds

## Need Help?

If you don't have a Supabase project yet:
1. Go to https://supabase.com
2. Sign up / Log in
3. Create a new project
4. Wait for it to finish setting up (~2 minutes)
5. Follow the steps above to get your URL and key

