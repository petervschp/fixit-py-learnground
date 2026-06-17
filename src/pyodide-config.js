export const DEFAULT_PYODIDE_BASE_URL = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/";
export const LOCAL_PYODIDE_EXAMPLE_BASE_URL = "./vendor/pyodide/v0.25.1/full/";
const STORAGE_KEY = "fixit.pyodide.baseUrl";

export function normalizePyodideBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_PYODIDE_BASE_URL;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export function getConfiguredPyodideBaseUrl() {
  if (typeof window === "undefined") return DEFAULT_PYODIDE_BASE_URL;

  const fromGlobal = typeof window.FIXIT_PYODIDE_BASE_URL === "string"
    ? window.FIXIT_PYODIDE_BASE_URL
    : "";
  if (fromGlobal.trim()) return normalizePyodideBaseUrl(fromGlobal);

  try {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("pyodideBaseUrl") || params.get("pyodide_base_url");
    if (fromParam && fromParam.trim()) return normalizePyodideBaseUrl(fromParam);
  } catch {}

  try {
    const fromStorage = window.localStorage?.getItem(STORAGE_KEY) || "";
    if (fromStorage.trim()) return normalizePyodideBaseUrl(fromStorage);
  } catch {}

  return DEFAULT_PYODIDE_BASE_URL;
}

export function setStoredPyodideBaseUrl(value) {
  if (typeof window === "undefined") return DEFAULT_PYODIDE_BASE_URL;
  const normalized = normalizePyodideBaseUrl(value);
  try {
    if (normalized === DEFAULT_PYODIDE_BASE_URL) window.localStorage?.removeItem(STORAGE_KEY);
    else window.localStorage?.setItem(STORAGE_KEY, normalized);
  } catch {}
  return normalized;
}

export function clearStoredPyodideBaseUrl() {
  try { window.localStorage?.removeItem(STORAGE_KEY); } catch {}
}

export function describePyodideBaseUrl(baseUrl = getConfiguredPyodideBaseUrl()) {
  const normalized = normalizePyodideBaseUrl(baseUrl);
  if (normalized === DEFAULT_PYODIDE_BASE_URL) {
    return {
      mode: "cdn",
      label: "Pyodide CDN",
      baseUrl: normalized,
      teacherNote: "Predvolené nastavenie: runtime sa sťahuje z jsDelivr CDN pri prvom Run/Testy."
    };
  }
  if (normalized.startsWith("./") || normalized.startsWith("/") || normalized.startsWith(locationOriginSafe())) {
    return {
      mode: "local",
      label: "lokálny Pyodide runtime",
      baseUrl: normalized,
      teacherNote: "Školské nastavenie: runtime sa očakáva na lokálnej/školskej ceste. Hlavný ZIP ho stále neobsahuje."
    };
  }
  return {
    mode: "custom",
    label: "vlastný Pyodide runtime",
    baseUrl: normalized,
    teacherNote: "Používa sa vlastná PYODIDE_BASE_URL cesta. Over ju smoke testom pred hodinou."
  };
}

function locationOriginSafe() {
  try { return window.location.origin; } catch { return ""; }
}
