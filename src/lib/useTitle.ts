import { useEffect } from 'react'

const DEFAULT_TITLE = 'Tetik — запчасти для авто в Кыргызстане. Базар, чаты, магазины'

/** Динамический заголовок вкладки (SEO + шеринг) */
export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — Tetik` : DEFAULT_TITLE
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title])
}
