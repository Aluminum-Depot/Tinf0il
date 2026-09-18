import { EMBED_DOMAINS, DEFAULT_EMBED_DOMAIN, STREAMED_API_BASES } from "@/lib/sportsConfig"

// Resolves the first *live* embed mirror so the player fails over automatically
// when a domain's DNS dies. Result is cached in-memory so we don't probe on
// every request.
export const dynamic = "force-dynamic"

const TTL_MS = 5 * 60 * 1000
let cache = { domain: null, ts: 0 }

async function isAlive(domain) {
  try {
    const res = await fetch(`https://${domain}/`, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    })
    // Any HTTP response means DNS resolves and the server is up. A dead mirror
    // (the failure mode we care about) throws on DNS/connection instead.
    return res.status < 500
  } catch {
    return false
  }
}

// Ask the streamed API which host it currently hands out in embedUrl. This is
// the source of truth — parked mirrors (e.g. embedme.top) still answer HTTP 200
// and would fool the plain liveness probe below.
async function discoverFromApi() {
  const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  for (const base of STREAMED_API_BASES) {
    try {
      const matches = await fetch(`${base}/api/matches/live`, { headers, signal: AbortSignal.timeout(6000) }).then(r => r.json())
      for (const m of matches.slice(0, 5)) {
        const src = m.sources?.[0]
        if (!src) continue
        const streams = await fetch(`${base}/api/stream/${src.source}/${src.id}`, { headers, signal: AbortSignal.timeout(6000) }).then(r => r.json())
        const url = streams?.[0]?.embedUrl
        if (url) return new URL(url).hostname
      }
    } catch {}
  }
  return null
}

export async function GET() {
  const now = Date.now()
  if (cache.domain && now - cache.ts < TTL_MS) {
    return Response.json({ domain: cache.domain, cached: true })
  }

  const discovered = await discoverFromApi()
  if (discovered) {
    cache = { domain: discovered, ts: now }
    return Response.json({ domain: discovered, cached: false, source: "api" })
  }

  for (const domain of EMBED_DOMAINS) {
    if (await isAlive(domain)) {
      cache = { domain, ts: now }
      return Response.json({ domain, cached: false })
    }
  }

  // None responded — hand back the preferred default and don't cache the miss,
  // so the next request re-probes (a mirror may have just come back up).
  return Response.json({ domain: DEFAULT_EMBED_DOMAIN, cached: false, healthy: false })
}
