// Sends a push notification when a message or a call arrives: to the one person in a private chat,
// or to everybody else in the group chat.
// Deploy as a Supabase Edge Function named "notify" (see push.sql for the trigger).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function push(subs: any[], payload: Record<string, unknown>) {
  const text = JSON.stringify(payload)
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          text,
          { TTL: payload.kind === 'call' ? 30 : 86400, urgency: 'high' },
        )
      } catch (e: any) {
        // the phone removed the subscription: forget it
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }),
  )
}

async function work(id: string) {
  const { data: msg } = await db.from('messages').select('*').eq('id', id).maybeSingle()
  if (!msg) return

  const { data: members } = await db.from('members').select('user_id, display_name').eq('space_id', msg.space_id)
  const sender = members?.find((m) => m.user_id === msg.user_id)
  const { data: st } = await db.from('chat_settings').select('nicknames').eq('space_id', msg.space_id).maybeSingle()
  const name = st?.nicknames?.[msg.user_id] || sender?.display_name || 'New message'

  // private chat: only that person. group chat: everyone except the sender.
  const isDm = !!msg.to_user
  const others = isDm
    ? [msg.to_user]
    : (members || []).filter((m) => m.user_id !== msg.user_id).map((m) => m.user_id)
  if (!others.length) return
  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', others)
  if (!subs?.length) return

  // the app opens the right chat: the group, or the private chat with the sender
  const chat = isDm ? msg.user_id : 'group'

  if (msg.kind === 'call') {
    if (!isDm || msg.meta?.status !== 'ringing') return
    const what = msg.meta?.video ? 'video' : 'voice'
    // ring for about 30 seconds, until the caller hangs up or the call is answered
    for (let i = 0; i < 6; i++) {
      const { data: cur } = await db.from('messages').select('meta').eq('id', id).maybeSingle()
      if (cur?.meta?.status !== 'ringing') return
      await push(subs, { kind: 'call', title: name, body: `Incoming ${what} call`, tag: 'call', chat })
      await sleep(5000)
    }
    return
  }

  let text = (msg.body || '').slice(0, 140)
  if (msg.kind === 'image') text = text || '📷 Photo'
  if (msg.kind === 'voice') text = '🎤 Voice message'

  if (isDm) {
    await push(subs, { kind: 'message', title: name, body: text, tag: 'chat-' + msg.user_id, chat })
  } else {
    const { data: space } = await db.from('spaces').select('name').eq('id', msg.space_id).maybeSingle()
    await push(subs, { kind: 'message', title: space?.name || 'Group chat', body: `${name}: ${text}`, tag: 'chat-group', chat })
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const body = await req.json().catch(() => null)
  const id = body?.record?.id
  if (!id) return new Response('no id', { status: 400 })
  // answer straight away; keep ringing in the background
  // @ts-ignore EdgeRuntime exists in Supabase Edge Functions
  EdgeRuntime.waitUntil(work(id).catch((e) => console.error(e)))
  return new Response('ok')
})
