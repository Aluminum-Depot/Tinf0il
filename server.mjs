import express from "express";
import { spawn } from "node:child_process";
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
		const msg = e?.name === "AbortError" ? "1MMUN3 TV timed out" : "1MMUN3 TV is not running";
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
		console.warn("1MMUN3 TV: run `npm install` inside movieverse/ to enable /tv/.");
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
			console.warn(`1MMUN3 TV stopped unexpectedly (${signal || code}).`);
		}
		tvAppChild = null;
	});
	console.log(`1MMUN3 TV (Next.js ${hasBuild ? "prod" : "dev"}): ${TV_APP_ORIGIN}/tv/`);
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
					"Mozilla/5.0 (compatible; OneMMUN3TabMeta/1.0; +https://github.com/)",
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
		title: "1MMUN3 · browse privately.",
		description: "Bypass filters, play games, and route the web privately. Zero logs. No leaks. No ads.",
		ogTitle: "1MMUN3 — the internet, unfiltered.",
		ogDescription: "A proxy portal that actually works. Games, apps, streaming — all routed privately. No logs. No leaks.",
	},
	games: {
		title: "1MMUN3 · games, unfiltered.",
		description: "Hundreds of unblocked games, all proxied. No ads, no installs — just tap and play.",
		ogTitle: "1MMUN3 Games — unblocked, unfiltered.",
		ogDescription: "Hundreds of games, zero filters. No ads, no installs. Your school can't stop you now.",
	},
	apps: {
		title: "1MMUN3 · apps, untangled.",
		description: "Every web app you actually use, one tap away — all routed privately.",
		ogTitle: "1MMUN3 Apps — untangled.",
		ogDescription: "YouTube, Docs, everything you need — one tap away and fully proxied. No restrictions, no noise.",
	},
	tv: {
		title: "1MMUN3 TV — stream anything.",
		description: "Movies and shows, proxied and ad-free. No account. No paywall. Just watch.",
		ogTitle: "1MMUN3 TV — stream anything, anywhere.",
		ogDescription: "Movies and shows routed through 1MMUN3. No account. No paywall. No ads. Just hit play.",
	},
	chatroom: {
		title: "1MMUN3 · chatroom",
		description: "Join the 1MMUN3 community. Talk proxy, games, and everything in between.",
		ogTitle: "1MMUN3 Chatroom — come hang.",
		ogDescription: "The official 1MMUN3 community. Proxy tips, game recs, and the whole vibe. Come through.",
	},
	settings: {
		title: "1MMUN3 · settings",
		description: "Cloak your tab, pick a theme, configure a panic key. Make 1MMUN3 yours.",
		ogTitle: "1MMUN3 Settings",
		ogDescription: "Tab cloaking, custom themes, panic key, and more. Make 1MMUN3 yours.",
	},
	about: {
		title: "1MMUN3 · about",
		description: "A lightweight proxy portal built on scramjet. Browse, play, work — privately. No logs. No leaks.",
		ogTitle: "about 1MMUN3",
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
	const origin = "https://1mmun3.site";
	const image = `${origin}/assets/foil.png`;
	return [
		`<title>${m.title}</title>`,
		`<meta name="description" content="${m.description}">`,
		`<meta property="og:type" content="website">`,
		`<meta property="og:site_name" content="1MMUN3">`,
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

console.log(`1MMUN3 UI + Scramjet: http://localhost:${boundPort}/`);
if (!portLocked && boundPort !== preferredPort) {
	console.log(`Note: preferred port ${preferredPort} was busy; using ${boundPort}.`);
}
