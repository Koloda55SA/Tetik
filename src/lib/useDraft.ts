import { useEffect, useRef } from 'react'

/**
 * Черновики форм: человек заполняет объявление, случайно обновляет страницу —
 * и всё введённое возвращается на место. Работает с обычными формами
 * (без контролируемых полей), поэтому подключается одной строкой.
 *
 *   const form = useFormDraft('new-listing')
 *   <form ref={form.ref} onSubmit={...}>
 *   // после успешной отправки:
 *   form.clear()
 */
export function useFormDraft(key: string, opts: { skip?: boolean } = {}) {
  const storageKey = `tetik-draft:${key}`
  const ref = useRef<HTMLFormElement | null>(null)
  const dirty = useRef(false)
  const cleared = useRef(false)

  // ---- восстановление ----
  useEffect(() => {
    if (opts.skip) return
    const form = ref.current
    if (!form) return
    let saved: Record<string, string> | null = null
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
    } catch {
      saved = null
    }
    if (!saved) return

    let restored = false
    for (const [name, value] of Object.entries(saved)) {
      const el = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null
      if (!el || typeof value !== 'string') continue
      if (el instanceof HTMLInputElement && (el.type === 'file' || el.type === 'password')) continue
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        el.checked = value === '1'
      } else if (el instanceof HTMLSelectElement) {
        el.value = value
      } else if (!el.value || el.value === el.defaultValue) {
        el.value = value
      }
      restored = true
    }
    if (restored) dirty.current = true
  }, [storageKey, opts.skip])

  // ---- сохранение при вводе ----
  useEffect(() => {
    if (opts.skip) return
    const form = ref.current
    if (!form) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const save = () => {
      if (cleared.current) return
      const data: Record<string, string> = {}
      for (const el of Array.from(form.elements) as HTMLElement[]) {
        const field = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        if (!field.name) continue
        if (field instanceof HTMLInputElement && (field.type === 'file' || field.type === 'password')) continue
        if (field instanceof HTMLInputElement && field.type === 'checkbox') {
          data[field.name] = field.checked ? '1' : '0'
        } else if (field.value) {
          data[field.name] = String(field.value).slice(0, 4000)
        }
      }
      const hasContent = Object.values(data).some((v) => v && v !== '0')
      dirty.current = hasContent
      try {
        if (hasContent) localStorage.setItem(storageKey, JSON.stringify(data))
        else localStorage.removeItem(storageKey)
      } catch {
        /* переполнение хранилища игнорируем */
      }
    }

    const onInput = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(save, 400)
    }

    form.addEventListener('input', onInput)
    form.addEventListener('change', onInput)
    // при сворачивании браузера сохраняем сразу
    const onHide = () => {
      if (timer) clearTimeout(timer)
      save()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      form.removeEventListener('input', onInput)
      form.removeEventListener('change', onInput)
      document.removeEventListener('visibilitychange', onHide)
      if (timer) clearTimeout(timer)
      save()
    }
  }, [storageKey, opts.skip])

  // ---- предупреждение при закрытии/обновлении ----
  useEffect(() => {
    if (opts.skip) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty.current || cleared.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [opts.skip])

  function clear() {
    cleared.current = true
    dirty.current = false
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* пусто */
    }
  }

  function hasDraft(): boolean {
    try {
      return !!localStorage.getItem(storageKey)
    } catch {
      return false
    }
  }

  return { ref, clear, hasDraft }
}

/**
 * Черновик одного поля (например, недописанного сообщения в чате).
 * Возвращает сохранённое значение и функцию записи.
 */
export function loadTextDraft(key: string): string {
  try {
    return localStorage.getItem(`tetik-text:${key}`) || ''
  } catch {
    return ''
  }
}

export function saveTextDraft(key: string, value: string) {
  try {
    if (value.trim()) localStorage.setItem(`tetik-text:${key}`, value.slice(0, 2000))
    else localStorage.removeItem(`tetik-text:${key}`)
  } catch {
    /* пусто */
  }
}
