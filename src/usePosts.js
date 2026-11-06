import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { resizeImage } from './photo.js'
import { dateInZone, readStoredValue, uuid, writeStoredValue } from './lib.js'

const BUCKET = 'post-photos'

export default function usePosts(space, userId, galleryOpen, today, zone) {
  const seenKey = 'posts-seen-' + space.id
  const [posts, setPosts] = useState([])
  const [replies, setReplies] = useState([])
  const [urls, setUrls] = useState({})
  const [gallery, setGallery] = useState(null)
  const [seen, setSeen] = useState(() => readStoredValue(seenKey))
  const [error, setError] = useState('')
  const seq = useRef(0)
  const loadRef = useRef(null)
  const signed = useRef({})
  const signedAt = useRef(Date.now())

  const load = useCallback(async () => {
    const id = ++seq.current
    try {
      const [feed, archive] = await Promise.all([
        supabase.from('posts')
          .select('id, user_id, body, checkin, place, photos, created_at, post_replies(id, post_id, user_id, body, created_at)')
          .eq('space_id', space.id).order('created_at', { ascending: false }).limit(100)
          .order('created_at', { referencedTable: 'post_replies', ascending: true }),
        galleryOpen && supabase.from('posts').select('id,user_id,photos,created_at')
          .eq('space_id', space.id).order('created_at', { ascending: false }).limit(1000),
      ])
      const { data, error: postsError } = feed
      if (postsError) throw postsError
      if (id !== seq.current) return
      const p = data.map(({ post_replies, ...post }) => post)
      const r = data.flatMap((post) => post.post_replies || [])
      setPosts(p)
      setReplies(r)

      let shots = null
      let paths = []
      if (archive) {
        const { data, error } = archive
        if (error) throw error
        shots = (data || []).flatMap((x) =>
          (x.photos || []).map((path) => ({ path, postId: x.id, user_id: x.user_id, created_at: x.created_at })),
        )
        paths = shots.map((x) => x.path)
      } else if (today) {
        paths = p.flatMap((post) =>
          post.photos?.length && dateInZone(zone, new Date(post.created_at)) === today ? post.photos : [],
        )
      }

      if (Date.now() - signedAt.current > 20 * 3600 * 1000) {
        signed.current = {}
        signedAt.current = Date.now()
      }
      const missing = [...new Set(paths)].filter((path) => !signed.current[path])
      for (let i = 0; i < missing.length; i += 100) {
        const { data, error: signError } = await supabase.storage.from(BUCKET)
          .createSignedUrls(missing.slice(i, i + 100), 86400)
        if (id !== seq.current) return
        if (signError) throw signError
        for (const item of data || []) if (item.signedUrl) signed.current[item.path] = item.signedUrl
      }
      if (id !== seq.current) return
      setUrls({ ...signed.current })
      if (shots) setGallery(shots)
      setError('')
    } catch (loadError) {
      if (id === seq.current) setError(loadError.message || 'Could not load posts and photos.')
    }
  }, [galleryOpen, space.id, today, zone])

  useEffect(() => {
    loadRef.current = load
    load()
    return () => { seq.current += 1 }
  }, [load])

  useEffect(() => {
    const refresh = () => loadRef.current()
    const ch = supabase
      .channel('posts-' + space.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `space_id=eq.${space.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_replies', filter: `space_id=eq.${space.id}` }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [space.id])

  async function add({ body, checkin, place, files }) {
    const paths = []
    try {
      for (const file of files) {
        const blob = await resizeImage(file)
        const path = `${space.id}/${userId}/${uuid()}.jpg`
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
        if (error) throw error
        paths.push(path)
      }
      const { error } = await supabase.from('posts').insert({
        space_id: space.id,
        kind: checkin ? 'checkin' : 'post',
        checkin: checkin || null,
        place: checkin ? place.trim() || null : null,
        body: body.trim() || null,
        photos: paths,
      })
      if (error) throw error
    } catch (err) {
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
      return err.message || 'Could not post. Try again.'
    }
    loadRef.current()
    return null
  }

  async function remove(post) {
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) return error.message
    if (post.photos?.length) await supabase.storage.from(BUCKET).remove(post.photos)
    loadRef.current()
    return null
  }

  async function reply(postId, body) {
    const { error } = await supabase
      .from('post_replies')
      .insert({ space_id: space.id, post_id: postId, body: body.trim() })
    if (error) return error.message
    loadRef.current()
    return null
  }

  async function removeReply(id) {
    const { error } = await supabase.from('post_replies').delete().eq('id', id)
    if (error) return error.message
    loadRef.current()
    return null
  }

  const latestOther = [...posts, ...replies]
    .filter((x) => x.user_id !== userId)
    .reduce((m, x) => (x.created_at > m ? x.created_at : m), '')
  const unread = latestOther > seen

  const markSeen = useCallback(() => {
    if (!latestOther || latestOther <= seen) return
    writeStoredValue(seenKey, latestOther)
    setSeen(latestOther)
  }, [latestOther, seen, seenKey])

  return { posts, replies, urls, gallery, unread, markSeen, add, remove, reply, removeReply, error, reload: load }
}
