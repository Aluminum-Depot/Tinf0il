// ─────────────────────────────────────────────────────────────────────────────
// Live-stream embed domain configuration — the ONE place to change this.
//
// These mirror domains get taken down / rotated by their operators every so
// often (DNS stops resolving and the iframes go blank). When that happens you
// have two ways to recover, neither of which needs touching the player code:
//
//   1. (no redeploy) Set the env var NEXT_PUBLIC_SPORTS_EMBED_DOMAINS to a
//      comma-separated list, newest first. e.g.
//          NEXT_PUBLIC_SPORTS_EMBED_DOMAINS="embednew.top,embedstreams.top"
//
//   2. (code) Add the new domain to the front of DEFAULT_EMBED_DOMAINS below.
//
// At runtime the /api/sports/embed-domain route probes this list in order and
// serves the first domain that's actually alive, so as long as the new domain
// is in the list the site fails over to it automatically — no manual switch.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_EMBED_DOMAINS = [
  "embed.st",         // current (verified live 2026-09-17)
  "embedstreams.top", // previous — DNS dead, kept in case it returns
  "embedsports.top",  // older — DNS dead
]

// The streamed API reports the live embed host in each stream's embedUrl. The
// /api/sports/embed-domain route asks it first, so future rotations are picked
// up automatically without touching the list above.
export const STREAMED_API_BASES = ["https://streamed.pk", "https://streamed.su"]

const ENV_EMBED_DOMAINS = (process.env.NEXT_PUBLIC_SPORTS_EMBED_DOMAINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean)

// Ordered list of candidate domains (env override wins, else built-in defaults).
export const EMBED_DOMAINS = ENV_EMBED_DOMAINS.length ? ENV_EMBED_DOMAINS : DEFAULT_EMBED_DOMAINS

// Preferred domain to use before/without runtime health resolution.
export const DEFAULT_EMBED_DOMAIN = EMBED_DOMAINS[0]

// Build an admin embed URL for a given slug + stream number on a given domain.
export function adminEmbedUrl(slug, stream, domain = DEFAULT_EMBED_DOMAIN) {
  return `https://${domain}/embed/admin/${slug}/${stream}`
}
