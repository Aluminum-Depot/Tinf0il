# A guide on how to BYOD (Bring Your Own Domain) to Tinf0il

**FreeDNS domains now work.** You no longer need to buy a domain, make a Cloudflare
account, or touch nameservers. One DNS record is the whole setup.

---

## 1. Get a domain

**Free — recommended:** [FreeDNS](https://freedns.afraid.org/) lets you create a
subdomain on a shared domain at no cost. Register, then open
[the shared domain list](https://freedns.afraid.org/domain/registry/).

> **Pick your shared domain carefully.** Certificates are rate-limited per
> *registered domain*, and on a shared FreeDNS domain you share that limit with
> every stranger using it. Prefer a domain on the
> [Public Suffix List](https://publicsuffix.org/list/) — those are limited per
> *subdomain* instead, so you get your own quota. `mooo.com`, `crabdance.com`,
> `us.to`, and `strangled.net` are usually on it. If your link doesn't go live,
> a crowded shared domain is the likeliest reason — try another one.

**Paid:** any registrar works — [Porkbun](https://porkbun.com/),
[Namecheap](https://www.namecheap.com/), [IONOS](https://www.ionos.com/).

---

## 2. Register your domain with Tinf0il

Go to **https://tinf0il.site/settings** — the **custom domain** panel is at the
top. Enter the domain you just created, and
submit. You'll get back a **DNS target** unique to your domain, looking something
like `salty-coconut-974s6k9xglor8s8wivf67c2n.herokudns.com`.

Copy it — you need it in the next step.

---

## 3. Create the DNS record

**On FreeDNS:** go to [Subdomains](https://freedns.afraid.org/subdomain/) →
`Add a subdomain`, and set:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Subdomain | the one you chose (e.g. `meals`) |
| Domain | your chosen shared domain |
| Destination | the DNS target from step 2 |

**On a registrar:** add a `CNAME` record with host `www` pointing to your DNS
target. (Apex domains — `example.com` with no `www` — need an `ALIAS` or `ANAME`
record instead; Porkbun and Cloudflare both support this, many registrars don't.)

Then click **Save**.

> Destination is a **hostname only** — no `https://`, no trailing slash, no path.
> Do **not** use the "Forward to a URL" option: URL forwarding serves your site
> inside a frame, which breaks the proxy, your login, and your saved settings.

> Register your domain **before** setting the CNAME. The target is generated when
> you register, so there's nothing to point at until step 2 is done.

---

## 4. Wait

That's it. Your link goes live on its own, usually within a few minutes, though
DNS can take up to an hour to propagate. HTTPS is set up automatically — there is
nothing to configure.

You can check progress any time at **https://tinf0il.site/settings** — it will
tell you whether your CNAME is detected and whether your certificate has been
issued yet.

> **Don't delete the record once it works.** If your domain stops pointing at
> Tinf0il for more than a day, it gets released automatically and you'll have to
> register it again.

---

## Troubleshooting

**I see a "Welcome! ... is being shared via Free DNS" page**
Your computer cached the old DNS answer. Run `ipconfig /flushdns` (Windows) or
`sudo dscacheutil -flushcache` (Mac), clear Chrome's cache at
`chrome://net-internals/#dns`, then hard-reload with `Ctrl+Shift+R`. Or just wait
an hour.

**Certificate warning, or the page won't load over HTTPS**
Check the custom domain panel on https://tinf0il.site/settings. If it says your CNAME isn't detected, the
record is wrong or hasn't propagated. If the CNAME is detected but the
certificate is still pending after ~30 minutes, your shared domain has likely hit
its certificate limit — see the note in step 1 and try a different one.

**It only works on `http://`**
Always use `https://`. The proxy cannot run without it.

---

## Contribute to the community

If you want to help others, post your link publicly in <#1194418751177769010> so
anyone can use it. This will not affect the performance of your link at all.
