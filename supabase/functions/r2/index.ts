// Authenticated R2 operations for Cinema uploads and playback.
// The browser receives short-lived presigned URLs, never R2 credentials.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from 'npm:@aws-sdk/client-s3@3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

function required(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`)
  return value
}

function clients() {
  const url = required('SUPABASE_URL')
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')
  const accountId = required('R2_ACCOUNT_ID')
  const accessKeyId = required('R2_ACCESS_KEY_ID')
  const secretAccessKey = required('R2_SECRET_ACCESS_KEY')
  const bucket = required('R2_BUCKET')

  return {
    bucket,
    db: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    s3: new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  }
}

function cleanKey(key: unknown): key is string {
  return typeof key === 'string' &&
    key.length <= 512 &&
    !key.includes('..') &&
    !key.includes('\\') &&
    !/[\u0000-\u001f\u007f]/.test(key)
}

async function keysForSpace(db: SupabaseClient, spaceId: string, keys: string[]) {
  const [byPath, byPoster] = await Promise.all([
    db.from('movies').select('path').eq('space_id', spaceId).eq('store', 'r2').in('path', keys),
    db.from('movies').select('poster_path').eq('space_id', spaceId).eq('store', 'r2').in('poster_path', keys),
  ])
  if (byPath.error || byPoster.error) throw new HttpError(502, 'Could not verify the Cinema files.')
  return new Set([
    ...(byPath.data || []).map((row: { path: string }) => row.path),
    ...(byPoster.data || []).map((row: { poster_path: string | null }) => row.poster_path).filter(Boolean),
  ])
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)

  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new HttpError(401, 'Sign in to use Cinema uploads.')

    const raw = await req.text()
    if (raw.length > 1_000_000) throw new HttpError(413, 'Request is too large.')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new HttpError(400, 'Invalid request.')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpError(400, 'Invalid request.')
    }
    const body = parsed as Record<string, unknown>

    const { bucket, db, s3 } = clients()
    const { data: authData, error: authError } = await db.auth.getUser(token)
    const user = authData?.user
    if (authError || !user) throw new HttpError(401, 'Sign in to use Cinema uploads.')

    const { data: member, error: memberError } = await db
      .from('members')
      .select('space_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (memberError || !member?.space_id) throw new HttpError(403, 'Join a calendar space first.')

    const spaceId = member.space_id as string
    const ownPrefix = `${spaceId}/${user.id}/`
    const action = body.action

    if (action === 'create') {
      const ext = typeof body.ext === 'string' ? body.ext.toLowerCase() : ''
      const contentType = typeof body.contentType === 'string'
        ? body.contentType.split(';', 1)[0].trim().toLowerCase()
        : ''
      if (!/^[a-z0-9]{1,10}$/.test(ext) || !/^video\/[a-z0-9.+-]+$/.test(contentType)) {
        throw new HttpError(400, 'Choose a supported video file.')
      }
      const key = `${ownPrefix}${crypto.randomUUID()}.${ext}`
      const started = await s3.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }))
      if (!started.UploadId) throw new HttpError(502, 'Could not start the upload.')
      return response({ key, uploadId: started.UploadId })
    }

    if (action === 'part') {
      const key = body.key
      const uploadId = body.uploadId
      const partNumber = Number(body.partNumber)
      if (!cleanKey(key) || !key.startsWith(ownPrefix) || typeof uploadId !== 'string' || uploadId.length > 2048) {
        throw new HttpError(403, 'Upload is not available to this account.')
      }
      if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
        throw new HttpError(400, 'Invalid upload part.')
      }
      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
        { expiresIn: 3600 },
      )
      return response({ url })
    }

    if (action === 'complete') {
      const key = body.key
      const uploadId = body.uploadId
      const inputParts = body.parts
      if (!cleanKey(key) || !key.startsWith(ownPrefix) || typeof uploadId !== 'string' || uploadId.length > 2048) {
        throw new HttpError(403, 'Upload is not available to this account.')
      }
      if (!Array.isArray(inputParts) || inputParts.length < 1 || inputParts.length > 10_000) {
        throw new HttpError(400, 'Invalid upload parts.')
      }
      const parts = inputParts.map((item: unknown) => {
        const part = item as { n?: unknown; etag?: unknown }
        const PartNumber = Number(part?.n)
        if (!Number.isInteger(PartNumber) || PartNumber < 1 || PartNumber > 10_000 || typeof part?.etag !== 'string' || part.etag.length > 256) {
          throw new HttpError(400, 'Invalid upload parts.')
        }
        return { PartNumber, ETag: part.etag }
      }).sort((a, b) => a.PartNumber - b.PartNumber)
      if (new Set(parts.map((part) => part.PartNumber)).size !== parts.length ||
          parts.some((part, index) => part.PartNumber !== index + 1)) {
        throw new HttpError(400, 'Invalid upload parts.')
      }
      await s3.send(new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }))
      return response({ ok: true })
    }

    if (action === 'abort') {
      const key = body.key
      const uploadId = body.uploadId
      if (!cleanKey(key) || !key.startsWith(ownPrefix) || typeof uploadId !== 'string' || uploadId.length > 2048) {
        throw new HttpError(403, 'Upload is not available to this account.')
      }
      await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }))
      return response({ ok: true })
    }

    if (action === 'put') {
      const key = body.key
      if (!cleanKey(key) || !key.startsWith(ownPrefix) || !key.endsWith('-poster.jpg')) {
        throw new HttpError(403, 'Poster upload is not available to this account.')
      }
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'image/jpeg' }),
        { expiresIn: 3600 },
      )
      return response({ url })
    }

    if (action === 'get' || action === 'delete') {
      const inputKeys = body.keys
      if (!Array.isArray(inputKeys) || inputKeys.length < 1 || inputKeys.length > 100 || !inputKeys.every(cleanKey)) {
        throw new HttpError(400, 'Invalid file list.')
      }
      const keys = [...new Set(inputKeys as string[])]
      const accessible = await keysForSpace(db, spaceId, keys)
      for (const key of keys) {
        const belongsToSpace = key.startsWith(`${spaceId}/`)
        if (!belongsToSpace || (action === 'get' && !accessible.has(key))) {
          throw new HttpError(403, 'One or more files are not available to this calendar.')
        }
        // A user may clean up their own failed upload; shared deletion also permits
        // keys that are still attached to a movie in this calendar.
        if (action === 'delete' && !key.startsWith(ownPrefix) && !accessible.has(key)) {
          throw new HttpError(403, 'One or more files are not available to this calendar.')
        }
      }

      if (action === 'get') {
        const entries = await Promise.all(keys.map(async (key) => [
          key,
          await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 6 * 3600 }),
        ] as const))
        return response({ urls: Object.fromEntries(entries) })
      }

      await Promise.all(keys.map((key) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))))
      return response({ ok: true })
    }

    throw new HttpError(400, 'Unknown operation.')
  } catch (error) {
    if (error instanceof HttpError) return response({ error: error.message }, error.status)
    console.error('R2 operation failed:', error instanceof Error ? error.name : 'unknown error')
    return response({ error: 'The Cinema storage operation failed.' }, 502)
  }
})
