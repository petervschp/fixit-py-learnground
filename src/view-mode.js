const VIEW_MODE_STORAGE_KEY = "fixit.viewMode";
const VALID_MODES = new Set(["simple", "full"]);

export function normalizeViewMode(value, fallback = "full") {
  const v = String(value ?? "").toLowerCase();
  if (VALID_MODES.has(v)) return v;
  return VALID_MODES.has(fallback) ? fallback : "full";
}

export function resolveViewMode(params = new URLSearchParams(typeof location !== "undefined" ? location.search : "")) {
  const hasSimpleParam = params.has("simple");
  if (hasSimpleParam) {
    const raw = params.get("simple");
    if (raw === "1" || raw === "true" || raw === "simple") return "simple";
    if (raw === "0" || raw === "false" || raw === "full") return "full";
  }

  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (VALID_MODES.has(stored)) return stored;
  } catch {}
  return "full";
}

export function isSimpleMode(viewMode) {
  return normalizeViewMode(viewMode) === "simple";
}

export function applyViewModeClass(viewMode) {
  if (typeof document === "undefined" || !document.body?.classList) return;
  const mode = normalizeViewMode(viewMode);
  document.body.classList.toggle("mode-simple", mode === "simple");
  document.body.classList.toggle("mode-full", mode === "full");
  document.body.setAttribute("data-view-mode", mode);
}

export function storeViewMode(viewMode) {
  const mode = normalizeViewMode(viewMode);
  try { localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode); } catch {}
  return mode;
}

export function simpleParamForMode(viewMode) {
  return normalizeViewMode(viewMode) === "simple" ? "1" : "0";
}

export function withViewMode(urlLike, viewMode) {
  const mode = normalizeViewMode(viewMode);
  const raw = String(urlLike || "./");
  const simple = simpleParamForMode(mode);

  if (raw.startsWith("?")) {
    const params = new URLSearchParams(raw.slice(1));
    params.set("simple", simple);
    return `?${params.toString()}`;
  }

  if (raw === "./" || raw === ".") {
    return `./?simple=${simple}`;
  }

  const base = typeof location !== "undefined" ? location.href : "http://localhost/index.html";
  const url = new URL(raw, base);
  url.searchParams.set("simple", simple);
  if (url.origin === new URL(base).origin) {
    // Return a relative path when possible so GitHub Pages project paths keep working.
    const currentDir = new URL("./", base).pathname;
    if (url.pathname === currentDir) return `./${url.search}${url.hash || ""}`;
    return `${url.pathname.split("/").pop() || "index.html"}${url.search}${url.hash || ""}`;
  }
  return url.href;
}

export function currentUrlWithViewMode(viewMode) {
  if (typeof location === "undefined") return `?simple=${simpleParamForMode(viewMode)}`;
  const url = new URL(location.href);
  url.searchParams.set("simple", simpleParamForMode(viewMode));
  return url.pathname + url.search + url.hash;
}

export function persistAndApplyViewMode(viewMode, { updateUrl = true } = {}) {
  const mode = storeViewMode(viewMode);
  applyViewModeClass(mode);
  if (updateUrl && typeof history !== "undefined" && typeof location !== "undefined") {
    history.replaceState(null, "", currentUrlWithViewMode(mode));
  }
  return mode;
}
