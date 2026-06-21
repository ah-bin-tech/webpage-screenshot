'use client'

import { Checkbox } from '@cloudflare/kumo'
import { Button } from '@cloudflare/kumo/components/button'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { Camera, Download, ImageIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const DEFAULT_URL = 'https://github.com/liuyuhe666'

export default function Home() {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [fullPage, setFullPage] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [ms, setMs] = useState<number | null>(null)
  const lastObjectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current)
        URL.revokeObjectURL(lastObjectUrlRef.current)
    }
  }, [])

  async function capture(e: React.SubmitEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const started = performance.now()
    try {
      const res = await fetch('/api/screenshot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, fullPage }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      const blob = await res.blob()
      if (lastObjectUrlRef.current)
        URL.revokeObjectURL(lastObjectUrlRef.current)
      const objectUrl = URL.createObjectURL(blob)
      lastObjectUrlRef.current = objectUrl
      setImgUrl(objectUrl)
      setMs(Math.round(performance.now() - started))
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setImgUrl(null)
    }
    finally {
      setLoading(false)
    }
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="flex flex-col gap-5 w-full max-w-2xl">
        <form onSubmit={capture}>
          <LayerCard>
            <LayerCard.Secondary>网页 URL</LayerCard.Secondary>
            <LayerCard.Primary>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <input
                  type="url"
                  required
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg bg-kumo-control px-3.5 py-2.5 text-sm text-kumo-default ring ring-kumo-line transition-[box-shadow] outline-none placeholder:text-kumo-subtle focus:ring-[1.5px] focus:ring-kumo-focus"
                />
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  disabled={loading}
                >
                  <Camera className="h-4 w-4" />
                  {loading ? '截图中' : '截图'}
                </Button>
              </div>
              <Checkbox
                label="整页截图"
                checked={fullPage}
                onCheckedChange={setFullPage}
              />
            </LayerCard.Primary>
          </LayerCard>
        </form>

        {error
          ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                {error}
              </p>
            )
          : null}

        <ResultFrame loading={loading}>
          {imgUrl
            ? (
                <figure className="flex flex-col gap-3">
                  <img
                    src={imgUrl}
                    alt="Screenshot result"
                    className="img-outline w-full rounded-xl"
                  />
                  <figcaption className="flex items-center justify-between text-sm text-kumo-subtle">
                    {ms !== null
                      ? (
                          <span>
                            耗时
                            {' '}
                            <span className="tnum font-medium text-kumo-default">
                              {(ms / 1000).toFixed(2)}
                              s
                            </span>
                          </span>
                        )
                      : (
                          <span />
                        )}
                    <a
                      href={imgUrl}
                      download="screenshot.png"
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-kumo-subtle transition-colors hover:text-kumo-default active:scale-[0.96]"
                    >
                      <Download className="h-4 w-4" />
                      下载图片
                    </a>
                  </figcaption>
                </figure>
              )
            : null}
        </ResultFrame>
      </div>
    </div>
  )
}

function ResultFrame({
  loading,
  children,
}: {
  loading: boolean
  children: React.ReactNode
}) {
  const hasContent = Boolean(children) && !loading

  if (loading) {
    return (
      <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
        <div className="flex flex-col items-center gap-3 text-kumo-subtle">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-kumo-fill border-t-orange-500" />
          <span className="text-sm">处理中</span>
        </div>
      </div>
    )
  }

  if (!hasContent) {
    return (
      <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
        <div className="flex flex-col items-center gap-2 text-kumo-subtle">
          <ImageIcon className="h-7 w-7" strokeWidth={1.75} />
          <span className="text-sm">你的截图将显示在这里</span>
        </div>
      </div>
    )
  }

  return <div className="rounded-xl">{children}</div>
}
