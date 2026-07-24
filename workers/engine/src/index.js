/**
 * Tetik Pinger + Sitemap — Cloudflare Worker
 * -------------------------------------------
 * 1. Cron каждые 6 часов: лёгкий REST-запрос — активность против паузы
 *    бесплатного Supabase (засыпает после 7 дней тишины).
 * 2. GET /sitemap.xml — живая карта сайта из базы (объявления + магазины),
 *    роут на зоне: tetik.radev.digital/sitemap.xml.
 *
 * Vars: SUPABASE_URL, SUPABASE_ANON_KEY (anon-ключ публичный, не секрет)
 */

const SITE = 'https://tetik.radev.digital'

function sbHeaders(env) {
  return {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
  }
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

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      fetch(`${env.SUPABASE_URL}/rest/v1/listings?select=id&limit=1`, { headers: sbHeaders(env) }),
    )
  },

  async fetch(req, env, ctx) {
    const url = new URL(req.url)
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
      } catch (e) {
        return new Response('sitemap error', { status: 500 })
      }
    }
    return new Response('tetik-pinger ok', { headers: { 'content-type': 'text/plain' } })
  },
}
