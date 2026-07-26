(() => {
  "use strict";

  const KEY = "site-color-theme";
  const root = document.documentElement;
  const systemTheme = globalThis.matchMedia?.("(prefers-color-scheme: light)");

  function storedTheme() {
    try {
      const saved = localStorage.getItem(KEY);
      return saved === "light" || saved === "dark" ? saved : null;
    } catch {
      return null;
    }
  }

  function readTheme() {
    return storedTheme() ?? (systemTheme?.matches ? "light" : "dark");
  }

  function apply(theme, persist = false) {
    const light = theme === "light";
    root.dataset.siteTheme = light ? "light" : "dark";
    if (persist) {
      try { localStorage.setItem(KEY, light ? "light" : "dark"); } catch { /* storage can be unavailable */ }
    }
    const button = document.querySelector(".site-theme-toggle");
    if (button) {
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = light ? "☀️" : "🌙";
      const label = document.createElement("span");
      label.className = "site-theme-toggle-label";
      label.textContent = light ? "Light" : "Dark";
      button.replaceChildren(icon, label);
      button.setAttribute("aria-label", "Use light color theme");
      button.setAttribute("aria-pressed", String(light));
      button.title = `Switch to ${light ? "dark" : "light"} mode`;
    }
  }

  function initialize() {
    if (document.querySelector(".site-theme-toggle")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "site-theme-toggle";
    button.addEventListener("click", () => apply(root.dataset.siteTheme === "light" ? "dark" : "light", true));
    document.body.appendChild(button);
    apply(readTheme());
  }

  globalThis.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === null) apply(readTheme());
  });
  systemTheme?.addEventListener?.("change", () => {
    if (storedTheme() === null) apply(readTheme());
  });

  apply(readTheme());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
