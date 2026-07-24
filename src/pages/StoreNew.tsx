import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { createStore, myStore, uploadPhotos } from '../lib/db'
import { CITIES } from '../lib/types'
import { useTitle } from '../lib/useTitle'
import Icon from '../components/Icons'

export default function StoreNew() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  useTitle(t('storeNew.title'))

  useEffect(() => {
    if (!user) {
      nav('/login')
      return
    }
    myStore(user.uid).then((s) => {
      if (s) nav(`/s/${s.slug}`, { replace: true })
    }).catch(() => {})
  }, [user, nav])

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || busy) return
    setErr('')
    setBusy(true)
    try {
      const fd = new FormData(e.currentTarget)
      const name = String(fd.get('name') || '').trim()
      const desc = String(fd.get('desc') || '').trim()
      const city = String(fd.get('city') || 'Бишкек')
      const address = String(fd.get('address') || '').trim()
      const phone = String(fd.get('phone') || '').trim()
      const whatsapp = String(fd.get('whatsapp') || '').trim()

      let logo: string | undefined
      let cover: string | undefined

      if (logoFile) {
        const urls = await uploadPhotos(user.uid, [logoFile], 'stores')
        logo = urls[0]
      }
      if (coverFile) {
        const urls = await uploadPhotos(user.uid, [coverFile], 'stores')
        cover = urls[0]
      }

      const slug = await createStore({
        name,
        desc,
        city,
        address: address || undefined,
        phone,
        whatsapp: whatsapp || undefined,
        ownerUid: user.uid,
        logo,
        cover,
      })

      alert(t('storeNew.created'))
      nav(`/s/${slug}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('duplicate') || msg.includes('slug conflict')) {
        setErr(t('common.error'))
      } else {
        setErr(t('common.error'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="section-title mb-1">{t('storeNew.title')}</h1>
      <p className="mb-5 text-sm text-muted">{t('storeNew.hint')}</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="card p-5 space-y-4">
          {/* Название */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('storeNew.nameLabel')} *</label>
            <input
              name="name"
              required
              minLength={3}
              maxLength={60}
              className="input"
              placeholder="Название магазина"
            />
          </div>

          {/* Описание */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('listing.descLabel')}</label>
            <textarea
              name="desc"
              rows={3}
              maxLength={500}
              className="input"
              placeholder="Чем торгуете, режим работы..."
            />
          </div>

          {/* Город */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('bazar.city')}</label>
            <select name="city" className="input">
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Адрес */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('store.address')}</label>
            <input name="address" className="input" placeholder="ул. Манаса 12, 2 этаж" />
          </div>
        </div>

        <div className="card p-5 space-y-4">
          {/* Телефон */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('listing.phoneLabel')} *</label>
            <input
              name="phone"
              required
              type="tel"
              className="input"
              placeholder="+996 700 123 456"
              defaultValue={profile?.phone || ''}
            />
          </div>

          {/* WhatsApp */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('listing.whatsappLabel')}</label>
            <input name="whatsapp" type="tel" className="input" placeholder="+996 ..." />
          </div>
        </div>

        <div className="card p-5 space-y-4">
          {/* Логотип */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('product.photoLabel').replace('товара', 'логотип')}</label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-xl object-cover border border-line"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-line bg-surface2">
                  <Icon name="camera" size={22} strokeWidth={1.5} className="text-muted" />
                </div>
              )}
              <label className="btn-outline cursor-pointer text-sm">
                <Icon name="camera" size={16} />
                Выбрать
                <input type="file" accept="image/*" className="sr-only" onChange={onLogoChange} />
              </label>
            </div>
          </div>

          {/* Обложка */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Обложка</label>
            {coverPreview ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl">
                <img src={coverPreview} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface2 transition-colors hover:border-muted">
                <Icon name="camera" size={22} strokeWidth={1.5} className="text-muted" />
                <span className="text-xs text-muted">Добавить обложку</span>
                <input type="file" accept="image/*" className="sr-only" onChange={onCoverChange} />
              </label>
            )}
            {coverPreview && (
              <label className="btn-outline mt-2 cursor-pointer text-sm">
                <Icon name="camera" size={16} />
                Изменить обложку
                <input type="file" accept="image/*" className="sr-only" onChange={onCoverChange} />
              </label>
            )}
          </div>
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}

        <button disabled={busy} className="btn-primary h-12 w-full">
          {busy ? t('common.loading') : t('storeNew.create')}
        </button>
      </form>
    </div>
  )
}
