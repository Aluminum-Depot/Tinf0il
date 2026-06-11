import { DEFAULT_EMBED_DOMAIN } from "./sportsConfig"

// Set NEXT_PUBLIC_SPORTS_RELAY to a Cloudflare Worker URL to bypass server IP blocks.
// Worker code: https://github.com/Aluminum-Depot/Tinf0il#sports-relay
const RELAY = process.env.NEXT_PUBLIC_SPORTS_RELAY

async function fetchNtvsData() {
  // If a relay URL is configured, use it (runs on CF edge — not blocked by ntvs.cx)
  if (RELAY) {
    const relayUrl = RELAY.startsWith("http") ? RELAY : `https://${RELAY}`
    const res = await fetch(relayUrl)
    if (res.ok) {
      const data = await res.json()
      if (data.success) return data
    }
  }

  // Direct browser fetch (works if ntvs.cx allows CORS from this origin)
  try {
    const res = await fetch("https://ntvs.cx/api/get-matches?server=kobra&type=both", {
      headers: { Accept: "application/json" },
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success) return data
    }
  } catch {}

  // Last resort: server-side proxy (will 403 on cloud hosts with blocked IPs)
  const res = await fetch("/api/sports/live")
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `server ${res.status}`)
  if (!data.success) throw new Error("API returned failure")
  return data
}

export async function getNtvsEvents() {
  const data = await fetchNtvsData()

  const liveIds = new Set((data.live || []).map(e => e.id))
  const all = data.all || []

  const live = all.filter(e => liveIds.has(e.id))
  const nonLive = all.filter(e => !liveIds.has(e.id))

  return { live, nonLive }
}

export function buildEmbedUrls(event, embedDomain = DEFAULT_EMBED_DOMAIN) {
  const results = []

  for (const s of event.sources || []) {
    if (s.source === "admin") {
      results.push({
        label: "Stream",
        type: "iframe",
        urls: [1, 2, 3].map(n => `https://${embedDomain}/embed/admin/${s.id}/${n}`),
      })
    } else if (s.source === "echo") {
      // echo source IDs don't map predictably to pooembed slugs —
      // embed the ntvs.cx watch page directly instead (no X-Frame-Options)
      results.push({
        label: "Alt Stream",
        type: "iframe",
        urls: [`https://ntvs.cx/watch/kobra/${event.id}`],
      })
    }
  }

  return results
}

export function getBadgeUrl(encoded) {
  if (!encoded) return null
  return `/tv/api/sports/badge?e=${encodeURIComponent(encoded)}`
}

export function formatEventTime(dateMs) {
  return new Date(dateMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export function formatEventDate(dateMs) {
  const d = new Date(dateMs)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const isPast = d < now
  if (isPast) return "In Progress"
  if (isToday) return `Today · ${formatEventTime(dateMs)}`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + formatEventTime(dateMs)
}

export const CATEGORY_ORDER = [
  "fight", "mma", "boxing", "wrestling",
  "rugby", "afl",
  "football", "soccer",
  "basketball", "baseball", "hockey",
  "cricket", "tennis", "golf",
  "motor-sports", "cycling",
  "other",
]

export function sortedCategories(events) {
  const grouped = {}
  for (const e of events) {
    const cat = e.category || "other"
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(e)
  }
  const ordered = CATEGORY_ORDER.filter(c => grouped[c])
  const rest = Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)).sort()
  return [...ordered, ...rest].map(cat => ({ cat, events: grouped[cat] }))
}
