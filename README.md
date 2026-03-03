# Clio Extractor

An Electron application for extracting data from Clio using their OAuth 2.0 API.

## Features

- ✅ OAuth 2.0 Authentication with Clio
- ✅ Secure token management
- ✅ Clean and modern UI
- ✅ TypeScript support
- ✅ Built with Electron and Vite

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Clio developer account with an application created

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
CLIO_CLIENT_ID=your-client-id-here
CLIO_CLIENT_SECRET=your-client-secret-here
```

**Important:** Never commit your `.env` file to version control!

### 3. Configure Clio Developer Application

1. Go to your [Clio Developer Portal](https://developers.clio.com/)
2. Open your application settings
3. Add the following redirect URIs:
   - `http://127.0.0.1/`
   - `https://app.clio.com/oauth/approval/` (optional, for alternative flow)

### 4. Run the Application

**Development mode:**

```bash
npm run dev
```

**Build for production:**

```bash
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```

## Usage

1. **Launch the application**
2. **Click "Login with Clio"** - Opens Clio's authorization page
3. **Authorize the application** - Grant permissions
4. **Start extracting data** - Once authenticated, you can use the Clio API

## Authentication Flow

The app implements OAuth 2.0 Authorization Code flow:

1. User clicks "Login with Clio"
2. Opens Clio authorization page in a new window
3. User approves the application
4. App receives authorization code
5. Exchanges code for access token
6. Token is stored securely in memory

For detailed information about authentication, see [CLIO_AUTH_GUIDE.md](./CLIO_AUTH_GUIDE.md).

## Project Structure

```
clio-extractor/
├── src/
│   ├── main/
│   │   ├── index.ts          # Main process entry point
│   │   ├── auth.ts            # Clio authentication manager
│   │   └── api-client.ts      # Clio API client (example)
│   ├── preload/
│   │   ├── index.ts           # Preload script (IPC bridge)
│   │   └── index.d.ts         # TypeScript definitions
│   └── renderer/
│       ├── index.html         # Main HTML
│       ├── src/
│       │   └── renderer.ts    # Renderer process logic
│       └── assets/
│           └── main.css       # Styles
├── .env                       # Environment variables (create this)
├── package.json
└── CLIO_AUTH_GUIDE.md        # Detailed authentication guide
```

## Key Files

- **`src/main/auth.ts`** - Handles all OAuth 2.0 authentication logic
- **`src/main/api-client.ts`** - Example API client for making authenticated requests
- **`src/preload/index.ts`** - Exposes secure IPC channels to renderer
- **`src/renderer/src/renderer.ts`** - UI logic for login/logout

## Security Features

✅ **State Parameter** - CSRF protection  
✅ **Content Security Policy** - Prevents XSS attacks  
✅ **Context Isolation** - Renderer process isolation  
✅ **No Node Integration** - Secure renderer environment  
✅ **Secure IPC** - contextBridge for safe communication

## Documentation

- [CLIO_AUTH_GUIDE.md](./CLIO_AUTH_GUIDE.md) - Complete authentication guide
  - Redirect URI configuration
  - Deauthorization callbacks
  - Token refresh
  - Security best practices
  - Troubleshooting

## API Usage Example

```typescript
// In main process
import ClioAPIClient from './api-client'

const apiClient = new ClioAPIClient(authManager)

// Get current user
const { data, error } = await apiClient.getCurrentUser()
if (!error) {
  console.log('User:', data)
}

// Get contacts
const contacts = await apiClient.getContacts({ limit: 50 })

// Get matters
const matters = await apiClient.getMatters({ limit: 100 })
```

## Next Steps

- [ ] Implement token persistence (using `electron-store` or `safeStorage`)
- [ ] Add automatic token refresh
- [ ] Build data extraction UI
- [ ] Add export functionality (CSV, JSON, etc.)
- [ ] Implement rate limiting handling
- [ ] Add progress indicators for long operations

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Tech Stack

- **Electron** - Cross-platform desktop apps
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Electron Vite** - Electron + Vite integration

## Troubleshooting

### "Clio credentials not found in environment variables"

**Solution:** Make sure you have a `.env` file with `CLIO_CLIENT_ID` and `CLIO_CLIENT_SECRET`.

### "redirect_uri_mismatch"

**Solution:** Verify that `http://127.0.0.1/` is added as a redirect URI in your Clio developer application settings.

### Auth window doesn't close after authorization

**Solution:** Check browser console in the auth window for errors. The redirect URL might not be matching.

For more troubleshooting, see [CLIO_AUTH_GUIDE.md](./CLIO_AUTH_GUIDE.md#troubleshooting).

## Resources

- [Clio API Documentation](https://docs.developers.clio.com/)
- [Electron Documentation](https://www.electronjs.org/docs)
- [OAuth 2.0 Specification](https://www.rfc-editor.org/rfc/rfc6749)

## License

MIT

## Support

For Clio API issues: api@clio.com  
For general questions: Open an issue on GitHub
