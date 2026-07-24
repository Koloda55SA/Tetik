import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { createListing, uploadPhotos } from '../lib/db'
import { BRANDS, CATEGORIES, CITIES, type CategorySlug, type Condition } from '../lib/types'
import Icon from '../components/Icons'
import { useFormDraft } from '../lib/useDraft'

export default function NewListing() {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // черновик: случайно обновил страницу — введённое вернётся
  const draft = useFormDraft('new-listing', { skip: !user })
  const [restored] = useState(() => draft.hasDraft())

  if (!user) {
    return (
      <div className="card p-10 text-center">
        <Icon name="plus" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
        <p className="mt-3 text-sm text-muted">{t('listing.needAuth')}</p>
        <Link to="/login" className="btn-primary mt-5 inline-flex">
          {t('auth.login')}
        </Link>
      </div>
    )
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setErr('')
    setBusy(true)
    try {
      const fd = new FormData(e.currentTarget)
      const photos = files.length ? await uploadPhotos(user!.uid, files) : []
      const id = await createListing({
        title: String(fd.get('title') || '').trim(),
        desc: String(fd.get('desc') || '').trim(),
        price: Number(fd.get('price') || 0),
        category: String(fd.get('category')) as CategorySlug,
        brand: String(fd.get('brand') || 'Другая'),
        model: String(fd.get('model') || '').trim(),
        year: String(fd.get('year') || '').trim(),
        condition: String(fd.get('condition')) as Condition,
        city: String(fd.get('city') || 'Бишкек'),
        photos,
        sellerId: user!.uid,
        sellerName: profile?.displayName || 'Продавец',
        phone: String(fd.get('phone') || '').trim(),
        whatsapp: String(fd.get('whatsapp') || '').trim() || undefined,
      } as never)
      draft.clear()
      nav(`/l/${id}`)
    } catch (e) {
      console.error(e)
      setErr(t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files || []).slice(0, 8))
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="section-title mb-5">{t('listing.create')}</h1>

      {restored && (
        <div className="card mb-4 flex items-center gap-2.5 border-l-4 border-l-accent p-3.5">
          <Icon name="check" size={16} className="shrink-0 text-accent" />
          <p className="flex-1 text-sm">{t('common.draftRestored')}</p>
          <button
            type="button"
            onClick={() => {
              draft.clear()
              window.location.reload()
            }}
            className="shrink-0 text-xs font-bold text-muted underline"
          >
            {t('common.draftClear')}
          </button>
        </div>
      )}

      <form ref={draft.ref} onSubmit={onSubmit} className="space-y-4">
        {/* Фото */}
        <div className="card p-5 space-y-4">
          <p className="text-sm font-semibold">{t('listing.photos')}</p>
          <div className="grid grid-cols-3 gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
                <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
            {files.length < 8 && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line transition-colors hover:border-muted">
                <Icon name="camera" size={22} strokeWidth={1.5} className="text-muted" />
                <span className="text-xs text-muted">Добавить</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={onFiles}
                />
              </label>
            )}
          </div>
        </div>

        {/* Основное */}
        <div className="card p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('listing.titleLabel')}</label>
            <input
              name="title"
              required
              minLength={5}
              maxLength={120}
              className="input"
              placeholder={t('listing.titlePlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('bazar.category')}</label>
            <select name="category" required className="input">
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {i18n.language === 'ky' ? c.ky : c.ru}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('listing.priceLabel')}</label>
            <input
              name="price"
              type="number"
              inputMode="numeric"
              required
              min={0}
              className="input"
              placeholder="5000"
            />
          </div>
        </div>

        {/* Детали */}
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t('bazar.brand')}</label>
              <select name="brand" className="input">
                {BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t('listing.modelLabel')}</label>
              <input
                name="model"
                className="input"
                placeholder={t('listing.modelPlaceholder')}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t('listing.yearLabel')}</label>
              <input
                name="year"
                inputMode="numeric"
                maxLength={4}
                className="input"
                placeholder="2018"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t('bazar.condition')}</label>
              <select name="condition" className="input">
                <option value="used">{t('bazar.used')}</option>
                <option value="new">{t('bazar.new')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('bazar.city')}</label>
            <select name="city" className="input">
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('listing.descLabel')}</label>
            <textarea
              name="desc"
              rows={4}
              maxLength={2000}
              className="input"
              placeholder={t('listing.descPlaceholder')}
            />
          </div>
        </div>

        {/* Контакты */}
        <div className="card p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('listing.phoneLabel')}</label>
            <input
              name="phone"
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="input"
              placeholder="+996 700 123 456"
              defaultValue={profile?.phone || ''}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('listing.whatsappLabel')}</label>
            <input
              name="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="input"
              placeholder="+996 ..."
            />
          </div>
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}

        <button disabled={busy} className="btn-primary h-12 w-full">
          {busy ? t('listing.publishing') : t('listing.publish')}
        </button>
      </form>
    </div>
  )
}
