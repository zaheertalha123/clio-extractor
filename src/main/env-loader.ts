/**
 * Loads env from .env.enc (encrypted) or .env (dev).
 * Key derivation matches scripts/encrypt-env.js
 */
import { createDecipheriv, pbkdf2Sync } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { config, parse } from 'dotenv'
import { app } from 'electron'

// Obfuscated: same seed as encrypt-env.js (hex-decoded fragments)
const _h = (x: string): string => Buffer.from(x, 'hex').toString('utf8')
const _p = (...parts: string[]): string => parts.map(_h).join('')
const _s = _p('636c696f2d', '657874726163746f72', '2d76312d', '73656564')
const _t = _p('636f6d2e636c696f2e657874726163746f72')

function getKey(): Buffer {
  return pbkdf2Sync(_s, _t, 15000, 32, 'sha256')
}

function decrypt(data: Buffer): string {
  const key = getKey()
  const iv = data.subarray(0, 16)
  const authTag = data.subarray(16, 32)
  const enc = data.subarray(32)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

function loadIntoProcessEnv(content: string): void {
  const parsed = parse(content)
  for (const [k, v] of Object.entries(parsed)) {
    if (v !== undefined) process.env[k] = v
  }
}

export function loadEnv(): void {
  const basePaths = app.isPackaged
    ? [process.resourcesPath, app.getAppPath()]
    : [process.cwd()]

  for (const base of basePaths) {
    const encPath = join(base, '.env.enc')
    const plainPath = join(base, '.env')

    if (existsSync(encPath)) {
      try {
        const enc = readFileSync(encPath)
        const plain = decrypt(enc)
        loadIntoProcessEnv(plain)
        return
      } catch {
        // Fall through to plain .env
      }
    }

    if (existsSync(plainPath)) {
      config({ path: plainPath })
      return
    }
  }
}
