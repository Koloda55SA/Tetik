#!/usr/bin/env node
/**
 * Прямая загрузка dist/ в Cloudflare Pages (протокол wrangler direct upload).
 * Использование: PAGES_JWT=<jwt> node scripts/pages-upload.mjs
 * Выводит JSON-манифест { "/path": "hash" } для создания деплоймента.
 */
import { hash as blake3 } from 'blake3-wasm'
import fs from 'node:fs'
import path from 'node:path'

const JWT = process.env.PAGES_JWT
if (!JWT) { console.error('нет PAGES_JWT'); process.exit(1) }

const DIST = path.resolve(process.cwd(), 'dist')
const API = 'https://api.cloudflare.com/client/v4'

const MIME = {
  html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp',
  ico: 'image/x-icon', txt: 'text/plain', webmanifest: 'application/manifest+json', map: 'application/json',
  woff: 'font/woff', woff2: 'font/woff2',
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}

const files = walk(DIST)
const manifest = {}
const byHash = {}

for (const f of files) {
  const rel = '/' + path.relative(DIST, f).split(path.sep).join('/')
  const ext = f.split('.').pop() || ''
  const base64 = fs.readFileSync(f).toString('base64')
  const h = blake3(base64 + ext).toString('hex').slice(0, 32)
  manifest[rel] = h
  byHash[h] = { base64, contentType: MIME[ext.toLowerCase()] || 'application/octet-stream' }
}

console.error(`файлов: ${files.length}`)

async function api(pathname, body) {
  const res = await fetch(`${API}${pathname}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${JWT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    throw new Error(`${pathname}: HTTP ${res.status} ${JSON.stringify(data.errors || data).slice(0, 400)}`)
  }
  return data.result
}

// 1) какие хэши отсутствуют
const missing = await api('/pages/assets/check-missing', { hashes: Object.keys(byHash) })
console.error(`к загрузке: ${missing.length}`)

// 2) загрузка порциями
const BATCH = 30
for (let i = 0; i < missing.length; i += BATCH) {
  const chunk = missing.slice(i, i + BATCH).map((h) => ({
    key: h,
    value: byHash[h].base64,
    metadata: { contentType: byHash[h].contentType },
    base64: true,
  }))
  await api('/pages/assets/upload', chunk)
  console.error(`загружено ${Math.min(i + BATCH, missing.length)}/${missing.length}`)
}

// 3) закрепить хэши
await api('/pages/assets/upsert-hashes', { hashes: Object.keys(byHash) }).catch((e) => console.error('upsert:', e.message))

// манифест — в stdout
console.log(JSON.stringify(manifest))
