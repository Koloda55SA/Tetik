import { supabase } from './supabase'
import type { ChatMessage, ChatMeta, Listing, Order, Product, Store, UserProfile } from './types'

type Unsubscribe = () => void

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

/** Postgres тянет все фильтры сервер-сайд + русский полнотекстовый поиск */
export async function fetchListings(f: ListingFilters, max = 60): Promise<Listing[]> {
  let q = supabase.from('listings').select('*').eq('status', 'active')
  if (f.q) q = q.textSearch('fts', f.q, { type: 'websearch', config: 'russian' })
  if (f.category) q = q.eq('category', f.category)
  if (f.brand) q = q.eq('brand', f.brand)
  if (f.city) q = q.eq('city', f.city)
  if (f.condition) q = q.eq('condition', f.condition)
  if (f.minPrice != null) q = q.gte('price', f.minPrice)
  if (f.maxPrice != null) q = q.lte('price', f.maxPrice)
  const { data, error } = await q.order('bumpedAt', { ascending: false }).limit(max)
  if (error) throw error
  return (data as Listing[]) || []
}

export async function getListing(id: string): Promise<Listing | null> {
  const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
  if (data) supabase.rpc('increment_views', { lid: id }).then(() => {})
  return (data as Listing) || null
}

/**
 * Сжатие фото на клиенте: до 1600px по длинной стороне, JPEG ~82%.
 * Телефонное фото 5МБ превращается в ~300КБ — бережём бесплатный 1ГБ Storage.
 * Если формат не читается (например HEIC в некоторых браузерах) — грузим оригинал.
 */
async function compressImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

export async function uploadPhotos(uid: string, files: File[], bucket = 'listings'): Promise<string[]> {
  const urls: string[] = []
  for (const file of files.slice(0, 8)) {
    const blob = await compressImage(file)
    const compressed = blob !== file
    const ext = compressed ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType: compressed ? 'image/jpeg' : file.type || 'image/jpeg',
      upsert: false,
    })
    if (error) throw error
    urls.push(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl)
  }
  return urls
}

export async function createListing(
  data: Omit<Listing, 'id' | 'views' | 'createdAt' | 'bumpedAt' | 'status' | 'currency'>,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('listings')
    .insert({ ...data, currency: 'KGS', status: 'active' })
    .select('id')
    .single()
  if (error) throw error
  return row.id as string
}

export async function setListingStatus(id: string, status: 'active' | 'sold' | 'archived') {
  const { error } = await supabase.from('listings').update({ status }).eq('id', id)
  if (error) throw error
}

export async function bumpListing(id: string) {
  const { error } = await supabase.from('listings').update({ bumpedAt: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteListing(id: string) {
  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) throw error
}

export async function myListings(uid: string): Promise<Listing[]> {
  const { data } = await supabase
    .from('listings').select('*').eq('sellerId', uid)
    .order('createdAt', { ascending: false }).limit(100)
  return (data as Listing[]) || []
}

/* ---------------- Профиль ---------------- */

export async function updateProfile(uid: string, fields: Partial<UserProfile>) {
  const { error } = await supabase.from('profiles').update(fields).eq('id', uid)
  if (error) throw error
}

/* ---------------- Чаты ---------------- */

export async function listGroupChats(): Promise<ChatMeta[]> {
  const { data } = await supabase
    .from('chats').select('*').eq('type', 'group')
    .order('lastMsgAt', { ascending: false, nullsFirst: false }).limit(50)
  return (data as ChatMeta[]) || []
}

export function subscribeMyDms(uid: string, cb: (chats: ChatMeta[]) => void): Unsubscribe {
  async function load() {
    const { data } = await supabase
      .from('chats').select('*').eq('type', 'dm').contains('members', [uid])
      .order('lastMsgAt', { ascending: false, nullsFirst: false }).limit(50)
    cb((data as ChatMeta[]) || [])
  }
  load()
  const channel = supabase
    .channel(`dms-${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => load())
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

export async function getChat(id: string): Promise<ChatMeta | null> {
  const { data } = await supabase.from('chats').select('*').eq('id', id).maybeSingle()
  return (data as ChatMeta) || null
}

/** DM-чат по паре пользователей: детерминированный id */
export async function ensureDmChat(
  me: { uid: string; name: string },
  other: { uid: string; name: string },
): Promise<string> {
  const id = ['dm', ...[me.uid, other.uid].sort()].join('_')
  const { data } = await supabase.from('chats').select('id').eq('id', id).maybeSingle()
  if (!data) {
    const { error } = await supabase.from('chats').insert({
      id,
      type: 'dm',
      title: '',
      members: [me.uid, other.uid],
      memberNames: { [me.uid]: me.name, [other.uid]: other.name },
      lastMsgAt: new Date().toISOString(),
    })
    if (error && !String(error.message).includes('duplicate')) throw error
  }
  return id
}

export function subscribeMessages(chatId: string, cb: (msgs: ChatMessage[]) => void): Unsubscribe {
  let msgs: ChatMessage[] = []
  async function load() {
    const { data } = await supabase
      .from('messages').select('*').eq('chatId', chatId)
      .order('createdAt', { ascending: true }).limit(200)
    msgs = (data as ChatMessage[]) || []
    cb(msgs)
  }
  load()
  const channel = supabase
    .channel(`chat-${chatId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `chatId=eq.${chatId}` },
      (payload) => {
        msgs = [...msgs, payload.new as ChatMessage]
        cb(msgs)
      },
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

/** Загрузка медиа чата (фото сжимается, голос как есть) → публичный URL */
export async function uploadChatMedia(uid: string, blob: Blob, kind: 'image' | 'audio'): Promise<string> {
  let payload: Blob = blob
  let mime = (blob.type || 'application/octet-stream').split(';')[0]
  let ext = 'bin'
  if (kind === 'image') {
    payload = await compressImage(blob)
    if (payload !== blob) mime = 'image/jpeg'
    ext = mime === 'image/jpeg' ? 'jpg' : (mime.split('/')[1] || 'jpg')
  } else {
    ext = mime.includes('webm') ? 'webm' : mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
    if (mime.includes('mp4')) mime = 'audio/mp4'
  }
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('chat').upload(path, payload, { contentType: mime })
  if (error) throw error
  return supabase.storage.from('chat').getPublicUrl(path).data.publicUrl
}

export async function sendMessage(
  chatId: string,
  sender: { uid: string; name: string },
  text: string,
  media?: { imageUrl?: string; audioUrl?: string },
) {
  const clean = text.trim().slice(0, 2000)
  if (!clean && !media?.imageUrl && !media?.audioUrl) return
  const { error } = await supabase.from('messages').insert({
    chatId,
    senderId: sender.uid,
    senderName: sender.name,
    text: clean,
    imageUrl: media?.imageUrl ?? null,
    audioUrl: media?.audioUrl ?? null,
  })
  if (error) throw error
  const preview = clean || (media?.imageUrl ? '📷 Фото' : '🎤 Голосовое')
  await supabase.from('chats')
    .update({ lastMsg: preview.slice(0, 80), lastMsgAt: new Date().toISOString() })
    .eq('id', chatId)
}

/* ---------------- Магазины ---------------- */

export async function listStores(): Promise<Store[]> {
  const { data } = await supabase.from('stores').select('*').order('createdAt', { ascending: false }).limit(50)
  return (data as Store[]) || []
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const { data } = await supabase.from('stores').select('*').eq('slug', slug).maybeSingle()
  return (data as Store) || null
}

export async function listProducts(storeId: string): Promise<Product[]> {
  const { data } = await supabase.from('products').select('*').eq('storeId', storeId).limit(200)
  return (data as Product[]) || []
}

export async function createOrder(o: Omit<Order, 'id' | 'status' | 'createdAt'>): Promise<string> {
  const { data, error } = await supabase
    .from('orders').insert({ ...o, status: 'new' }).select('id').single()
  if (error) throw error
  return data.id as string
}

/* ---------------- Жалобы ---------------- */

export async function reportTarget(
  targetType: 'listing' | 'user' | 'message',
  targetId: string,
  reason: string,
  byUid: string,
) {
  await supabase.from('reports').insert({ targetType, targetId, reason: reason.slice(0, 500), byUid })
}
