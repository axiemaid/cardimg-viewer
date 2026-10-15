#!/usr/bin/env node
/**
 * CARDIMG Viewer — Clean public-facing gallery
 *
 * Static frontend served by a minimal Express server.
 * Talks to the CARDIMG API for data. No own state.
 *
 * Usage:
 *   node server.cjs                          # Default port 3015
 *   node server.cjs --port 3025              # Custom port
 *   node server.cjs --api http://localhost:3014   # Custom API URL
 */

const path = require('path')
const fs = require('fs')
const express = require('express')

const DEFAULT_PORT = 3015
const DEFAULT_API = 'http://localhost:3014'

function main() {
  const args = process.argv.slice(2)
  const portArg = args.indexOf('--port')
  const port = portArg >= 0 ? parseInt(args[portArg + 1]) : DEFAULT_PORT
  const apiArg = args.indexOf('--api')
  const apiUrl = apiArg >= 0 ? args[apiArg + 1] : DEFAULT_API

  const app = express()

  // Inject API URL into client-side JS via env-like endpoint
  app.get('/config.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript')
    res.send(`window.CARDIMG_API = ${JSON.stringify(apiUrl)};`)
  })

  // Serve static files from public/
  const publicDir = path.join(__dirname, 'public')
  app.use(express.static(publicDir))

  // Fallback to index.html for any non-asset route (for deep linking)
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })

  app.listen(port, () => {
    console.log(`CARDIMG Viewer running at http://localhost:${port}`)
    console.log(`API: ${apiUrl}`)
  })
}

main()
