import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { updateProfile } from '../lib/db'
import { useTitle } from '../lib/useTitle'
import Icon from '../components/Icons'
import { useFormDraft } from '../lib/useDraft'

/**
 * Обязательный шаг после первой регистрации: имя и телефон.
 * Без телефона покупатели не смогут связаться с продавцом.
 */
export default function Onboarding() {
  const { t } = useTranslation()
  const { user, profile, loading, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const draft = useFormDraft('welcome')
  useTitle(t('auth.completeTitle'))

  useEffect(() => {
    if (!loading && !user) nav('/login')
  }, [loading, user])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || busy) return
    setErr('')
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') || '').trim()
    const phone = String(fd.get('phone') || '').trim()
    if (name.length < 2) {
      setErr(t('auth.badName'))
      return
    }
    if (phone.replace(/\D/g, '').length < 9) {
      setErr(t('auth.badPhone'))
      return
    }
    setBusy(true)
    try {
      await updateProfile(user.uid, { displayName: name, phone })
      await refreshProfile()
      draft.clear()
      nav('/')
    } catch {
      setErr(t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-4 max-w-[400px] md:mt-10">
      <div className="card p-6 md:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="user" size={26} />
        </div>
        <h1 className="mt-4 text-center text-[22px] font-extrabold tracking-tight">{t('auth.completeTitle')}</h1>
        <p className="mt-1 text-center text-sm text-muted">{t('auth.completeHint')}</p>

        <form ref={draft.ref} onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('profile.name')} *</label>
            <input
              name="name"
              required
              minLength={2}
              maxLength={60}
              autoFocus
              autoComplete="name"
              className="input h-12"
              placeholder={t('auth.namePlaceholder')}
              defaultValue={profile?.phone ? profile?.displayName : ''}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('profile.phone')} *</label>
            <input
              name="phone"
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="input h-12"
              placeholder="+996 700 123 456"
              defaultValue={profile?.phone || ''}
            />
          </div>
          {err && <p className="text-sm font-semibold text-danger">{err}</p>}
          <button disabled={busy} className="btn-primary h-12 w-full">
            {busy ? t('common.loading') : t('auth.completeSave')}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">{t('auth.completeWhy')}</p>
    </div>
  )
}
