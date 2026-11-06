import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { resizeImage } from './photo.js'
import { uuid } from './lib.js'

const BUCKET = 'chat-media'
const PAGE = 80
const RECENT = 300
const RING_WINDOW = 40_000

// A chat is identified by a key: 'group' for the group chat, or the other person's user id for a private chat.
export const GROUP = 'group'

export const preview = (m) => {
  if (!m) return ''
  if (m.deleted_at) return 'Message unsent'
  if (m.kind === 'image') return m.body || 'Photo'
  if (m.kind === 'voice') return 'Voice message'
  if (m.kind === 'call') return m.meta?.video ? 'Video call' : 'Voice call'
  return m.body || ''
}

// does this message belong to the chat with this key?
function inChat(m, key, me) {
  if (key === GROUP) return !m.to_user
  return !!m.to_user && ((m.user_id === me && m.to_user === key) || (m.user_id === key && m.to_user === me))
}

const LIGHT = 'id, user_id, to_user, kind, body, meta, deleted_at, created_at'
const DEFAULT_SETTINGS = { color: null, quick_emoji: null, nicknames: {} }

function messagesFor(query, key, userId) {
  return key === GROUP
    ? query.is('to_user', null)
    : query.or(`and(user_id.eq.${userId},to_user.eq.${key}),and(user_id.eq.${key},to_user.eq.${userId})`)
}

export default function useChat(space, userId, members, chatOpen) {
  const [activeKey, setActiveKey] = useState(null) // null = the list of chats is shown
  const [limit, setLimit] = useState(PAGE)
  const [messages, setMessages] = useState([])
  const [{ messages: recent, loadedAt: recentMessagesLoadedAt }, setRecent] = useState({ messages: [], loadedAt: 0 })
  const [extraLast, setExtraLast] = useState({})
  const [reactions, setReactions] = useState([])
  const [reads, setReads] = useState([])
  const [readsReady, setReadsReady] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [urls, setUrls] = useState({})
  const [typers, setTypers] = useState({})
  const [onlineIds, setOnlineIds] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const summaryRequest = useRef(null)
  const readsVersion = useRef(0)
  const threadSeq = useRef(0)
  const settingsRequest = useRef(null)
  const settingsVersion = useRef(0)
  const settingsRef = useRef(null)
  const signed = useRef({})
  const signedAt = useRef(Date.now())
  const chan = useRef(null)
  const lastTyping = useRef(0)
  const typingTimers = useRef({})
  const loadThreadRef = useRef(() => {})
  const membersRef = useRef(members)
  membersRef.current = members
  const visibleKey = chatOpen ? activeKey : null
  const keyRef = useRef(visibleKey)
  keyRef.current = visibleKey
  const chatOpenRef = useRef(chatOpen)
  chatOpenRef.current = chatOpen

  const loadSummary = useCallback(async (changed = false) => {
    const pending = summaryRequest.current
    if (pending) {
      pending.changed ||= changed
      return
    }
    const request = { changed: false }
    summaryRequest.current = request
    try {
      do {
        request.changed = false
        const version = readsVersion.current
        const [messagesResult, readsResult] = await Promise.all([
          supabase.from('messages').select(LIGHT).eq('space_id', space.id)
            .order('created_at', { ascending: false }).limit(RECENT),
          supabase.from('chat_reads').select('user_id, chat_key, read_at').eq('space_id', space.id),
        ])
        if (summaryRequest.current !== request) return
        if (!messagesResult.error && messagesResult.data) {
          setRecent({ messages: messagesResult.data, loadedAt: Date.now() })
        }
        if (version === readsVersion.current) {
          if (!readsResult.error && readsResult.data) setReads(readsResult.data)
          setReadsReady(true)
        }
      } while (request.changed)
    } finally {
      if (summaryRequest.current === request) summaryRequest.current = null
    }
  }, [space.id])

  const loadThread = useCallback(async () => {
    const key = visibleKey
    if (!key) return
    const id = ++threadSeq.current
    const { data, error } = await messagesFor(supabase.from('messages').select('*')
      .eq('space_id', space.id).order('created_at', { ascending: false }).limit(limit), key, userId)
    if (id !== threadSeq.current || error || !data) return
    const list = [...data].reverse()
    let rx = []
    if (list.length) {
      const r = await supabase.from('message_reactions').select('*').in('message_id', list.map((x) => x.id))
      if (id !== threadSeq.current) return
      rx = r.data || []
    }
    setMessages(list)
    setHasMore(data.length >= limit)
    setReactions(rx)

    if (Date.now() - signedAt.current > 20 * 3600 * 1000) {
      signed.current = {}
      signedAt.current = Date.now()
    }
    const missing = [...new Set(list.flatMap((x) => x.media || []))].filter((p) => !signed.current[p])
    if (!missing.length) return
    const result = await supabase.storage.from(BUCKET).createSignedUrls(missing, 86400)
    if (id !== threadSeq.current) return
    for (const item of result.data || []) if (item.signedUrl) signed.current[item.path] = item.signedUrl
    setUrls({ ...signed.current })
  }, [visibleKey, limit, userId, space.id])

  const storeSettings = useCallback((row) => {
    const next = row ? { color: row.color, quick_emoji: row.quick_emoji, nicknames: row.nicknames || {} } : DEFAULT_SETTINGS
    settingsVersion.current += 1
    settingsRef.current = next
    setSettings(next)
  }, [])

  const loadSettings = useCallback(() => {
    if (settingsRequest.current) return settingsRequest.current
    const version = settingsVersion.current
    const request = supabase.from('chat_settings').select('color, quick_emoji, nicknames')
      .eq('space_id', space.id).maybeSingle().then(({ data, error }) => {
        if (!error && version === settingsVersion.current) storeSettings(data)
        return error
      }).finally(() => {
        if (settingsRequest.current === request) settingsRequest.current = null
      })
    settingsRequest.current = request
    return request
  }, [space.id, storeSettings])

  loadThreadRef.current = loadThread
  useEffect(() => {
    if (!document.hidden) loadSummary()
    return () => { summaryRequest.current = null }
  }, [loadSummary])

  useEffect(() => {
    loadThread()
    return () => { threadSeq.current += 1 }
  }, [loadThread])

  useEffect(() => {
    if (chatOpen) loadSettings()
  }, [chatOpen, loadSettings])

  useEffect(() => () => {
    settingsVersion.current += 1
    settingsRequest.current = null
    settingsRef.current = null
  }, [space.id])

  // Older per-chat previews are only used in the chat list.
  useEffect(() => {
    if (!chatOpen) return
    if (recent.length < RECENT) {
      setExtraLast((previous) => Object.keys(previous).length ? {} : previous)
      return
    }
    let active = true
    const keys = [GROUP, ...members.filter((m) => m.user_id !== userId).map((m) => m.user_id)]
    const missing = keys.filter((key) => !recent.some((m) => inChat(m, key, userId)))
    Promise.all(missing.map(async (key) => {
      const query = supabase.from('messages').select(LIGHT).eq('space_id', space.id)
        .order('created_at', { ascending: false }).limit(1)
      const { data } = await messagesFor(query, key, userId)
      return [key, data?.[0]]
    })).then((results) => {
      if (active) setExtraLast(Object.fromEntries(results.filter(([, message]) => message)))
    })
    return () => { active = false }
  }, [chatOpen, members, recent, space.id, userId])

  // live updates (the database only sends me the messages I am allowed to see)
  useEffect(() => {
    const f = `space_id=eq.${space.id}`
    const messageChanged = (payload) => {
      loadSummary(true)
      if (keyRef.current && (payload.eventType === 'DELETE' || inChat(payload.new, keyRef.current, userId))) {
        loadThreadRef.current()
      }
    }
    const ch = supabase
      .channel('chat-db-' + space.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: f }, (p) => {
        const m = p.new
        if (p.eventType === 'INSERT' && !import.meta.env.VITE_VAPID_PUBLIC_KEY && m.user_id !== userId && m.kind !== 'call' && document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const sender = membersRef.current.find((x) => x.user_id === m.user_id)
            new Notification(sender?.display_name || 'New message', { body: preview(m), tag: 'chat' })
          } catch {
            /* some phones only allow notifications through a service worker */
          }
        }
        messageChanged(p)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: f }, () => loadThreadRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reads', filter: f }, (p) => {
        const row = p.eventType === 'DELETE' ? p.old : p.new
        if (!row.user_id || !row.chat_key) return
        readsVersion.current += 1
        if (summaryRequest.current) summaryRequest.current.changed = true
        setReads((current) => {
          const others = current.filter((read) => read.user_id !== row.user_id || read.chat_key !== row.chat_key)
          return p.eventType === 'DELETE' ? others : [...others, row]
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_settings', filter: f }, (p) => {
        if (p.eventType === 'DELETE') {
          if (p.old.space_id === space.id) storeSettings(null)
        } else {
          storeSettings(p.new)
        }
      })
      .subscribe()
    // a phone that was asleep may have missed events: refresh when the app is shown again
    let wasHidden = document.hidden
    const vis = () => {
      if (document.hidden) {
        wasHidden = true
        return
      }
      if (!wasHidden) return
      wasHidden = false
      loadSummary(true)
      loadThreadRef.current()
      if (chatOpenRef.current) loadSettings()
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      document.removeEventListener('visibilitychange', vis)
      supabase.removeChannel(ch)
    }
  }, [space.id, userId, loadSummary, loadSettings, storeSettings])

  // typing + "active now"
  useEffect(() => {
    const ch = supabase.channel('chat-live-' + space.id, { config: { presence: { key: userId }, broadcast: { self: false } } })
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.from === userId) return
      // which of my chats is this? the group, or the private chat with the sender
      const key = payload.chat === 'group' ? GROUP : payload.to === userId ? payload.from : null
      if (!key) return
      const tk = key + ':' + payload.from
      clearTimeout(typingTimers.current[tk])
      const drop = () =>
        setTypers((t) => {
          const list = (t[key] || []).filter((x) => x !== payload.from)
          return { ...t, [key]: list }
        })
      if (payload.on) {
        setTypers((t) => ((t[key] || []).includes(payload.from) ? t : { ...t, [key]: [...(t[key] || []), payload.from] }))
        typingTimers.current[tk] = setTimeout(drop, 4000)
      } else {
        drop()
      }
    })
    ch.on('presence', { event: 'sync' }, () => {
      setOnlineIds(Object.keys(ch.presenceState()).filter((k) => k !== userId))
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') ch.track({ at: Date.now() })
    })
    chan.current = ch
    const timers = typingTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
      supabase.removeChannel(ch)
      chan.current = null
    }
  }, [space.id, userId])

  function notifyTyping(on = true) {
    const key = keyRef.current
    if (!key) return
    const now = Date.now()
    if (on && now - lastTyping.current < 2500) return
    lastTyping.current = on ? now : 0
    chan.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { from: userId, chat: key === GROUP ? 'group' : 'dm', to: key === GROUP ? null : key, on },
    })
  }

  function openChat(key) {
    setMessages([])
    setReactions([])
    setHasMore(false)
    setLimit(PAGE)
    setActiveKey(key)
  }
  function closeChat() {
    notifyTyping(false)
    setActiveKey(null)
    setMessages([])
    setReactions([])
  }

  async function upload(blob, ext, type) {
    const path = `${space.id}/${userId}/${uuid()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type })
    if (error) throw error
    return path
  }

  const toUser = activeKey && activeKey !== GROUP ? activeKey : null

  // text, photos or a voice note, sent to the chat that is open
  async function send({ body = '', files = [], voice = null, replyTo = null }) {
    if (!activeKey) return 'Open a chat first.'
    const paths = []
    try {
      let kind = 'text'
      let meta = null
      if (files.length) {
        kind = 'image'
        for (const f of files) paths.push(await upload(await resizeImage(f), 'jpg', 'image/jpeg'))
      } else if (voice) {
        kind = 'voice'
        const type = voice.blob.type || 'audio/webm'
        paths.push(await upload(voice.blob, type.includes('mp4') ? 'm4a' : 'webm', type.split(';')[0]))
        meta = { seconds: Math.round(voice.seconds) }
      }
      const { error } = await supabase.from('messages').insert({
        space_id: space.id,
        to_user: toUser,
        kind,
        body: body.trim() || null,
        media: paths,
        meta,
        reply_to: replyTo,
      })
      if (error) throw error
    } catch (err) {
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
      return err.message || 'Could not send. Try again.'
    }
    notifyTyping(false)
    loadSummary(true)
    loadThreadRef.current()
    return null
  }

  // a call is one row in the private chat with that person: it starts as "ringing"
  // (this also rings their phone) and is updated when it ends
  async function beginCall(video, to) {
    if (!to) return null
    const { data } = await supabase
      .from('messages')
      .insert({ space_id: space.id, to_user: to, kind: 'call', meta: { video, status: 'ringing', seconds: 0 } })
      .select('id')
      .single()
    return data?.id || null
  }

  async function finishCall(id, { video, status, seconds }) {
    if (!id) return
    await supabase
      .from('messages')
      .update({ meta: { video, status, seconds: Math.round(seconds || 0) } })
      .eq('id', id)
  }

  async function edit(id, body) {
    const { error } = await supabase
      .from('messages')
      .update({ body: body.trim(), edited_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return error.message
    loadSummary(true)
    loadThreadRef.current()
    return null
  }

  async function unsend(m) {
    const { error } = await supabase
      .from('messages')
      .update({ body: null, media: [], meta: null, deleted_at: new Date().toISOString() })
      .eq('id', m.id)
    if (error) return error.message
    if (m.media?.length) await supabase.storage.from(BUCKET).remove(m.media)
    loadSummary(true)
    loadThreadRef.current()
    return null
  }

  async function react(messageId, emoji) {
    const mine = reactions.find((r) => r.message_id === messageId && r.user_id === userId)
    let error
    if (mine && mine.emoji === emoji) {
      ;({ error } = await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId))
    } else {
      ;({ error } = await supabase
        .from('message_reactions')
        .upsert({ message_id: messageId, space_id: space.id, user_id: userId, emoji }, { onConflict: 'message_id,user_id' }))
    }
    if (error) return error.message
    loadThreadRef.current()
    return null
  }

  async function saveSettings(patch) {
    if (!settingsRef.current) {
      const error = await loadSettings()
      if (error) return error.message
    }
    const current = settingsRef.current
    const next = { ...current, ...patch }
    if (patch.nicknames) {
      next.nicknames = { ...current.nicknames }
      for (const [id, name] of Object.entries(patch.nicknames)) {
        if (name.trim()) next.nicknames[id] = name.trim()
        else delete next.nicknames[id]
      }
    }
    const { error } = await supabase
      .from('chat_settings')
      .upsert({ space_id: space.id, color: next.color, quick_emoji: next.quick_emoji, nicknames: next.nicknames }, { onConflict: 'space_id' })
    if (error) return error.message
    storeSettings(next)
    return null
  }

  const myReadOf = useCallback(
    (key) => reads.find((r) => r.user_id === userId && r.chat_key === key)?.read_at || '',
    [reads, userId],
  )

  // the list of chats: the group first in the data, then one private chat per other person
  const chats = useMemo(() => {
    const ids = members.filter((m) => m.user_id !== userId).map((m) => m.user_id)
    return [GROUP, ...ids].map((key) => {
      const msgs = recent.filter((m) => inChat(m, key, userId))
      const last = msgs[0] || extraLast[key] || null
      const mr = myReadOf(key)
      const count = msgs.filter((m) => m.user_id !== userId && m.kind !== 'call' && !m.deleted_at && m.created_at > mr).length
      return { key, last, unread: count }
    })
  }, [members, recent, extraLast, userId, myReadOf])

  const unread = useMemo(() => chats.reduce((n, c) => n + c.unread, 0), [chats])
  const unreadActive = chats.find((c) => c.key === activeKey)?.unread || 0
  const latestIncomingCall = useMemo(
    () => recent.find((message) => message.kind === 'call' && message.to_user === userId && message.user_id !== userId) || null,
    [recent, userId],
  )
  const recentCallsMayBeMissing = recent.length >= RECENT &&
    Date.parse(recent[recent.length - 1].created_at) > Date.now() - RING_WINDOW

  const latest = messages.length ? messages[messages.length - 1].created_at : ''
  const myRead = activeKey ? myReadOf(activeKey) : ''

  // mark the open chat as read
  const markRead = useCallback(async () => {
    if (!readsReady || !visibleKey || !latest || latest <= myRead) return
    readsVersion.current += 1
    setReads((list) => {
      const rest = list.filter((r) => !(r.user_id === userId && r.chat_key === visibleKey))
      return [...rest, { user_id: userId, space_id: space.id, chat_key: visibleKey, read_at: latest }]
    })
    await supabase
      .from('chat_reads')
      .upsert({ user_id: userId, space_id: space.id, chat_key: visibleKey, read_at: latest }, { onConflict: 'user_id,chat_key' })
  }, [readsReady, visibleKey, latest, myRead, userId, space.id])

  // when did the other person (private chat) or the other people (group) last read this chat
  const partnerRead = activeKey && activeKey !== GROUP ? reads.find((r) => r.user_id === activeKey && r.chat_key === userId)?.read_at || '' : ''
  const groupReads = activeKey === GROUP ? reads.filter((r) => r.chat_key === GROUP && r.user_id !== userId) : []

  return {
    activeKey, openChat, closeChat, chats, unread, unreadActive,
    messages, reactions, urls, settings, loadSettings, hasMore,
    latestIncomingCall, recentCallsMayBeMissing, recentMessagesLoadedAt,
    typing: (activeKey && typers[activeKey]) || [],
    onlineIds,
    partnerRead, groupReads,
    loadMore: () => setLimit((n) => n + PAGE),
    send, edit, unsend, react, saveSettings, markRead, notifyTyping, beginCall, finishCall,
  }
}
