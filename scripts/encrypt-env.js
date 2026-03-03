#!/usr/bin/env node
/**
 * Encrypts .env file for production builds.
 * Run before electron-builder. Output: .env.enc
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const ENV_PATH = path.join(__dirname, '../.env')
const ENC_PATH = path.join(__dirname, '../.env.enc')

// Obfuscated seed: hex decode of "clio-extractor-v1-seed"
const _h = (x) => Buffer.from(x, 'hex').toString('utf8')
const _p = (...parts) => parts.map(_h).join('')
const SEED = _p('636c696f2d', '657874726163746f72', '2d76312d', '73656564')
const SALT = _p('636f6d2e636c696f2e657874726163746f72') // com.clio.extractor

function getKey() {
  return crypto.pbkdf2Sync(SEED, SALT, 15000, 32, 'sha256')
}

function encrypt(plaintext) {
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, enc])
}

function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('No .env file found. Create .env with CLIO_CLIENT_ID and CLIO_CLIENT_SECRET before build.')
    process.exit(1)
  }

  const content = fs.readFileSync(ENV_PATH, 'utf8')
  const enc = encrypt(content)
  fs.writeFileSync(ENC_PATH, enc)
  console.log('Encrypted .env → .env.enc')
}

main()
