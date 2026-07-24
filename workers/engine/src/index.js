/**
 * Tetik Engine — Cloudflare Worker
 * ----------------------------------
 * Роуты:
 *   POST /auth/send-code  { email }         → отправляет 6-значный код на почту (Brevo)
 *   POST /auth/verify     { email, code }   → проверяет код, возвращает Firebase custom token
 * Cron (каждые 6ч):
 *   - автомодерация свежих объявлений по стоп-словам → status=blocked
 *   - автоархив объявлений старше 60 дней → status=archived
 *
 * Работает на бесплатных тарифах: Firebase Spark + Workers Free + Brevo Free.
 * Секреты: FIREBASE_SERVICE_ACCOUNT (JSON), BREVO_API_KEY
 * Переменные: FIREBASE_PROJECT_ID, ALLOWED_ORIGINS, SENDER_EMAIL, SENDER_NAME
 */

const OTP_TTL_MS = 10 * 60 * 1000 // 10 минут
const RESEND_COOLDOWN_MS = 60 * 1000 // 1 минута между письмами
const MAX_ATTEMPTS = 5
const ARCHIVE_AFTER_DAYS = 60

const STOP_WORDS = [
  'казино', 'ставки на спорт', 'букмекер', 'порно', 'эскорт', 'интим',
  'наркотик', 'гашиш', 'мефедрон', 'закладк', 'финансовая пирамида',
  'быстрый заработок', 'работа в интернете без вложений', 'млм',
  'документы под ключ', 'права без экзамен', 'диплом купить',
]

/* ============================ utils ============================ */

const enc = new TextEncoder()

function b64url(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlJson(obj) {
  return b64url(enc.encode(JSON.stringify(obj)))
}

async function sha256hex(str) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(str))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

function corsHeaders(env, request) {
  const origin = request.headers.get('Origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
  const ok = allowed.includes('*') || allowed.includes(origin)
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/* ====================== Google auth (JWT) ====================== */

async function importPrivateKey(pem) {
  const raw = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const bin = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8', bin.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )
}

async function signJwt(claims, sa) {
  const input = `${b64urlJson({ alg: 'RS256', typ: 'JWT' })}.${b64urlJson(claims)}`
  const key = await importPrivateKey(sa.private_key)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(input))
  return `${input}.${b64url(sig)}`
}

const tokenCache = { token: null, exp: 0 }

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000)
  if (tokenCache.token && tokenCache.exp > now + 120) return tokenCache.token
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
  const jwt = await signJwt(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa,
  )
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  if (!res.ok) throw new Error(`oauth ${res.status}: ${await res.text()}`)
  const data = await res.json()
  tokenCache.token = data.access_token
  tokenCache.exp = now + (data.expires_in || 3600)
  return tokenCache.token
}

/** Firebase custom token для signInWithCustomToken */
async function mintCustomToken(env, uid, extraClaims) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
  const now = Math.floor(Date.now() / 1000)
  return signJwt(
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now,
      exp: now + 3600,
      uid,
      claims: extraClaims || {},
    },
    sa,
  )
}

/* ====================== Firestore REST ====================== */

function fsBase(env) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
}

// Кодирование JS → Firestore Value
function fv(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fv) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fv(x)])) } }
}

// Декодирование Firestore Value → JS
function fj(value) {
  if (!value) return null
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('booleanValue' in value) return value.booleanValue
  if ('timestampValue' in value) return new Date(value.timestampValue)
  if ('nullValue' in value) return null
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fj)
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, fj(v)]))
  return null
}

function docToObj(doc) {
  return Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fj(v)]))
}

async function fsGet(env, token, path) {
  const res = await fetch(`${fsBase(env)}/${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`fsGet ${res.status}`)
  return docToObj(await res.json())
}

async function fsSet(env, token, path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fv(v)]))
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const res = await fetch(`${fsBase(env)}/${path}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`fsSet ${res.status}: ${await res.text()}`)
}

async function fsDelete(env, token, path) {
  await fetch(`${fsBase(env)}/${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}

async function fsQuery(env, token, structuredQuery) {
  const res = await fetch(`${fsBase(env)}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  })
  if (!res.ok) throw new Error(`fsQuery ${res.status}: ${await res.text()}`)
  const rows = await res.json()
  return rows
    .filter((r) => r.document)
    .map((r) => ({ path: r.document.name.split('/documents/')[1], data: docToObj(r.document) }))
}

/* ====================== Email (Brevo) ====================== */

function otpEmailHtml(code) {
  return `<!doctype html><html><body style="margin:0;background:#111110;font-family:Arial,sans-serif;padding:32px 16px">
  <div style="max-width:420px;margin:0 auto;background:#1c1c1a;border-radius:16px;padding:32px;text-align:center">
    <p style="color:#ff6b1a;font-weight:800;font-size:22px;letter-spacing:2px;margin:0 0 8px">TETIK</p>
    <p style="color:#f0efe9;font-size:15px;margin:0 0 4px">Ваш код для входа / Кирүү коду:</p>
    <p style="color:#ffffff;background:#2a2a27;border-radius:12px;font-size:34px;font-weight:800;letter-spacing:10px;padding:16px 8px;margin:16px 0">${code}</p>
    <p style="color:#9a9890;font-size:12px;margin:0">Код действует 10 минут. Если это были не вы — просто игнорируйте письмо.<br/>Код 10 мүнөт жарактуу.</p>
  </div>
  <p style="color:#5c5a52;font-size:11px;text-align:center;margin-top:16px">Tetik — маркетплейс автозапчастей Кыргызстана</p>
</body></html>`
}

async function sendOtpEmail(env, email, code) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || 'Tetik' },
      to: [{ email }],
      subject: `${code} — код входа в Tetik`,
      htmlContent: otpEmailHtml(code),
    }),
  })
  if (!res.ok) throw new Error(`brevo ${res.status}: ${await res.text()}`)
}

/* ====================== Auth handlers ====================== */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function handleSendCode(env, body) {
  const email = String(body.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 200) return { status: 400, data: { error: 'bad_email' } }

  const token = await getAccessToken(env)
  const key = await sha256hex(email)
  const existing = await fsGet(env, token, `otps/${key}`)
  const now = Date.now()

  if (existing && existing.lastSentAt && now - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { status: 429, data: { error: 'too_often' } }
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
  const codeHash = await sha256hex(`${code}:${email}`)

  await fsSet(env, token, `otps/${key}`, {
    email,
    codeHash,
    attempts: 0,
    expiresAt: new Date(now + OTP_TTL_MS),
    lastSentAt: new Date(now),
  })
  await sendOtpEmail(env, email, code)
  return { status: 200, data: { ok: true } }
}

async function handleVerify(env, body) {
  const email = String(body.email || '').trim().toLowerCase()
  const code = String(body.code || '').trim()
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return { status: 400, data: { error: 'bad_input' } }

  const token = await getAccessToken(env)
  const key = await sha256hex(email)
  const rec = await fsGet(env, token, `otps/${key}`)
  const now = Date.now()

  if (!rec || !rec.expiresAt || rec.expiresAt.getTime() < now) {
    return { status: 400, data: { error: 'expired' } }
  }
  if ((rec.attempts || 0) >= MAX_ATTEMPTS) {
    return { status: 429, data: { error: 'too_many_attempts' } }
  }

  const codeHash = await sha256hex(`${code}:${email}`)
  if (codeHash !== rec.codeHash) {
    await fsSet(env, token, `otps/${key}`, { attempts: (rec.attempts || 0) + 1 })
    return { status: 400, data: { error: 'wrong_code' } }
  }

  await fsDelete(env, token, `otps/${key}`)
  const uid = `u${key.slice(0, 27)}` // детерминированный uid из email
  const customToken = await mintCustomToken(env, uid, { em: email })
  return { status: 200, data: { token: customToken, uid } }
}

/* ====================== Cron: автономная работа ====================== */

async function moderationSweep(env) {
  const token = await getAccessToken(env)

  // 1) Автомодерация: свежие активные объявления → стоп-слова
  const fresh = await fsQuery(env, token, {
    from: [{ collectionId: 'listings' }],
    where: {
      fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } },
    },
    orderBy: [{ field: { fieldPath: 'bumpedAt' }, direction: 'DESCENDING' }],
    limit: 200,
  })

  let blocked = 0
  for (const { path, data } of fresh) {
    const hay = `${data.title || ''} ${data.desc || ''}`.toLowerCase()
    if (STOP_WORDS.some((w) => hay.includes(w))) {
      await fsSet(env, token, path, { status: 'blocked', blockedReason: 'automod_stopword', blockedAt: new Date() })
      blocked++
    }
  }

  // 2) Автоархив: активные объявления старше N дней
  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 24 * 3600 * 1000)
  const stale = await fsQuery(env, token, {
    from: [{ collectionId: 'listings' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
          { fieldFilter: { field: { fieldPath: 'bumpedAt' }, op: 'LESS_THAN', value: { timestampValue: cutoff.toISOString() } } },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: 'bumpedAt' }, direction: 'ASCENDING' }],
    limit: 200,
  })

  for (const { path } of stale) {
    await fsSet(env, token, path, { status: 'archived', archivedAt: new Date() })
  }

  // 3) Пульс системы — виден на клиенте (system/health)
  await fsSet(env, token, 'system/health', {
    lastSweepAt: new Date(),
    lastBlocked: blocked,
    lastArchived: stale.length,
  })
}

/* ====================== entry ====================== */

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(request.url)
    if (request.method !== 'POST') return json({ error: 'method' }, 405, cors)

    let body = {}
    try {
      body = await request.json()
    } catch {
      return json({ error: 'bad_json' }, 400, cors)
    }

    try {
      if (url.pathname === '/auth/send-code') {
        const r = await handleSendCode(env, body)
        return json(r.data, r.status, cors)
      }
      if (url.pathname === '/auth/verify') {
        const r = await handleVerify(env, body)
        return json(r.data, r.status, cors)
      }
      return json({ error: 'not_found' }, 404, cors)
    } catch (e) {
      console.error(e)
      return json({ error: 'internal' }, 500, cors)
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(moderationSweep(env))
  },
}
