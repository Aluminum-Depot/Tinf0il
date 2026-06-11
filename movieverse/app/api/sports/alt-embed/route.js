// The "Alt Stream" used to embed the entire ntvs.cx watch page, which on mobile
// only showed the page header (the player sits below the fold and iOS can't
// scroll inside an iframe). The watch page loads its actual player from an inner
// `ntvs.cx/embed?t=<token>` iframe — that endpoint renders the player full-frame
// and embeds cleanly from any origin. This route fetches the watch page and
// pulls out that token so we can embed the player directly instead of the whole
// site. Token is AES-encrypted by ntvs.cx, so it can only be lifted, not built.
export const dynamic = "force-dynamic"

const WATCH_BASE = "https://ntvs.cx/watch/kobra/"
const EMBED_BASE = "https://ntvs.cx/embed?t="

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return Response.json({ url: null, error: "missing id" }, { status: 400 })

  try {
    const res = await fetch(WATCH_BASE + encodeURIComponent(id), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return Response.json({ url: null, error: `watch ${res.status}` })

    const html = await res.text()
    // First token = the default (Kobra) stream shown by the watch page.
    const m = html.match(/\/embed\?t=([A-Za-z0-9+/=_-]+)/)
    if (!m) return Response.json({ url: null, error: "no token" })

    return Response.json({ url: EMBED_BASE + m[1] })
  } catch (e) {
    return Response.json({ url: null, error: String(e?.message || e) })
  }
}
