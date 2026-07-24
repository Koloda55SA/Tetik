import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { t } = useTranslation()
  const { sendCode, verifyCode } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onEmail(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setErr('')
    setBusy(true)
    try {
      await sendCode(email)
      setStep('code')
    } catch (e: any) {
      setErr(String(e?.message).includes('429') || String(e?.message).includes('often') ? t('auth.tooOften') : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  async function onCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setErr('')
    setBusy(true)
    try {
      const code = String(new FormData(e.currentTarget).get('code') || '')
      await verifyCode(email, code)
      nav('/')
    } catch {
      setErr(t('auth.invalidCode'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-6">
      <div className="card p-6">
        <img src="/logo-mark.svg" alt="Tetik" className="w-14 h-14 mx-auto mb-3" />
        <h1 className="font-display font-bold text-xl text-center">{t('auth.welcome')}</h1>
        <p className="text-sm text-muted text-center mt-1 mb-5">{t('auth.hint')}</p>

        {step === 'email' ? (
          <form onSubmit={onEmail} className="space-y-3">
            <div>
              <label className="text-sm font-semibold">{t('auth.emailLabel')}</label>
              <input
                type="email" required autoFocus
                className="input mt-1"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            <button disabled={busy} className="btn-primary w-full">
              {busy ? t('common.loading') : t('auth.sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={onCode} className="space-y-3">
            <p className="text-sm text-muted">{t('auth.codeSent', { email })}</p>
            <div>
              <label className="text-sm font-semibold">{t('auth.codeLabel')}</label>
              <input
                name="code" required autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                className="input mt-1 text-center text-2xl tracking-[0.5em] font-bold"
                placeholder="••••••"
              />
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            <button disabled={busy} className="btn-primary w-full">
              {busy ? t('common.loading') : t('auth.verify')}
            </button>
            <button type="button" className="btn-ghost w-full text-sm" onClick={() => setStep('email')}>
              {t('common.back')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
