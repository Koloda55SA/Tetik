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
  role: 'user'
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
