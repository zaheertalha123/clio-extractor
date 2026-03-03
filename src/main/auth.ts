import { BrowserWindow, ipcMain } from 'electron'
import { randomBytes } from 'crypto'
import { storeTokens, loadTokens, clearTokens } from './token-storage'

interface ClioTokenResponse {
  token_type: string
  access_token: string
  expires_in: number
  refresh_token: string
}

interface ClioAuthState {
  state: string
  codeVerifier?: string
}

class ClioAuthManager {
  private clientId: string
  private clientSecret: string
  private redirectUri: string
  private authWindow: BrowserWindow | null = null
  private authState: ClioAuthState | null = null
  private accessToken: string | null = null
  private refreshToken: string | null = null

  constructor() {
    this.clientId = process.env.CLIO_CLIENT_ID || ''
    this.clientSecret = process.env.CLIO_CLIENT_SECRET || ''
    this.redirectUri = 'http://127.0.0.1/' // Match your registered redirect URI

    if (!this.clientId || !this.clientSecret) {
      console.error('Clio credentials not found in environment variables')
    }

    this.setupIpcHandlers()
    this.loadStoredTokens()
  }

  private loadStoredTokens(): void {
    try {
      const stored = loadTokens()
      if (stored) {
        this.accessToken = stored.access_token
        this.refreshToken = stored.refresh_token
        console.log('Loaded tokens from secure storage')
      }
    } catch (error) {
      console.error('Failed to load stored tokens:', error)
    }
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('clio:login', async (_event, keepMeLoggedIn: boolean) => {
      return await this.startAuthFlow(keepMeLoggedIn)
    })

    ipcMain.handle('clio:logout', async () => {
      return await this.deauthorize()
    })

    ipcMain.handle('clio:get-token', () => {
      return this.accessToken
    })

    ipcMain.handle('clio:is-authenticated', () => {
      return this.accessToken !== null
    })
  }

  private generateState(): string {
    return randomBytes(16).toString('hex')
  }

  async startAuthFlow(keepMeLoggedIn: boolean = false): Promise<{ success: boolean; error?: string }> {
    try {
      // Generate state for CSRF protection
      const state = this.generateState()
      this.authState = { state }

      const authUrl = this.buildAuthUrl(state)

      return await this.openAuthWindow(authUrl, keepMeLoggedIn)
    } catch (error) {
      console.error('Auth flow error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: state,
      redirect_on_decline: 'true'
    })

    return `https://app.clio.com/oauth/authorize?${params.toString()}`
  }

  private openAuthWindow(authUrl: string, keepMeLoggedIn: boolean): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.authWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      this.authWindow.loadURL(authUrl)

      this.authWindow.once('ready-to-show', () => {
        this.authWindow?.show()
      })

      // Handle navigation events to capture the redirect
      this.authWindow.webContents.on('will-redirect', async (_event, url) => {
        await this.handleRedirect(url, resolve, keepMeLoggedIn)
      })

      this.authWindow.webContents.on('did-navigate', async (_event, url) => {
        await this.handleRedirect(url, resolve, keepMeLoggedIn)
      })

      // Handle window close
      this.authWindow.on('closed', () => {
        this.authWindow = null
        if (this.authState) {
          // Window was closed without completing auth
          resolve({ success: false, error: 'Authentication window was closed' })
          this.authState = null
        }
      })
    })
  }

  private async handleRedirect(
    url: string,
    resolve: (value: { success: boolean; error?: string }) => void,
    keepMeLoggedIn: boolean
  ): Promise<void> {
    if (url.startsWith(this.redirectUri) || url.includes('127.0.0.1')) {
      const urlObj = new URL(url)
      const code = urlObj.searchParams.get('code')
      const state = urlObj.searchParams.get('state')
      const error = urlObj.searchParams.get('error')

      // Verify state matches
      if (state !== this.authState?.state) {
        this.authWindow?.close()
        resolve({ success: false, error: 'State mismatch - possible CSRF attack' })
        this.authState = null
        return
      }

      // Handle authorization denial
      if (error === 'access_denied') {
        this.authWindow?.close()
        resolve({ success: false, error: 'User declined authorization' })
        this.authState = null
        return
      }

      // Exchange code for token
      if (code) {
        try {
          await this.exchangeCodeForToken(code, keepMeLoggedIn)
          this.authWindow?.close()
          resolve({ success: true })
        } catch (err) {
          this.authWindow?.close()
          resolve({
            success: false,
            error: err instanceof Error ? err.message : 'Token exchange failed'
          })
        }
        this.authState = null
      }
    }
  }

  private async exchangeCodeForToken(code: string, keepMeLoggedIn: boolean): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.redirectUri
    })

    const response = await fetch('https://app.clio.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`)
    }

    const data: ClioTokenResponse = await response.json()

    this.accessToken = data.access_token
    this.refreshToken = data.refresh_token

    if (keepMeLoggedIn) {
      storeTokens(data.access_token, data.refresh_token)
    }

    console.log('Successfully authenticated with Clio')
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.error('No refresh token available')
      return false
    }

    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      })

      const response = await fetch('https://app.clio.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`)
      }

      const data: ClioTokenResponse = await response.json()
      this.accessToken = data.access_token

      console.log('Successfully refreshed access token')
      return true
    } catch (error) {
      console.error('Token refresh error:', error)
      return false
    }
  }

  async deauthorize(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.accessToken) {
        const params = new URLSearchParams({
          token: this.accessToken
        })

        const response = await fetch('https://app.clio.com/oauth/deauthorize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        })

        if (!response.ok) {
          throw new Error(`Deauthorization failed: ${response.status}`)
        }

        console.log('Successfully deauthorized')
      }

      this.accessToken = null
      this.refreshToken = null
      clearTokens()

      return { success: true }
    } catch (error) {
      console.error('Deauthorization error:', error)
      this.accessToken = null
      this.refreshToken = null
      clearTokens()
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deauthorization failed'
      }
    }
  }

  getAccessToken(): string | null {
    return this.accessToken
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null
  }
}

export default ClioAuthManager
