import i18n from './i18n'

/** «2 часа назад» / «2 саат мурун» */
export function timeAgo(iso?: string | null): string {
  if (!iso) return ''
  const ky = i18n.language === 'ky'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return ky ? 'азыр эле' : 'только что'
  if (min < 60) return ky ? `${min} мүн. мурун` : `${min} мин. назад`
  const h = Math.floor(min / 60)
  if (h < 24) return ky ? `${h} саат мурун` : `${h} ч. назад`
  const d = Math.floor(h / 24)
  if (d === 1) return ky ? 'кечээ' : 'вчера'
  if (d < 7) return ky ? `${d} күн мурун` : `${d} дн. назад`
  return new Date(iso).toLocaleDateString(ky ? 'ky-KG' : 'ru-RU', { day: 'numeric', month: 'short' })
}

/** Детерминированный мягкий цвет аватара по строке */
export function avatarHue(s: string): string {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 45% 88%)`
}

export function avatarInk(s: string): string {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 55% 32%)`
}
