import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import {
  deleteMessage,
  editMessage,
  getChat,
  joinGroup,
  markChatRead,
  pinMessage,
  sendMessage,
  setSlowmode,
  subscribeChat,
  subscribeMessages,
  uploadChatMedia,
} from '../lib/db'
import { avatarHue, avatarInk } from '../lib/format'
import { SLOWMODE_OPTIONS, slowmodeLabel, type ChatMessage, type ChatMeta } from '../lib/types'
import Icon from '../components/Icons'
import { loadTextDraft, saveTextDraft } from '../lib/useDraft'

const MAX_VOICE_SEC = 60

/** Короткое превью сообщения для цитаты и закрепа */
function preview(m: ChatMessage): string {
  if (m.deleted) return '—'
  if (m.text) return m.text
  if (m.imageUrl) return '📷 Фото'
  if (m.audioUrl) return '🎤 Голосовое'
  return ''
}

export default function ChatRoom() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [chat, setChat] = useState<ChatMeta | null>(null)
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recSec, setRecSec] = useState(0)
  const [joining, setJoining] = useState(false)
  const [sheet, setSheet] = useState<ChatMessage | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [settings, setSettings] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const cancelledRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // недописанное сообщение не теряется при уходе со страницы
  useEffect(() => {
    if (!id) return
    setText(loadTextDraft(`chat-${id}`))
  }, [id])

  useEffect(() => {
    if (!id || editing) return
    saveTextDraft(`chat-${id}`, text)
  }, [text, id, editing])

  useEffect(() => {
    if (!id) return
    getChat(id).then(setChat).catch(() => {})
    const offMsgs = subscribeMessages(id, setMsgs)
    const offChat = subscribeChat(id, setChat)
    return () => {
      offMsgs()
      offChat()
    }
  }, [id])

  // Прокручиваем ТОЛЬКО ленту сообщений (scrollIntoView дёргал всю страницу),
  // и только если человек уже был внизу — иначе не мешаем читать историю
  useEffect(() => {
    const box = listRef.current
    if (!box) return
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 160
    if (nearBottom || msgs.length <= 1) {
      box.scrollTo({ top: box.scrollHeight, behavior: msgs.length <= 1 ? 'auto' : 'smooth' })
    }
  }, [msgs.length])

  useEffect(() => {
    if (user && id && msgs.length > 0) {
      markChatRead(user.uid, id).catch(() => {})
    }
  }, [msgs.length, user?.uid, id])

  // подчистить запись при уходе со страницы
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        cancelledRef.current = true
        recorderRef.current.stop()
      }
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const sender = user ? { uid: user.uid, name: profile?.displayName || 'Пользователь' } : null
  const isAdmin = profile?.role === 'admin'
  const isGroup = chat?.type === 'group'
  const isMember = !!user && !!chat && chat.members.includes(user.uid)
  const canWrite = !!user && (!isGroup || isMember)
  const slow = chat?.slowmodeSec || 0

  /* ---------- Антифлуд: локальный отсчёт ---------- */
  useEffect(() => {
    if (!user || !isGroup || !slow || isAdmin) {
      setCooldown(0)
      return
    }
    const mine = msgs.filter((m) => m.senderId === user.uid)
    const last = mine[mine.length - 1]
    if (!last?.createdAt) {
      setCooldown(0)
      return
    }
    const tick = () => {
      const passed = (Date.now() - new Date(last.createdAt).getTime()) / 1000
      setCooldown(Math.max(0, Math.ceil(slow - passed)))
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [msgs, slow, user?.uid, isGroup, isAdmin])

  // Клавиатура на телефоне: окно чата жёстко следует за видимой областью.
  // Safari при открытии клавиатуры не уменьшает окно, а СДВИГАЕТ видимую
  // область вверх — поэтому нужен не только height, но и offsetTop.
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('chat-page')
    const vv = window.visualViewport
    if (!vv) return () => root.classList.remove('chat-page')

    let raf = 0
    const apply = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        // высота видимой части и её смещение от верха документа
        root.style.setProperty('--vvh', `${Math.round(vv.height)}px`)
        root.style.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`)
        const box = listRef.current
        if (box) box.scrollTop = box.scrollHeight
      })
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      window.removeEventListener('orientationchange', apply)
      root.style.removeProperty('--vvh')
      root.style.removeProperty('--vvt')
      root.classList.remove('chat-page')
    }
  }, [])

  // При фокусе в поле держим ленту у низа: iOS иначе прокручивает документ,
  // пытаясь «показать» поле, и переписка уезжает из вида
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onFocus = () => {
      // даём клавиатуре появиться, затем выравниваем
      setTimeout(() => {
        window.scrollTo(0, 0)
        const box = listRef.current
        if (box) box.scrollTop = box.scrollHeight
      }, 250)
    }
    el.addEventListener('focus', onFocus)
    return () => el.removeEventListener('focus', onFocus)
  }, [canWrite])

  // Пока открыта любая панель — фон под ней не прокручивается
  useEffect(() => {
    const open = !!sheet || settings
    document.body.classList.toggle('sheet-open', open)
    return () => document.body.classList.remove('sheet-open')
  }, [sheet, settings])

  // Кнопка «назад» на телефоне закрывает панель, а не уводит со страницы
  useEffect(() => {
    setConfirmDel(false)
    if (!sheet) return
    window.history.pushState({ sheet: true }, '')
    const onPop = () => setSheet(null)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (window.history.state?.sheet) window.history.back()
    }
  }, [sheet?.id])

  async function onJoinHere() {
    if (!user || !id || joining) return
    setJoining(true)
    try {
      await joinGroup(id, profile?.displayName)
      setChat(await getChat(id))
    } catch {
      alert(t('common.error'))
    } finally {
      setJoining(false)
    }
  }

  /* ---------- Отправка / правка ---------- */
  async function onSend(e: FormEvent) {
    e.preventDefault()
    if (!sender || !id || !text.trim()) return
    const val = text

    if (editing?.id) {
      setText('')
      const target = editing
      setEditing(null)
      await editMessage(target.id!, val).catch(() => {
        setText(val)
        setEditing(target)
        alert(t('common.error'))
      })
      return
    }

    if (cooldown > 0) {
      alert(t('chat.slowWait', { sec: cooldown }))
      return
    }
    setText('')
    if (id) saveTextDraft(`chat-${id}`, '')
    const rt = replyTo
    setReplyTo(null)
    await sendMessage(
      id,
      sender,
      val,
      undefined,
      rt?.id ? { id: rt.id, name: rt.senderName, text: preview(rt) } : null,
    ).catch((err) => {
      setText(val)
      if (rt) setReplyTo(rt)
      alert(String(err?.message || '').includes('slowmode') ? t('chat.slowFlood') : t('common.error'))
    })
  }

  /* ---------- Фото ---------- */
  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !sender || !id || sending) return
    if (cooldown > 0) return alert(t('chat.slowWait', { sec: cooldown }))
    setSending(true)
    try {
      const imageUrl = await uploadChatMedia(sender.uid, file, 'image')
      const rt = replyTo
      await sendMessage(
        id,
        sender,
        text.trim(),
        { imageUrl },
        rt?.id ? { id: rt.id, name: rt.senderName, text: preview(rt) } : null,
      )
      setText('')
      setReplyTo(null)
    } catch {
      alert(t('common.error'))
    } finally {
      setSending(false)
    }
  }

  /* ---------- Голосовые ---------- */
  async function startRecording() {
    if (!sender || recording) return
    if (cooldown > 0) return alert(t('chat.slowWait', { sec: cooldown }))
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = rec
      chunksRef.current = []
      cancelledRef.current = false
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        setRecording(false)
        setRecSec(0)
        if (cancelledRef.current || chunksRef.current.length === 0) return
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        if (blob.size < 1000) return // случайное нажатие
        setSending(true)
        try {
          const audioUrl = await uploadChatMedia(sender!.uid, blob, 'audio')
          const rt = replyTo
          await sendMessage(
            id!,
            sender!,
            '',
            { audioUrl },
            rt?.id ? { id: rt.id, name: rt.senderName, text: preview(rt) } : null,
          )
          setReplyTo(null)
        } catch {
          alert(t('common.error'))
        } finally {
          setSending(false)
        }
      }
      rec.start(250)
      setRecording(true)
      setRecSec(0)
      timerRef.current = setInterval(() => {
        setRecSec((s) => {
          if (s + 1 >= MAX_VOICE_SEC) stopRecording(false)
          return s + 1
        })
      }, 1000)
    } catch {
      alert(t('chat.micDenied'))
    }
  }

  function stopRecording(cancel: boolean) {
    cancelledRef.current = cancel
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }

  /* ---------- Действия над сообщением ---------- */
  function startReply(m: ChatMessage) {
    setSheet(null)
    setEditing(null)
    setReplyTo(m)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function startEdit(m: ChatMessage) {
    setSheet(null)
    setReplyTo(null)
    setEditing(m)
    setText(m.text)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function onDelete(m: ChatMessage) {
    if (!m.id) return
    setSheet(null)
    await deleteMessage(m.id).catch(() => alert(t('common.error')))
  }

  async function onPin(m: ChatMessage) {
    setSheet(null)
    if (!m.id || !id) return
    await pinMessage(id, m.id).catch(() => alert(t('common.error')))
  }

  async function onUnpin() {
    if (!id) return
    await pinMessage(id, null).catch(() => alert(t('common.error')))
  }

  async function onSlowmode(secs: number) {
    if (!id) return
    await setSlowmode(id, secs).catch(() => alert(t('common.error')))
  }

  function copyText(m: ChatMessage) {
    setSheet(null)
    navigator.clipboard?.writeText(m.text).catch(() => {})
  }

  function scrollToMsg(msgId?: string | null) {
    if (!msgId) return
    const box = listRef.current
    const el = document.getElementById(`m-${msgId}`)
    if (!box || !el) return
    // считаем позицию внутри ленты, чтобы не тянуть за собой всю страницу
    const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    el.animate(
      [{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }],
      { duration: 700, easing: 'ease-in-out' },
    )
  }

  function title(): string {
    if (!chat) return '...'
    if (chat.type === 'group') return chat.title
    const other = chat.members.find((m) => m !== user?.uid)
    return (other && chat.memberNames?.[other]) || 'Чат'
  }

  const chatTitle = title()
  const avatarBg = avatarHue(chatTitle)
  const avatarColor = avatarInk(chatTitle)
  const fmtSec = (s: number) => `0:${String(s).padStart(2, '0')}`

  return (
    <div className="chat-shell mx-auto flex w-full max-w-2xl flex-col">
      {/* Шапка */}
      <div className="card mb-2 p-3">
        <div className="flex items-center gap-3">
          <Link to="/chats" className="icon-btn shrink-0">
            <Icon name="chevronLeft" size={20} />
          </Link>
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold"
            style={{ background: avatarBg, color: avatarColor }}
          >
            {chatTitle.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold leading-tight">{chatTitle}</p>
            {chat?.type === 'group' && (
              <p className="text-xs text-muted">
                {t('chat.members', { count: chat.members.length })}
                {slow > 0 && ` · ⏱ ${slowmodeLabel(slow)}`}
              </p>
            )}
          </div>
          {isAdmin && isGroup && (
            <button
              onClick={() => setSettings(true)}
              className="icon-btn shrink-0"
              title={t('chat.slowmode')}
            >
              <Icon name="sliders" size={19} />
            </button>
          )}
        </div>

      </div>

      {/* Закреплённое сообщение */}
      {chat?.pinnedMsgId && (
        <button
          onClick={() => scrollToMsg(chat.pinnedMsgId)}
          className="card mb-2 flex items-center gap-2.5 border-l-4 border-l-accent p-2.5 text-left"
        >
          <Icon name="tag" size={15} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-accent">
              {t('chat.pinned')}
              {chat.pinnedName ? ` · ${chat.pinnedName}` : ''}
            </span>
            <span className="line-clamp-1 text-xs text-muted">{chat.pinnedText}</span>
          </span>
          {isAdmin && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onUnpin()
              }}
              className="icon-btn !h-7 !w-7 shrink-0"
              title={t('chat.unpin')}
            >
              <Icon name="x" size={14} />
            </span>
          )}
        </button>
      )}

      {/* Сообщения */}
      <div
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto overscroll-contain px-1 py-2"
        style={{ WebkitOverflowScrolling: 'touch', overflowAnchor: 'none' }}
      >
        {msgs.length === 0 && <p className="py-8 text-center text-sm text-muted">{t('chat.empty')}</p>}
        {msgs.map((m) => {
          const mine = m.senderId === user?.uid
          const senderColor = avatarInk(m.senderName)
          const mediaOnly = (m.imageUrl || m.audioUrl) && !m.text
          const canDelete = mine || isAdmin
          const isPinned = chat?.pinnedMsgId === m.id

          if (m.deleted) {
            return (
              <div key={m.id} id={`m-${m.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%] rounded-2xl bg-surface2 px-4 py-2">
                  <p className="flex items-center gap-1.5 text-xs italic text-muted">
                    <Icon name="trash" size={12} />
                    {t('chat.deletedMsg')}
                  </p>
                </div>
              </div>
            )
          }

          return (
            <div key={m.id} id={`m-${m.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="relative max-w-[85%]">
                <div
                  onClick={() => canWrite && setSheet(m)}
                  onContextMenu={(e) => {
                    if (canWrite) {
                      e.preventDefault()
                      setSheet(m)
                    }
                  }}
                  className={`cursor-pointer ${mediaOnly ? 'p-1.5' : 'px-4 py-2.5'} ${
                    mine ? 'rounded-2xl rounded-br-md bg-ink text-bg' : 'card rounded-2xl rounded-bl-md'
                  } ${isPinned ? 'ring-2 ring-accent' : ''}`}
                >
                  {!mine && chat?.type === 'group' && (
                    <p
                      className={`mb-0.5 text-xs font-bold ${mediaOnly ? 'px-2 pt-1' : ''}`}
                      style={{ color: senderColor }}
                    >
                      {m.senderName}
                    </p>
                  )}

                  {/* Цитата — на что отвечают */}
                  {m.replyToId && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        scrollToMsg(m.replyToId)
                      }}
                      className={`mb-1.5 border-l-2 pl-2 ${
                        mine ? 'border-l-bg/50 opacity-80' : 'border-l-accent'
                      } ${mediaOnly ? 'mx-1.5 mt-1' : ''}`}
                    >
                      <p className={`text-[11px] font-bold ${mine ? '' : 'text-accent'}`}>
                        {m.replyToName}
                      </p>
                      <p className="line-clamp-2 text-[11px] opacity-75">{m.replyToText}</p>
                    </div>
                  )}

                  {m.imageUrl && (
                    <a
                      href={m.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="block"
                    >
                      <img
                        src={m.imageUrl}
                        alt=""
                        loading="lazy"
                        className="max-h-64 w-auto rounded-xl object-cover"
                      />
                    </a>
                  )}

                  {m.audioUrl && (
                    <audio
                      controls
                      preload="metadata"
                      src={m.audioUrl}
                      onClick={(e) => e.stopPropagation()}
                      className="h-11 w-[230px] max-w-full"
                    />
                  )}

                  {m.text && (
                    <p className={`whitespace-pre-wrap break-words text-sm ${m.imageUrl ? 'mt-1.5 px-1' : ''}`}>
                      {m.text}
                    </p>
                  )}

                  <p
                    className={`mt-1 flex items-center gap-1 text-[10px] opacity-60 ${
                      mine ? 'justify-end' : 'justify-start'
                    } ${mediaOnly ? 'px-2 pb-1' : ''}`}
                  >
                    {isPinned && <Icon name="tag" size={9} />}
                    {m.editedAt && <span>{t('chat.edited')}</span>}
                    {m.createdAt
                      ? new Date(m.createdAt).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </p>
                </div>

              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Панель ответа / правки */}
      {canWrite && (replyTo || editing) && (
        <div className="card mb-1.5 flex items-center gap-2.5 border-l-4 border-l-accent p-2.5">
          <Icon name={editing ? 'name' : 'arrowRight'} size={15} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
              {editing ? t('chat.editing') : `${t('chat.reply')} · ${replyTo?.senderName}`}
            </p>
            <p className="line-clamp-1 text-xs text-muted">
              {editing ? editing.text : replyTo ? preview(replyTo) : ''}
            </p>
          </div>
          <button
            onClick={() => {
              setReplyTo(null)
              if (editing) {
                setEditing(null)
                setText('')
              }
            }}
            className="icon-btn !h-8 !w-8 shrink-0"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      {/* Инпут */}
      {!user ? (
        <Link to="/login" className="btn-primary mt-2 w-full">
          {t('chat.needAuth')}
        </Link>
      ) : !canWrite ? (
        <div className="card mt-2 p-4 text-center">
          <p className="text-sm text-muted">{t('chat.joinToWrite')}</p>
          <button onClick={onJoinHere} disabled={joining} className="btn-primary mt-3 w-full disabled:opacity-40">
            <Icon name="plus" size={16} />
            {joining ? t('common.loading') : t('chat.join')}
          </button>
        </div>
      ) : recording ? (
        /* Режим записи голосового */
        <div className="card flex items-center gap-3 p-2">
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="icon-btn text-danger"
            title={t('common.cancel')}
          >
            <Icon name="trash" size={20} />
          </button>
          <div className="flex flex-1 items-center gap-2.5">
            <span className="h-3 w-3 animate-pulse rounded-full bg-danger" />
            <span className="text-sm font-bold tabular-nums">{fmtSec(recSec)}</span>
            <span className="text-sm text-muted">{t('chat.recording')}</span>
          </div>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-fg"
            title={t('chat.send')}
          >
            <Icon name="send" size={18} />
          </button>
        </div>
      ) : (
        <form onSubmit={onSend} className="card flex items-center gap-1.5 p-2">
          {/* Фото */}
          {!editing && (
            <label
              className={`icon-btn ${sending || cooldown > 0 ? 'pointer-events-none opacity-40' : ''}`}
              title={t('chat.photo')}
            >
              <Icon name="camera" size={21} />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onPickPhoto}
                disabled={sending || cooldown > 0}
              />
            </label>
          )}

          <input
            ref={inputRef}
            className="h-10 flex-1 rounded-xl border-0 bg-surface2 px-4 text-base text-ink placeholder:text-muted focus:outline-none md:text-[15px]"
            placeholder={
              sending
                ? t('chat.sending')
                : cooldown > 0
                  ? t('chat.slowWait', { sec: cooldown })
                  : editing
                    ? t('chat.editing')
                    : t('chat.placeholder')
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            disabled={sending}
          />

          {text.trim() ? (
            <button
              type="submit"
              disabled={sending || (cooldown > 0 && !editing)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-fg transition-opacity disabled:opacity-40"
              title={t('chat.send')}
            >
              <Icon name={editing ? 'check' : 'send'} size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={sending || cooldown > 0}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-40"
              title={t('chat.voice')}
            >
              <Icon name="mic" size={19} />
            </button>
          )}
        </form>
      )}

      {/* ======= Панель действий над сообщением (снизу, под палец) ======= */}
      {sheet && (
        <>
          <div className="sheet-backdrop" onClick={() => setSheet(null)} />
          <div className="sheet" role="dialog" aria-modal="true">
            <div className="sheet-grip" />

            {/* Что за сообщение */}
            <div className="mx-5 mb-1 mt-2 flex items-center gap-2.5 border-b border-line pb-3">
              {sheet.imageUrl && (
                <img src={sheet.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-muted">{sheet.senderName}</p>
                <p className="line-clamp-1 text-sm">{preview(sheet)}</p>
              </div>
            </div>

            <button onClick={() => startReply(sheet)} className="sheet-item">
              <Icon name="arrowRight" size={19} className="text-muted" />
              {t('chat.reply')}
            </button>

            {sheet.text && (
              <button onClick={() => copyText(sheet)} className="sheet-item">
                <Icon name="tag" size={19} className="text-muted" />
                {t('chat.copy')}
              </button>
            )}

            {sheet.senderId === user?.uid && sheet.text && (
              <button onClick={() => startEdit(sheet)} className="sheet-item">
                <Icon name="name" size={19} className="text-muted" />
                {t('chat.edit')}
              </button>
            )}

            {isAdmin && isGroup && (
              <button
                onClick={() =>
                  chat?.pinnedMsgId === sheet.id ? (setSheet(null), onUnpin()) : onPin(sheet)
                }
                className="sheet-item"
              >
                <Icon name="tag" size={19} className="text-muted" />
                {chat?.pinnedMsgId === sheet.id ? t('chat.unpin') : t('chat.pin')}
              </button>
            )}

            {(sheet.senderId === user?.uid || isAdmin) &&
              (confirmDel ? (
                <button onClick={() => onDelete(sheet)} className="sheet-item-danger font-extrabold">
                  <Icon name="trash" size={19} />
                  {t('chat.deleteSure')}
                </button>
              ) : (
                <button onClick={() => setConfirmDel(true)} className="sheet-item-danger">
                  <Icon name="trash" size={19} />
                  {t('common.delete')}
                </button>
              ))}

            <button
              onClick={() => setSheet(null)}
              className="sheet-item mt-1 justify-center border-t border-line text-muted"
            >
              {t('common.cancel')}
            </button>
          </div>
        </>
      )}

      {/* ======= Настройки группы: задержка (только админ) ======= */}
      {settings && isAdmin && isGroup && (
        <>
          <div className="sheet-backdrop" onClick={() => setSettings(false)} />
          <div className="sheet" role="dialog" aria-modal="true">
            <div className="sheet-grip" />
            <div className="px-5 pb-2 pt-2">
              <p className="text-[15px] font-bold">{t('chat.slowmode')}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t('chat.slowmodeHint')}</p>
            </div>
            {SLOWMODE_OPTIONS.map((sec) => (
              <button
                key={sec}
                onClick={() => {
                  onSlowmode(sec)
                  setSettings(false)
                }}
                className="sheet-item justify-between"
              >
                <span className="flex items-center gap-3.5">
                  <Icon name="clock" size={19} className="text-muted" />
                  {sec === 0 ? t('chat.slowOff') : slowmodeLabel(sec)}
                </span>
                {slow === sec && <Icon name="check" size={18} className="text-accent" />}
              </button>
            ))}
            <button
              onClick={() => setSettings(false)}
              className="sheet-item mt-1 justify-center border-t border-line text-muted"
            >
              {t('common.cancel')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
