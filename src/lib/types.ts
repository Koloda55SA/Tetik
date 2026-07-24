import type { Timestamp } from 'firebase/firestore'

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
  keywords: string[]
  views: number
  createdAt: Timestamp
  bumpedAt: Timestamp
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  city?: string
  phone?: string
  whatsapp?: string
  photoURL?: string
  role: 'user'
  lang?: 'ru' | 'ky'
  createdAt: Timestamp
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
  lastMsgAt?: Timestamp
  createdAt: Timestamp
}

export interface ChatMessage {
  id?: string
  senderId: string
  senderName: string
  text: string
  imageUrl?: string
  createdAt: Timestamp
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
  createdAt: Timestamp
}

export interface Product {
  id?: string
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
  createdAt: Timestamp
}

export function listingKeywords(l: Pick<Listing, 'title' | 'brand' | 'model' | 'category'>): string[] {
  const words = `${l.title} ${l.brand} ${l.model} ${l.category}`
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
  return Array.from(new Set(words)).slice(0, 30)
}

export function formatPrice(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n) + ' сом'
}

export function waLink(phone: string, text?: string): string {
  const p = phone.replace(/[^0-9]/g, '')
  return `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
