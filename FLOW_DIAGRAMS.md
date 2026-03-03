# Clio OAuth Flow - Visual Guide

This document provides visual representations of the OAuth authentication flow.

## Complete OAuth Flow Diagram

```
┌─────────────┐
│   User      │
│  Opens App  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  Clio Extractor App         │
│  Shows "Login with Clio"    │
└──────────┬──────────────────┘
           │ User clicks login
           ▼
┌─────────────────────────────────────────┐
│  Step 1: Generate State & Build URL     │
│  https://app.clio.com/oauth/authorize?  │
│    response_type=code                   │
│    client_id=YOUR_ID                    │
│    redirect_uri=http://127.0.0.1/       │
│    state=RANDOM_STRING                  │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Step 2: Open Auth Window   │
│  (New BrowserWindow)        │
│  Loads Clio login page      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  User at Clio Website       │
│  - Enters credentials       │
│  - Sees permission request  │
│  - Clicks "Authorize"       │
└──────────┬──────────────────┘
           │
           ├──────────┐
           │          │
  ┌────────▼──┐   ┌───▼─────────┐
  │  Approved │   │  Declined   │
  └────┬──────┘   └────┬────────┘
       │               │
       ▼               ▼
┌──────────────┐  ┌────────────────────┐
│ Redirect to  │  │ Redirect to        │
│ http://      │  │ http://127.0.0.1/  │
│ 127.0.0.1/   │  │ ?error=            │
│ ?code=XXX    │  │ access_denied      │
│ &state=YYY   │  │ &state=YYY         │
└──────┬───────┘  └────────┬───────────┘
       │                   │
       ▼                   ▼
┌──────────────────┐  ┌────────────────┐
│ Step 3:          │  │ Show Error     │
│ Validate State   │  │ Close Window   │
└──────┬───────────┘  └────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Step 4: Exchange Code for Token      │
│ POST https://app.clio.com/oauth/token│
│   client_id=YOUR_ID                  │
│   client_secret=YOUR_SECRET          │
│   grant_type=authorization_code      │
│   code=XXX                           │
│   redirect_uri=http://127.0.0.1/     │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Response:                    │
│ {                            │
│   "access_token": "...",     │
│   "refresh_token": "...",    │
│   "expires_in": 604800       │
│ }                            │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Step 5: Store Tokens         │
│ - Save in memory             │
│ - Close auth window          │
│ - Update UI                  │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ User Authenticated!          │
│ Ready to use Clio API        │
└──────────────────────────────┘
```

## File Structure and Data Flow

```
┌─────────────────────────────────────────┐
│         Renderer Process                │
│      (src/renderer/src/renderer.ts)     │
│                                         │
│  ┌──────────────────────────────┐      │
│  │  UI Components:              │      │
│  │  - Login Button              │      │
│  │  - Logout Button             │      │
│  │  - Status Display            │      │
│  └──────────────┬───────────────┘      │
│                 │                       │
│        window.api.clio.login()         │
└─────────────────┼───────────────────────┘
                  │
                  │ IPC Call
                  │
┌─────────────────▼───────────────────────┐
│         Preload Script                  │
│      (src/preload/index.ts)             │
│                                         │
│  contextBridge.exposeInMainWorld({     │
│    api: {                              │
│      clio: {                           │
│        login: () =>                    │
│          ipcRenderer.invoke(          │
│            'clio:login')               │
│      }                                 │
│    }                                   │
│  })                                    │
└─────────────────┬───────────────────────┘
                  │
                  │ IPC Channel
                  │
┌─────────────────▼───────────────────────┐
│         Main Process                    │
│        (src/main/index.ts)              │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  ClioAuthManager                 │  │
│  │  (src/main/auth.ts)              │  │
│  │                                  │  │
│  │  ┌────────────────────────────┐ │  │
│  │  │  setupIpcHandlers()        │ │  │
│  │  │  - clio:login              │ │  │
│  │  │  - clio:logout             │ │  │
│  │  │  - clio:get-token          │ │  │
│  │  │  - clio:is-authenticated   │ │  │
│  │  └────────────────────────────┘ │  │
│  │                                  │  │
│  │  ┌────────────────────────────┐ │  │
│  │  │  startAuthFlow()           │ │  │
│  │  │  - Generate state          │ │  │
│  │  │  - Build auth URL          │ │  │
│  │  │  - Open BrowserWindow      │ │  │
│  │  └────────────────────────────┘ │  │
│  │                                  │  │
│  │  ┌────────────────────────────┐ │  │
│  │  │  handleRedirect()          │ │  │
│  │  │  - Capture redirect URL    │ │  │
│  │  │  - Extract code            │ │  │
│  │  │  - Validate state          │ │  │
│  │  └────────────────────────────┘ │  │
│  │                                  │  │
│  │  ┌────────────────────────────┐ │  │
│  │  │  exchangeCodeForToken()    │ │  │
│  │  │  - POST to Clio API        │ │  │
│  │  │  - Store tokens            │ │  │
│  │  └────────────────────────────┘ │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  ClioAPIClient                   │  │
│  │  (src/main/api-client.ts)        │  │
│  │                                  │  │
│  │  - getCurrentUser()              │  │
│  │  - getContacts()                 │  │
│  │  - getMatters()                  │  │
│  │  - getBills()                    │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
                  │
                  │ HTTPS
                  │
┌─────────────────▼───────────────────────┐
│         Clio API                        │
│    (app.clio.com/api/v4/*)              │
│                                         │
│  Authorization: Bearer <access_token>   │
└─────────────────────────────────────────┘
```

## Token Lifecycle

```
┌─────────────────────────┐
│  Initial State          │
│  No tokens stored       │
└──────────┬──────────────┘
           │
           │ User logs in
           ▼
┌─────────────────────────────────────┐
│  Authentication Successful          │
│  - access_token stored              │
│  - refresh_token stored             │
│  - expires_in: 604800 seconds       │
│    (7 days)                         │
└──────────┬──────────────────────────┘
           │
           │ Time passes...
           ▼
┌─────────────────────────────────────┐
│  Token Valid                        │
│  Can make API requests              │
│                                     │
│  Every request:                     │
│  Authorization: Bearer ACCESS_TOKEN │
└──────────┬──────────────────────────┘
           │
           │ 7 days pass
           ▼
┌─────────────────────────────────────┐
│  Token Expired                      │
│  API returns 401 Unauthorized       │
└──────────┬──────────────────────────┘
           │
           ├──────────┐
           │          │
    ┌──────▼───┐  ┌───▼─────────────┐
    │ Refresh  │  │ Re-authenticate │
    │ Token    │  │ (login again)   │
    └────┬─────┘  └─────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Refresh Token Request             │
│  POST /oauth/token                 │
│    grant_type=refresh_token        │
│    refresh_token=REFRESH_TOKEN     │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  New Access Token Received         │
│  Continue making API requests      │
└────────────────────────────────────┘
```

## State Management (CSRF Protection)

```
┌──────────────────────────┐
│  Generate Random State   │
│  state = randomBytes(16) │
│  Example: "a3f7e9c2..." │
└──────────┬───────────────┘
           │
           │ Store in memory
           ▼
┌──────────────────────────────────┐
│  Send to Clio in Auth URL        │
│  ...&state=a3f7e9c2...           │
└──────────┬───────────────────────┘
           │
           │ User authorizes
           ▼
┌──────────────────────────────────┐
│  Clio Returns Same State         │
│  redirect?code=XXX&state=a3f7... │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Validate State                  │
│  if (received !== stored) {      │
│    throw "CSRF Attack!"          │
│  }                               │
└──────────┬───────────────────────┘
           │
           │ State matches ✓
           ▼
┌──────────────────────────────────┐
│  Proceed with Token Exchange     │
└──────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────┐
│         Renderer Process                │
│      (Untrusted Environment)            │
│                                         │
│  - No direct Node.js access             │
│  - No direct file system access         │
│  - Limited by Content Security Policy  │
│  - Can only use exposed APIs            │
└─────────────────┬───────────────────────┘
                  │
                  │ IPC (contextBridge)
                  │ Only specific APIs
                  │
┌─────────────────▼───────────────────────┐
│         Preload Script                  │
│      (Bridge - Secure APIs Only)        │
│                                         │
│  contextBridge.exposeInMainWorld()     │
│  - Only expose safe functions          │
│  - No direct access to main process    │
│  - Type-safe API definitions           │
└─────────────────┬───────────────────────┘
                  │
                  │ IPC Channels
                  │ Validated requests
                  │
┌─────────────────▼───────────────────────┐
│         Main Process                    │
│      (Trusted Environment)              │
│                                         │
│  - Full Node.js access                 │
│  - File system access                  │
│  - Environment variables (.env)        │
│  - Secure token storage                │
│  - Network requests to Clio API        │
└─────────────────────────────────────────┘

Security Layers:
├─ Context Isolation ✓
├─ Content Security Policy ✓
├─ No Node Integration ✓
├─ Secure IPC ✓
├─ HTTPS only ✓
└─ State validation (CSRF) ✓
```

## Error Handling Flow

```
┌─────────────────┐
│  User Action    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Try Authentication     │
└────────┬────────────────┘
         │
         ├──────────────┬──────────────┬────────────┐
         │              │              │            │
    ┌────▼─────┐  ┌─────▼──────┐ ┌────▼─────┐ ┌───▼──────┐
    │ Success  │  │ User       │ │ Network  │ │ Invalid  │
    │          │  │ Declined   │ │ Error    │ │ Creds    │
    └────┬─────┘  └─────┬──────┘ └────┬─────┘ └───┬──────┘
         │              │              │            │
         ▼              ▼              ▼            ▼
    ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌──────────┐
    │ Store      │ │ Show       │ │ Retry     │ │ Show     │
    │ Tokens     │ │ "Declined" │ │ Logic     │ │ Error    │
    │ Update UI  │ │ Message    │ │           │ │ Message  │
    └────────────┘ └────────────┘ └───────────┘ └──────────┘
```

## Directory Structure

```
clio-extractor/
│
├── src/
│   ├── main/                    # Main process (Node.js)
│   │   ├── index.ts            # Entry point
│   │   ├── auth.ts             # OAuth manager
│   │   └── api-client.ts       # API helper
│   │
│   ├── preload/                # Preload scripts
│   │   ├── index.ts            # IPC bridge
│   │   └── index.d.ts          # Type definitions
│   │
│   └── renderer/               # Renderer process (Browser)
│       ├── index.html          # Main HTML
│       ├── src/
│       │   └── renderer.ts     # UI logic
│       └── assets/
│           └── main.css        # Styles
│
├── .env                        # Environment variables
├── .env.example                # Template
│
├── README.md                   # Main documentation
├── QUICKSTART.md              # Quick setup guide
├── CLIO_AUTH_GUIDE.md         # Detailed auth guide
└── REDIRECTS_CALLBACKS.md     # This document
```

## API Request Flow

```
┌────────────────────────┐
│  Renderer wants data   │
│  (e.g., user contacts) │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────────────┐
│  Get token from main process   │
│  const token = await           │
│    window.api.clio.getToken()  │
└───────────┬────────────────────┘
            │
            ▼
┌────────────────────────────────┐
│  Make API request              │
│  fetch('clio.com/api/v4/...', {│
│    headers: {                  │
│      'Authorization':          │
│        `Bearer ${token}`       │
│    }                           │
│  })                            │
└───────────┬────────────────────┘
            │
            ├──────────┬──────────┐
            │          │          │
      ┌─────▼────┐ ┌───▼───┐ ┌───▼────┐
      │ 200 OK   │ │ 401   │ │ Other  │
      └─────┬────┘ └───┬───┘ └───┬────┘
            │          │          │
            ▼          ▼          ▼
      ┌──────────┐ ┌─────────┐ ┌─────────┐
      │ Return   │ │ Refresh │ │ Handle  │
      │ Data     │ │ Token   │ │ Error   │
      └──────────┘ └─────────┘ └─────────┘
```

---

## Legend

```
┌────┐
│Box │  = Process or component
└────┘

  │
  ▼     = Flow direction

─────   = Data flow

┌────┐
│ ✓  │  = Security feature enabled
└────┘
```

---

For implementation details, see:
- [CLIO_AUTH_GUIDE.md](./CLIO_AUTH_GUIDE.md)
- [QUICKSTART.md](./QUICKSTART.md)
- [README.md](./README.md)
