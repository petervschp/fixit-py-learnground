import { escapeHtml } from "./utils.js";
import {
  buildTaskPresentation,
  renderTaskHeaderHtml,
  renderRouteContextHtml,
  renderTaskContextPanelHtml
} from "./task-header-context-panel.js";
import { renderProblemNavigationHtml, setupProblemNavigation } from "./problem-navigation.js";
import { renderEditorPanelHtml, setupEditorPanel, installPythonIndentation } from "./editor-panel.js";
import {
  renderPredictPanelHtml,
  renderFixPanelHtml,
  getBaseCodeForProblem,
  setupFixPanel,
  setupPredictPanel
} from "./predict-fix-panel.js";
import { setupTestActionHandlers } from "./test-action-handlers.js";
import { renderRuntimeStatusPanelHtml, bindRuntimeStatusPanel } from "./runtime-status.js";
import { createHintController } from "./diagnostic-hints.js";
import { renderStatusBadge } from "./microdefense.js";
import { setupExportBackupHandlers } from "./export-backup.js";
import { computeMisconceptionStats, renderTaskMap } from "./map-ui.js";
import {
  loadState,
  ensureProblemEntry,
  setMicroDefenseStatus,
  recordEvent
} from "../storage.js";

const app = document.querySelector("#app");

function renderActionPanelsHtml(simpleMode) {
  return `
    <section class="action-section primary-actions" aria-label="Hlavné pracovné akcie">
      <div class="row">
        <button id="btnRun" class="btn">Run</button>
        <button id="btnTest" class="btn">Testy</button>
        <button id="btnHint" class="btn secondary">Poraď mi</button>
      </div>
    </section>

    ${simpleMode ? `
      <section class="action-section simple-note">
        <div class="small">Jednoduchý režim skrýva odovzdanie, zálohy a pokročilé nastavenia. Učiteľ alebo rýchlejší žiak môže zapnúť plný režim cez horný odkaz.</div>
      </section>
    ` : `
      <section class="action-section submission-actions" aria-label="Anonymné odovzdanie učiteľovi">
        <h3>Odovzdať učiteľovi anonymné zhrnutie</h3>
        <p class="small">Tento export neobsahuje meno, kód, stdin ani voľný text. Nedá sa použiť ako spätný import tvojej práce.</p>
        <div class="row">
          <button id="btnExport" class="btn secondary">Stiahnuť anonymné zhrnutie</button>
          <button id="btnCode" class="btn secondary">Skopírovať anonymný kód</button>
          <button id="btnSummary" class="btn secondary">Skopírovať krátke zhrnutie</button>
        </div>
      </section>

      <details class="action-section advanced-actions">
        <summary>Pokročilé: moja súkromná záloha, import, reset</summary>
        <p class="small"><strong>Moja súkromná záloha</strong> môže obsahovať rozpracovaný kód a vstupy. Neodovzdávaj ju učiteľovi ako anonymné zhrnutie.</p>
        <div class="row">
          <button id="btnBackup" class="btn secondary">Stiahnuť moju súkromnú zálohu</button>
          <button id="btnImport" class="btn secondary">Importovať súkromnú zálohu</button>
          <button id="btnReset" class="btn secondary">Resetovať aktuálnu úlohu</button>
          <button id="btnFactoryReset" class="btn secondary danger">Vymazať môj progres</button>
          <button id="btnOfflineCacheReset" class="btn secondary danger">Vymazať offline cache</button>
        </div>
        <input id="fileImport" type="file" accept="application/json" style="display:none;" />
      </details>
    `}
  `;
}

function renderAuxiliaryPanelsHtml(simpleMode) {
  return `
    <section class="card">
      <h3 style="margin-top:0;">Mapa úloh</h3>
      <div class="small">Klikni na úlohu. Farby: zelená = testy prešli/vysvetlené, žltá = skúšané, sivá = nové.</div>
      <div id="mapBox" class="map"></div>
    </section>

    ${simpleMode ? "" : `
      <section class="card">
        <h3>Mini-štatistiky (tvoje chyby)</h3>
        <div id="statsBox" class="small">Načítavam…</div>
      </section>
    `}

    <section class="card">
      <h3>Output</h3>
      <pre id="out" class="output"></pre>
    </section>

    <section class="card">
      <h3>Testy</h3>
      <div class="small">Viditeľné testy ukazujú expected/got. Skryté testy ukazujú len OK/FAIL.</div>
      <div id="tests"></div>
    </section>
  `;
}

function renderStats(state, statsBox) {
  if (!statsBox) return;
  const top = computeMisconceptionStats(state);
  if (top.length === 0) {
    statsBox.innerHTML = "Zatiaľ nemáš dosť údajov. Skús pár Fix úloh a potom sa tu ukáže, na čom najčastejšie padáš.";
    return;
  }
  statsBox.innerHTML = `
    <ol>
      ${top.map(x => `<li><strong>${escapeHtml(x.tag)}</strong> — ${x.n}×</li>`).join("")}
    </ol>
    <div class="small">Počítané z tvojich výberov chybného riešenia (Fix).</div>
  `;
}

function setupMicroDefenseHandlers({ problem, route, refreshLearningNextStep, renderMap }) {
  document.querySelectorAll(".btnMicroDefense").forEach(btn => {
    btn.addEventListener("click", () => {
      const rating = Number(btn.getAttribute("data-rating"));
      const fresh = loadState();
      setMicroDefenseStatus(fresh, problem.id, rating);
      recordEvent(fresh, "micro_defense_self_check", { problemId: problem.id, rating, routeId: route?.id ?? null });
      const e = ensureProblemEntry(fresh, problem.id);
      const solvedSlot = document.querySelector("#solvedBadgeSlot");
      if (solvedSlot) solvedSlot.innerHTML = renderStatusBadge(e);
      const status = document.querySelector("#microDefenseStatus");
      if (status) status.textContent = rating >= 3
        ? "Uložené: viem samostatne vysvetliť."
        : (rating === 2 ? "Uložené: viem vysvetliť s pomocou." : "Uložené: zatiaľ neviem vysvetliť.");
      refreshLearningNextStep(e);
      try { if (typeof renderMap === "function") renderMap(); } catch {}
    });
  });
}

function collectTaskElements() {
  return {
    problemSelect: document.querySelector("#problemSelect"),
    levelSelect: document.querySelector("#levelSelect"),
    codeEl: document.querySelector("#code"),
    runInputEl: document.querySelector("#runInput"),
    outEl: document.querySelector("#out"),
    testsEl: document.querySelector("#tests"),
    statusEl: document.querySelector("#status"),
    hintBox: document.querySelector("#hintBox"),
    statsBox: document.querySelector("#statsBox"),
    btnRun: document.querySelector("#btnRun"),
    btnTest: document.querySelector("#btnTest"),
    btnHint: document.querySelector("#btnHint"),
    btnReset: document.querySelector("#btnReset"),
    btnExport: document.querySelector("#btnExport"),
    btnCode: document.querySelector("#btnCode"),
    btnSummary: document.querySelector("#btnSummary"),
    btnBackup: document.querySelector("#btnBackup"),
    btnImport: document.querySelector("#btnImport"),
    fileImport: document.querySelector("#fileImport"),
    btnFactoryReset: document.querySelector("#btnFactoryReset"),
    btnOfflineCacheReset: document.querySelector("#btnOfflineCacheReset"),
    mapBox: document.querySelector("#mapBox"),
    btnUseSample: document.querySelector("#btnUseSample"),
    btnClearInput: document.querySelector("#btnClearInput"),
    buggySelect: document.querySelector("#buggySelect"),
    predictGuessEl: document.querySelector("#predictGuess"),
    btnLockGuess: document.querySelector("#btnLockGuess"),
    btnClearGuess: document.querySelector("#btnClearGuess"),
    predictStatusEl: document.querySelector("#predictStatus")
  };
}

export function render(problem, state, allProblems, currentLevel, context = {}) {
  const buggyList = Array.isArray(problem.buggy_solutions) ? problem.buggy_solutions : [];
  const isFix = problem.mode === "fix";
  const defaultBuggy = isFix ? (buggyList[0]?.id ?? null) : null;
  const route = context.route ?? null;
  const routeTaskMetaById = context.routeTaskMetaById ?? {};
  const simpleMode = Boolean(context.simpleMode);

  const { entry, currentRouteTask, md, badgeHtml } = buildTaskPresentation({ problem, state, route, routeTaskMetaById });
  const navHtml = renderProblemNavigationHtml({ problem, allProblems, currentLevel, route, routeTaskMetaById, simpleMode });

  app.innerHTML = `
    <section class="card">
      ${renderTaskHeaderHtml({ problem, entry, badgeHtml, navHtml })}
      ${renderRouteContextHtml({ route, currentRouteTask, md })}
      ${renderTaskContextPanelHtml({ problem, entry, md })}
      ${renderPredictPanelHtml(problem)}
      ${renderFixPanelHtml({ isFix, buggyList })}
      ${renderEditorPanelHtml()}
      ${renderActionPanelsHtml(simpleMode)}
      ${renderRuntimeStatusPanelHtml({ simpleMode })}
      <div class="small" id="status"></div>
      <div id="hintBox" class="hint hidden"></div>
    </section>
    ${renderAuxiliaryPanelsHtml(simpleMode)}
  `;

  bindRuntimeStatusPanel({ simpleMode });

  const el = collectTaskElements();
  if (el.levelSelect) el.levelSelect.value = String(currentLevel);

  function setStatus(msg) {
    el.statusEl.textContent = msg || "";
  }

  function showOutput(stdout, stderr = "") {
    const parts = [];
    if (stdout) parts.push(stdout);
    if (stderr) parts.push("\n[stderr]\n" + stderr);
    el.outEl.textContent = parts.join("\n");
  }

  function refreshLearningNextStep(entryOverride = null) {
    const e = entryOverride || ensureProblemEntry(loadState(), problem.id);
    const box = document.querySelector("#nextStepText");
    if (!box) return;
    if (e.lastResult === "FAIL") {
      box.textContent = "Pred ďalším pokusom si pozri prvý zlyhaný test: čo test poslal, čo očakával a čo tvoj kód vrátil alebo vypísal.";
    } else if (e.lastResult === "PASS" && e.status !== "explained") {
      box.textContent = "Teraz odpovedz na otázku mikroobhajoby. Ak nevieš, pozri prvý test alebo klikni Poraď mi. Po vysvetlení pokračuj.";
    } else if (e.status === "explained") {
      box.textContent = "Úloha má prejdené testy aj označené porozumenie. Pokračuj na ďalšiu jadrovú úlohu alebo skonči krátky tréningový blok.";
    }
  }

  function renderMap() {
    renderTaskMap({
      mapBox: el.mapBox,
      allProblems,
      route,
      currentLevel,
      context,
      onSelectProblem: (next, fresh) => render(next, fresh, allProblems, next.level ?? currentLevel, context)
    });
  }

  setupProblemNavigation({
    problemSelect: el.problemSelect,
    levelSelect: el.levelSelect,
    allProblems,
    currentLevel,
    route,
    context,
    onRender: render
  });

  const editorController = setupEditorPanel({
    problem,
    state,
    codeEl: el.codeEl,
    runInputEl: el.runInputEl,
    btnUseSample: el.btnUseSample,
    btnClearInput: el.btnClearInput,
    setStatus,
    getBaseCodeForProblem: () => getBaseCodeForProblem({ problem, buggySelect: el.buggySelect, buggyList, defaultBuggy })
  });
  installPythonIndentation(el.predictGuessEl);

  setupFixPanel({
    problem,
    state,
    buggySelect: el.buggySelect,
    buggyList,
    defaultBuggy,
    overwriteDraftWithBase: editorController.overwriteDraftWithBase,
    outEl: el.outEl,
    testsEl: el.testsEl,
    statusEl: el.statusEl
  });

  const predictController = setupPredictPanel({
    problem,
    state,
    predictGuessEl: el.predictGuessEl,
    btnLockGuess: el.btnLockGuess,
    btnClearGuess: el.btnClearGuess,
    predictStatusEl: el.predictStatusEl,
    btnTest: el.btnTest
  });

  const hintController = createHintController({
    problem,
    state,
    btnHint: el.btnHint,
    hintBox: el.hintBox,
    setStatus
  });

  setupExportBackupHandlers({
    btnExport: el.btnExport,
    btnCode: el.btnCode,
    btnSummary: el.btnSummary,
    btnBackup: el.btnBackup,
    btnImport: el.btnImport,
    fileImport: el.fileImport,
    btnFactoryReset: el.btnFactoryReset,
    btnOfflineCacheReset: el.btnOfflineCacheReset,
    problem,
    route,
    setStatus,
    renderMap
  });

  setupMicroDefenseHandlers({ problem, route, refreshLearningNextStep, renderMap });

  el.btnReset?.addEventListener("click", () => {
    hintController.resetHint();
    el.outEl.textContent = "";
    el.testsEl.innerHTML = "";
    setStatus("");
    editorController.overwriteDraftWithBase();
  });

  setupTestActionHandlers({
    problem,
    state,
    codeEl: el.codeEl,
    runInputEl: el.runInputEl,
    outEl: el.outEl,
    testsEl: el.testsEl,
    btnRun: el.btnRun,
    btnTest: el.btnTest,
    setStatus,
    showOutput,
    predictController,
    refreshHintAvailability: hintController.refreshHintAvailability,
    refreshLearningNextStep,
    renderMap
  });

  renderMap();
  renderStats(state, el.statsBox);
}
