"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getNtvsEvents, buildEmbedUrls, formatEventDate } from "@/lib/ntvsApi"
import { DEFAULT_EMBED_DOMAIN } from "@/lib/sportsConfig"

const SportsPlayer = ({ id }) => {
  const [event, setEvent] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sourceIndex, setSourceIndex] = useState(0)
  const [streamIndex, setStreamIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [embedDomain, setEmbedDomain] = useState(DEFAULT_EMBED_DOMAIN)
  const [isIOS, setIsIOS] = useState(false)

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // iOS (iPhone/iPad) — incl. Chrome/Firefox on iOS, which are all WebKit —
  // can't play these embeds: the providers use MSE/hls.js with origin-locked
  // HLS, which iOS native playback rejects. Detect it to show a clear notice
  // instead of the provider's cryptic player error.
  useEffect(() => {
    const ua = navigator.userAgent || ""
    const iOS = /iPhone|iPad|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) // iPadOS 13+
    setIsIOS(iOS)
  }, [])

  // Resolve the currently-live embed mirror so streams keep working when a
  // domain's DNS dies (see lib/sportsConfig.js). Falls back to the default.
  useEffect(() => {
    fetch("/tv/api/sports/embed-domain")
      .then(res => res.json())
      .then(data => { if (data?.domain) setEmbedDomain(data.domain) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    getNtvsEvents()
      .then(({ live, nonLive }) => {
        const all = [...live, ...nonLive]
        const found = all.find(e => String(e.id) === String(id))
        setEvent(found || null)
        if (!found) setError(`Event ID "${id}" not in API response (${all.length} events loaded)`)
      })
      .catch(e => setError(e?.message || "Failed to load events"))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="aspect-video w-full bg-[#22212c] rounded-md animate-pulse" />

  if (!event) return (
    <div className="flex flex-col items-center justify-center py-32 text-slate-500 gap-3">
      <span className="text-5xl">📡</span>
      <span className="text-lg font-medium">Event not found</span>
      {error && <span className="text-xs text-slate-600 font-mono">{error}</span>}
      <Link href="/sports" className="text-sm hover:text-slate-300 transition-colors">← Back to Live Sports</Link>
    </div>
  )

  const sources = buildEmbedUrls(event, embedDomain)
  const activeSource = sources[sourceIndex]
  const embedUrl = activeSource?.urls[streamIndex]

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="bg-[#22212c] rounded-md p-2 !pb-0">
        {isIOS ? (
          <div className="aspect-video w-full bg-[#1a1929] rounded-sm flex flex-col items-center justify-center text-center gap-3 px-6">
            <span className="text-4xl">📱</span>
            <span className="text-slate-200 text-base font-medium">Live streams don't play on iPhone or iPad</span>
            <span className="text-slate-400 text-sm max-w-md leading-relaxed">
              Apple's mobile browsers (including Chrome and Firefox on iOS) can't play these streams.
              Please open this page on a computer, or on an Android device, to watch.
            </span>
          </div>
        ) : embedUrl ? (
          <iframe
            key={embedUrl}
            src={embedUrl}
            className="aspect-video w-full z-30"
            allowFullScreen
            loading="lazy"
            frameBorder="0"
            referrerPolicy="no-referrer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={event.title}
          />
        ) : (
          <div className="aspect-video w-full bg-[#1a1929] flex items-center justify-center text-slate-500">
            No stream available for this event
          </div>
        )}

        {!isIOS && sources.length > 0 && (
          <div className="bg-[#323044] w-full px-4 py-2 mt-2 flex items-center gap-6 flex-wrap">
            {sources.map((src, si) => (
              <div key={si} className="flex items-center gap-2">
                <span className="text-[13px] text-slate-400">{src.label}</span>
                {src.urls.map((_, ni) => (
                  <button
                    key={ni}
                    onClick={() => { setSourceIndex(si); setStreamIndex(ni) }}
                    className="px-4 py-[5px] text-[14px] rounded-md border border-[#5b5682] cursor-pointer transition-colors"
                    style={{ background: sourceIndex === si && streamIndex === ni ? "#4a446c" : "#413d57" }}
                  >
                    {ni + 1}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {!isIOS && (
          <div className="bg-[#2a2838] px-4 py-2 flex items-center gap-2 text-amber-400/80 text-xs mb-2">
            <span>⚠</span>
            <span>If the stream shows an error, try a different stream number above.</span>
          </div>
        )}
      </div>

      <div className="bg-[#22212c] rounded-md px-6 py-5 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="text-xl font-medium font-['poppins'] text-[#ffffffbd]">{event.title}</div>
          <div className="text-[13px] font-['poppins'] text-[#5c5c6e] capitalize">{event.category?.replace(/-/g, " ")}</div>
          <div className="text-[13px] font-['poppins'] text-[#5c5c6e]">{formatEventDate(event.date)}</div>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-3 py-[6px] rounded-md border border-[#5b5682] text-[13px] font-['poppins'] text-slate-300 hover:bg-[#4a446c] transition-colors shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
          </svg>
          {copied ? <span style={{ color: "var(--accent)" }}>Copied!</span> : "Share"}
        </button>
      </div>

      <Link href="/sports" className="text-sm text-slate-500 hover:text-slate-300 transition-colors mt-1">
        ← Back to Live Sports
      </Link>
    </div>
  )
}

export default SportsPlayer
