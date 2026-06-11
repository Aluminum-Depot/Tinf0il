(function () {
  const root = document.documentElement;
  const theme = localStorage.getItem("theme") || "midnight";
  root.dataset.theme = theme;

  // Tab cloak is ON by default. A lot of school filters block/flag pages by
  // their tab title, so out of the box we disguise the tab as Google Classroom.
  // Users can set their own title/icon in settings; "reset" reverts to this.
  const DEFAULT_CLOAK = {
    title: "Classroom",
    icon: "https://ssl.gstatic.com/classroom/favicon.png",
  };

  const effectiveTitle = () => localStorage.getItem("websiteTitle") || DEFAULT_CLOAK.title;
  const effectiveIcon = () => localStorage.getItem("websiteIcon") || DEFAULT_CLOAK.icon;

  function applyIcon(href) {
    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    if (favicon.href !== href) favicon.href = href;
  }

  function applyCloak() {
    const t = effectiveTitle();
    if (document.title !== t) document.title = t; // also creates <title> if absent
    applyIcon(effectiveIcon());
  }

  applyCloak();

  // Keep the cloak enforced even when the app changes document.title on
  // client-side navigation. Observing <title> and re-applying covers any router
  // without having to hook into the page code. Setting the title back to the
  // same value is a no-op, so this can't loop.
  function startObserver() {
    const target = document.querySelector("title");
    if (!target) return;
    new MutationObserver(() => {
      const t = effectiveTitle();
      if (document.title !== t) document.title = t;
    }).observe(target, { childList: true, subtree: true, characterData: true });
  }
  if (document.querySelector("title")) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver);

  window.Tinf0ilSettings = {
    DEFAULT_CLOAK,
    effectiveTitle,
    effectiveIcon,
    applyCloak,
    save({ title: nextTitle, icon: nextIcon, theme: nextTheme, cloakPreset: nextPreset, cloakHost: nextHost }) {
      localStorage.setItem("websiteTitle", nextTitle || DEFAULT_CLOAK.title);
      localStorage.setItem("websiteIcon", nextIcon || DEFAULT_CLOAK.icon);
      localStorage.setItem("theme", nextTheme || "midnight");
      if (nextPreset) localStorage.setItem("websiteCloakPreset", nextPreset);
      if (nextHost) localStorage.setItem("websiteCloakHost", nextHost);
      applyCloak();
    },
    clear() {
      // Revert to the default cloak (not the real "tinf0il" title).
      localStorage.removeItem("websiteTitle");
      localStorage.removeItem("websiteIcon");
      localStorage.removeItem("theme");
      localStorage.removeItem("autoAB");
      localStorage.removeItem("websiteCloakPreset");
      localStorage.removeItem("websiteCloakHost");
      applyCloak();
    },
  };
})();
