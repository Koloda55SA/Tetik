import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Порядок прокрутки при переходах:
 *  • открыли новую страницу → показываем сверху;
 *  • нажали «назад» → возвращаем туда, где человек читал;
 *  • страницы чата исключены — там своя прокрутка внутри ленты.
 * Без этого браузер оставляет прежнее смещение, и экран «уезжает» непонятно куда.
 */
export default function ScrollManager() {
  const loc = useLocation()
  const navType = useNavigationType() // PUSH | POP | REPLACE
  const positions = useRef<Map<string, number>>(new Map())
  const prevKey = useRef<string>('')

  // запоминаем позицию покидаемой страницы
  useEffect(() => {
    const key = prevKey.current
    return () => {
      if (key) positions.current.set(key, window.scrollY)
    }
  }, [loc.key])

  useEffect(() => {
    prevKey.current = loc.key

    // в чате прокруткой управляет сама страница
    if (loc.pathname.startsWith('/chats/')) return

    if (navType === 'POP') {
      const saved = positions.current.get(loc.key)
      if (saved != null) {
        // ждём отрисовку контента, иначе прыжок в никуда
        requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: 'auto' }))
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [loc.key, loc.pathname, navType])

  return null
}
