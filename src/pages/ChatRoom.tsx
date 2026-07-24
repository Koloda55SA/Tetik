import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { getChat, joinGroup, markChatRead, sendMessage, subscribeMessages, uploadChatMedia } from '../lib/db'
import { avatarHue, avatarInk } from '../lib/format'
import type { ChatMessage, ChatMeta } from '../lib/types'
import Icon from '../components/Icons'

const MAX_VOICE_SEC = 60

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const cancelledRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!id) return
    getChat(id).then(setChat).catch(() => {})
    return subscribeMessages(id, setMsgs)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  // В группе писать могут только участники
  const isGroup = chat?.type === 'group'
  const isMember = !!user && !!chat && chat.members.includes(user.uid)
  const canWrite = !!user && (!isGroup || isMember)
  const [joining, setJoining] = useState(false)

  async function onJoinHere() {
    if (!user || !id || joining) return
    setJoining(true)
    try {
      await joinGroup(id, profile?.displayName)
      const fresh = await getChat(id)
      setChat(fresh)
    } catch {
      alert(t('common.error'))
    } finally {
      setJoining(false)
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault()
    if (!sender || !id || !text.trim()) return
    const val = text
    setText('')
    await sendMessage(id, sender, val).catch(() => setText(val))
  }

  /* ---------- Фото ---------- */
  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !sender || !id || sending) return
    setSending(true)
    try {
      const imageUrl = await uploadChatMedia(sender.uid, file, 'image')
      await sendMessage(id, sender, text.trim(), { imageUrl })
      setText('')
    } catch {
      alert(t('common.error'))
    } finally {
      setSending(false)
    }
  }

  /* ---------- Голосовые ---------- */
  async function startRecording() {
    if (!sender || recording) return
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
          await sendMessage(id!, sender!, '', { audioUrl })
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
    <div className="max-w-2xl mx-auto flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-14rem)]">
      {/* Шапка */}
      <div className="card mb-2 flex items-center gap-3 p-3">
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
          <p className="font-bold leading-tight">{chatTitle}</p>
          {chat?.type === 'group' && (
            <p className="text-xs text-muted">{t('chat.members', { count: chat.members.length })}</p>
          )}
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 space-y-2 overflow-y-auto px-1 py-2">
        {msgs.length === 0 && <p className="py-8 text-center text-sm text-muted">{t('chat.empty')}</p>}
        {msgs.map((m) => {
          const mine = m.senderId === user?.uid
          const senderColor = avatarInk(m.senderName)
          const mediaOnly = (m.imageUrl || m.audioUrl) && !m.text
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`relative max-w-[80%] ${mediaOnly ? 'p-1.5' : 'px-4 py-2.5'} ${
                  mine ? 'rounded-2xl rounded-br-md bg-ink text-bg' : 'card rounded-2xl rounded-bl-md'
                }`}
              >
                {!mine && chat?.type === 'group' && (
                  <p className={`mb-0.5 text-xs font-bold ${mediaOnly ? 'px-2 pt-1' : ''}`} style={{ color: senderColor }}>
                    {m.senderName}
                  </p>
                )}

                {m.imageUrl && (
                  <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={m.imageUrl}
                      alt=""
                      loading="lazy"
                      className="max-h-64 w-auto rounded-xl object-cover"
                    />
                  </a>
                )}

                {m.audioUrl && (
                  <audio controls preload="metadata" src={m.audioUrl} className="h-11 w-[230px] max-w-full" />
                )}

                {m.text && <p className={`whitespace-pre-wrap break-words text-sm ${m.imageUrl ? 'mt-1.5 px-1' : ''}`}>{m.text}</p>}

                <p className={`mt-1 text-[10px] opacity-60 ${mine ? 'text-right' : 'text-left'} ${mediaOnly ? 'px-2 pb-1' : ''}`}>
                  {m.createdAt
                    ? new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

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
      ) : (
        recording ? (
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
            <label className={`icon-btn ${sending ? 'pointer-events-none opacity-40' : ''}`} title={t('chat.photo')}>
              <Icon name="camera" size={21} />
              <input type="file" accept="image/*" className="sr-only" onChange={onPickPhoto} disabled={sending} />
            </label>

            <input
              className="h-10 flex-1 rounded-xl border-0 bg-surface2 px-4 text-[15px] text-ink placeholder:text-muted focus:outline-none"
              placeholder={sending ? t('chat.sending') : t('chat.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              disabled={sending}
            />

            {text.trim() ? (
              <button
                type="submit"
                disabled={sending}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-fg transition-opacity disabled:opacity-40"
                title={t('chat.send')}
              >
                <Icon name="send" size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={sending}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-40"
                title={t('chat.voice')}
              >
                <Icon name="mic" size={19} />
              </button>
            )}
          </form>
        )
      )}
    </div>
  )
}
