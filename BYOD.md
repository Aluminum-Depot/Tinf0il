# How to BYOD (Bring Your Own Domain) to Tinf0il

Point a domain you own at Tinf0il and get your own private link, with HTTPS set
up automatically. Takes about five minutes.

---

## 1. Get a domain

**Recommended — buy one.** A real domain is far less likely to be blocked than a
free one, it's yours alone, and nobody else's behaviour can get it filtered.
First-year prices are often under $2.

- https://porkbun.com/ (cheapest for most TLDs — check online for coupon codes)
- https://www.namecheap.com/
- https://www.ionos.com/
- https://www.godaddy.com/

**Free alternative — FreeDNS.** https://freedns.afraid.org/ gives you a subdomain
of a shared domain at no cost. It works, but shared domains get blocked far more
often, because a filter blocking one person's link blocks everyone's.

If you go free, pick a shared domain that appears on the Public Suffix List
(https://publicsuffix.org/list/) — `mooo.com`, `crabdance.com`, `us.to`. Those get
their own certificate quota. On a domain that isn't listed, you share one weekly
certificate limit with every stranger using it, and issuing can just stop.

---

## 2. Sign in to Tinf0il

Domains are tied to your account, so you can check on them later.

Go to https://tinf0il.site/settings and sign in (or create an account) from the
button in the top right.

---

## 3. Claim your domain

Still on https://tinf0il.site/settings — the **custom domain** panel is at the top
of the page.

Type your domain in and press **claim it**. You'll get back a **DNS target** that
looks something like:

```
amorphous-okra-hlrccn5gi7amb98iu3cmgdpr.herokudns.com
```

Copy it. That value is unique to your domain — don't use one from a screenshot or
from someone else.

---

## 4. Point your domain at it

Go to your registrar's DNS settings and add **one** record.

**For a subdomain** like `go.yourdomain.com` — the easy option:

- Type: `CNAME`
- Name / Host: `go` (or `www`, or whatever you like)
- Value / Target: the DNS target from step 3

**For the bare domain** like `yourdomain.com` with no prefix:

- Type: `ALIAS` or `ANAME` (**not** CNAME — the DNS standard forbids CNAME here)
- Name / Host: `@`
- Value / Target: the DNS target from step 3

Porkbun and Cloudflare both support ALIAS/ANAME. Many registrars don't — if yours
doesn't offer it, use a subdomain instead.

**On FreeDNS:** Subdomains → Add a subdomain → Type `CNAME`, fill in your
subdomain, and paste the DNS target as the Destination.

> **Paste the hostname only** — no `https://`, no trailing slash, no path.
>
> **Do not use "URL forwarding" / "redirect" / "cloaking".** Those serve the site
> inside a frame, which breaks the proxy, your login, and your saved settings.

---

## 5. Wait

That's it. HTTPS is issued automatically — there is nothing to configure and no
certificate to install.

Your link usually goes live within a few minutes, though DNS can take up to an
hour to spread.

Check progress any time under **your domains** in that same settings panel. It
shows whether your record has been detected and whether your certificate is ready.

---

## Troubleshooting

**Still shows "waiting for dns"**
The record hasn't spread yet. Give it up to an hour. Double-check you used the
exact DNS target from step 3, with no `https://` and no trailing slash.

**"That domain is already in use elsewhere"**
Someone else already has it registered. If it's genuinely yours and you moved it
from another host, remove it there first.

**"You've claimed 3 domains this hour"**
That's the limit per account per hour. Re-entering a domain you already claimed
doesn't count toward it — that's just checking status.

**The site loads for everyone else but times out for you**
Try it in a private/incognito window. If it works there, an extension in your
normal browser is blocking it — school and "study helper" extensions often filter
proxy domains. Turn extensions off one at a time to find it.

**I never pointed it and now it's gone**
Domains that are never pointed at Tinf0il are released after 24 hours to free up
space. Just claim it again. Once your link is live it stays.

---

## Share it

Once your link works, post it in this channel so others can use it. Sharing it
doesn't slow your link down at all.
