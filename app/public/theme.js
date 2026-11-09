/* Appearance: stored only in this browser, applied before first paint via data attributes (no inline styles, CSP-safe). */
(function () {
  "use strict";
  const KEY = "thinkvis.appearance";
  const CHOICES = {
    theme: ["system", "light", "dark"],
    size: ["14", "16", "18", "20"],
    font: ["mono", "text"],
    spacing: ["tight", "comfortable", "airy"],
    width: ["full", "readable"],
  };
  const DEFAULTS = { theme: "system", size: "16", font: "mono", spacing: "comfortable", width: "full" };

  function clean(v) {
    const out = { ...DEFAULTS };
    if (v && typeof v === "object") for (const k in CHOICES) if (CHOICES[k].includes(String(v[k]))) out[k] = String(v[k]);
    return out;
  }
  function load() {
    try { return clean(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return { ...DEFAULTS }; }
  }
  function apply(a) {
    const r = document.documentElement;
    if (a.theme === "system") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", a.theme);
    r.dataset.size = a.size; r.dataset.font = a.font; r.dataset.spacing = a.spacing; r.dataset.width = a.width;
  }
  function save(a) {
    const v = clean(a);
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode: applies for this session only */ }
    apply(v);
    return v;
  }
  apply(load());
  window.ThinkVisTheme = { CHOICES, DEFAULTS, load, save, apply };
})();
