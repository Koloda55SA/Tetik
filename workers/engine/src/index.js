/**
 * Tetik Pinger + Sitemap + OG-превью — Cloudflare Worker
 * -------------------------------------------------------
 * 1. Cron каждые 6 часов: лёгкий REST-запрос — активность против паузы Supabase.
 * 2. GET /sitemap.xml — живая карта сайта из базы.
 * 3. GET /l/{id} — для ботов-превьюшников (WhatsApp, Telegram, соцсети)
 *    отдаёт OG-разметку с фото, названием и ценой объявления;
 *    людям прозрачно проксирует SPA с Pages.
 *
 * Vars: SUPABASE_URL, SUPABASE_ANON_KEY (anon-ключ публичный, не секрет)
 */

const SITE = 'https://tetik.radev.digital'
const PAGES = 'https://tetik.pages.dev'

const BOT_RE = /whatsapp|facebookexternalhit|facebot|telegrambot|twitterbot|vkshare|linkedinbot|slackbot|discordbot|skypeuripreview|viber|okhttp|bot\b|crawler|spider|preview/

function sbHeaders(env) {
  return {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
  }
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function buildSitemap(env) {
  const [listingsRes, storesRes] = await Promise.all([
    fetch(
      `${env.SUPABASE_URL}/rest/v1/listings?select=id,%22bumpedAt%22&status=eq.active&order=%22bumpedAt%22.desc&limit=2000`,
      { headers: sbHeaders(env) },
    ),
    fetch(`${env.SUPABASE_URL}/rest/v1/stores?select=slug,%22createdAt%22&limit=500`, {
      headers: sbHeaders(env),
    }),
  ])
  const listings = listingsRes.ok ? await listingsRes.json() : []
  const stores = storesRes.ok ? await storesRes.json() : []

  const urls = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/bazar`, priority: '0.9' },
    { loc: `${SITE}/stores`, priority: '0.7' },
    ...listings.map((l) => ({
      loc: `${SITE}/l/${l.id}`,
      lastmod: l.bumpedAt ? String(l.bumpedAt).slice(0, 10) : undefined,
      priority: '0.8',
    })),
    ...stores.map((s) => ({ loc: `${SITE}/s/${encodeURIComponent(s.slug)}`, priority: '0.7' })),
  ]

  const body = urls
    .map(
      (u) =>
        `<url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
}

async function ogListing(env, id) {
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/listings?select=title,%22desc%22,price,city,photos,status&id=eq.${id}`,
    { headers: sbHeaders(env) },
  )
  if (!r.ok) return null
  const rows = await r.json()
  const l = rows[0]
  if (!l || l.status === 'blocked') return null

  const photo = Array.isArray(l.photos) && l.photos[0] ? String(l.photos[0]) : ''
  const img = photo ? (photo.startsWith('http') ? photo : SITE + photo) : `${SITE}/og-image.jpg`
  const title = esc(`${l.title} — ${Number(l.price).toLocaleString('ru-RU')} сом`)
  const desc = esc(`${String(l.desc || '').slice(0, 150)}${l.desc ? ' · ' : ''}${l.city} · Tetik — запчасти КР`)
  const pageUrl = `${SITE}/l/${id}`

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>${title}</title>
<meta property="og:type" content="product">
<meta property="og:site_name" content="Tetik">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${pageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${pageUrl}">
</head><body><a href="${pageUrl}">${title}</a></body></html>`
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      fetch(`${env.SUPABASE_URL}/rest/v1/listings?select=id&limit=1`, { headers: sbHeaders(env) }),
    )
  },

  async fetch(req, env, ctx) {
    const url = new URL(req.url)

    /* ---- живой sitemap ---- */
    if (url.pathname === '/sitemap.xml') {
      const cache = caches.default
      const cached = await cache.match(req)
      if (cached) return cached
      try {
        const xml = await buildSitemap(env)
        const res = new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
        ctx.waitUntil(cache.put(req, res.clone()))
        return res
      } catch {
        return new Response('sitemap error', { status: 500 })
      }
    }

    /* ---- OG-превью объявлений для ботов ---- */
    if (url.pathname.startsWith('/l/')) {
      const id = (url.pathname.split('/')[2] || '').toLowerCase()
      const ua = (req.headers.get('user-agent') || '').toLowerCase()
      const isBot = BOT_RE.test(ua)
      if (isBot && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
        try {
          const html = await ogListing(env, id)
          if (html) {
            return new Response(html, {
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=600',
              },
            })
          }
        } catch {
          /* fallthrough к прокси */
        }
      }
      // люди — прозрачный прокси SPA с Pages
      return fetch(`${PAGES}${url.pathname}${url.search}`, {
        headers: { accept: req.headers.get('accept') || '*/*' },
      })
    }

    return new Response('tetik-pinger ok', { headers: { 'content-type': 'text/plain' } })
  },
}
