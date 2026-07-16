(function () {
  const searchTemplate = "https://www.google.com/search?q=%s";
  const fallbackImage = "/addicon.png";

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function normalizeUrl(input) {
    const value = input.trim();
    if (!value) return "";

    try {
      return new URL(value).toString();
    } catch {
      try {
        const url = new URL(`https://${value}`);
        if (url.hostname.includes(".")) return url.toString();
      } catch {
        return searchTemplate.replace("%s", encodeURIComponent(value));
      }
    }

    return searchTemplate.replace("%s", encodeURIComponent(value));
  }

  function setStatus(message, tone = "neutral") {
    const status = $("[data-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  const LAUNCH_SIDEBAR_KEY = "tinf0ilLaunchSidebarCollapsed";

  /* Adsterra 160x600 for the launch sidebar.
     Mounted only while the sidebar is both visible and expanded: this aside stays
     `hidden` for plain ?url= browsing and shrinks to a 48px rail when collapsed,
     and a unit that loads in either state still books an impression nobody can
     see. Own srcdoc iframe so `atOptions` stays out of the page's globals.
     Set `key` to the unit id from Adsterra; null renders nothing. */
  const SIDE_AD = { key: "0b7fd6b2125a6f37356ac2638db9c719", width: 160, height: 600 };

  function sideAdSrcDoc() {
    const opts = JSON.stringify({
      key: SIDE_AD.key,
      format: "iframe",
      height: SIDE_AD.height,
      width: SIDE_AD.width,
      params: {},
    });
    return [
      '<!doctype html><html><head><meta charset="utf-8">',
      "<style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body>",
      "<script>atOptions = " + opts + ";<\/script>",
      '<script src="https://www.highperformanceformat.com/' +
        SIDE_AD.key +
        '/invoke.js"><\/script>',
      "</body></html>",
    ].join("");
  }

  function mountSideAd() {
    const host = $("[data-side-ad]");
    if (!host || !SIDE_AD.key || host.firstChild) return;
    const frame = document.createElement("iframe");
    frame.className = "load-side-ad-frame";
    frame.title = "advertisement";
    frame.width = SIDE_AD.width;
    frame.height = SIDE_AD.height;
    frame.scrolling = "no";
    frame.srcdoc = sideAdSrcDoc();
    host.appendChild(frame);
    host.hidden = false;
  }

  function unmountSideAd() {
    const host = $("[data-side-ad]");
    if (!host) return;
    host.textContent = "";
    host.hidden = true;
  }

  function syncLaunchSidebarCollapsed(collapsed) {
    const grid = $("#browser-main-grid");
    const aside = $("#launch-sidebar");
    if (!grid || !aside || aside.hasAttribute("hidden")) return;
    const collapseBtn = $("[data-sidebar-collapse]");
    const expandBtn = $("[data-sidebar-expand]");
    grid.classList.toggle("is-collapsed", collapsed);
    if (collapseBtn) {
      collapseBtn.hidden = collapsed;
      collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    }
    if (expandBtn) expandBtn.hidden = !collapsed;
    if (collapsed) unmountSideAd();
    else mountSideAd();
  }

  function hideLaunchSidebar() {
    const grid = $("#browser-main-grid");
    const aside = $("#launch-sidebar");
    unmountSideAd();
    grid?.classList.remove("has-launch-sidebar", "is-collapsed");
    if (aside) {
      aside.hidden = true;
      aside.setAttribute("hidden", "");
    }
    const collapseBtn = $("[data-sidebar-collapse]");
    const expandBtn = $("[data-sidebar-expand]");
    if (collapseBtn) {
      collapseBtn.hidden = false;
      collapseBtn.setAttribute("aria-expanded", "true");
    }
    if (expandBtn) expandBtn.hidden = true;
  }

  /** Active tab highlights on load.html (SPA hash links). */
  function updateLoadBrowserNavActive() {
    const path = location.pathname.split("/").pop() || "";
    if (path !== "load.html") return;
    const qs = new URLSearchParams(location.search);
    $all(".browser-nav-tabs a[data-spa-page]").forEach((link) => {
      link.classList.remove("active");
    });
    if (qs.has("game")) {
      $all('.browser-nav-tabs a[data-spa-page="games"]').forEach((link) => {
        link.classList.add("active");
      });
    } else if (qs.has("app")) {
      $all('.browser-nav-tabs a[data-spa-page="apps"]').forEach((link) => {
        link.classList.add("active");
      });
    } else {
      $all('.browser-nav-tabs a[data-spa-page="proxy"]').forEach((link) => {
        link.classList.add("active");
      });
    }
  }

  function openBlank(url = location.href) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setStatus("Popup blocked. Allow popups and try again.", "bad");
      return;
    }

    tab.document.title = document.title || "Tinf0il";
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
  }

  async function launch(value) {
    const url = normalizeUrl(value);
    if (!url) {
      setStatus("Drop a link or search first.", "bad");
      return;
    }

    try {
      setStatus("Starting the proxy...", "good");
      await window.Tinf0ilProxy.open(url);
    } catch (error) {
      setStatus(error.message || "Proxy could not launch.", "bad");
    }
  }

  function bindNav() {
    const toggle = $(".nav-toggle");
    const nav = $(".nav-links");
    const path = location.pathname.split("/").pop() || "index.html";

    if (path === "load.html") updateLoadBrowserNavActive();

    $all(".nav-links a").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (href === path || href.endsWith("/" + path)) link.classList.add("active");
    });

    toggle?.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      nav?.classList.toggle("open");
    });
  }

  function bindBrowserChrome() {
    const form = $("[data-browser-nav]");
    const input = $("[data-browser-url]");
    if (!form || !input) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const raw = input.value.trim();
      const url = normalizeUrl(raw);
      if (!url) {
        setStatus("Enter a URL or search.", "bad");
        return;
      }
      const frame = $("#launch-frame");
      if (!frame) return;
      try {
        hideLaunchSidebar();
        setStatus("Loading…", "good");
        await window.Tinf0ilProxy.frame(frame, url);
        input.value = url;
        const next = new URL(location.href);
        next.searchParams.delete("game");
        next.searchParams.delete("app");
        next.searchParams.set("url", url);
        history.replaceState(null, "", next.pathname + next.search);
        updateLoadBrowserNavActive();
        setStatus("", "neutral");
      } catch (error) {
        setStatus(error.message || "Navigation failed.", "bad");
      }
    });
  }

  function bindLauncher() {
    const form = $("[data-launch-form]");
    const input = $("[data-launch-input]");
    const blank = $("[data-open-blank]");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      launch(input?.value || "");
    });

    blank?.addEventListener("click", () => openBlank());

    if (localStorage.getItem("autoAB") === "true" && window.self === window.top) {
      openBlank();
    }
  }

  function storageArray(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function storeArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function createCustom(kind, collection) {
    const name = prompt(`Name this ${kind}:`);
    const url = prompt(`Paste the ${kind} URL:`);
    const id = prompt("Give it a short ID with no spaces:");
    const image = prompt("Icon/image URL, optional:");
    const description = prompt("Description, optional:");

    if (!name || !url || !id) return;
    if (id.includes(" ")) {
      alert("IDs cannot contain spaces.");
      return;
    }
    if (collection.some((item) => item.id === id)) {
      alert("That ID is already taken.");
      return;
    }

    const key = kind === "game" ? "customgames" : "customapps";
    const custom = storageArray(key);
    custom.push({
      id,
      title: `${name} (Custom ${kind})`,
      url,
      image,
      description,
    });
    storeArray(key, custom);
    location.reload();
  }

  function renderCatalog(kind) {
    const grid = $("[data-catalog-grid]");
    const search = $("[data-catalog-search]");
    if (!grid) return;

    const source = kind === "games" ? window.games || [] : window.apps || [];
    const itemKind = kind === "games" ? "game" : "app";

    function paint(query = "") {
      const needle = query.toLowerCase();
      grid.innerHTML = "";

      source
        .filter((item) => item && item.title)
        .filter((item) => item.title.toLowerCase().includes(needle))
        .forEach((item) => {
          const card = document.createElement("button");
          card.type = "button";
          card.className = "catalog-card";
          card.innerHTML = `
            <img src="${item.image || fallbackImage}" alt="" loading="lazy">
            <span>${item.title}</span>
            <small>${item.description || (item.proxy === false ? "Local play" : "Ready")}</small>
          `;
          card.addEventListener("click", () => {
            if (item.id === "customgame" || item.id === "customapp") {
              createCustom(itemKind, source);
              return;
            }
            location.href = `/load.html?${itemKind}=${encodeURIComponent(item.id)}`;
          });
          grid.appendChild(card);
        });
    }

    search?.addEventListener("input", () => paint(search.value));
    paint();
  }

  async function loadEmbed() {
    const frame = $("#launch-frame");
    if (!frame) return;

    const params = new URLSearchParams(location.search);
    const directUrl = params.get("url");
    if (params.has("url") && directUrl) {
      hideLaunchSidebar();
      const urlField = $("[data-browser-url]");
      if (urlField) urlField.value = directUrl;
      document.title = `${directUrl.replace(/^https?:\/\//, "").slice(0, 48)} | Tinf0il`;
      try {
        setStatus("Connecting…", "good");
        await window.Tinf0ilProxy.frame(frame, directUrl);
        setStatus("", "neutral");
      } catch (error) {
        setStatus(error.message || "Launch failed.", "bad");
      }
      return;
    }

    const gameId = params.get("game");
    const appId = params.get("app");
    const collection = gameId ? window.games || [] : window.apps || [];
    const item = collection.find((entry) => entry.id === (gameId || appId));

    if (!item) {
      hideLaunchSidebar();
      setStatus("Could not find that launch target.", "bad");
      return;
    }

    const grid = $("#browser-main-grid");
    const aside = $("#launch-sidebar");
    grid?.classList.add("has-launch-sidebar");
    aside?.removeAttribute("hidden");
    if (aside) aside.hidden = false;

    $("#launch-title").textContent = item.title;
    $("#launch-description").textContent = item.description || "Loaded and ready.";
    $("#launch-image").src = item.image || fallbackImage;

    const urlField = $("[data-browser-url]");
    if (urlField) {
      urlField.value =
        item.proxy === false || item.url.startsWith("/")
          ? new URL(item.url, location.origin).href
          : item.url;
    }
    document.title = `${item.title} | Tinf0il`;

    try {
      if (item.proxy === false || item.url.startsWith("/")) {
        frame.src = item.url;
      } else {
        setStatus("Connecting…", "good");
        await window.Tinf0ilProxy.frame(frame, item.url);
      }
      setStatus("", "neutral");
    } catch (error) {
      setStatus(error.message || "Launch failed.", "bad");
    }

    syncLaunchSidebarCollapsed(localStorage.getItem(LAUNCH_SIDEBAR_KEY) === "1");
  }

  function bindSettings() {
    const form = $("[data-settings-form]");
    if (!form) return;

    $("#title-input").value = localStorage.getItem("websiteTitle") || "";
    $("#icon-input").value = localStorage.getItem("websiteIcon") || "";
    $("#theme-select").value = localStorage.getItem("theme") || "midnight";
    $("#auto-blank").checked = localStorage.getItem("autoAB") === "true";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      window.Tinf0ilSettings.save({
        title: $("#title-input").value.trim(),
        icon: $("#icon-input").value.trim(),
        theme: $("#theme-select").value,
      });
      localStorage.setItem("autoAB", String($("#auto-blank").checked));
      location.reload();
    });

    $("[data-reset-settings]")?.addEventListener("click", () => {
      window.Tinf0ilSettings.clear();
      location.reload();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindNav();
    bindLauncher();
    bindBrowserChrome();
    bindSettings();
    renderCatalog(document.body.dataset.catalog);

    document.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-sidebar-collapse]")) {
        syncLaunchSidebarCollapsed(true);
        localStorage.setItem(LAUNCH_SIDEBAR_KEY, "1");
      } else if (ev.target.closest("[data-sidebar-expand]")) {
        syncLaunchSidebarCollapsed(false);
        localStorage.setItem(LAUNCH_SIDEBAR_KEY, "0");
      }
    });

    loadEmbed();
  });

  window.Tinf0il = {
    launch,
    normalizeUrl,
    openBlank,
  };
})();
