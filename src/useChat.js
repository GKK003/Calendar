import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { resizeImage } from './photo.js'
import { uuid } from './lib.js'

const BUCKET = 'chat-media'
const PAGE = 80

export const preview = (m) => {
  if (!m) return ''
  if (m.deleted_at) return 'Message unsent'
  if (m.kind === 'image') return m.body || 'Photo'
  if (m.kind === 'voice') return 'Voice message'
  if (m.kind === 'call') return m.meta?.video ? 'Video call' : 'Voice call'
  return m.body || ''
}

export default function useChat(space, userId, partnerId, partnerName) {
  const [limit, setLimit] = useState(PAGE)
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState([])
  const [reads, setReads] = useState({})
  const [settings, setSettings] = useState({ color: null, quick_emoji: null, nicknames: {} })
  const [urls, setUrls] = useState({})
  const [typing, setTyping] = useState(false)
  const [online, setOnline] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const seq = useRef(0)
  const signed = useRef({})
  const signedAt = useRef(Date.now())
  const chan = useRef(null)
  const lastTyping = useRef(0)
  const typingTimer = useRef(null)
  const nameRef = useRef(partnerName)
  nameRef.current = partnerName

  const load = useCallback(async () => {
    const id = ++seq.current
    const m = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (m.error || id !== seq.current) return
    const list = [...m.data].reverse()
    let rx = []
    if (list.length) {
      const r = await supabase.from('message_reactions').select('*').in('message_id', list.map((x) => x.id))
      if (id !== seq.current) return
      rx = r.data || []
    }
    const rd = await supabase.from('chat_reads').select('*')
    const st = await supabase.from('chat_settings').select('*').eq('space_id', space.id).maybeSingle()
    if (id !== seq.current) return
    setMessages(list)
    setHasMore(m.data.length >= limit)
    setReactions(rx)
    setReads(Object.fromEntries((rd.data || []).map((x) => [x.user_id, x.read_at])))
    if (st.data) setSettings({ color: st.data.color, quick_emoji: st.data.quick_emoji, nicknames: st.data.nicknames || {} })

    if (Date.now() - signedAt.current > 20 * 3600 * 1000) {
      signed.current = {}
      signedAt.current = Date.now()
    }
    const missing = [...new Set(list.flatMap((x) => x.media || []))].filter((p) => !signed.current[p])
    if (!missing.length) return
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, 86400)
    for (const item of data || []) if (item.signedUrl) signed.current[item.path] = item.signedUrl
    setUrls({ ...signed.current })
  }, [limit, space.id])

  useEffect(() => {
    load()
  }, [load])

  // live updates
  useEffect(() => {
    const f = `space_id=eq.${space.id}`
    const ch = supabase
      .channel('chat-db-' + space.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: f }, (p) => {
        const m = p.new
        if (m.user_id !== userId && m.kind !== 'call' && document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(nameRef.current || 'New message', { body: preview(m), tag: 'chat' })
          } catch {
            /* some phones only allow notifications through a service worker */
          }
        }
        load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: f }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: f }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reads', filter: f }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_settings', filter: f }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [space.id, userId, load])

  // typing + "active now"
  useEffect(() => {
    const ch = supabase.channel('chat-live-' + space.id, { config: { presence: { key: userId }, broadcast: { self: false } } })
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.from === userId) return
      clearTimeout(typingTimer.current)
      setTyping(!!payload.on)
      if (payload.on) typingTimer.current = setTimeout(() => setTyping(false), 4000)
    })
    ch.on('presence', { event: 'sync' }, () => {
      setOnline(Object.keys(ch.presenceState()).some((k) => k !== userId))
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') ch.track({ at: Date.now() })
    })
    chan.current = ch
    return () => {
      clearTimeout(typingTimer.current)
      supabase.removeChannel(ch)
      chan.current = null
    }
  }, [space.id, userId])

  function notifyTyping(on = true) {
    const now = Date.now()
    if (on && now - lastTyping.current < 2500) return
    lastTyping.current = on ? now : 0
    chan.current?.send({ type: 'broadcast', event: 'typing', payload: { from: userId, on } })
  }

  async function upload(blob, ext, type) {
    const path = `${space.id}/${userId}/${uuid()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type })
    if (error) throw error
    return path
  }

  // text, photos or a voice note
  async function send({ body = '', files = [], voice = null, replyTo = null }) {
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
    load()
    return null
  }

  async function logCall({ video, status, seconds }) {
    await supabase.from('messages').insert({
      space_id: space.id,
      kind: 'call',
      meta: { video, status, seconds: Math.round(seconds || 0) },
    })
  }

  async function edit(id, body) {
    const { error } = await supabase
      .from('messages')
      .update({ body: body.trim(), edited_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return error.message
    load()
    return null
  }

  async function unsend(m) {
    const { error } = await supabase
      .from('messages')
      .update({ body: null, media: [], meta: null, deleted_at: new Date().toISOString() })
      .eq('id', m.id)
    if (error) return error.message
    if (m.media?.length) await supabase.storage.from(BUCKET).remove(m.media)
    load()
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
    load()
    return null
  }

  async function saveSettings(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    const { error } = await supabase
      .from('chat_settings')
      .upsert({ space_id: space.id, color: next.color, quick_emoji: next.quick_emoji, nicknames: next.nicknames }, { onConflict: 'space_id' })
    if (error) return error.message
    return null
  }

  const latest = messages.length ? messages[messages.length - 1].created_at : ''
  const myRead = reads[userId] || ''
  const unread = useMemo(
    () => messages.filter((m) => m.user_id !== userId && m.kind !== 'call' && m.created_at > myRead).length,
    [messages, userId, myRead],
  )

  const markRead = useCallback(async () => {
    if (!latest || latest <= myRead) return
    setReads((r) => ({ ...r, [userId]: latest }))
    await supabase.from('chat_reads').upsert({ user_id: userId, space_id: space.id, read_at: latest }, { onConflict: 'user_id' })
  }, [latest, myRead, userId, space.id])

  return {
    messages, reactions, urls, settings, typing, online, hasMore, unread,
    partnerRead: reads[partnerId] || '',
    loadMore: () => setLimit((n) => n + PAGE),
    send, edit, unsend, react, saveSettings, markRead, notifyTyping, logCall,
  }
}
