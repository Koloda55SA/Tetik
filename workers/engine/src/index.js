/**
 * Tetik Engine — Cloudflare Worker
 * --------------------------------------------------------------------
 * 1. Cron каждые 6 часов: проверка сайта и базы. Запрос к базе заодно
 *    держит Supabase активным (против паузы бесплатного тарифа).
 *    При сбое зовёт edge-функцию alert-mailer — владельцу приходит письмо.
 *    Раз в сутки пингует IndexNow (Bing/Яндекс) свежими ссылками.
 * 2. GET /sitemap.xml — живая карта сайта из базы (+ страницы моделей).
 * 3. GET /l/{id}, /cars, /cars/{slug} — поисковым ботам и превьюшникам
 *    отдаём готовый HTML с контентом и разметкой; людям — SPA с Pages.
 * 4. GET /{key}.txt — подтверждение ключа IndexNow.
 *
 * Vars: SUPABASE_URL, SUPABASE_ANON_KEY (публичный), ALERT_URL, ALERT_TOKEN,
 *       INDEXNOW_KEY
 */

const SITE = 'https://tetik.radev.digital'
const SITEMAP_V = '2026-07-25-cars'  // меняем при правках структуры карты сайта
const PAGES = 'https://tetik.pages.dev'

// превьюшники соцсетей + поисковые краулеры
const BOT_RE =
  /whatsapp|facebookexternalhit|facebot|telegrambot|twitterbot|vkshare|linkedinbot|slackbot|discordbot|skypeuripreview|viber|okhttp|googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot|petalbot|ahrefs|semrush|bot\b|crawler|spider|preview/

/** Самые ходовые машины КР — синхронно с src/lib/types.ts */
const CARS = [
  ['toyota-camry', 'Toyota', 'Camry'],
  ['daewoo-matiz', 'Daewoo', 'Matiz'],
  ['honda-fit', 'Honda', 'Fit'],
  ['daewoo-nexia', 'Daewoo', 'Nexia'],
  ['hyundai-sonata', 'Hyundai', 'Sonata'],
  ['lexus-rx', 'Lexus', 'RX'],
  ['honda-cr-v', 'Honda', 'CR-V'],
  ['toyota-prius', 'Toyota', 'Prius'],
  ['honda-accord', 'Honda', 'Accord'],
  ['honda-odyssey', 'Honda', 'Odyssey'],
  ['toyota-rav4', 'Toyota', 'RAV4'],
  ['mercedes-benz-e-klass', 'Mercedes-Benz', 'E-класс'],
  ['mercedes-benz-c-klass', 'Mercedes-Benz', 'C-класс'],
  ['bmw-5', 'BMW', '5 серия'],
  ['bmw-3', 'BMW', '3 серия'],
  ['volkswagen-passat', 'Volkswagen', 'Passat'],
  ['audi-80', 'Audi', '80'],
  ['audi-a6', 'Audi', 'A6'],
  ['subaru-outback', 'Subaru', 'Outback'],
  ['subaru-legacy', 'Subaru', 'Legacy'],
  ['hyundai-accent', 'Hyundai', 'Accent'],
  ['hyundai-grandeur', 'Hyundai', 'Grandeur'],
  ['kia-rio', 'Kia', 'Rio'],
  ['kia-k5', 'Kia', 'K5'],
  ['kia-sorento', 'Kia', 'Sorento'],
  ['toyota-corolla', 'Toyota', 'Corolla'],
  ['toyota-land-cruiser-prado', 'Toyota', 'Land Cruiser Prado'],
  ['lada-2107', 'Lada (ВАЗ)', '2107'],
  ['lada-2106', 'Lada (ВАЗ)', '2106'],
  ['mitsubishi-galant', 'Mitsubishi', 'Galant'],
  ['mitsubishi-outlander', 'Mitsubishi', 'Outlander'],
  ['nissan-x-trail', 'Nissan', 'X-Trail'],
  ['chevrolet-lacetti', 'Chevrolet', 'Lacetti'],
  ['lexus-es', 'Lexus', 'ES'],
  ['opel-vectra', 'Opel', 'Vectra'],
  ['toyota-highlander', 'Toyota', 'Highlander'],
  ['honda-stepwgn', 'Honda', 'Stepwgn'],
  ['toyota-ipsum', 'Toyota', 'Ipsum'],
  ['mercedes-benz-sprinter', 'Mercedes-Benz', 'Sprinter'],
  ['byd-song-plus', 'BYD', 'Song Plus'],
]

const CITIES = ['Бишкек', 'Ош', 'Джалал-Абад', 'Каракол']
const PARTS = ['фара', 'бампер', 'тормозные колодки', 'стойка амортизатора', 'коробка автомат', 'радиатор', 'зеркало', 'двигатель']

function sbHeaders(env) {
  return {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
  }
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const som = (n) => `${Number(n).toLocaleString('ru-RU')} сом`

/* ================= sitemap ================= */

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
  const today = new Date().toISOString().slice(0, 10)

  const urls = [
    { loc: `${SITE}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE}/bazar`, priority: '0.9', changefreq: 'hourly' },
    { loc: `${SITE}/cars`, priority: '0.9', changefreq: 'daily', lastmod: today },
    { loc: `${SITE}/stores`, priority: '0.7', changefreq: 'weekly' },
    // страницы моделей: модель + модель×город
    ...CARS.flatMap(([slug]) => [
      { loc: `${SITE}/cars/${slug}`, priority: '0.8', changefreq: 'daily', lastmod: today },
      ...CITIES.map((c) => ({
        loc: `${SITE}/cars/${slug}?city=${encodeURIComponent(c)}`,
        priority: '0.6',
        changefreq: 'weekly',
        lastmod: today,
      })),
    ]),
    ...listings.map((l) => ({
      loc: `${SITE}/l/${l.id}`,
      lastmod: l.bumpedAt ? String(l.bumpedAt).slice(0, 10) : undefined,
      priority: '0.8',
      changefreq: 'weekly',
    })),
    ...stores.map((s) => ({ loc: `${SITE}/s/${encodeURIComponent(s.slug)}`, priority: '0.7', changefreq: 'weekly' })),
  ]

  const body = urls
    .map(
      (u) =>
        `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${
          u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ''
        }<priority>${u.priority}</priority></url>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
}

/* ================= HTML для ботов ================= */

function shell({ title, desc, canonical, image, ld, body }) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tetik">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
${image ? `<meta property="og:image" content="${image}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${image}">` : ''}
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head><body>${body}
<hr><nav><a href="${SITE}/">Главная</a> · <a href="${SITE}/bazar">Базар</a> · <a href="${SITE}/cars">Запчасти по моделям</a> · <a href="${SITE}/stores">Магазины</a></nav>
</body></html>`
}

async function ogListing(env, id) {
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/listings?select=title,%22desc%22,price,city,photos,status,brand,model,condition,%22bumpedAt%22&id=eq.${id}`,
    { headers: sbHeaders(env) },
  )
  if (!r.ok) return null
  const rows = await r.json()
  const l = rows[0]
  if (!l || l.status === 'blocked') return null

  const photo = Array.isArray(l.photos) && l.photos[0] ? String(l.photos[0]) : ''
  const img = photo ? (photo.startsWith('http') ? photo : SITE + photo) : `${SITE}/og-image.jpg`
  const title = esc(`${l.title} — ${som(l.price)}`)
  const desc = esc(`${String(l.desc || '').slice(0, 150)}${l.desc ? ' · ' : ''}${l.city} · Tetik — запчасти КР`)
  const canonical = `${SITE}/l/${id}`

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: l.title,
    description: String(l.desc || '').slice(0, 400),
    image: img,
    brand: { '@type': 'Brand', name: l.brand },
    itemCondition: l.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    offers: {
      '@type': 'Offer',
      price: Number(l.price),
      priceCurrency: 'KGS',
      availability: l.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      url: canonical,
      areaServed: l.city,
    },
  }

  const body = `<h1>${title}</h1>
<p><img src="${esc(img)}" alt="${esc(l.title)}" width="600"></p>
<p><strong>${som(l.price)}</strong> · ${esc(l.brand)} ${esc(l.model)} · ${esc(l.city)} · ${l.condition === 'new' ? 'новое' : 'б/у'}</p>
<p>${esc(String(l.desc || '').slice(0, 800))}</p>
<p><a href="${canonical}">Открыть объявление на Tetik</a></p>`

  return shell({ title, desc, canonical, image: esc(img), ld, body })
}

async function ogCar(env, slug, city) {
  const car = CARS.find((c) => c[0] === slug)
  if (!car) return null
  const [, brand, model] = car
  const q =
    `${env.SUPABASE_URL}/rest/v1/listings?select=id,title,price,city,photos&status=eq.active` +
    `&brand=eq.${encodeURIComponent(brand)}&model=ilike.*${encodeURIComponent(model)}*` +
    (city ? `&city=eq.${encodeURIComponent(city)}` : '') +
    `&order=%22bumpedAt%22.desc&limit=30`
  const r = await fetch(q, { headers: sbHeaders(env) })
  const items = r.ok ? await r.json() : []

  const where = city ? ` в ${city}` : ' в Кыргызстане'
  const title = esc(`Запчасти на ${brand} ${model}${where} — купить, цены · Tetik`)
  const desc = esc(
    `Запчасти на ${brand} ${model}${where}: ${items.length} объявлений от продавцов, авторазборов и магазинов. Новые и б/у детали, цены в сомах, Бишкек, Ош и вся страна.`,
  )
  const canonical = `${SITE}/cars/${slug}${city ? `?city=${encodeURIComponent(city)}` : ''}`
  const firstPhoto = items.find((i) => Array.isArray(i.photos) && i.photos[0])
  const img = firstPhoto ? String(firstPhoto.photos[0]) : `${SITE}/og-image.jpg`

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tetik', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Запчасти по моделям', item: `${SITE}/cars` },
          { '@type': 'ListItem', position: 3, name: `${brand} ${model}`, item: canonical },
        ],
      },
      ...(items.length
        ? [
            {
              '@type': 'ItemList',
              name: `Запчасти на ${brand} ${model}${where}`,
              numberOfItems: items.length,
              itemListElement: items.slice(0, 20).map((l, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                  '@type': 'Product',
                  name: l.title,
                  image: Array.isArray(l.photos) ? l.photos[0] : undefined,
                  offers: {
                    '@type': 'Offer',
                    price: Number(l.price),
                    priceCurrency: 'KGS',
                    url: `${SITE}/l/${l.id}`,
                  },
                },
              })),
            },
          ]
        : []),
    ],
  }

  const list = items.length
    ? `<ul>${items
        .map((l) => `<li><a href="${SITE}/l/${l.id}">${esc(l.title)}</a> — ${som(l.price)}, ${esc(l.city)}</li>`)
        .join('')}</ul>`
    : `<p>Пока нет активных объявлений на ${esc(brand)} ${esc(model)}${esc(where)}. Спросите в группах Tetik — продавцы отвечают быстро.</p>`

  const body = `<h1>Запчасти на ${esc(brand)} ${esc(model)}${esc(where)}</h1>
<p>${esc(brand)} ${esc(model)} — одна из самых распространённых машин Кыргызстана, детали на неё есть почти всегда. Новые и б/у, оригинал и аналоги, от частных продавцов, авторазборов и официальных магазинов. Цены в сомах, связь напрямую по телефону или WhatsApp.</p>
<h2>Объявления (${items.length})</h2>
${list}
<h2>Что чаще всего ищут</h2>
<ul>${PARTS.map((p) => `<li><a href="${SITE}/bazar?q=${encodeURIComponent(`${p} ${model}`)}">${esc(p)} ${esc(model)}</a></li>`).join('')}</ul>
<h2>По городам</h2>
<ul>${CITIES.map((c) => `<li><a href="${SITE}/cars/${slug}?city=${encodeURIComponent(c)}">Запчасти на ${esc(brand)} ${esc(model)} в ${esc(c)}</a></li>`).join('')}</ul>`

  return shell({ title, desc, canonical, image: esc(img), ld, body })
}

function ogCarsHub() {
  const title = 'Запчасти по моделям машин — Кыргызстан · Tetik'
  const desc = esc(
    'Запчасти на самые распространённые машины Кыргызстана: Toyota Camry, Honda Fit, Daewoo Nexia, Mercedes, BMW, Hyundai, Kia и другие. Новые и б/у детали, Бишкек, Ош и вся страна.',
  )
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url: `${SITE}/cars`,
    hasPart: CARS.map(([slug, brand, model]) => ({
      '@type': 'WebPage',
      name: `Запчасти на ${brand} ${model}`,
      url: `${SITE}/cars/${slug}`,
    })),
  }
  const body = `<h1>Запчасти по моделям машин</h1>
<p>Выберите свою машину — увидите только подходящие детали от продавцов, авторазборов и магазинов Кыргызстана.</p>
<ul>${CARS.map(([slug, brand, model]) => `<li><a href="${SITE}/cars/${slug}">Запчасти на ${esc(brand)} ${esc(model)}</a></li>`).join('')}</ul>`
  return shell({ title, desc, canonical: `${SITE}/cars`, image: `${SITE}/og-image.jpg`, ld, body })
}

/* ================= мониторинг ================= */

async function healthProblems(env) {
  const problems = []
  try {
    const r = await fetch(`${PAGES}/`, { headers: { accept: 'text/html' } })
    const html = r.ok ? await r.text() : ''
    if (!r.ok) problems.push(`Сайт tetik.radev.digital: ошибка HTTP ${r.status}`)
    else if (!/tetik/i.test(html)) problems.push('Сайт отвечает, но отдаёт неожиданный контент')
  } catch (e) {
    problems.push(`Сайт недоступен: ${String(e && e.message).slice(0, 120)}`)
  }
  try {
    // этот же запрос — активность против паузы Supabase
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/listings?select=id&limit=1`, {
      headers: sbHeaders(env),
    })
    if (!r.ok) problems.push(`База данных (Supabase): ошибка HTTP ${r.status}`)
  } catch (e) {
    problems.push(`База данных недоступна: ${String(e && e.message).slice(0, 120)}`)
  }
  return problems
}

async function notifyOwner(env, problems) {
  if (!env.ALERT_URL || !env.ALERT_TOKEN || problems.length === 0) return
  await fetch(env.ALERT_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-alert-token': env.ALERT_TOKEN,
      ...sbHeaders(env),
    },
    body: JSON.stringify({ problems, subject: '🔴 Tetik: обнаружена проблема' }),
  }).catch(() => {})
}

/* ================= IndexNow (Bing + Яндекс) ================= */

async function pingIndexNow(env) {
  if (!env.INDEXNOW_KEY) return
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/listings?select=id&status=eq.active&order=%22bumpedAt%22.desc&limit=40`,
    { headers: sbHeaders(env) },
  )
  const listings = r.ok ? await r.json() : []
  const urlList = [
    `${SITE}/`,
    `${SITE}/bazar`,
    `${SITE}/cars`,
    ...CARS.slice(0, 20).map(([slug]) => `${SITE}/cars/${slug}`),
    ...listings.map((l) => `${SITE}/l/${l.id}`),
  ]
  await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'tetik.radev.digital',
      key: env.INDEXNOW_KEY,
      keyLocation: `${SITE}/${env.INDEXNOW_KEY}.txt`,
      urlList,
    }),
  }).catch(() => {})
  // подсказка Google/Bing о новом sitemap
  await Promise.all([
    fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(`${SITE}/sitemap.xml`)}`).catch(() => {}),
  ])
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const problems = await healthProblems(env)
        await notifyOwner(env, problems)
        // раз в сутки (в ночной тик) сообщаем поисковикам о свежих страницах
        const hour = new Date((event && event.scheduledTime) || Date.now()).getUTCHours()
        if (hour < 6 && problems.length === 0) await pingIndexNow(env)
      })(),
    )
  },

  async fetch(req, env, ctx) {
    const url = new URL(req.url)
    const ua = (req.headers.get('user-agent') || '').toLowerCase()
    const isBot = BOT_RE.test(ua)

    /* ---- подтверждение ключа IndexNow ---- */
    if (env.INDEXNOW_KEY && url.pathname === `/${env.INDEXNOW_KEY}.txt`) {
      return new Response(env.INDEXNOW_KEY, {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' },
      })
    }

    /* ---- живой sitemap ---- */
    if (url.pathname === '/sitemap.xml') {
      const cache = caches.default
      // версия в ключе кэша: при обновлении воркера старая карта не залипает
      const cacheKey = new Request(`${SITE}/sitemap.xml?v=${SITEMAP_V}`, { method: 'GET' })
      const cached = await cache.match(cacheKey)
      if (cached) return cached
      try {
        const xml = await buildSitemap(env)
        const res = new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
        ctx.waitUntil(cache.put(cacheKey, res.clone()))
        return res
      } catch {
        return new Response('sitemap error', { status: 500 })
      }
    }

    /* ---- страницы моделей: боту готовый HTML ---- */
    if (url.pathname === '/cars' || url.pathname === '/cars/') {
      if (isBot) {
        return new Response(ogCarsHub(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
        })
      }
      return fetch(`${PAGES}${url.pathname}${url.search}`, {
        headers: { accept: req.headers.get('accept') || '*/*' },
      })
    }

    if (url.pathname.startsWith('/cars/')) {
      const slug = (url.pathname.split('/')[2] || '').toLowerCase()
      if (isBot && /^[a-z0-9-]{2,60}$/.test(slug)) {
        try {
          const html = await ogCar(env, slug, url.searchParams.get('city') || '')
          if (html) {
            return new Response(html, {
              headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=1800' },
            })
          }
        } catch {
          /* fallthrough */
        }
      }
      return fetch(`${PAGES}${url.pathname}${url.search}`, {
        headers: { accept: req.headers.get('accept') || '*/*' },
      })
    }

    /* ---- OG-превью объявлений для ботов ---- */
    if (url.pathname.startsWith('/l/')) {
      const id = (url.pathname.split('/')[2] || '').toLowerCase()
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

    return new Response('tetik engine ok', { headers: { 'content-type': 'text/plain' } })
  },
}
