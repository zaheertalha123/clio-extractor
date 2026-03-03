#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

async function convert() {
  try {
    const pngToIco = (await import('png-to-ico')).default
    const pngPath = path.join(__dirname, '../resources/clio-extractor-logo.png')
    const icoPath = path.join(__dirname, '../resources/clio-extractor-logo.ico')

    if (!fs.existsSync(pngPath)) {
      console.error('PNG not found:', pngPath)
      process.exit(1)
    }

    const buf = await pngToIco(pngPath)
    fs.writeFileSync(icoPath, buf)
    console.log('Created', icoPath)
  } catch (err) {
    console.error('Icon conversion failed:', err.message)
    process.exit(1)
  }
}

convert()
