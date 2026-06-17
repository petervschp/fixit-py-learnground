import { describePyodideBaseUrl, getConfiguredPyodideBaseUrl } from "./pyodide-config.js";

const DEFAULT_STATUS = {
  state: "idle",
  message: "Python runtime sa spustí až pri Run/Testy.",
  detail: "App shell, trasy a JSON úlohy môžu fungovať offline; samotný Python runtime zatiaľ používa Pyodide cez CDN alebo nastavenú PYODIDE_BASE_URL cestu.",
  updatedAt: null
};

let currentStatus = { ...DEFAULT_STATUS };
let simplePanelMode = false;
const listeners = new Set();

export function getRuntimeStatus() {
  return { ...currentStatus };
}

export function setRuntimeStatus(update = {}) {
  currentStatus = {
    ...currentStatus,
    ...update,
    updatedAt: new Date().toISOString()
  };
  updateRuntimeStatusDom();
  for (const fn of listeners) {
    try { fn(getRuntimeStatus()); } catch {}
  }
}

export function subscribeRuntimeStatus(fn) {
  if (typeof fn !== "function") return () => {};
  listeners.add(fn);
  try { fn(getRuntimeStatus()); } catch {}
  return () => listeners.delete(fn);
}

export function runtimeStatusClass(state = currentStatus.state) {
  if (["ready", "ok"].includes(state)) return "runtime-ok";
  if (["loading", "starting", "checking"].includes(state)) return "runtime-loading";
  if (["offline", "error", "unavailable", "timeout"].includes(state)) return "runtime-error";
  return "runtime-idle";
}

export function pyodideFallbackMessage(errorLike = "") {
  const msg = String(errorLike && errorLike.message ? errorLike.message : errorLike);
  if (msg.includes("TIMEOUT")) {
    return "Zadanie vidíš, ale Python sa teraz nedá spustiť alebo program prekročil časový limit. Ak ide o nekonečný cyklus, uprav kód; ak sa to deje pri prvom spustení, skontroluj internet a Pyodide runtime.";
  }
  return "Zadanie vidíš, ale Python sa teraz nedá spustiť. App shell, zadania, trasy a predikčné čítanie kódu ostávajú dostupné, ale Run/Testy potrebujú Pyodide CDN alebo nastavenú lokálnu PYODIDE_BASE_URL cestu.";
}

export function renderRuntimeStatusPanelHtml(options = {}) {
  simplePanelMode = Boolean(options.simpleMode);
  const st = getRuntimeStatus();
  const view = formatRuntimeStatusForDisplay(st, simplePanelMode);
  return `
    <section class="runtime-panel ${runtimeStatusClass(st.state)} ${simplePanelMode ? "runtime-simple" : ""}" id="runtimeStatusPanel" aria-live="polite">
      <div class="runtime-row">
        <strong>${simplePanelMode ? "Stav Pythonu" : "Python runtime"}</strong>
        <span class="runtime-pill" id="runtimeStatusState">${escapeForRuntime(view.stateLabel)}</span>
      </div>
      <div class="small" id="runtimeStatusMessage">${escapeForRuntime(view.message)}</div>
      <div class="small runtime-detail" id="runtimeStatusDetail">${escapeForRuntime(view.detail ?? "")}</div>
    </section>
  `;
}

export function bindRuntimeStatusPanel(options = {}) {
  simplePanelMode = Boolean(options.simpleMode);
  updateRuntimeStatusDom();
  if (typeof window !== "undefined") {
    const updateOnlineState = () => {
      if (navigator && navigator.onLine === false) {
        setRuntimeStatus({
          state: "offline",
          message: "Prehliadač je offline.",
          detail: "Zadania a trasy môžu byť dostupné z cache. Run/Testy fungujú iba vtedy, ak je Pyodide runtime dostupný z prehliadačovej cache alebo z nastavenej lokálnej cesty."
        });
      } else if (["offline", "unavailable"].includes(currentStatus.state)) {
        setRuntimeStatus({
          state: "idle",
          message: DEFAULT_STATUS.message,
          detail: DEFAULT_STATUS.detail
        });
      }
    };
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    updateOnlineState();
  }
}

export function updateRuntimeStatusDom() {
  if (typeof document === "undefined") return;
  const panel = document.querySelector("#runtimeStatusPanel");
  if (!panel) return;
  const st = getRuntimeStatus();
  const view = formatRuntimeStatusForDisplay(st, simplePanelMode);
  panel.className = `runtime-panel ${runtimeStatusClass(st.state)} ${simplePanelMode ? "runtime-simple" : ""}`;
  const stateEl = document.querySelector("#runtimeStatusState");
  const msgEl = document.querySelector("#runtimeStatusMessage");
  const detailEl = document.querySelector("#runtimeStatusDetail");
  if (stateEl) stateEl.textContent = view.stateLabel;
  if (msgEl) msgEl.textContent = view.message;
  if (detailEl) detailEl.textContent = view.detail ?? "";
}

function formatRuntimeStatusForDisplay(st, simpleMode) {
  if (!simpleMode) {
    const info = describePyodideBaseUrl(getConfiguredPyodideBaseUrl());
    const detail = st.detail || info.teacherNote;
    return { stateLabel: st.state, message: st.message, detail };
  }

  if (["ready", "ok"].includes(st.state)) {
    return { stateLabel: "pripravený", message: "Python je pripravený. Run/Testy môžeš používať.", detail: "" };
  }
  if (["loading", "starting", "checking"].includes(st.state)) {
    return { stateLabel: "pripravuje sa", message: "Python sa pripravuje. Prvé spustenie môže chvíľu trvať.", detail: "" };
  }
  if (["offline", "error", "unavailable", "timeout"].includes(st.state)) {
    return { stateLabel: "nedostupný", message: "Zadanie vidíš, ale Python sa teraz nedá spustiť.", detail: "Pokračuj v čítaní kódu alebo zavolaj učiteľa." };
  }
  return { stateLabel: "čaká", message: "Python sa spustí až pri Run/Testy.", detail: "" };
}

function escapeForRuntime(s) {
  return String(s ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}
