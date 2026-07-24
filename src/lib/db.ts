import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, limit,
  onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
  type QueryConstraint, type Unsubscribe,
} from 'firebase/firestore'
import { getDownloadURL, ref as sRef, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase'
import {
  listingKeywords,
  type ChatMessage, type ChatMeta, type Listing, type Order, type Product, type Store,
} from './types'

/* ---------------- Базар ---------------- */

export interface ListingFilters {
  q?: string
  category?: string
  brand?: string
  city?: string
  condition?: string
  minPrice?: number
  maxPrice?: number
}

/**
 * Firestore позволяет 1 равенство + orderBy без лишних индексов-комбинаций,
 * поэтому берём самый селективный фильтр на сервере, остальное дочищаем на клиенте.
 */
export async function fetchListings(f: ListingFilters, max = 60): Promise<Listing[]> {
  const cons: QueryConstraint[] = [where('status', '==', 'active')]
  if (f.q) {
    const token = f.q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2)[0]
    if (token) cons.push(where('keywords', 'array-contains', token))
  } else if (f.category) {
    cons.push(where('category', '==', f.category))
  } else if (f.brand) {
    cons.push(where('brand', '==', f.brand))
  } else if (f.city) {
    cons.push(where('city', '==', f.city))
  }
  cons.push(orderBy('bumpedAt', 'desc'), limit(max))
  const snap = await getDocs(query(collection(db, 'listings'), ...cons))
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Listing)

  // клиентская дочистка остальных фильтров
  const qWords = f.q ? f.q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2) : []
  items = items.filter((l) => {
    if (f.category && l.category !== f.category) return false
    if (f.brand && l.brand !== f.brand) return false
    if (f.city && l.city !== f.city) return false
    if (f.condition && l.condition !== f.condition) return false
    if (f.minPrice != null && l.price < f.minPrice) return false
    if (f.maxPrice != null && l.price > f.maxPrice) return false
    if (qWords.length > 1) {
      const hay = `${l.title} ${l.desc} ${l.brand} ${l.model}`.toLowerCase()
      if (!qWords.every((w) => hay.includes(w))) return false
    }
    return true
  })
  return items
}

export async function getListing(id: string): Promise<Listing | null> {
  const snap = await getDoc(doc(db, 'listings', id))
  if (!snap.exists()) return null
  updateDoc(snap.ref, { views: increment(1) }).catch(() => {})
  return { id: snap.id, ...snap.data() } as Listing
}

export async function uploadPhotos(uid: string, files: File[], folder = 'listings'): Promise<string[]> {
  const urls: string[] = []
  for (const file of files.slice(0, 8)) {
    const path = `${folder}/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const r = sRef(storage, path)
    await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' })
    urls.push(await getDownloadURL(r))
  }
  return urls
}

export async function createListing(
  data: Omit<Listing, 'id' | 'keywords' | 'views' | 'createdAt' | 'bumpedAt' | 'status' | 'currency'>,
): Promise<string> {
  const docData = {
    ...data,
    currency: 'KGS',
    status: 'active',
    keywords: listingKeywords(data),
    views: 0,
    createdAt: serverTimestamp(),
    bumpedAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'listings'), docData)
  return ref.id
}

export async function setListingStatus(id: string, status: 'active' | 'sold' | 'archived') {
  await updateDoc(doc(db, 'listings', id), { status })
}

export async function bumpListing(id: string) {
  await updateDoc(doc(db, 'listings', id), { bumpedAt: serverTimestamp() })
}

export async function deleteListing(id: string) {
  await deleteDoc(doc(db, 'listings', id))
}

export async function myListings(uid: string): Promise<Listing[]> {
  const snap = await getDocs(
    query(collection(db, 'listings'), where('sellerId', '==', uid), orderBy('createdAt', 'desc'), limit(100)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Listing)
}

/* ---------------- Чаты ---------------- */

export async function listGroupChats(): Promise<ChatMeta[]> {
  const snap = await getDocs(
    query(collection(db, 'chats'), where('type', '==', 'group'), orderBy('lastMsgAt', 'desc'), limit(50)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMeta)
}

export function subscribeMyDms(uid: string, cb: (chats: ChatMeta[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'chats'), where('type', '==', 'dm'), where('members', 'array-contains', uid), limit(50)),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMeta)
      items.sort((a, b) => (b.lastMsgAt?.toMillis() ?? 0) - (a.lastMsgAt?.toMillis() ?? 0))
      cb(items)
    },
  )
}

export async function getChat(id: string): Promise<ChatMeta | null> {
  const snap = await getDoc(doc(db, 'chats', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ChatMeta) : null
}

/** DM-чат по паре пользователей: детерминированный id */
export async function ensureDmChat(
  me: { uid: string; name: string },
  other: { uid: string; name: string },
): Promise<string> {
  const id = ['dm', ...[me.uid, other.uid].sort()].join('_')
  const ref = doc(db, 'chats', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      type: 'dm',
      title: '',
      members: [me.uid, other.uid],
      memberNames: { [me.uid]: me.name, [other.uid]: other.name },
      createdAt: serverTimestamp(),
      lastMsgAt: serverTimestamp(),
    })
  }
  return id
}

export function subscribeMessages(chatId: string, cb: (msgs: ChatMessage[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(100)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage).reverse()),
  )
}

export async function sendMessage(chatId: string, sender: { uid: string; name: string }, text: string) {
  const clean = text.trim().slice(0, 2000)
  if (!clean) return
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderId: sender.uid,
    senderName: sender.name,
    text: clean,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'chats', chatId), {
    lastMsg: clean.slice(0, 80),
    lastMsgAt: serverTimestamp(),
  }).catch(() => {})
}

/* ---------------- Магазины ---------------- */

export async function listStores(): Promise<Store[]> {
  const snap = await getDocs(query(collection(db, 'stores'), orderBy('createdAt', 'desc'), limit(50)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Store)
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const snap = await getDocs(query(collection(db, 'stores'), where('slug', '==', slug), limit(1)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Store
}

export async function listProducts(storeId: string): Promise<Product[]> {
  const snap = await getDocs(query(collection(db, 'stores', storeId, 'products'), limit(200)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)
}

export async function createOrder(o: Omit<Order, 'id' | 'status' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'orders'), {
    ...o,
    status: 'new',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/* ---------------- Жалобы ---------------- */

export async function reportTarget(targetType: 'listing' | 'user' | 'message', targetId: string, reason: string, byUid: string) {
  await addDoc(collection(db, 'reports'), {
    targetType, targetId, reason: reason.slice(0, 500), byUid,
    createdAt: serverTimestamp(),
  })
}
