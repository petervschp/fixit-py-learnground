export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function stableStringify(value) {
  // Deterministic JSON-like stringify: sorts object keys, keeps array order.
  const t = typeof value;
  if (value === null) return "null";
  if (t === "number" || t === "boolean") return JSON.stringify(value);
  if (t === "string") return JSON.stringify(value);
  if (t === "undefined") return "null";
  if (Array.isArray(value)) {
    return "[" + value.map(v => stableStringify(v)).join(",") + "]";
  }
  if (t === "object") {
    const keys = Object.keys(value).sort();
    const parts = [];
    for (const k of keys) {
      const v = value[k];
      if (typeof v === "undefined") continue;
      parts.push(JSON.stringify(k) + ":" + stableStringify(v));
    }
    return "{" + parts.join(",") + "}";
  }
  return JSON.stringify(String(value));
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
