// Cloudflare Worker — sports relay for 1MMUN3 TV
// Deploy at: https://workers.cloudflare.com
// After deploying, set NEXT_PUBLIC_SPORTS_RELAY=<your-worker-url> in Heroku config vars.

export default {
  async fetch(request) {
    const res = await fetch("https://ntvs.cx/api/get-matches?server=kobra&type=both", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://ntvs.cx/",
        "Origin": "https://ntvs.cx",
      },
    })

    const body = await res.text()

    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    })
  },
}
