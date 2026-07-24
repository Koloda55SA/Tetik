import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import Icon from '../components/Icons'

export default function Login() {
  const { t } = useTranslation()
  const { sendCode, verifyCode, signInWithGoogle } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onGoogle() {
    setErr('')
    try {
      await signInWithGoogle()
    } catch {
      setErr(t('auth.googleSoon'))
    }
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setErr('')
    setBusy(true)
    try {
      await sendCode(email)
      setStep('code')
    } catch (e) {
      const msg = String((e as Error).message)
      setErr(msg.includes('too_often') || msg.includes('rate') ? t('auth.tooOften') : t('common.error'))
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
    <div className="mx-auto mt-4 max-w-[400px] md:mt-10">
      <div className="card p-6 md:p-8">
        <img src="/logo-mark.svg" alt="Tetik" className="mx-auto h-14 w-14" />
        <h1 className="mt-4 text-center text-[22px] font-extrabold tracking-tight">{t('auth.welcome')}</h1>
        <p className="mt-1 text-center text-sm text-muted">{t('auth.hint')}</p>

        {/* Google */}
        <button onClick={onGoogle} className="btn-outline mt-6 h-12 w-full">
          <Icon name="google" size={19} />
          {t('auth.google')}
        </button>

        {/* Разделитель */}
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs font-semibold text-muted">{t('auth.orEmail')}</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {step === 'email' ? (
          <form onSubmit={onEmail} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              className="input h-12"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {err && <p className="text-sm font-semibold text-danger">{err}</p>}
            <button disabled={busy} className="btn-primary h-12 w-full">
              {busy ? t('common.loading') : t('auth.sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={onCode} className="space-y-3">
            <p className="text-sm text-muted">{t('auth.codeSent', { email })}</p>
            <input
              name="code"
              required
              autoFocus
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              className="input h-14 text-center text-[26px] font-extrabold tracking-[0.45em]"
              placeholder="······"
            />
            {err && <p className="text-sm font-semibold text-danger">{err}</p>}
            <button disabled={busy} className="btn-primary h-12 w-full">
              {busy ? t('common.loading') : t('auth.verify')}
            </button>
            <button type="button" className="btn-ghost h-11 w-full text-sm" onClick={() => { setStep('email'); setErr('') }}>
              <Icon name="chevronLeft" size={16} />
              {t('common.back')}
            </button>
          </form>
        )}
      </div>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">{t('auth.agree')}</p>
    </div>
  )
}
