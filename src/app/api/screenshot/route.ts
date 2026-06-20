import { z } from 'zod'

import { browser } from '@/lib/browser'
import {
  cacheKey,
  DAY,
  readBinaryCache,
  writeBinaryCache,
} from '@/lib/cache'
import { guardUrl } from '@/lib/url-guard'

const bodySchema = z.object({
  url: z.url({ message: 'Enter a valid http(s) URL' }),
  fullPage: z.boolean().optional().default(false),
})

export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  }
  catch {
    return Response.json(
      { error: 'Invalid JSON' },
      { status: 400 },
    )
  }
  const result = bodySchema.safeParse(json)
  if (!result.success) {
    return Response.json(
      { error: result.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { fullPage } = result.data
  const guard = await guardUrl(result.data.url)
  if (!guard.ok) {
    return Response.json({ error: guard.reason }, { status: guard.status })
  }
  const url = guard.url
  const key = cacheKey('screenshot', { url, fullPage })

  // Cache hit → serve the stored PNG straight from KV.
  const hit = await readBinaryCache(key)
  if (hit) {
    return new Response(hit.body, {
      headers: { 'content-type': hit.contentType, 'x-cache': 'HIT' },
    })
  }

  try {
    const res = await browser.quickAction('screenshot', {
      url,
      viewport: { width: 1920, height: 1080 },
      screenshotOptions: { fullPage },
      gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return Response.json(
        { error: `Browser Run returned ${res.status}`, detail },
        { status: 502 },
      )
    }

    const contentType = res.headers.get('content-type') ?? 'image/png'
    const bytes = await res.arrayBuffer()
    await writeBinaryCache(key, bytes, contentType, DAY)

    return new Response(bytes, {
      headers: { 'content-type': contentType, 'x-cache': 'MISS' },
    })
  }
  catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Screenshot failed' },
      { status: 500 },
    )
  }
}
