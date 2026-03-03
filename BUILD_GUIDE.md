# Building Clio Extractor for Windows (EXE)

## Prerequisites

1. **Node.js** (v18 or newer recommended) - [Download](https://nodejs.org/)
2. **npm** (comes with Node.js)
3. **Clio OAuth credentials** — Create a `.env` file in the project root with:
   ```
   CLIO_CLIENT_ID=your_clio_app_client_id
   CLIO_CLIENT_SECRET=your_clio_app_client_secret
   ```
   Get these from [Clio Developer Portal](https://developers.clio.com/) when creating your app. The `.env` is encrypted at build time and packaged as `.env.enc` so the installed app can authenticate.
4. Ensure all dependencies are installed:
   ```bash
   npm install
   ```

## Build Steps

### 1. Build the application

```bash
npm run build:win
```

This command will:

1. Convert PNG icon to ICO
2. Encrypt `.env` → `.env.enc` (AES-256-GCM)
3. Run type checking
4. Build the Electron app with electron-vite
5. Package it into a Windows executable using electron-builder

### 2. Output location

After a successful build, your files will be in:

- **Installer (NSIS):** `dist/Clio Extractor Setup 1.0.0.exe` — Full installer with option to choose install directory
- **Portable:** `dist/Clio Extractor 1.0.0.exe` — Portable EXE, no installation required (run directly)

## Build variants

| Command         | Output                                                       |
|----------------|--------------------------------------------------------------|
| `npm run build:win` | Installer + Portable EXE in `dist/` folder                   |
| `npm run build:unpack` | Unpacked app folder (for testing, no installer)            |

## Icon

The build converts `resources/clio-extractor-logo.png` to `.ico` automatically for Windows. The app uses this icon for:

- Window taskbar icon
- Desktop shortcut icon
- Installer icon

**Note:** For best results, use a PNG at least 256×256 pixels. electron-builder converts it to the required Windows .ico format automatically.

## Troubleshooting

- **"client_id missing" / "Invalid authorization request":** Ensure `.env` exists in the project root with `CLIO_CLIENT_ID` and `CLIO_CLIENT_SECRET` **before** running `npm run build:win`. The `.env` is encrypted and packaged as `.env.enc`.
- **Build fails:** Run `npm run build` first to see type/compile errors
- **Icon not showing:** Ensure `resources/clio-extractor-logo.png` exists and is at least 256×256px
- **Antivirus flags EXE:** Unsigned executables may be flagged; add an exception or sign the app (requires code signing certificate)
