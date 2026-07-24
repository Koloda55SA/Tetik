import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { createListing, uploadPhotos } from '../lib/db'
import { BRANDS, CATEGORIES, CITIES, type CategorySlug, type Condition } from '../lib/types'

export default function NewListing() {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!user) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted mb-4">{t('listing.needAuth')}</p>
        <Link to="/login" className="btn-primary">{t('auth.login')}</Link>
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
      nav(`/l/${id}`)
    } catch (e) {
      console.error(e)
      setErr(t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="font-display font-bold text-xl mb-4">{t('listing.create')}</h1>
      <form onSubmit={onSubmit} className="card p-4 space-y-3">
        <div>
          <label className="text-sm font-semibold">{t('listing.titleLabel')}</label>
          <input name="title" required minLength={5} maxLength={120} className="input mt-1" placeholder={t('listing.titlePlaceholder')} />
        </div>

        <div>
          <label className="text-sm font-semibold">{t('listing.photos')}</label>
          <input
            type="file" accept="image/*" multiple
            className="input mt-1"
            onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 8))}
          />
          {files.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto">
              {files.map((f, i) => (
                <img key={i} src={URL.createObjectURL(f)} alt="" className="w-16 h-16 object-cover rounded-btn" />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold">{t('bazar.category')}</label>
            <select name="category" required className="input mt-1">
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{i18n.language === 'ky' ? c.ky : c.ru}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">{t('listing.priceLabel')}</label>
            <input name="price" type="number" required min={0} className="input mt-1" placeholder="5000" />
          </div>
          <div>
            <label className="text-sm font-semibold">{t('bazar.brand')}</label>
            <select name="brand" className="input mt-1">
              {BRANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">{t('listing.modelLabel')}</label>
            <input name="model" className="input mt-1" placeholder={t('listing.modelPlaceholder')} />
          </div>
          <div>
            <label className="text-sm font-semibold">{t('bazar.condition')}</label>
            <select name="condition" className="input mt-1">
              <option value="used">{t('bazar.used')}</option>
              <option value="new">{t('bazar.new')}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">{t('bazar.city')}</label>
            <select name="city" className="input mt-1">
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold">{t('listing.descLabel')}</label>
          <textarea name="desc" rows={4} maxLength={2000} className="input mt-1" placeholder={t('listing.descPlaceholder')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold">{t('listing.phoneLabel')}</label>
            <input name="phone" required type="tel" className="input mt-1" placeholder="+996 700 123 456" defaultValue={profile?.phone || ''} />
          </div>
          <div>
            <label className="text-sm font-semibold">{t('listing.whatsappLabel')}</label>
            <input name="whatsapp" type="tel" className="input mt-1" placeholder="+996 ..." />
          </div>
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}

        <button disabled={busy} className="btn-primary w-full">
          {busy ? t('listing.publishing') : t('listing.publish')}
        </button>
      </form>
    </div>
  )
}
