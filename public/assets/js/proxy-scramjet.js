(function () {
	const FRAME = Symbol.for("controller frame handle");

	function getSearchTemplate() {
		const searchEngines = {
			duckduckgo: "https://duckduckgo.com/?q=%s",
			google: "https://www.google.com/search?q=%s",
			bing: "https://www.bing.com/search?q=%s",
			startpage: "https://www.startpage.com/sp/search?query=%s",
		};
		const browser = localStorage.getItem('1MMUN3Browser') || 'duckduckgo';
		return searchEngines[browser] || searchEngines.duckduckgo;
	}

	function normalizeUrl(value) {
		const v = (value || "").trim();
		if (!v) return "";
		try {
			return new URL(v).toString();
		} catch {
			/* not absolute */
		}
		try {
			const u = new URL("https://" + v);
			if (u.hostname.includes(".")) return u.toString();
		} catch {
			/* ignore */
		}
		const searchTemplate = getSearchTemplate();
		return searchTemplate.replace("%s", encodeURIComponent(v));
	}

	function loadScript(url) {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = url;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error("Failed to load script " + url));
			document.head.appendChild(script);
		});
	}

	/** LibcurlClient requires ws:// or wss://, not a path. */
	function wispWebSocketUrl() {
		const proto = location.protocol === "https:" ? "wss:" : "ws:";
		return `${proto}//${location.host}/wisp/`;
	}

	function registerSw(path) {
		return navigator.serviceWorker
			.register(path, { type: "classic", updateViaCache: "none" })
			.then(async (registration) => {
				await navigator.serviceWorker.ready;
				if (registration.active) return registration.active;
				if (registration.installing) {
					await new Promise((resolve) => {
						const sw = registration.installing;
						if (sw.state === "activated") resolve();
						else {
							sw.addEventListener("statechange", function onChange() {
								if (sw.state === "activated") {
									sw.removeEventListener("statechange", onChange);
									resolve();
								}
							});
						}
					});
					return registration.active;
				}
				if (registration.waiting) {
					registration.waiting.postMessage({ type: "SKIP_WAITING" });
					await new Promise((resolve) => {
						navigator.serviceWorker.addEventListener(
							"controllerchange",
							resolve,
							{ once: true },
						);
					});
					return navigator.serviceWorker.controller;
				}
				throw new Error("No service worker found in registration");
			});
	}

	let initPromise;

	async function initController() {
		const sw = await registerSw("/sw.js");
		await loadScript("/scram/scramjet.js");
		await loadScript("/controller/controller.api.js");

		await loadScript("/clients/libcurl-client.js");
		const LibcurlCtor = window.LibcurlTransport.LibcurlClient;
		const transport = new LibcurlCtor({ wisp: wispWebSocketUrl() });

		const { Controller, config } = window.$scramjetController;
		config.injectPath = "/controller/controller.inject.js";
		config.wasmPath = "/scram/scramjet.wasm";
		config.scramjetPath = "/scram/scramjet.js";

		const controller = new Controller({ serviceworker: sw, transport });
		await controller.wait();
		return controller;
	}

	function getController() {
		if (!initPromise) initPromise = initController();
		return initPromise;
	}

	window.OneMMUN3Proxy = {
		async encode(url) {
			return url;
		},
		async open(url) {
			const u = (url || "").trim();
			if (!u) return;
			const abs = normalizeUrl(u);
			const next = new URL("/load.html", location.origin);
			next.searchParams.set("url", abs);
			location.href = next.toString();
		},
		async frame(el, url) {
			if (!el || !url) return;
			const controller = await getController();
			let fr = el[FRAME];
			if (!fr) fr = controller.createFrame(el);
			fr.go(url);
		},
		async ready() {
			await getController();
		},
		async reset() {
			const regs = await navigator.serviceWorker.getRegistrations();
			await Promise.all(regs.map((r) => r.unregister()));
			location.reload();
		},
	};

	window.OneMMUN3 = window.OneMMUN3 || {};
	window.OneMMUN3.normalizeUrl = normalizeUrl;
	window.OneMMUN3.openBlank = function (url) {
		url = url || location.href;
		const tab = window.open("about:blank", "_blank");
		if (!tab) return;
		tab.document.title = document.title || "1MMUN3";
		const iframe = tab.document.createElement("iframe");
		Object.assign(iframe.style, {
			border: "0",
			inset: "0",
			width: "100vw",
			height: "100vh",
			position: "fixed",
		});
		iframe.src = url;
		tab.document.body.style.margin = "0";
		tab.document.body.appendChild(iframe);
	};
	window.OneMMUN3.resetProxy = function () {
		window.OneMMUN3Proxy.reset();
	};

	(function initPanicKey() {
		let lastPress = 0;
		document.addEventListener("keydown", (e) => {
			const key = localStorage.getItem("1MMUN3PanicKey") || "Escape";
			if (e.key !== key) return;
			const now = Date.now();
			if (now - lastPress < 500) {
				e.preventDefault();
				const raw = localStorage.getItem("1MMUN3PanicUrl") ||
					localStorage.getItem("websiteCloakHost") ||
					"classroom.google.com";
				const href = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
				location.replace(href);
			}
			lastPress = now;
		}, true);
	})();

	document.addEventListener("DOMContentLoaded", () => {
		getController().catch((err) => {
			console.error("[Scramjet] controller init failed:", err);
		});
	});
})();
