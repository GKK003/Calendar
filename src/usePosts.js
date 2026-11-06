import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { resizeImage } from './photo.js'
import { readStoredValue, writeStoredValue } from './lib.js'
import { uuid } from './lib.js'

const BUCKET = 'post-photos'

export default function usePosts(space, userId) {
  const seenKey = 'posts-seen-' + space.id
  const [posts, setPosts] = useState([])
  const [replies, setReplies] = useState([])
  const [urls, setUrls] = useState({})
  const [gallery, setGallery] = useState([])
  const [seen, setSeen] = useState(() => readStoredValue(seenKey))
  const [error, setError] = useState('')
  const seq = useRef(0)
  const signed = useRef({})
  const signedAt = useRef(Date.now())

  const load = useCallback(async () => {
    const id = ++seq.current
    try {
      const { data: p, error: postsError } = await supabase
        .from('posts').select('*').order('created_at', { ascending: false }).limit(100)
      if (postsError) throw postsError
      if (id !== seq.current) return
      let r = []
      if (p.length) {
        const res = await supabase.from('post_replies').select('*')
          .in('post_id', p.map((x) => x.id)).order('created_at', { ascending: true })
        if (res.error) throw res.error
        if (id !== seq.current) return
        r = res.data
      }
      // Gallery currently keeps the 1,000 newest photo posts.
      const g = await supabase.from('posts').select('id,user_id,photos,created_at')
        .order('created_at', { ascending: false }).limit(1000)
      if (g.error) throw g.error
      if (id !== seq.current) return
      const shots = (g.data || []).flatMap((x) =>
        (x.photos || []).map((path) => ({ path, postId: x.id, user_id: x.user_id, created_at: x.created_at })),
      )
      setPosts(p)
      setReplies(r)
      setGallery(shots)
      if (Date.now() - signedAt.current > 20 * 3600 * 1000) {
        signed.current = {}
        signedAt.current = Date.now()
      }
      const wanted = new Set([...p.flatMap((x) => x.photos || []), ...shots.map((x) => x.path)])
      const missing = [...wanted].filter((path) => !signed.current[path])
      for (let i = 0; i < missing.length; i += 100) {
        const { data, error: signError } = await supabase.storage.from(BUCKET)
          .createSignedUrls(missing.slice(i, i + 100), 86400)
        if (signError) throw signError
        for (const item of data || []) if (item.signedUrl) signed.current[item.path] = item.signedUrl
      }
      if (id !== seq.current) return
      setUrls({ ...signed.current })
      setError('')
    } catch (loadError) {
      if (id === seq.current) setError(loadError.message || 'Could not load posts and photos.')
    }
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('posts-' + space.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `space_id=eq.${space.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_replies', filter: `space_id=eq.${space.id}` }, load)
      .subscribe()
    return () => {
      seq.current += 1
      supabase.removeChannel(ch)
    }
  }, [space.id, load])

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
    load()
    return null
  }

  async function remove(post) {
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) return error.message
    if (post.photos?.length) await supabase.storage.from(BUCKET).remove(post.photos)
    load()
    return null
  }

  async function reply(postId, body) {
    const { error } = await supabase
      .from('post_replies')
      .insert({ space_id: space.id, post_id: postId, body: body.trim() })
    if (error) return error.message
    load()
    return null
  }

  async function removeReply(id) {
    const { error } = await supabase.from('post_replies').delete().eq('id', id)
    if (error) return error.message
    load()
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
