import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from '../locales/ru.json'
import ky from '../locales/ky.json'

const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('tetik-lang')) || 'ru'

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    ky: { translation: ky },
  },
  lng: saved,
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
})

export function setLang(lang: 'ru' | 'ky') {
  i18n.changeLanguage(lang)
  localStorage.setItem('tetik-lang', lang)
  document.documentElement.lang = lang
}

export default i18n
