# Quick Start Guide

Get up and running with Clio Extractor in 5 minutes.

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Get Clio API Credentials

1. Go to [Clio Developer Portal](https://developers.clio.com/)
2. Sign in with your Clio account
3. Create a new application (or use existing)
4. Note your **Client ID** and **Client Secret**

## Step 3: Configure Redirect URIs

In your Clio application settings, add these redirect URIs:

```
http://127.0.0.1/
https://app.clio.com/oauth/approval/
```

**Important:** The redirect URI must match exactly (including trailing slash for `http://127.0.0.1/`)

## Step 4: Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env

# Then edit .env with your credentials
```

Your `.env` should look like:

```env
CLIO_CLIENT_ID=your-actual-client-id
CLIO_CLIENT_SECRET=your-actual-client-secret
```

## Step 5: Run the App

```bash
npm run dev
```

## Step 6: Test Authentication

1. The app should open with a "Login with Clio" button
2. Click the button
3. A new window opens with Clio's authorization page
4. Log in with your Clio credentials
5. Click "Authorize" to grant permissions
6. The window should close and show "Connected to Clio"

## Success! 🎉

You're now authenticated and ready to use the Clio API.

## What's Next?

### Test the API

Open DevTools (F12) and try:

```javascript
// Get current user info
const token = await window.api.clio.getToken()
const response = await fetch('https://app.clio.com/api/v4/users/who_am_i', {
  headers: { 'Authorization': `Bearer ${token}` }
})
const data = await response.json()
console.log(data)
```

### Build Your Features

- Extract contacts, matters, bills, etc.
- Use the API client in `src/main/api-client.ts`
- Add UI for data extraction

### Read the Docs

- [CLIO_AUTH_GUIDE.md](./CLIO_AUTH_GUIDE.md) - Detailed authentication info
- [README.md](./README.md) - Full project documentation
- [Clio API Docs](https://docs.developers.clio.com/) - Official API reference

## Troubleshooting

### "Clio credentials not found in environment variables"

**Fix:** Make sure your `.env` file exists and has the correct variable names:
- `CLIO_CLIENT_ID`
- `CLIO_CLIENT_SECRET`

### "redirect_uri_mismatch"

**Fix:** 
1. Check that `http://127.0.0.1/` is added in Clio developer portal
2. Make sure there's no trailing slash mismatch
3. The redirect URI in code (`src/main/auth.ts`) must match exactly

### Auth window doesn't close

**Fix:** Check the browser console in the auth window for errors. The redirect might not be matching.

### Token exchange failed

**Fix:** Verify your Client ID and Client Secret are correct in the `.env` file.

## Common Commands

```bash
# Development
npm run dev

# Type checking
npm run typecheck

# Lint code
npm run lint

# Format code
npm run format

# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

## Need Help?

- Check [CLIO_AUTH_GUIDE.md](./CLIO_AUTH_GUIDE.md) for detailed troubleshooting
- Open an issue on GitHub
- Email Clio API support: api@clio.com
