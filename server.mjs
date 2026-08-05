import express from "express";
import { spawn } from "node:child_process";
import dns from "node:dns/promises";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrap } from "./lib/bootstrap-server.js";

/** Default 8787 avoids common Apache/httpd on 8080. Override with PORT (no auto-fallback if set). */
const preferredPort = Number(process.env.PORT) || 8787;
const portLocked = Boolean(process.env.PORT);

const META_MAX_BYTES = 450_000;
const META_FETCH_MS = 10_000;
const TV_PROXY_FETCH_MS = 20_000;
const TV_APP_FETCH_MS = 30_000;
const TV_APP_ORIGIN = process.env.TV_APP_ORIGIN || process.env.TV_NEXT_ORIGIN || "http://127.0.0.1:8791";
const TV_APP_AUTOSTART = process.env.TV_APP_AUTOSTART !== "0" && process.env.TV_NEXT_AUTOSTART !== "0";
const TV_APP_URL = new URL(TV_APP_ORIGIN);
const TV_APP_PORT = Number(process.env.TV_APP_PORT || process.env.TV_NEXT_PORT || TV_APP_URL.port || 3000);
const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const TV_APP_DIR = path.join(repoRoot, "movieverse");

/** Public IPs of this edge. Caddy only issues a cert for a hostname that resolves here. */
const EDGE_IPS = new Set(
	(process.env.EDGE_IPS || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
);
const TLS_ALLOW_TTL_OK = 6 * 60 * 60 * 1000;
const TLS_ALLOW_TTL_DENY = 60 * 1000;

const HEROKU_API_KEY = process.env.HEROKU_API_KEY || "";
const HEROKU_APP = process.env.HEROKU_APP_NAME || "";
/** Hostnames users may never claim. */
const RESERVED_SUFFIX = "tinf0il.site";
/** An unconfirmed domain holds a slot in the app's domain quota; reap it after this. */
const DOMAIN_GRACE_MS = 24 * 60 * 60 * 1000;
const DOMAIN_REAP_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Public web API key, same one the client uses. Enables account-keyed limits. */
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "";
/** Successful claims per signed-in account per hour. */
const DOMAIN_CLAIM_LIMIT = 3;
/**
 * Attempts per IP per hour. Only a coarse anti-hammering backstop — a whole
 * school shares one address, so this must stay well clear of real usage.
 */
const DOMAIN_ATTEMPT_LIMIT = 120;
const DOMAIN_RATE_WINDOW_MS = 60 * 60 * 1000;
/** Ceiling on unconfirmed domains, so nobody can fill the app's domain quota. */
const MAX_PENDING_DOMAINS = 50;
const TV_PROXY_HEADER_MAP = {
	"x-cookie": "cookie",
	"x-referer": "referer",
	"x-origin": "origin",
	"x-user-agent": "user-agent",
	"x-x-real-ip": "x-real-ip",
};
const TV_PROXY_DIRECT_HEADERS = new Set([
	"accept",
	"accept-language",
	"authorization",
	"cache-control",
	"content-type",
	"pragma",
	"range",
	"x-requested-with",
]);
const TV_PROXY_BLOCKED_HEADERS = new Set([
	"connection",
	"content-length",
	"host",
	"sec-fetch-dest",
	"sec-fetch-mode",
	"sec-fetch-site",
	"sec-fetch-user",
	"upgrade-insecure-requests",
]);
const TV_APP_RESPONSE_BLOCKED_HEADERS = new Set([
	"connection",
	"content-encoding",
	"content-length",
	"keep-alive",
	"transfer-encoding",
	"upgrade",
]);
const TV_PROXY_PUBLIC_PATH = "/api/tv-proxy";

function decodeBasicEntities(s) {
	return s
		.replaceAll(/\s+/g, " ")
		.replaceAll(/&nbsp;/gi, " ")
		.replaceAll("&amp;", "&")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replaceAll(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(Number.parseInt(h, 16)))
		.trim();
}

function absolutize(href, baseUrl, docBase) {
	if (!href || href.startsWith("data:") || href.startsWith("javascript:")) return null;
	try {
		return new URL(href, docBase || baseUrl).href;
	} catch {
		return null;
	}
}

function googleFavicon(hostname) {
	return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}

function parseTabMeta(html, finalUrl) {
	const pageUrl = new URL(finalUrl);
	const baseMatch = /<base[^>]+href\s*=\s*["']([^"']+)["']/i.exec(html);
	const docBase = baseMatch ? absolutize(baseMatch[1], pageUrl.href, pageUrl.href) : pageUrl.href;

	let title = "";
	const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
	if (titleMatch) title = decodeBasicEntities(titleMatch[1]).slice(0, 240);

	let iconHref = null;
	const linkRe = /<link\b[^>]*>/gi;
	let m;
	while ((m = linkRe.exec(html)) !== null) {
		const tag = m[0];
		const rel = /\brel\s*=\s*["']([^"']+)["']/i.exec(tag);
		if (!rel) continue;
		const r = rel[1].toLowerCase();
		if (!r.includes("icon") && r !== "shortcut icon" && !r.includes("apple-touch")) continue;
		const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
		if (!href) continue;
		const abs = absolutize(href[1], pageUrl.href, docBase);
		if (abs) {
			iconHref = abs;
			break;
		}
	}

	if (!iconHref) {
		iconHref = new URL("/favicon.ico", docBase).href;
	}

	const iconUrl = iconHref;
	const hostname = pageUrl.hostname;
	return {
		title: title || hostname,
		iconUrl,
		fallbackIconUrl: googleFavicon(hostname),
		hostname,
	};
}

function headerValue(value) {
	if (Array.isArray(value)) return value.join(", ");
	if (typeof value === "string") return value;
	return undefined;
}

function collectTvProxyHeaders(req) {
	const headers = {};
	for (const [name, rawValue] of Object.entries(req.headers)) {
		const value = headerValue(rawValue);
		if (!value) continue;
		const mapped = TV_PROXY_HEADER_MAP[name];
		if (mapped) {
			headers[mapped] = value;
			continue;
		}
		if (TV_PROXY_DIRECT_HEADERS.has(name) || (name.startsWith("x-") && !TV_PROXY_BLOCKED_HEADERS.has(name))) {
			headers[name] = value;
		}
	}
	if (!headers["user-agent"]) {
		headers["user-agent"] =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
	}
	return headers;
}

function tvProxyDestinationUrl(destination) {
	return `${TV_PROXY_PUBLIC_PATH}?destination=${encodeURIComponent(destination)}`;
}

function rewriteM3u8Uri(uri, baseUrl) {
	try {
		return tvProxyDestinationUrl(new URL(uri, baseUrl).href);
	} catch {
		return uri;
	}
}

function rewriteM3u8Line(line, baseUrl) {
	const trimmed = line.trim();
	if (!trimmed) return line;
	if (trimmed.startsWith("#")) {
		return line
			.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${rewriteM3u8Uri(uri, baseUrl)}"`)
			.replace(/URI='([^']+)'/g, (_match, uri) => `URI='${rewriteM3u8Uri(uri, baseUrl)}'`)
			.replace(/URI=(?!["'])([^,\s]+)/g, (_match, uri) => `URI=${rewriteM3u8Uri(uri, baseUrl)}`);
	}

	const leading = line.match(/^\s*/)?.[0] || "";
	const trailing = line.match(/\s*$/)?.[0] || "";
	return `${leading}${rewriteM3u8Uri(trimmed, baseUrl)}${trailing}`;
}

function looksLikeM3u8(destination, contentType, buf) {
	if (contentType && /mpegurl|m3u8/i.test(contentType)) return true;
	const prefix = buf.subarray(0, 32).toString("utf8").trimStart();
	return prefix.startsWith("#EXTM3U");
}

function rewriteM3u8Manifest(buf, baseUrl) {
	const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
	const newline = text.includes("\r\n") ? "\r\n" : "\n";
	return Buffer.from(text.split(/\r?\n/).map((line) => rewriteM3u8Line(line, baseUrl)).join(newline), "utf8");
}

async function readRequestBody(req) {
	const chunks = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}

function collectTvAppHeaders(req) {
	const headers = {};
	for (const [name, rawValue] of Object.entries(req.headers)) {
		if (TV_PROXY_BLOCKED_HEADERS.has(name)) continue;
		const value = headerValue(rawValue);
		if (value) headers[name] = value;
	}
	const publicHost = headerValue(req.headers.host);
	if (publicHost) {
		headers["x-forwarded-host"] = publicHost;
		headers["x-forwarded-proto"] = "http";
	}
	return headers;
}

async function proxyTvAppRequest(req, res) {
	const target = new URL(req.originalUrl, TV_APP_ORIGIN);
	const ctrl = new AbortController();
	const timeout = setTimeout(() => ctrl.abort(), TV_APP_FETCH_MS);
	try {
		const hasBody = req.method !== "GET" && req.method !== "HEAD";
		const body = hasBody ? await readRequestBody(req) : undefined;
		const upstream = await fetch(target.href, {
			method: req.method,
			redirect: "manual",
			headers: collectTvAppHeaders(req),
			body: body && body.length > 0 ? body : undefined,
			signal: ctrl.signal,
		});
		const buf = req.method === "HEAD" ? Buffer.alloc(0) : Buffer.from(await upstream.arrayBuffer());
		clearTimeout(timeout);

		res.status(upstream.status);
		upstream.headers.forEach((value, name) => {
			if (!TV_APP_RESPONSE_BLOCKED_HEADERS.has(name)) res.setHeader(name, value);
		});
		const getSetCookie = upstream.headers.getSetCookie;
		const setCookie =
			typeof getSetCookie === "function"
				? getSetCookie.call(upstream.headers)
				: upstream.headers.get("set-cookie");
		if (setCookie) res.setHeader("set-cookie", setCookie);
		res.end(buf);
	} catch (e) {
		clearTimeout(timeout);
		const msg = e?.name === "AbortError" ? "tinf0il TV timed out" : "tinf0il TV is not running";
		res.status(502).send(msg);
	}
}

function applyTvProxyCors(res) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "*");
	res.setHeader(
		"Access-Control-Expose-Headers",
		"X-Final-Destination, X-Set-Cookie, X-Content-Type, X-Content-Length, X-Location, Content-Range, Accept-Ranges",
	);
}

const app = express();

/** Behind Caddy: honour X-Forwarded-* so req.ip and req.protocol stay accurate. */
app.set("trust proxy", true);

let tvAppChild = null;

function hasTvAppInstalled() {
	return fs.existsSync(path.join(TV_APP_DIR, "package.json")) &&
		fs.existsSync(path.join(TV_APP_DIR, "node_modules", "next", "dist", "bin", "next"));
}

async function isTvAppReachable() {
	const ctrl = new AbortController();
	const timeout = setTimeout(() => ctrl.abort(), 1_500);
	try {
		const res = await fetch(new URL("/tv/", TV_APP_ORIGIN), {
			method: "HEAD",
			redirect: "manual",
			signal: ctrl.signal,
		});
		clearTimeout(timeout);
		return res.status < 500;
	} catch {
		clearTimeout(timeout);
		return false;
	}
}

async function ensureTvAppServer() {
	if (!TV_APP_AUTOSTART || !["localhost", "127.0.0.1"].includes(TV_APP_URL.hostname)) return;
	if (!hasTvAppInstalled()) {
		console.warn("tinf0il TV: run `npm install` inside movieverse/ to enable /tv/.");
		return;
	}
	if (await isTvAppReachable()) return;

	const nextCli = path.join(TV_APP_DIR, "node_modules", "next", "dist", "bin", "next");
	const hasBuild = fs.existsSync(path.join(TV_APP_DIR, ".next", "BUILD_ID"));
	const nextArgs = hasBuild
		? ["start", "--hostname", "127.0.0.1", "--port", String(TV_APP_PORT)]
		: ["dev", "--turbo", "--hostname", "127.0.0.1", "--port", String(TV_APP_PORT)];

	const out = fs.openSync(path.join(TV_APP_DIR, "movieverse.out.log"), "a");
	const err = fs.openSync(path.join(TV_APP_DIR, "movieverse.err.log"), "a");

	tvAppChild = spawn(process.execPath, [nextCli, ...nextArgs], {
		cwd: TV_APP_DIR,
		env: { ...process.env, PORT: String(TV_APP_PORT) },
		stdio: ["ignore", out, err],
		windowsHide: true,
	});
	tvAppChild.on("exit", (code, signal) => {
		if (code !== 0 && signal !== "SIGTERM") {
			console.warn(`tinf0il TV stopped unexpectedly (${signal || code}).`);
		}
		tvAppChild = null;
	});
	console.log(`tinf0il TV (Next.js ${hasBuild ? "prod" : "dev"}): ${TV_APP_ORIGIN}/tv/`);
}

function stopTvAppServer() {
	if (tvAppChild && !tvAppChild.killed) tvAppChild.kill();
}

process.once("exit", stopTvAppServer);
process.once("SIGINT", () => {
	stopTvAppServer();
	process.exit(130);
});
process.once("SIGTERM", () => {
	stopTvAppServer();
	process.exit(143);
});

app.get("/api/sports/live", async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=30");

	const relay = process.env.SPORTS_RELAY || process.env.NEXT_PUBLIC_SPORTS_RELAY;

	// Try CF Worker relay first (bypasses ntvs.cx IP block on cloud hosts)
	if (relay) {
		try {
			const relayUrl = relay.startsWith("http") ? relay : `https://${relay}`;
			const r = await fetch(relayUrl);
			if (r.ok) {
				const data = await r.json();
				if (data.success) return res.json(data);
			}
		} catch {}
	}

	// Direct fetch fallback
	try {
		const r = await fetch("https://ntvs.cx/api/get-matches?server=kobra&type=both", {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				"Accept": "application/json, text/plain, */*",
				"Accept-Language": "en-US,en;q=0.9",
				"Origin": "https://ntvs.cx",
				"Referer": "https://ntvs.cx/",
			},
		});
		const text = await r.text();
		if (!r.ok) {
			return res.status(502).json({ success: false, error: `ntvs ${r.status}`, body: text.slice(0, 300) });
		}
		const data = JSON.parse(text);
		res.json(data);
	} catch (e) {
		res.status(502).json({ success: false, error: String(e) });
	}
});

app.options("/api/tv-proxy", (_req, res) => {
	applyTvProxyCors(res);
	res.status(204).end();
});

app.all("/api/tv-proxy", async (req, res) => {
	applyTvProxyCors(res);

	const raw = Array.isArray(req.query.destination)
		? req.query.destination[0]
		: req.query.destination;
	if (!raw || typeof raw !== "string") {
		res.status(400).json({ error: "missing destination" });
		return;
	}

	let destination;
	try {
		destination = new URL(raw);
	} catch {
		res.status(400).json({ error: "invalid destination" });
		return;
	}
	if (destination.protocol !== "http:" && destination.protocol !== "https:") {
		res.status(400).json({ error: "only http(s) URLs" });
		return;
	}

	const ctrl = new AbortController();
	const timeout = setTimeout(() => ctrl.abort(), TV_PROXY_FETCH_MS);
	try {
		const hasBody = req.method !== "GET" && req.method !== "HEAD";
		const body = hasBody ? await readRequestBody(req) : undefined;
		const upstream = await fetch(destination.href, {
			method: req.method,
			redirect: "follow",
			headers: collectTvProxyHeaders(req),
			body: body && body.length > 0 ? body : undefined,
			signal: ctrl.signal,
		});
		let buf = req.method === "HEAD" ? Buffer.alloc(0) : Buffer.from(await upstream.arrayBuffer());
		clearTimeout(timeout);

		const contentType = upstream.headers.get("content-type");
		const isPlaylist = req.method !== "HEAD" && looksLikeM3u8(destination, contentType, buf);
		if (isPlaylist) {
			buf = rewriteM3u8Manifest(buf, upstream.url || destination.href);
		}
		const contentLength = isPlaylist ? String(buf.length) : upstream.headers.get("content-length");
		const contentRange = upstream.headers.get("content-range");
		const acceptRanges = upstream.headers.get("accept-ranges");
		const location = upstream.headers.get("location");
		const getSetCookie = upstream.headers.getSetCookie;
		const setCookie =
			typeof getSetCookie === "function"
				? getSetCookie.call(upstream.headers).join(", ")
				: upstream.headers.get("set-cookie");

		res.status(upstream.status);
		res.setHeader("X-Final-Destination", upstream.url || destination.href);
		const responseContentType = isPlaylist
			? "application/vnd.apple.mpegurl; charset=utf-8"
			: contentType;
		if (responseContentType) {
			res.setHeader("Content-Type", responseContentType);
			res.setHeader("X-Content-Type", responseContentType);
		}
		if (contentLength) res.setHeader("X-Content-Length", contentLength);
		if (contentRange) res.setHeader("Content-Range", contentRange);
		if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
		if (location) res.setHeader("X-Location", location);
		if (setCookie) res.setHeader("X-Set-Cookie", setCookie);
		res.end(buf);
	} catch (e) {
		clearTimeout(timeout);
		const msg = e?.name === "AbortError" ? "timeout" : "fetch failed";
		res.status(502).json({ error: msg });
	}
});

app.all(/^\/tv(\/.*)?$/, (req, res, next) => {
	if (req.headers['sec-fetch-dest'] === 'document') {
		const html = getIndexHtml().replace("<!-- PAGE_META -->", buildMetaTags('tv'));
		res.setHeader("Content-Type", "text/html; charset=utf-8");
		return res.send(html);
	}
	proxyTvAppRequest(req, res).catch(next);
});

app.get("/api/tab-meta", async (req, res) => {
	const raw = req.query.url;
	if (!raw || typeof raw !== "string") {
		res.status(400).json({ error: "missing url" });
		return;
	}
	let u;
	try {
		u = new URL(raw.trim());
	} catch {
		try {
			u = new URL(`https://${raw.trim()}`);
		} catch {
			res.status(400).json({ error: "invalid url" });
			return;
		}
	}
	if (u.protocol !== "http:" && u.protocol !== "https:") {
		res.status(400).json({ error: "only http(s) URLs" });
		return;
	}

	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), META_FETCH_MS);
	try {
		const r = await fetch(u.href, {
			redirect: "follow",
			signal: ctrl.signal,
			headers: {
				Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
				"User-Agent":
					"Mozilla/5.0 (compatible; Tinf0ilTabMeta/1.0; +https://github.com/)",
			},
		});
		clearTimeout(t);
		if (!r.ok) {
			res.status(502).json({ error: `site returned ${r.status}` });
			return;
		}
		const ct = r.headers.get("content-type") || "";
		if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
			res.status(200).json({
				title: u.hostname,
				iconUrl: googleFavicon(u.hostname),
				fallbackIconUrl: googleFavicon(u.hostname),
				hostname: u.hostname,
			});
			return;
		}
		const buf = await r.arrayBuffer();
		const slice = buf.byteLength > META_MAX_BYTES ? buf.slice(0, META_MAX_BYTES) : buf;
		const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
		const parsed = parseTabMeta(html, r.url || u.href);
		res.json(parsed);
	} catch (e) {
		clearTimeout(t);
		const msg = e?.name === "AbortError" ? "timeout" : "fetch failed";
		res.status(502).json({ error: msg });
	}
});

const PAGE_META = {
	home: {
		title: "tinf0il · browse privately.",
		description: "Bypass filters, play games, and route the web privately. Zero logs. No leaks. No ads.",
		ogTitle: "tinf0il — the internet, unfiltered.",
		ogDescription: "A proxy portal that actually works. Games, apps, streaming — all routed privately. No logs. No leaks.",
	},
	games: {
		title: "tinf0il · games, unfiltered.",
		description: "Hundreds of unblocked games, all proxied. No ads, no installs — just tap and play.",
		ogTitle: "tinf0il Games — unblocked, unfiltered.",
		ogDescription: "Hundreds of games, zero filters. No ads, no installs. Your school can't stop you now.",
	},
	apps: {
		title: "tinf0il · apps, untangled.",
		description: "Every web app you actually use, one tap away — all routed privately.",
		ogTitle: "tinf0il Apps — untangled.",
		ogDescription: "YouTube, Docs, everything you need — one tap away and fully proxied. No restrictions, no noise.",
	},
	tv: {
		title: "tinf0il TV — stream anything.",
		description: "Movies and shows, proxied and ad-free. No account. No paywall. Just watch.",
		ogTitle: "tinf0il TV — stream anything, anywhere.",
		ogDescription: "Movies and shows routed through tinf0il. No account. No paywall. No ads. Just hit play.",
	},
	chatroom: {
		title: "tinf0il · chatroom",
		description: "Join the tinf0il community. Talk proxy, games, and everything in between.",
		ogTitle: "tinf0il Chatroom — come hang.",
		ogDescription: "The official tinf0il community. Proxy tips, game recs, and the whole vibe. Come through.",
	},
	settings: {
		title: "tinf0il · settings",
		description: "Cloak your tab, pick a theme, configure a panic key. Make tinf0il yours.",
		ogTitle: "tinf0il Settings",
		ogDescription: "Tab cloaking, custom themes, panic key, and more. Make tinf0il yours.",
	},
	about: {
		title: "tinf0il · about",
		description: "A lightweight proxy portal built on scramjet. Browse, play, work — privately. No logs. No leaks.",
		ogTitle: "about tinf0il",
		ogDescription: "Built on scramjet by Mercury Workshop. Zero trackers, zero logs, open source. The clean room the internet needed.",
	},
};

const INDEX_HTML_PATH = path.join(repoRoot, "public", "index.html");
let indexHtmlTemplate = null;

function getIndexHtml() {
	if (!indexHtmlTemplate) indexHtmlTemplate = fs.readFileSync(INDEX_HTML_PATH, "utf8");
	return indexHtmlTemplate;
}

function buildMetaTags(page) {
	const m = PAGE_META[page] || PAGE_META.home;
	const origin = "https://tinf0il.site";
	const image = `${origin}/assets/foil.png`;
	return [
		`<title>${m.title}</title>`,
		`<meta name="description" content="${m.description}">`,
		`<meta property="og:type" content="website">`,
		`<meta property="og:site_name" content="tinf0il">`,
		`<meta property="og:title" content="${m.ogTitle}">`,
		`<meta property="og:description" content="${m.ogDescription}">`,
		`<meta property="og:image" content="${image}">`,
		`<meta property="og:url" content="${origin}${page === "home" ? "/" : `/${page}`}">`,
		`<meta name="twitter:card" content="summary">`,
		`<meta name="twitter:title" content="${m.ogTitle}">`,
		`<meta name="twitter:description" content="${m.ogDescription}">`,
		`<meta name="twitter:image" content="${image}">`,
	].join("\n  ");
}

const tlsAllowCache = new Map();

async function pointsAtEdge(host) {
	const [v4, v6] = await Promise.all([
		dns.resolve4(host).catch(() => []),
		dns.resolve6(host).catch(() => []),
	]);
	return [...v4, ...v6].some((addr) => EDGE_IPS.has(addr));
}

/**
 * Gate for Caddy's on-demand TLS. Returns 200 only for hostnames that already
 * resolve to this edge, so arbitrary SNI can't burn our ACME quota. Fails closed
 * when EDGE_IPS is unset.
 */
app.get("/api/tls-allow", async (req, res) => {
	const host = String(req.query.domain || "")
		.toLowerCase()
		.replace(/\.$/, "");
	if (!/^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
		return res.sendStatus(400);
	}
	if (!EDGE_IPS.size) return res.sendStatus(503);

	const hit = tlsAllowCache.get(host);
	if (hit && hit.expires > Date.now()) return res.sendStatus(hit.ok ? 200 : 403);

	const ok = await pointsAtEdge(host).catch(() => false);
	if (tlsAllowCache.size > 5000) tlsAllowCache.clear();
	tlsAllowCache.set(host, {
		ok,
		expires: Date.now() + (ok ? TLS_ALLOW_TTL_OK : TLS_ALLOW_TTL_DENY),
	});
	res.sendStatus(ok ? 200 : 403);
});

const HOSTNAME_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function normalizeHost(input) {
	const host = String(input || "")
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/[/?#].*$/, "")
		.replace(/\.$/, "");
	return HOSTNAME_RE.test(host) ? host : null;
}

async function herokuApi(method, pathname, body) {
	const res = await fetch(`https://api.heroku.com${pathname}`, {
		method,
		headers: {
			Authorization: `Bearer ${HEROKU_API_KEY}`,
			Accept: "application/vnd.heroku+json; version=3",
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let parsed = null;
	try {
		parsed = text ? JSON.parse(text) : null;
	} catch {}
	return { ok: res.ok, status: res.status, body: parsed };
}

const domainAttempts = new Map();
const domainClaims = new Map();

function takeToken(bucket, ip, limit) {
	const now = Date.now();
	const hits = (bucket.get(ip) || []).filter((t) => now - t < DOMAIN_RATE_WINDOW_MS);
	if (hits.length >= limit) return false;
	hits.push(now);
	bucket.set(ip, hits);
	if (bucket.size > 5000) bucket.clear();
	return true;
}

/** Peek at a bucket without spending anything. */
function hasCapacity(bucket, key, limit) {
	const now = Date.now();
	const hits = (bucket.get(key) || []).filter((t) => now - t < DOMAIN_RATE_WINDOW_MS);
	bucket.set(key, hits);
	return hits.length < limit;
}

function spendToken(bucket, key) {
	const hits = bucket.get(key) || [];
	hits.push(Date.now());
	bucket.set(key, hits);
	if (bucket.size > 5000) bucket.clear();
}

/**
 * Reject hostnames whose parent zone doesn't exist, which kills typos and
 * invented domains before they reach the Heroku API.
 *
 * Deliberately does NOT reject hostnames that currently resolve elsewhere:
 * anyone migrating a live domain needs it serving its old target right up
 * until they switch the record over. Claiming a domain you don't control gains
 * nothing anyway — no certificate issues until DNS points here, and the reaper
 * releases it within the grace period.
 */
async function checkClaimable(host) {
	const parent = host.split(".").slice(-2).join(".");
	const ns = await dns.resolveNs(parent).catch(() => []);
	if (!ns.length) {
		return { ok: false, error: `${parent} isn't a real domain. Check the spelling.` };
	}
	return { ok: true };
}

/** Whether the hostname's CNAME actually resolves to the target Heroku gave it. */
async function isPointedAt(host, target) {
	if (!target) return false;
	const cname = await dns.resolveCname(host).catch(() => []);
	const want = String(target).toLowerCase().replace(/\.$/, "");
	return cname.some((t) => t.toLowerCase().replace(/\.$/, "") === want);
}

let pendingCache = { count: 0, at: 0 };

async function pendingDomainCount() {
	if (Date.now() - pendingCache.at < 60_000) return pendingCache.count;
	const list = await herokuApi("GET", `/apps/${HEROKU_APP}/domains`);
	if (!list.ok || !Array.isArray(list.body)) return 0;
	const count = list.body.filter((d) => d.kind === "custom" && d.acm_status !== "cert issued").length;
	pendingCache = { count, at: Date.now() };
	return count;
}

function domainsConfigured() {
	return Boolean(HEROKU_API_KEY && HEROKU_APP);
}

const idTokenCache = new Map();

/**
 * Resolve a Firebase ID token to a uid via Google's own lookup, which validates
 * signature and expiry for us — no service-account key needed, just the public
 * web API key the client already ships.
 */
async function uidFromToken(header) {
	const token = /^Bearer (.+)$/i.exec(String(header || ""))?.[1];
	if (!token || !FIREBASE_API_KEY) return null;

	const hit = idTokenCache.get(token);
	if (hit && hit.expires > Date.now()) return hit.uid;

	try {
		const res = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ idToken: token }),
			},
		);
		if (!res.ok) return null;
		const body = await res.json();
		const uid = body?.users?.[0]?.localId || null;
		if (uid) {
			if (idTokenCache.size > 2000) idTokenCache.clear();
			// well inside Firebase's 1h token lifetime
			idTokenCache.set(token, { uid, expires: Date.now() + 5 * 60 * 1000 });
		}
		return uid;
	} catch {
		return null;
	}
}

/** Register a user-supplied domain and hand back the CNAME target Heroku assigns it. */
app.post("/api/domains", express.json({ limit: "1kb" }), async (req, res) => {
	if (!domainsConfigured()) {
		return res.status(503).json({ error: "Domain registration is not configured." });
	}
	const host = normalizeHost(req.body?.domain);
	if (!host) {
		return res.status(400).json({ error: "Enter a valid domain, for example meals.mooo.com" });
	}
	if (host === RESERVED_SUFFIX || host.endsWith(`.${RESERVED_SUFFIX}`)) {
		return res.status(400).json({ error: "That domain is reserved." });
	}
	if (!takeToken(domainAttempts, req.ip, DOMAIN_ATTEMPT_LIMIT)) {
		return res.status(429).json({ error: "Too many attempts from this network. Try again later." });
	}

	// Key claims to the account, not the address: a whole school shares one IP,
	// so per-IP claim limits punish everyone for one person's fumbling.
	const uid = await uidFromToken(req.get("authorization"));
	if (FIREBASE_API_KEY && !uid) {
		return res.status(401).json({ error: "Sign in to claim a domain." });
	}

	// Re-submitting a domain we already hold is how people check on it, so answer
	// with its current status and don't touch the claim budget.
	const held = await herokuApi("GET", `/apps/${HEROKU_APP}/domains/${encodeURIComponent(host)}`);
	if (held.ok) {
		return res.json({
			domain: host,
			target: held.body?.cname,
			pointed: await isPointedAt(host, held.body?.cname),
			status: held.body?.acm_status || "pending",
		});
	}

	const claimable = await checkClaimable(host);
	if (!claimable.ok) return res.status(400).json({ error: claimable.error });

	if ((await pendingDomainCount()) >= MAX_PENDING_DOMAINS) {
		return res.status(503).json({
			error: "Too many domains are waiting to be set up right now. Try again later.",
		});
	}
	// Checked here but only spent on a registration that actually succeeds, so
	// failed attempts never cost anyone a slot.
	if (!hasCapacity(domainClaims, uid || req.ip, DOMAIN_CLAIM_LIMIT)) {
		return res.status(429).json({
			error: `You've claimed ${DOMAIN_CLAIM_LIMIT} domains this hour. Try again later.`,
		});
	}

	const created = await herokuApi("POST", `/apps/${HEROKU_APP}/domains`, {
		hostname: host,
		sni_endpoint: null,
	});
	if (!created.ok) {
		// Heroku custom domains are unique across all of Heroku, so a 422 means
		// either we already hold it (re-claim, fine) or somebody else does.
		if (created.status === 422) {
			const existing = await herokuApi(
				"GET",
				`/apps/${HEROKU_APP}/domains/${encodeURIComponent(host)}`,
			);
			if (existing.ok) {
				return res.json({
					domain: host,
					target: existing.body?.cname,
					pointed: await isPointedAt(host, existing.body?.cname),
					status: existing.body?.acm_status || "pending",
				});
			}
			return res.status(409).json({
				error: "That domain is already in use elsewhere and can't be claimed here.",
			});
		}
		console.warn(`domain add failed for ${host}: ${created.status}`);
		return res.status(502).json({ error: "Could not register that domain right now." });
	}
	spendToken(domainClaims, uid || req.ip);
	pendingCache.count += 1;

	res.json({
		domain: host,
		target: created.body?.cname,
		// false on a fresh claim — the record can't exist before we hand out the target
		pointed: false,
		status: created.body?.acm_status || "pending",
	});
});

/** Poll for cert progress so users can self-diagnose instead of asking for help. */
app.get("/api/domains/:host", async (req, res) => {
	if (!domainsConfigured()) {
		return res.status(503).json({ error: "Domain registration is not configured." });
	}
	const host = normalizeHost(req.params.host);
	if (!host) return res.status(400).json({ error: "Invalid domain." });

	const found = await herokuApi("GET", `/apps/${HEROKU_APP}/domains/${encodeURIComponent(host)}`);
	if (!found.ok) return res.status(404).json({ error: "That domain is not registered." });

	const target = found.body?.cname;

	res.json({
		domain: host,
		target,
		pointed: await isPointedAt(host, target),
		status: found.body?.acm_status || "pending",
		detail: found.body?.acm_status_reason || null,
	});
});

/**
 * Domains that are registered but never pointed here sit in the app's domain
 * quota forever. Drop the ones still unconfirmed past the grace period.
 */
async function reapStaleDomains() {
	if (!domainsConfigured()) return;
	const list = await herokuApi("GET", `/apps/${HEROKU_APP}/domains`);
	if (!list.ok || !Array.isArray(list.body)) return;

	for (const entry of list.body) {
		if (entry.kind !== "custom") continue;
		if (entry.acm_status === "cert issued") continue;
		if (entry.hostname === RESERVED_SUFFIX || entry.hostname?.endsWith(`.${RESERVED_SUFFIX}`)) continue;
		if (Date.now() - new Date(entry.created_at).getTime() < DOMAIN_GRACE_MS) continue;

		const cname = await dns.resolveCname(entry.hostname).catch(() => []);
		const pointed = cname.some(
			(t) => t.toLowerCase().replace(/\.$/, "") === String(entry.cname).toLowerCase(),
		);
		if (pointed) continue;

		const removed = await herokuApi(
			"DELETE",
			`/apps/${HEROKU_APP}/domains/${encodeURIComponent(entry.hostname)}`,
		);
		console.log(`reaped unconfirmed domain ${entry.hostname} (${removed.ok ? "ok" : "failed"})`);
	}
}

if (domainsConfigured()) {
	setInterval(() => {
		reapStaleDomains().catch((e) => console.warn(`domain reap failed: ${e?.message}`));
	}, DOMAIN_REAP_INTERVAL_MS).unref();
}

app.use((req, res, next) => {
	if (req.method !== "GET") return next();
	if (req.path.startsWith("/api/") || req.path.startsWith("/tv/") || req.path.includes(".")) return next();
	const seg = req.path.replace(/^\//, "").split("/")[0].toLowerCase();
	const page = PAGE_META[seg] ? seg : "home";
	const html = getIndexHtml().replace("<!-- PAGE_META -->", buildMetaTags(page));
	res.setHeader("Content-Type", "text/html; charset=utf-8");
	res.send(html);
});

app.use(express.static("public", { fallthrough: true }));

const { routeRequest, routeUpgrade } = await bootstrap({
	transport: "libcurl",
});

await ensureTvAppServer();

const server = http.createServer((req, res) => {
	if (routeRequest(req, res)) return;
	app(req, res);
});

server.on('clientError', (err, socket) => {
	if (err.code === 'ECONNRESET') { socket.destroy(); return; }
	socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.on("upgrade", routeUpgrade);

function listenOnce(srv, port) {
	return new Promise((resolve, reject) => {
		const onErr = (err) => {
			srv.off("error", onErr);
			reject(err);
		};
		srv.once("error", onErr);
		srv.listen(port, () => {
			srv.off("error", onErr);
			resolve(port);
		});
	});
}

let port = preferredPort;
const maxAttempts = portLocked ? 1 : 30;
let boundPort = null;

for (let attempt = 0; attempt < maxAttempts; attempt++) {
	try {
		boundPort = await listenOnce(server, port);
		break;
	} catch (err) {
		if (err.code === "EADDRINUSE" && !portLocked) {
			port++;
			continue;
		}
		if (err.code === "EADDRINUSE") {
			console.error(
				`Port ${preferredPort} is already in use (EADDRINUSE). Stop the other process or choose a different PORT.`,
			);
			console.error(
				`PowerShell: Get-NetTCPConnection -LocalPort ${preferredPort} | Select-Object OwningProcess`,
			);
			process.exit(1);
		}
		throw err;
	}
}

if (boundPort === null) {
	console.error(
		`Could not bind (${preferredPort}–${port - 1}): all attempts EADDRINUSE. Free a port or set PORT explicitly.`,
	);
	process.exit(1);
}

console.log(`Tinf0il UI + Scramjet: http://localhost:${boundPort}/`);
if (!portLocked && boundPort !== preferredPort) {
	console.log(`Note: preferred port ${preferredPort} was busy; using ${boundPort}.`);
}
