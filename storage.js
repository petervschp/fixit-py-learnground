// storage.js — namespaced localStorage adapter + private backup/anonymized summary exports.

export const STORAGE_KEY = "fixit.student.v3";
const LEGACY_STORAGE_KEYS = ["fixit.userState.v3", "fixit.userState.v2", "fixit.userState"];
export const CONTENT_VERSION = "2026-06-17-student-path-v0.9-vendor-pyodide-deployment";

function nowIso() {
  return new Date().toISOString();
}

export function defaultState() {
  return {
    schemaVersion: 3,
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
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        raw = localStorage.getItem(legacyKey);
        if (raw) break;
      }
    }
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultState();

    // minimal schema sanity + v2 -> v3 migration
    if (!parsed.schemaVersion) parsed.schemaVersion = 3;
    if (parsed.schemaVersion < 3) parsed.schemaVersion = 3;
    if (!parsed.progress) parsed.progress = { problems: {} };
    if (!parsed.progress.problems) parsed.progress.problems = {};
    if (!parsed.events) parsed.events = { max: 300, items: [] };
    if (!Array.isArray(parsed.events.items)) parsed.events.items = [];
    if (!Number.isFinite(parsed.events.max)) parsed.events.max = 300;
    if (!parsed.routes || typeof parsed.routes !== "object") parsed.routes = { currentRouteId: null, history: [] };
    if (!Array.isArray(parsed.routes.history)) parsed.routes.history = [];

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
      status: "new",
      microDefenseStatus: null,
      selfRating: null,
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
  e.status = ["new", "attempted", "tests_passed", "explained"].includes(e.status)
    ? e.status
    : (e.solved ? "tests_passed" : (e.attempts > 0 ? "attempted" : "new"));
  e.microDefenseStatus = typeof e.microDefenseStatus === "string" ? e.microDefenseStatus : null;
  e.selfRating = Number.isFinite(e.selfRating) ? e.selfRating : null;
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
  if (result === "PASS") {
    entry.status = entry.status === "explained" ? "explained" : "tests_passed";
  } else {
    entry.status = "attempted";
    entry.microDefenseStatus = null;
    entry.selfRating = null;
  }
  entry.updatedAt = nowIso();
  saveState(state);
}

export function setMicroDefenseStatus(state, problemId, rating) {
  const entry = ensureProblemEntry(state, problemId);
  const n = Number(rating);
  entry.selfRating = Number.isFinite(n) ? n : null;
  entry.microDefenseStatus = n >= 3 ? "explained" : (n === 2 ? "explained_with_help" : "not_explained");
  if (entry.lastResult === "PASS" && n >= 3) {
    entry.status = "explained";
  } else if (entry.lastResult === "PASS") {
    entry.status = "tests_passed";
  } else {
    entry.status = "attempted";
  }
  entry.updatedAt = nowIso();
  saveState(state);
}

export function setCurrentRoute(state, routeId) {
  if (!state.routes || typeof state.routes !== "object") state.routes = { currentRouteId: null, history: [] };
  state.routes.currentRouteId = routeId || null;
  if (routeId) {
    state.routes.history = Array.isArray(state.routes.history) ? state.routes.history : [];
    state.routes.history = [routeId, ...state.routes.history.filter(x => x !== routeId)].slice(0, 20);
  }
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

export async function buildPrivateBackupExport(state, problemsMeta = {}) {
  const out = {
    type: "fixit-private-backup",
    schemaVersion: 1,
    contentVersion: state.contentVersion ?? CONTENT_VERSION,
    exportedAt: nowIso(),
    privacy: {
      containsName: Boolean(state.user?.displayName && state.user.displayName !== "Anonymous"),
      containsCode: true,
      containsRunInput: true,
      containsFreeText: false,
      note: "Private backup is for the student only. It may include draft code and stdin. Do not submit it as an anonymous teacher summary."
    },
    problemsMeta,
    state
  };
  const code = await submissionCodeFromExport(out);
  return { ...out, submission: { code, algorithm: "SHA-256", codeLength: 12 } };
}

export async function buildAnonymousSummaryExport(state, route = null, problemsMeta = {}) {
  const problems = state.progress?.problems ?? {};
  const taskStatus = Object.entries(problems).map(([id, e]) => ({
    id,
    status: e?.status ?? (e?.solved ? "tests_passed" : "new"),
    lastResult: e?.lastResult ?? null,
    attempts: Number.isFinite(e?.attempts) ? e.attempts : 0,
    hintsUsed: Number.isFinite(e?.hintsUsed) ? e.hintsUsed : 0,
    selfRating: Number.isFinite(e?.selfRating) ? e.selfRating : null
  })).sort((a, b) => a.id.localeCompare(b.id));

  const summary = {
    tasksTouched: taskStatus.filter(x => x.attempts > 0 || x.hintsUsed > 0 || x.lastResult).length,
    testsPassed: taskStatus.filter(x => x.lastResult === "PASS").length,
    explained: taskStatus.filter(x => x.status === "explained").length,
    attempts: taskStatus.reduce((acc, x) => acc + x.attempts, 0),
    hintsUsed: taskStatus.reduce((acc, x) => acc + x.hintsUsed, 0),
  };

  const events = state.events?.items ?? [];
  const failureCounts = new Map();
  for (const ev of events) {
    const kind = ev.payload?.kind || ev.payload?.misconceptionTag || ev.payload?.failureKind || null;
    if (!kind) continue;
    if (["run_input_change", "no_diag", "passed"].includes(kind)) continue;
    failureCounts.set(kind, (failureCounts.get(kind) ?? 0) + 1);
  }
  summary.topFailureKinds = [...failureCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kind, n]) => ({ kind, n }));

  const out = {
    type: "fixit-anonymous-summary",
    schemaVersion: 1,
    contentVersion: state.contentVersion ?? CONTENT_VERSION,
    exportedAt: nowIso(),
    route: route ? { id: route.id, title: route.title, phase: route.phase } : { id: state.routes?.currentRouteId ?? null },
    summary,
    taskStatus,
    problemsMeta,
    privacy: {
      containsName: false,
      containsCode: false,
      containsFreeText: false,
      note: "Anonymous teacher summary intentionally excludes user identity, draft code, run input and free-text microdefense. It is not a private backup and cannot restore student work."
    }
  };
  const code = await submissionCodeFromExport(out);
  return { ...out, submission: { code, algorithm: "SHA-256", codeLength: 12 } };
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
    if (k.startsWith("fixit.")) keysToDelete.push(k);
  }
  keysToDelete.forEach(k => localStorage.removeItem(k));

  // Bez fallback localStorage.clear(): FixIt nesmie mazať Teacher Companion ani iné dáta na rovnakom origine.
}

export function importStateReplace(imported) {
  // Import je určený iba pre súkromnú zálohu žiaka.
  // Anonymný teacher summary zámerne neobsahuje kód ani stdin, preto sa nedá použiť na obnovu práce.
  if (!imported || typeof imported !== "object") {
    throw new Error("Import: neplatný JSON objekt.");
  }
  if (imported.type === "fixit-anonymous-summary") {
    throw new Error("Toto je anonymné zhrnutie pre učiteľa, nie súkromná záloha. Nedá sa importovať späť ako práca žiaka.");
  }

  let state;
  if (imported.type === "fixit-private-backup" && imported.state) {
    state = imported.state;
  } else if (imported.progress && imported.events) {
    // legacy/raw state fallback
    state = imported;
  } else if (imported.progress && imported.app) {
    // legacy signed export fallback
    state = {
      schemaVersion: imported.app?.schemaVersion ?? 3,
      contentVersion: imported.app?.contentVersion ?? "unknown",
      user: imported.user ?? { id: "anonymous", displayName: "Anonymous" },
      progress: imported.progress ?? { problems: {} },
      events: { max: 300, items: [] },
      routes: imported.routes ?? { currentRouteId: null, history: [] },
      uiPrefs: imported.uiPrefs ?? undefined,
      createdAt: imported.exportedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    throw new Error("Import: súbor nemá štruktúru súkromnej FixIt zálohy.");
  }

  if (!state || typeof state !== "object") {
    throw new Error("Import: chýba vnútorný stav aplikácie.");
  }
  state.schemaVersion = Number.isFinite(state.schemaVersion) ? state.schemaVersion : 3;
  if (!state.progress) state.progress = { problems: {} };
  if (!state.progress.problems) state.progress.problems = {};
  if (!state.events) state.events = { max: 300, items: [] };
  if (!Array.isArray(state.events.items)) state.events.items = [];
  if (!Number.isFinite(state.events.max)) state.events.max = 300;
  if (!state.routes || typeof state.routes !== "object") state.routes = { currentRouteId: null, history: [] };
  if (!Array.isArray(state.routes.history)) state.routes.history = [];
  if (!state.user || typeof state.user !== "object") state.user = { id: "anonymous", displayName: "Anonymous" };
  // V žiackej appke nepoužívame mená. Pri importe starších exportov ich neutralizujeme.
  state.user.id = "anonymous";
  state.user.displayName = "Anonymous";
  state.contentVersion = CONTENT_VERSION;

  if (state.uiPrefs && typeof state.uiPrefs === "object") {
    if (!Number.isFinite(state.uiPrefs.lastLevel)) state.uiPrefs.lastLevel = 1;
    if (!state.uiPrefs.lastProblemByLevel || typeof state.uiPrefs.lastProblemByLevel !== "object") {
      state.uiPrefs.lastProblemByLevel = {};
    }
  }

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
