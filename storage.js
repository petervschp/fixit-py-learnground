// storage.js — localStorage adapter (v2) + basic validation to avoid "weird UI" after updates.

const STORAGE_KEY = "fixit.userState.v3";
export const CONTENT_VERSION = "2026-04-29-fix-hints-indent-v2";

function nowIso() {
  return new Date().toISOString();
}

export function defaultState() {
  return {
    schemaVersion: 2,
    contentVersion: CONTENT_VERSION,
    user: {
      id: "anonymous",
      displayName: "Anonymous",
    },
    progress: {
      problems: {},
    },
    events: {
      max: 300,
      items: [],
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultState();

    // minimal schema sanity
    if (!parsed.schemaVersion) parsed.schemaVersion = 2;
    if (!parsed.progress) parsed.progress = { problems: {} };
    if (!parsed.progress.problems) parsed.progress.problems = {};
    if (!parsed.events) parsed.events = { max: 300, items: [] };
    if (!Array.isArray(parsed.events.items)) parsed.events.items = [];
    if (!Number.isFinite(parsed.events.max)) parsed.events.max = 300;

    // content version can change; keep state but update marker
    parsed.contentVersion = CONTENT_VERSION;

    return parsed;
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  state.updatedAt = nowIso();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function ensureProblemEntry(state, problemId) {
  if (!state.progress?.problems) state.progress = { problems: {} };

  if (!state.progress.problems[problemId]) {
    state.progress.problems[problemId] = {
      solved: false,
      attempts: 0,
      hintsUsed: 0,
      lastResult: null,
      updatedAt: nowIso(),
      runInput: "",
      draftCode: "",
      lastDiag: null,
    };
  }

  // basic validation / migration of fields
  const e = state.progress.problems[problemId];
  e.solved = Boolean(e.solved);
  e.attempts = Number.isFinite(e.attempts) ? e.attempts : 0;
  e.hintsUsed = Number.isFinite(e.hintsUsed) ? e.hintsUsed : 0;
  e.lastResult = (e.lastResult === "PASS" || e.lastResult === "FAIL") ? e.lastResult : null;
  e.runInput = typeof e.runInput === "string" ? e.runInput : "";
  e.draftCode = typeof e.draftCode === "string" ? e.draftCode : "";
  e.lastDiag = (e.lastDiag && typeof e.lastDiag === "object") ? e.lastDiag : null;
  e.updatedAt = typeof e.updatedAt === "string" ? e.updatedAt : nowIso();

  return e;
}

export function recordEvent(state, type, payload = {}) {
  const ev = { at: nowIso(), type, payload };
  if (!state.events) state.events = { max: 300, items: [] };
  state.events.items.push(ev);
  if (state.events.items.length > state.events.max) {
    state.events.items = state.events.items.slice(-state.events.max);
  }
  saveState(state);
}

export function incAttempts(state, problemId, kind) {
  const entry = ensureProblemEntry(state, problemId);
  entry.attempts += 1;
  entry.lastKind = kind;
  entry.updatedAt = nowIso();
  saveState(state);
}

export function incHints(state, problemId) {
  const entry = ensureProblemEntry(state, problemId);
  entry.hintsUsed += 1;
  entry.updatedAt = nowIso();
  saveState(state);
}

export function setResult(state, problemId, result) {
  const entry = ensureProblemEntry(state, problemId);
  entry.lastResult = result;
  entry.solved = (result === "PASS");
  entry.updatedAt = nowIso();
  saveState(state);
}

export function getRunInput(state, problemId) {
  const entry = ensureProblemEntry(state, problemId);
  return entry.runInput ?? "";
}

export function setRunInput(state, problemId, text) {
  const entry = ensureProblemEntry(state, problemId);
  entry.runInput = String(text ?? "");
  entry.updatedAt = nowIso();
  saveState(state);
}

export function exportState(state, problemsMeta = {}) {
  return {
    exportedAt: nowIso(),
    app: {
      name: "FixIt – Eric’s Python Learnground",
      contentVersion: state.contentVersion,
      schemaVersion: state.schemaVersion,
    },
    user: state.user,
    progress: state.progress,
    problemsMeta,
  };
}

export async function submissionCodeFromExport(exportObj) {
  const json = JSON.stringify(exportObj);
  const enc = new TextEncoder().encode(json);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  const hex = hashArr.map(b => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 12).toUpperCase();
}

export async function buildSignedExport(state, problemsMeta = {}) {
  const base = exportState(state, problemsMeta);
  const code = await submissionCodeFromExport(base);
  return {
    ...base,
    submission: { code, algorithm: "SHA-256", codeLength: 12 }
  };
}
export function computeSummaryFromState(state) {
  const problems = state.progress?.problems ?? {};
  const ids = Object.keys(problems);

  let solved = 0;
  let attempts = 0;
  let hints = 0;

  for (const id of ids) {
    const e = problems[id];
    if (e?.solved) solved += 1;
    attempts += Number.isFinite(e?.attempts) ? e.attempts : 0;
    hints += Number.isFinite(e?.hintsUsed) ? e.hintsUsed : 0;
  }

  // Top misconception tags from events
  const counts = new Map();
  const items = state.events?.items ?? [];
  for (const ev of items) {
    if (ev.type === "fix_pick_bug" || ev.type === "fix_initial_bug") {
      const tag = ev.payload?.misconceptionTag ?? null;
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...counts.entries()]
    .map(([tag, n]) => ({ tag, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  return { solved, attempts, hints, topTags };
}
export function getUiPrefs(state) {
  if (!state.uiPrefs || typeof state.uiPrefs !== "object") {
    state.uiPrefs = {
      lastLevel: 1,
      lastProblemByLevel: {}
    };
    saveState(state);
  }
  if (!Number.isFinite(state.uiPrefs.lastLevel)) state.uiPrefs.lastLevel = 1;
  if (!state.uiPrefs.lastProblemByLevel || typeof state.uiPrefs.lastProblemByLevel !== "object") {
    state.uiPrefs.lastProblemByLevel = {};
  }
  return state.uiPrefs;
}

export function setLastSelection(state, level, problemId) {
  const ui = getUiPrefs(state);
  ui.lastLevel = level;
  ui.lastProblemByLevel[String(level)] = problemId;
  saveState(state);
}

export function getDraftCode(state, problemId) {
  const entry = ensureProblemEntry(state, problemId);
  return entry.draftCode ?? "";
}

export function setDraftCode(state, problemId, code) {
  const entry = ensureProblemEntry(state, problemId);
  entry.draftCode = String(code ?? "");
  entry.updatedAt = nowIso();
  saveState(state);
}


// --- P0: Factory reset ---
export function resetAllState() {
  // Vymaž všetky kľúče tejto aplikácie (nezávisle od verzie)
  const keysToDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("fixit.") || k.includes("fixit")) keysToDelete.push(k);
  }
  keysToDelete.forEach(k => localStorage.removeItem(k));

  // Ak nič nevymazalo (napr. iný kľúč), sprav "hard reset" pre daný origin.
  if (keysToDelete.length === 0) {
    localStorage.clear();
  }
}

export function importStateReplace(imported) {
  // Minimálna validácia a “sanitize”
  if (!imported || typeof imported !== "object") {
    throw new Error("Import: neplatný JSON objekt.");
  }

  // podporíme priamo exportState/buildSignedExport formát aj čistý state
  const candidate = imported.progress && imported.events ? imported : (imported.progress ? imported : null);

  let state;
  if (candidate && candidate.progress && candidate.events) {
    // vyzerá ako náš state
    state = candidate;
  } else if (imported.progress && imported.app) {
    // vyzerá ako exportObj (exportState/buildSignedExport)
    // skonštruujeme state z exportu
    state = {
      schemaVersion: imported.app?.schemaVersion ?? 2,
      contentVersion: imported.app?.contentVersion ?? "unknown",
      user: imported.user ?? { id: "anonymous", displayName: "Anonymous" },
      progress: imported.progress ?? { problems: {} },
      events: { max: 300, items: [] },
      uiPrefs: imported.uiPrefs ?? undefined,
      createdAt: imported.exportedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // eventy z exportu nemusia byť prítomné – ak chceš, môžeš ich do exportu pridať neskôr
    // zatiaľ necháme prázdne
  } else {
    throw new Error("Import: súbor nemá rozpoznateľnú štruktúru FixIt exportu.");
  }

  // doplň default štruktúry
  if (!state.progress) state.progress = { problems: {} };
  if (!state.progress.problems) state.progress.problems = {};
  if (!state.events) state.events = { max: 300, items: [] };
  if (!Array.isArray(state.events.items)) state.events.items = [];
  if (!Number.isFinite(state.events.max)) state.events.max = 300;

  // UI prefs (nepovinné)
  if (state.uiPrefs && typeof state.uiPrefs === "object") {
    if (!Number.isFinite(state.uiPrefs.lastLevel)) state.uiPrefs.lastLevel = 1;
    if (!state.uiPrefs.lastProblemByLevel || typeof state.uiPrefs.lastProblemByLevel !== "object") {
      state.uiPrefs.lastProblemByLevel = {};
    }
  }

  // zapíš do localStorage – tu použi tvoju existujúcu saveState
  saveState(state);
  return state;
}

export function getLastDiag(state, problemId) {
  const entry = ensureProblemEntry(state, problemId);
  return entry.lastDiag ?? null;
}

export function setLastDiag(state, problemId, diag) {
  const entry = ensureProblemEntry(state, problemId);
  entry.lastDiag = (diag && typeof diag === "object") ? diag : null;
  entry.updatedAt = nowIso();
  saveState(state);
}
