(function () {
  const searchEngines = {
    duckduckgo: "https://duckduckgo.com/?q=%s",
    google: "https://www.google.com/search?q=%s",
    bing: "https://www.bing.com/search?q=%s",
    startpage: "https://www.startpage.com/sp/search?query=%s",
  };

  function getSearchTemplate() {
    const browser = localStorage.getItem('1MMUN3Browser') || 'duckduckgo';
    return searchEngines[browser] || searchEngines.duckduckgo;
  }

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
        const searchTemplate = getSearchTemplate();
        return searchTemplate.replace("%s", encodeURIComponent(value));
      }
    }

    const searchTemplate = getSearchTemplate();
    return searchTemplate.replace("%s", encodeURIComponent(value));
  }

  function setStatus(message, tone = "neutral") {
    const status = $("[data-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  const LAUNCH_SIDEBAR_KEY = "1MMUN3LaunchSidebarCollapsed";

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
  }

  function hideLaunchSidebar() {
    const grid = $("#browser-main-grid");
    const aside = $("#launch-sidebar");
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
  }

  async function launch(value) {
    const url = normalizeUrl(value);
    if (!url) {
      setStatus("Drop a link or search first.", "bad");
      return;
    }

    try {
      setStatus("Starting the proxy...", "good");
      await window.OneMMUN3Proxy.open(url);
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
        await window.OneMMUN3Proxy.frame(frame, url);
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
      document.title = `${directUrl.replace(/^https?:\/\//, "").slice(0, 48)} | 1MMUN3`;
      try {
        setStatus("Connecting…", "good");
        await window.OneMMUN3Proxy.frame(frame, directUrl);
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
    document.title = `${item.title} | 1MMUN3`;

    try {
      if (item.proxy === false || item.url.startsWith("/")) {
        frame.src = item.url;
      } else {
        setStatus("Connecting…", "good");
        await window.OneMMUN3Proxy.frame(frame, item.url);
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
      window.OneMMUN3Settings.save({
        title: $("#title-input").value.trim(),
        icon: $("#icon-input").value.trim(),
        theme: $("#theme-select").value,
      });
      localStorage.setItem("autoAB", String($("#auto-blank").checked));
      location.reload();
    });

    $("[data-reset-settings]")?.addEventListener("click", () => {
      window.OneMMUN3Settings.clear();
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

  window.OneMMUN3 = {
    launch,
    normalizeUrl,
    openBlank,
  };
})();
