import { setRuntimeStatus, pyodideFallbackMessage } from "./runtime-status.js";
import { getConfiguredPyodideBaseUrl, describePyodideBaseUrl } from "./pyodide-config.js";

/** ---------- PYODIDE (Worker runner + timeout) ---------- **/
let _pyWorker = null;
let _reqSeq = 0;
const _pending = new Map();

function _startWorker() {
  _pyWorker = new Worker("./py-worker.js", { type: "classic" });
  const pyodideInfo = describePyodideBaseUrl(getConfiguredPyodideBaseUrl());
  try {
    _pyWorker.postMessage({ type: "config", pyodideBaseUrl: pyodideInfo.baseUrl });
  } catch {}

  _pyWorker.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.type === "runtime_status") {
      setRuntimeStatus({ state: msg.state, message: msg.message, detail: msg.detail });
      return;
    }
    const entry = _pending.get(msg.id);
    if (!entry) return;
    _pending.delete(msg.id);

    if (msg.ok) entry.resolve(msg.result);
    else entry.reject(new Error(msg.error?.message || "Worker error"));
  };

  _pyWorker.onerror = () => {
    setRuntimeStatus({
      state: "error",
      message: "Python worker spadol alebo ho prehliadač zablokoval.",
      detail: pyodideFallbackMessage("Worker crashed")
    });
    for (const [id, entry] of _pending.entries()) {
      entry.reject(new Error("Worker crashed"));
      _pending.delete(id);
    }
  };
}

function _ensureWorker() {
  if (!_pyWorker) _startWorker();
  return _pyWorker;
}

async function _callWorker(action, payload, timeoutMs) {
  const pyodideInfo = describePyodideBaseUrl(getConfiguredPyodideBaseUrl());
  setRuntimeStatus({
    state: "starting",
    message: "Pripravujem Python runtime…",
    detail: `${pyodideInfo.teacherNote} App shell a úlohy môžu byť dostupné offline, ale hlavný ZIP Pyodide runtime stále lokálne nebalí.`
  });
  _ensureWorker();
  const id = ++_reqSeq;

  const p = new Promise((resolve, reject) => {
    _pending.set(id, { resolve, reject });
    _pyWorker.postMessage({ id, action, payload });
  });

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
  });

  try {
    return await Promise.race([p, timeout]);
  } catch (e) {
    setRuntimeStatus({
      state: String(e && e.message ? e.message : e).includes("TIMEOUT") ? "timeout" : "error",
      message: "Python runtime alebo program sa nepodarilo dokončiť.",
      detail: pyodideFallbackMessage(e)
    });
    // On timeout: terminate worker to stop infinite loops, then recreate later
    try {
      _pyWorker.terminate();
    } catch {}
    _pyWorker = null;

    // reject any pending
    for (const [pid, entry] of _pending.entries()) {
      entry.reject(new Error("Terminated"));
      _pending.delete(pid);
    }
    throw e;
  }
}

export async function runPython(userCode, inputData = "") {
  const res = await _callWorker("run", { userCode, inputData }, 2000);
  return {
    ok: Boolean(res.ok),
    stdout: String(res.stdout ?? ""),
    stderr: String(res.stderr ?? ""),
  };
}

export async function runPythonFunction(userCode, fnName, args = [], kwargs = {}, mutSpec = null) {
  const mutIdxs = (mutSpec && mutSpec.check) ? (mutSpec.inputsMustRemainUnchanged ?? []) : [];
  const mutCheck = (mutSpec && mutSpec.check) ? true : false;

  const res = await _callWorker(
    "run_function",
    { userCode, fnName, args, kwargs, mutIdxs, mutCheck },
    2500
  );

  return {
    ok: Boolean(res.ok),
    kind: String(res.kind ?? ""),
    return_json: String(res.return_json ?? ""),
    mutation_check: Boolean(res.mutation_check ?? false),
    mutation_ok: Boolean(res.mutation_ok ?? false),
    mutation_failed_indices: Array.isArray(res.mutation_failed_indices) ? res.mutation_failed_indices : [],
    stdout: String(res.stdout ?? ""),
    stderr: String(res.stderr ?? ""),
  };
}

export async function runAstChecks(userCode, astCfg) {
  const res = await _callWorker("ast_check", { userCode, astCfg }, 1500);
  const violations = (res.violations ?? []).map((v) => ({
    source: "ast",
    type: String(v.type ?? ""),
    name: v.name ?? null,
    lineno: Number(v.lineno ?? 1),
    col: Number(v.col ?? 0),
    message: String(v.message ?? "Porušenie štruktúry."),
  }));
  return { ok: Boolean(res.ok), violations };
}

export async function runGenFunctionCases(generatorCfg) {
  return await _callWorker("gen_cases", { generatorCfg }, 1500);
}



export function terminatePythonWorker() {
  try {
    if (_pyWorker) _pyWorker.terminate();
  } catch {}
  _pyWorker = null;
  setRuntimeStatus({
    state: "idle",
    message: "Python runtime bol ukončený a spustí sa znova pri ďalšom Run/Testy.",
    detail: "App shell a JSON úlohy ostávajú dostupné; Pyodide runtime sa pri ďalšom spustení môže načítať podľa aktuálnej PYODIDE_BASE_URL konfigurácie."
  });
  for (const [id, entry] of _pending.entries()) {
    try { entry.reject(new Error("Terminated")); } catch {}
    _pending.delete(id);
  }
}
