#!/usr/bin/env node
/**
 * Seed демо-данных Tetik: магазин Murabaha Auto, стартовые групповые чаты,
 * демо-объявления с фото из tetik-assets/parts (фото должны лежать рядом или в Storage).
 *
 * Запуск (нужны креды):
 *   FIREBASE_SERVICE_ACCOUNT='<json>' FIREBASE_PROJECT_ID=<id> node scripts/seed.mjs
 *
 * Скрипт идемпотентный: документы создаются с фиксированными id, повторный запуск обновляет их.
 */
import crypto from 'node:crypto'

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
const PROJECT = process.env.FIREBASE_PROJECT_ID || SA.project_id
if (!SA.client_email || !PROJECT) {
  console.error('Нужны FIREBASE_SERVICE_ACCOUNT и FIREBASE_PROJECT_ID')
  process.exit(1)
}

/* ---- Google OAuth ---- */
function b64url(buf) {
  return Buffer.from(buf).toString('base64url')
}
async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const input = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(input)
  const jwt = `${input}.${sign.sign(SA.private_key, 'base64url')}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(JSON.stringify(data))
  return data.access_token
}

/* ---- Firestore REST ---- */
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
function fv(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fv) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fv(x)])) } }
}
async function setDoc(token, path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fv(v)]))
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  console.log('✓', path)
}

function keywords(title, brand, model, category) {
  const words = `${title} ${brand} ${model} ${category}`.toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, ' ').split(/\s+/).filter((w) => w.length >= 2)
  return [...new Set(words)].slice(0, 30)
}

/* ---- Данные ---- */
const now = new Date()
const SYS_UID = 'system-seed'

const GROUP_CHATS = [
  { id: 'g-bishkek', title: 'Запчасти Бишкек 🔧', region: 'Бишкек' },
  { id: 'g-osh', title: 'Запчасти Ош 🔧', region: 'Ош' },
  { id: 'g-toyota', title: 'Toyota KG — клуб', topic: 'Toyota' },
  { id: 'g-honda', title: 'Honda Fit/Stepwgn KG', topic: 'Honda' },
  { id: 'g-german', title: 'Немцы: Mercedes/BMW/Audi', topic: 'Евро' },
]

// Фото демо-объявлений должны быть загружены в Storage (scripts берут URL из manifest,
// пока Storage пуст — публичные пути /parts/*.jpg можно захостить на Pages)
const LISTINGS = [
  { id: 'demo-1', img: 'camry-headlight', title: 'Фара передняя Camry 70, новая, оригинал, в упаковке', price: 8500, category: 'body', brand: 'Toyota', model: 'Camry 70', condition: 'new', city: 'Бишкек' },
  { id: 'demo-2', img: 'fit-bumper', title: 'Бампер передний Honda Fit, б/у, серебристый, без трещин', price: 3200, category: 'body', brand: 'Honda', model: 'Fit', condition: 'used', city: 'Бишкек' },
  { id: 'demo-3', img: 'brake-pads', title: 'Колодки тормозные передние, комплект, новые в упаковке', price: 1400, category: 'brakes', brand: 'Toyota', model: 'универсал', condition: 'new', city: 'Ош' },
  { id: 'demo-4', img: 'alternator', title: 'Генератор б/у, рабочий, снят с Camry 40, проверен', price: 4800, category: 'electrics', brand: 'Toyota', model: 'Camry 40', condition: 'used', city: 'Бишкек' },
  { id: 'demo-5', img: 'radiator', title: 'Радиатор охлаждения новый, подходит на Corolla/Prius', price: 6200, category: 'engine', brand: 'Toyota', model: 'Corolla', condition: 'new', city: 'Бишкек' },
  { id: 'demo-6', img: 'shock-absorbers', title: 'Амортизаторы передние 2 шт., новые, комплект', price: 5500, category: 'suspension', brand: 'Honda', model: 'Fit', condition: 'new', city: 'Ош' },
  { id: 'demo-7', img: 'oil-filters', title: 'Фильтр масляный, в наличии много, оптом дешевле', price: 280, category: 'oils', brand: 'Другая', model: '', condition: 'new', city: 'Бишкек' },
  { id: 'demo-8', img: 'alloy-wheels', title: 'Диски литые R16 4 шт., б/у, без серьёзных повреждений', price: 12000, category: 'wheels', brand: 'Другая', model: 'R16', condition: 'used', city: 'Бишкек' },
  { id: 'demo-9', img: 'battery', title: 'Аккумулятор 60Ач новый, гарантия 1 год, доставка', price: 5900, category: 'electrics', brand: 'Другая', model: '60Ah', condition: 'new', city: 'Бишкек' },
  { id: 'demo-10', img: 'timing-kit', title: 'Комплект ГРМ (ремень + ролики), новый, в упаковке', price: 3700, category: 'engine', brand: 'Toyota', model: '1ZZ/2ZR', condition: 'new', city: 'Ош' },
]

const SITE = process.env.SITE_URL || 'https://tetik.pages.dev'

const token = await accessToken()

// Магазин Murabaha Auto
await setDoc(token, 'stores/murabaha-auto', {
  slug: 'murabaha-auto',
  name: 'Murabaha Auto',
  desc: 'Официальный автосалон в Оше. Авто в рассрочку по исламским принципам, оригинальные запчасти под заказ.',
  city: 'Ош',
  phone: '+996550000000', // TODO: реальный номер салона
  verified: true,
  ownerUid: SYS_UID,
  cover: `${SITE}/heroes/stores-banner.jpg`,
  createdAt: now,
})

// Групповые чаты
for (const g of GROUP_CHATS) {
  await setDoc(token, `chats/${g.id}`, {
    type: 'group',
    title: g.title,
    region: g.region || '',
    topic: g.topic || '',
    members: [SYS_UID],
    lastMsg: 'Добро пожаловать! Кош келиңиздер!',
    lastMsgAt: now,
    createdAt: now,
  })
  await setDoc(token, `chats/${g.id}/messages/welcome`, {
    senderId: SYS_UID,
    senderName: 'Tetik',
    text: `Это группа «${g.title}». Пишите, что продаёте или ищете — как в WhatsApp, только с поиском по базару 🔧`,
    createdAt: now,
  })
}

// Демо-объявления
for (const l of LISTINGS) {
  await setDoc(token, `listings/${l.id}`, {
    title: l.title,
    desc: 'Демо-объявление Tetik. Звоните или пишите в WhatsApp — ответим быстро. Торг уместен.',
    price: l.price,
    currency: 'KGS',
    category: l.category,
    brand: l.brand,
    model: l.model,
    condition: l.condition,
    city: l.city,
    photos: [`${SITE}/parts/${l.img}.jpg`],
    sellerId: SYS_UID,
    sellerName: l.city === 'Ош' ? 'Автозапчасти Ош' : 'Автозапчасти Бишкек',
    phone: '+996550000000',
    status: 'active',
    keywords: keywords(l.title, l.brand, l.model, l.category),
    views: Math.floor(Math.random() * 60) + 5,
    createdAt: now,
    bumpedAt: now,
  })
}

console.log('\nSeed завершён ✓')
