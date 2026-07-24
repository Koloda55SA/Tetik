export type CategorySlug =
  | 'engine' | 'suspension' | 'body' | 'electrics' | 'interior'
  | 'brakes' | 'wheels' | 'oils' | 'accessories' | 'tools'

export interface CategoryDef {
  slug: CategorySlug
  ru: string
  ky: string
  img: string
}

export const CATEGORIES: CategoryDef[] = [
  { slug: 'engine',      ru: 'Двигатель',       ky: 'Кыймылдаткыч',      img: '/categories/engine.jpg' },
  { slug: 'suspension',  ru: 'Ходовая',          ky: 'Жүрүүчү бөлүк',     img: '/categories/suspension.jpg' },
  { slug: 'body',        ru: 'Кузов',            ky: 'Кузов',             img: '/categories/body.jpg' },
  { slug: 'electrics',   ru: 'Электрика',        ky: 'Электрика',         img: '/categories/electrics.jpg' },
  { slug: 'interior',    ru: 'Салон',            ky: 'Салон',             img: '/categories/interior.jpg' },
  { slug: 'brakes',      ru: 'Тормоза',          ky: 'Тормоз',            img: '/categories/brakes.jpg' },
  { slug: 'wheels',      ru: 'Колёса и шины',    ky: 'Дөңгөлөк жана шина', img: '/categories/wheels.jpg' },
  { slug: 'oils',        ru: 'Масла и фильтры',  ky: 'Май жана фильтр',   img: '/categories/oils.jpg' },
  { slug: 'accessories', ru: 'Аксессуары',       ky: 'Аксессуарлар',      img: '/categories/accessories.jpg' },
  { slug: 'tools',       ru: 'Инструменты',      ky: 'Аспаптар',          img: '/categories/tools.jpg' },
]

export const CITIES = [
  'Бишкек', 'Ош', 'Джалал-Абад', 'Каракол', 'Токмок', 'Кара-Балта',
  'Нарын', 'Талас', 'Баткен', 'Кызыл-Кия', 'Узген', 'Кант', 'Балыкчы',
] as const

export const BRANDS = [
  'Toyota', 'Honda', 'Lexus', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen',
  'Hyundai', 'Kia', 'Nissan', 'Mitsubishi', 'Subaru', 'Mazda', 'Daewoo',
  'Chevrolet', 'Lada (ВАЗ)', 'Ford', 'Opel', 'Porsche', 'Другая',
] as const

export type ListingStatus = 'active' | 'sold' | 'archived' | 'blocked'
export type Condition = 'new' | 'used'
export type Origin = 'original' | 'aftermarket'

/** timestamptz из Postgres приходит ISO-строкой */
export type Ts = string

export interface Listing {
  id?: string
  title: string
  desc: string
  price: number
  currency: 'KGS'
  category: CategorySlug
  brand: string
  model: string
  year?: string
  condition: Condition
  origin?: Origin
  city: string
  photos: string[]
  sellerId: string
  sellerName: string
  phone: string
  whatsapp?: string
  status: ListingStatus
  views: number
  createdAt: Ts
  bumpedAt: Ts
}

export interface UserProfile {
  id: string
  email: string
  displayName: string
  city?: string
  phone?: string
  whatsapp?: string
  photoURL?: string
  role: 'user' | 'admin'
  lang?: 'ru' | 'ky'
  createdAt: Ts
}

export type ChatType = 'group' | 'dm'

export interface ChatMeta {
  id?: string
  type: ChatType
  title: string
  region?: string
  topic?: string
  members: string[]
  memberNames?: Record<string, string>
  lastMsg?: string
  lastMsgAt?: Ts
  createdAt: Ts
}

export interface ChatMessage {
  id?: string
  chatId?: string
  senderId: string
  senderName: string
  text: string
  imageUrl?: string | null
  audioUrl?: string | null
  createdAt: Ts
}

export interface Store {
  id?: string
  slug: string
  name: string
  desc: string
  logo?: string
  cover?: string
  city: string
  address?: string
  phone: string
  whatsapp?: string
  verified: boolean
  ownerUid: string
  createdAt: Ts
}

export interface Product {
  id?: string
  storeId?: string
  name: string
  price: number
  photos: string[]
  category?: CategorySlug
  inStock: boolean
  desc?: string
}

export type OrderStatus = 'new' | 'confirmed' | 'done' | 'cancelled'

export interface Order {
  id?: string
  storeId: string
  storeName: string
  buyerUid: string
  buyerName: string
  phone: string
  items: { productId: string; name: string; price: number; qty: number }[]
  total: number
  comment?: string
  status: OrderStatus
  createdAt: Ts
}

export function formatPrice(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n) + ' сом'
}

export function waLink(phone: string, text?: string): string {
  const p = phone.replace(/[^0-9]/g, '')
  return `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** Самые ходовые машины Кыргызстана — для SEO-страниц и подсказок */
export interface PopularCar { brand: string; model: string; slug: string }

export const POPULAR_CARS: PopularCar[] = [
  { brand: 'Toyota', model: 'Camry', slug: 'toyota-camry' },
  { brand: 'Daewoo', model: 'Matiz', slug: 'daewoo-matiz' },
  { brand: 'Honda', model: 'Fit', slug: 'honda-fit' },
  { brand: 'Daewoo', model: 'Nexia', slug: 'daewoo-nexia' },
  { brand: 'Hyundai', model: 'Sonata', slug: 'hyundai-sonata' },
  { brand: 'Lexus', model: 'RX', slug: 'lexus-rx' },
  { brand: 'Honda', model: 'CR-V', slug: 'honda-cr-v' },
  { brand: 'Toyota', model: 'Prius', slug: 'toyota-prius' },
  { brand: 'Honda', model: 'Accord', slug: 'honda-accord' },
  { brand: 'Honda', model: 'Odyssey', slug: 'honda-odyssey' },
  { brand: 'Toyota', model: 'RAV4', slug: 'toyota-rav4' },
  { brand: 'Mercedes-Benz', model: 'E-класс', slug: 'mercedes-benz-e-klass' },
  { brand: 'Mercedes-Benz', model: 'C-класс', slug: 'mercedes-benz-c-klass' },
  { brand: 'BMW', model: '5 серия', slug: 'bmw-5' },
  { brand: 'BMW', model: '3 серия', slug: 'bmw-3' },
  { brand: 'Volkswagen', model: 'Passat', slug: 'volkswagen-passat' },
  { brand: 'Audi', model: '80', slug: 'audi-80' },
  { brand: 'Audi', model: 'A6', slug: 'audi-a6' },
  { brand: 'Subaru', model: 'Outback', slug: 'subaru-outback' },
  { brand: 'Subaru', model: 'Legacy', slug: 'subaru-legacy' },
  { brand: 'Hyundai', model: 'Accent', slug: 'hyundai-accent' },
  { brand: 'Hyundai', model: 'Grandeur', slug: 'hyundai-grandeur' },
  { brand: 'Kia', model: 'Rio', slug: 'kia-rio' },
  { brand: 'Kia', model: 'K5', slug: 'kia-k5' },
  { brand: 'Kia', model: 'Sorento', slug: 'kia-sorento' },
  { brand: 'Toyota', model: 'Corolla', slug: 'toyota-corolla' },
  { brand: 'Toyota', model: 'Land Cruiser Prado', slug: 'toyota-land-cruiser-prado' },
  { brand: 'Lada (ВАЗ)', model: '2107', slug: 'lada-2107' },
  { brand: 'Lada (ВАЗ)', model: '2106', slug: 'lada-2106' },
  { brand: 'Mitsubishi', model: 'Galant', slug: 'mitsubishi-galant' },
  { brand: 'Mitsubishi', model: 'Outlander', slug: 'mitsubishi-outlander' },
  { brand: 'Nissan', model: 'X-Trail', slug: 'nissan-x-trail' },
  { brand: 'Chevrolet', model: 'Lacetti', slug: 'chevrolet-lacetti' },
  { brand: 'Lexus', model: 'ES', slug: 'lexus-es' },
  { brand: 'Opel', model: 'Vectra', slug: 'opel-vectra' },
  { brand: 'Toyota', model: 'Highlander', slug: 'toyota-highlander' },
  { brand: 'Honda', model: 'Stepwgn', slug: 'honda-stepwgn' },
  { brand: 'Toyota', model: 'Ipsum', slug: 'toyota-ipsum' },
  { brand: 'Mercedes-Benz', model: 'Sprinter', slug: 'mercedes-benz-sprinter' },
  { brand: 'BYD', model: 'Song Plus', slug: 'byd-song-plus' },
]

/** Что чаще всего ищут — для перелинковки и подсказок поиска */
export const POPULAR_PARTS = [
  'фара', 'бампер', 'тормозные колодки', 'стойка амортизатора',
  'коробка автомат', 'радиатор', 'зеркало', 'двигатель',
] as const

export function carBySlug(slug: string): PopularCar | undefined {
  return POPULAR_CARS.find((c) => c.slug === slug)
}

/** Города для SEO-страниц (крупнейшие) */
export const SEO_CITIES = ['Бишкек', 'Ош', 'Джалал-Абад', 'Каракол'] as const

