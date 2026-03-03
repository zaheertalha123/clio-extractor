import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'

const TOKEN_FILE = 'clio-tokens.dat'

interface StoredTokens {
  access_token: string
  refresh_token: string
}

function getTokenFilePath(): string {
  return join(app.getPath('userData'), TOKEN_FILE)
}

function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function storeTokens(accessToken: string, refreshToken: string): boolean {
  if (!isEncryptionAvailable()) {
    console.warn('safeStorage is not available, tokens will not be persisted')
    return false
  }

  try {
    const data: StoredTokens = {
      access_token: accessToken,
      refresh_token: refreshToken
    }

    const plainText = JSON.stringify(data)
    const encrypted = safeStorage.encryptString(plainText)
    const filePath = getTokenFilePath()

    writeFileSync(filePath, encrypted)
    return true
  } catch (error) {
    console.error('Failed to store tokens:', error)
    return false
  }
}

export function loadTokens(): StoredTokens | null {
  if (!isEncryptionAvailable()) {
    return null
  }

  const filePath = getTokenFilePath()
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const encrypted = readFileSync(filePath)
    const decrypted = safeStorage.decryptString(encrypted)
    return JSON.parse(decrypted) as StoredTokens
  } catch (error) {
    console.error('Failed to load tokens (may be corrupted or from different machine):', error)
    clearTokens()
    return null
  }
}

export function clearTokens(): void {
  try {
    const filePath = getTokenFilePath()
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  } catch (error) {
    console.error('Failed to clear tokens:', error)
  }
}
