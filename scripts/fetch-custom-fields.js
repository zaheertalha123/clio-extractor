#!/usr/bin/env node
/**
 * Standalone script to fetch custom fields from Clio API.
 * Reads CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, REFRESH_TOKEN from .env (project root).
 * Refreshes the access token, then fetches all custom fields with full field set and pagination.
 *
 * Query params: fields, limit=200, order=id(asc). Paginates until no more pages.
 *
 * Usage: node scripts/fetch-custom-fields.js [options]
 * Options (env or future CLI): created_since, updated_since, parent_type, field_type, etc.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const ENV_FILE = path.join(ROOT, '.env')
const TOKEN_URL = 'https://app.clio.com/oauth/token'
const CUSTOM_FIELDS_BASE = 'https://app.clio.com/api/v4/custom_fields.json'

// Full response shape: top-level + picklist_options nested
const CUSTOM_FIELDS_FIELDS = [
  'id', 'etag', 'created_at', 'updated_at', 'name', 'parent_type', 'field_type',
  'displayed', 'deleted', 'required', 'display_order',
  'picklist_options{id,etag,created_at,updated_at,option,deleted_at}'
].join(',')

function parseEnv(filePath) {
  const env = {}
  if (!fs.existsSync(filePath)) return env
  const content = fs.readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) env[key] = value.slice(1, -1)
    else env[key] = value
  }
  return env
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  }).toString()

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.access_token
}

/**
 * Build URL with optional query params. All params are optional except fields.
 * @param {Object} opts - created_since, updated_since, deleted, field_type, fields, ids[],
 *   limit, order, page_token, parent_type, query, visible_and_required
 */
function buildCustomFieldsUrl(opts = {}) {
  const params = new URLSearchParams()
  params.set('fields', opts.fields ?? CUSTOM_FIELDS_FIELDS)
  if (opts.limit != null) params.set('limit', String(opts.limit))
  if (opts.order != null) params.set('order', opts.order)
  if (opts.page_token != null) params.set('page_token', opts.page_token)
  if (opts.parent_type != null) params.set('parent_type', opts.parent_type)
  if (opts.field_type != null) params.set('field_type', opts.field_type)
  if (opts.query != null) params.set('query', opts.query)
  if (opts.deleted != null) params.set('deleted', opts.deleted ? 'true' : 'false')
  if (opts.visible_and_required != null) params.set('visible_and_required', opts.visible_and_required ? 'true' : 'false')
  if (opts.created_since != null) params.set('created_since', opts.created_since)
  if (opts.updated_since != null) params.set('updated_since', opts.updated_since)
  if (opts.ids != null && opts.ids.length) opts.ids.forEach(id => params.append('ids[]', String(id)))
  const qs = params.toString()
  return qs ? `${CUSTOM_FIELDS_BASE}?${qs}` : CUSTOM_FIELDS_BASE
}

async function fetchCustomFieldsPage(accessToken, url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    console.error('API error:', res.status, res.statusText)
    const text = await res.text()
    console.error(text)
    process.exit(1)
  }

  return res.json()
}

/** Fetch all pages and return { data: [...all records...] } */
async function fetchAllCustomFields(accessToken, opts = {}) {
  const limit = opts.limit ?? 200
  const order = opts.order ?? 'id(asc)'
  const allData = []
  let pageToken = null
  let page = 0

  do {
    page++
    const url = buildCustomFieldsUrl({
      ...opts,
      fields: opts.fields ?? CUSTOM_FIELDS_FIELDS,
      limit,
      order,
      page_token: pageToken ?? undefined
    })
    if (page === 1) console.error('Fetching custom fields (full fields, limit=%s, order=%s)...', limit, order)
    else console.error('Fetching page %s...', page)

    const response = await fetchCustomFieldsPage(accessToken, url)
    const pageData = response.data ?? []
    allData.push(...pageData)

    // Clio pagination: meta.paging.next_page_token or similar
    const nextToken = response.meta?.paging?.next_page_token ?? response.meta?.next_page_token ?? null
    const hasMore = nextToken && pageData.length === limit
    pageToken = hasMore ? nextToken : null
  } while (pageToken)

  return { data: allData }
}

/**
 * Analyze custom fields: unique parent_type values and count per parent_type.
 * Prints summary to stderr.
 */
function analyzeCustomFields(data) {
  if (!Array.isArray(data) || data.length === 0) {
    console.error('Analysis: no data to analyze.')
    return
  }

  const byParentType = Object.create(null)
  for (const row of data) {
    const pt = row.parent_type != null ? String(row.parent_type) : '(missing)'
    if (!byParentType[pt]) byParentType[pt] = 0
    byParentType[pt]++
  }

  const parentTypes = Object.keys(byParentType).sort()
  console.error('')
  console.error('--- Custom fields analysis ---')
  console.error('Unique parent_type values:', parentTypes.length)
  console.error('Options:', parentTypes.join(', ') || '(none)')
  console.error('')
  console.error('Count per parent_type:')
  for (const pt of parentTypes) {
    console.error('  %s: %d', pt, byParentType[pt])
  }
  console.error('---')
  console.error('')
}

async function main() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('.env not found at:', ENV_FILE)
    process.exit(1)
  }

  const env = parseEnv(ENV_FILE)
  const clientId = env.CLIO_CLIENT_ID
  const clientSecret = env.CLIO_CLIENT_SECRET
  const refreshToken = env.REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('.env must contain CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, and REFRESH_TOKEN')
    process.exit(1)
  }

  console.error('Refreshing access token...')
  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken)

  const result = await fetchAllCustomFields(accessToken)
  console.error('Total custom fields:', result.data.length)
  analyzeCustomFields(result.data)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
