(() => {
  const KEY = "site-color-theme";
  const root = document.documentElement;

  const style = document.createElement("style");
  style.textContent = `
    :root { color-scheme: dark; }
    :root[data-site-theme="dark"] {
      color-scheme: dark;
      --bg: #12161d; --bg2: #161c25; --bg-alt: #161c25;
      --bg-top: #12161d; --bg-bottom: #0f1319; --bg-strong: #252e3c;
      --page: #12161d; --paper: #1d2430; --canvas: #12161d; --canvas-2: #161c25;
      --surface: #1d2430; --surface-2: #252e3c; --card: #1d2430;
      --panel: #1d2430; --panel2: #252e3c; --panel-bg: #1d2430;
      --panel-light: #252e3c; --panel-soft: #252e3c; --panel-strong: #333c4b;
      --shell: #1d2430; --shell-2: #252e3c; --shell-bg: #1d2430;
      --ink: #edf2f7; --text: #edf2f7; --panel-text: #edf2f7; --head-ink: #f8fafc;
      --muted: #b5bfcb; --text-muted: #b5bfcb; --text-soft: #98a6b7; --ink-dim: #98a6b7;
      --line: #333c4b; --border: #333c4b; --border-strong: #526174;
      --panel-border: #333c4b; --card-border: #333c4b;
      --accent: #7ad6a2; --accent-strong: #a5e8c0; --accent-soft: #173626;
      --warn: #f1ca71; --warn-soft: #392a12;
      --shadow: none; --soft-shadow: none;
      --code: #161c25; --code-ink: #edf2f7; --row-alt: #161c25;
      --hover-bg: #252e3c; --summary-hover: #252e3c; --chip-bg: #252e3c;
      --graph-surface: #161c25; --graph-node: #1d2430; --graph-node-text: #edf2f7;
      --graph-edge: #7f8ea3; --page-bg-color: #12161d;
    }
    :root[data-site-theme="light"] {
      color-scheme: light;
      --bg: #f4f7fb; --bg2: #e8eef6; --bg-alt: #e8eef6;
      --bg-top: #f8fafc; --bg-bottom: #e8eef6; --bg-strong: #dbe5f0;
      --page: #f4f7fb; --paper: #ffffff; --canvas: #f4f7fb; --canvas-2: #e8eef6;
      --surface: #ffffff; --surface-2: #edf2f7; --card: #ffffff;
      --panel: #ffffff; --panel2: #edf2f7; --panel-bg: #ffffff;
      --panel-light: #f8fafc; --panel-soft: #edf2f7; --panel-strong: #dbe5f0;
      --shell: #ffffff; --shell-2: #edf2f7; --shell-bg: #ffffff;
      --ink: #172033; --text: #172033; --panel-text: #172033; --head-ink: #101827;
      --muted: #526174; --text-muted: #526174; --text-soft: #66758a; --ink-dim: #66758a;
      --line: #c5d0de; --border: #c5d0de; --border-strong: #91a1b5;
      --panel-border: #c5d0de; --card-border: #c5d0de;
      --shadow: 0 18px 45px rgba(30, 48, 74, .14);
      --soft-shadow: 0 10px 28px rgba(30, 48, 74, .12);
      --code: #e8eef6; --code-ink: #172033; --row-alt: #f4f7fb;
      --hover-bg: #e8eef6; --summary-hover: #e8eef6; --chip-bg: #e8eef6;
      --graph-surface: #f8fafc; --graph-node: #ffffff; --graph-node-text: #172033;
      --graph-edge: #7b8da4; --page-bg-color: #f4f7fb;
    }
    :root[data-site-theme="dark"] body { background-color: var(--bg, #12161d); color: var(--text, #edf2f7); }
    :root[data-site-theme="light"] body { background-color: var(--bg, #f4f7fb); color: var(--text, #172033); }
    .site-theme-toggle {
      position: fixed; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
      z-index: 2147483647; display: inline-flex; align-items: center; gap: 7px;
      min-height: 40px; padding: 8px 12px; border: 1px solid rgba(148, 163, 184, .55);
      border-radius: 999px; background: rgba(10, 18, 30, .9); color: #f8fafc;
      font: 700 13px/1 system-ui, sans-serif; letter-spacing: .01em; cursor: pointer;
      box-shadow: 0 8px 24px rgba(0, 0, 0, .24); backdrop-filter: blur(12px);
    }
    :root[data-site-theme="light"] .site-theme-toggle {
      background: rgba(255, 255, 255, .94); color: #172033; border-color: #c5d0de;
      box-shadow: 0 8px 24px rgba(30, 48, 74, .16);
    }
    .site-theme-toggle:hover { transform: translateY(-1px); }
    .site-theme-toggle:focus-visible { outline: 3px solid #38bdf8; outline-offset: 3px; }
    @media (max-width: 520px) { .site-theme-toggle { padding: 9px; } .site-theme-toggle-label { display: none; } }
    @media print { .site-theme-toggle { display: none !important; } }
  `;
  document.head.appendChild(style);

  function readTheme() {
    try { return localStorage.getItem(KEY) === "light" ? "light" : "dark"; }
    catch { return "dark"; }
  }

  function apply(theme, persist = false) {
    const light = theme === "light";
    root.dataset.siteTheme = light ? "light" : "dark";
    if (persist) {
      try { localStorage.setItem(KEY, light ? "light" : "dark"); } catch { /* storage can be unavailable */ }
    }
    const button = document.querySelector(".site-theme-toggle");
    if (button) {
      button.innerHTML = `<span aria-hidden="true">${light ? "☀️" : "🌙"}</span><span class="site-theme-toggle-label">${light ? "Light" : "Dark"}</span>`;
      button.setAttribute("aria-label", `Switch to ${light ? "dark" : "light"} mode`);
      button.setAttribute("aria-pressed", String(light));
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

  apply(readTheme());
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
