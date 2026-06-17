import { escapeHtml } from "./utils.js";
import { runPython } from "./runner-client.js";
import { pyodideFallbackMessage } from "./runtime-status.js";
import { runAllTests, runFunctionEvaluation, runStructureChecks } from "./test-engine.js";
import { renderFirstFailedSummary } from "./diagnostics.js";
import { renderStatusBadge } from "./microdefense.js";
import {
  loadState,
  ensureProblemEntry,
  recordEvent,
  incAttempts,
  setResult,
  setLastDiag
} from "../storage.js";

function refreshHeaderProgress(problem) {
  const fresh = loadState();
  const e = ensureProblemEntry(fresh, problem.id);
  const attemptsEl = document.querySelector("#attemptsVal");
  const hintsEl = document.querySelector("#hintsVal");
  const lastResEl = document.querySelector("#lastResultVal");
  const solvedSlot = document.querySelector("#solvedBadgeSlot");
  if (attemptsEl) attemptsEl.textContent = String(e.attempts);
  if (hintsEl) hintsEl.textContent = String(e.hintsUsed);
  if (lastResEl) lastResEl.textContent = String(e.lastResult ?? "—");
  if (solvedSlot) solvedSlot.innerHTML = renderStatusBadge(e);
  return e;
}

function enableMicroDefenseAfterPass() {
  document.querySelectorAll(".btnMicroDefense").forEach(b => { b.disabled = false; });
  const mdStatus = document.querySelector("#microDefenseStatus");
  if (mdStatus) mdStatus.textContent = "Testy prešli. Teraz označ, ako vieš riešenie vysvetliť.";
}

function renderStructureResults(structure) {
  const structureBadge = structure.passed
    ? `<span class="badge ok">OK</span>`
    : `<span class="badge no">FAIL</span>`;

  const structureItemsHtml = (structure.violations ?? []).map(v => {
    if (v.source === "ast") {
      const loc = (v.lineno != null) ? `riadok ${v.lineno}:${v.col ?? 0}` : "";
      const extra = v.name ? ` (${v.name}())` : "";
      return `
        <li>
          <div><strong>${escapeHtml(v.message)}</strong>${escapeHtml(extra)}</div>
          <div class="small">AST: ${escapeHtml(loc)}</div>
        </li>
      `;
    }
    return `
      <li>
        <div><strong>${escapeHtml(v.message)}</strong></div>
        <div class="small">Vzorec: <code>${escapeHtml(v.pattern ?? "")}</code></div>
        ${(v.match) ? `<div class="small">Nájdené: <code>${escapeHtml(v.match)}</code></div>` : ``}
      </li>
    `;
  }).join("");

  return `
    <div class="card" style="margin-top:10px;">
      <h4 style="margin:0 0 6px 0;">Štrukturálne kontroly ${structureBadge}</h4>
      ${structure.passed ? `
        <div class="small">Žiadne zakázané vzory neboli nájdené.</div>
      ` : `
        <ol>${structureItemsHtml}</ol>
      `}
    </div>
  `;
}

function renderFunctionalResults(functional, evalKind) {
  const functionalBadge = functional.passed
    ? `<span class="badge ok">PASS</span>`
    : `<span class="badge no">FAIL</span>`;

  const functionalHeader = evalKind === "function"
    ? `Funkčné testy (return) ${functionalBadge}`
    : `Funkčné testy (stdin/stdout) ${functionalBadge}`;

  const hiddenSummary = (evalKind === "function" && Number.isFinite(functional.hiddenTotal) && functional.hiddenTotal > 0)
    ? `<div class="small">hidden: ${functional.hiddenPassed}/${functional.hiddenTotal} OK (generované: ${functional.generatedCount ?? 0})</div>`
    : ``;

  return `
    <div class="card" style="margin-top:10px;">
      <h4 style="margin:0 0 6px 0;">${functionalHeader}</h4>
      ${hiddenSummary}
      <ol>
        ${(functional.details ?? []).map(d => `
          <li style="margin-bottom:10px;">
            ${d.ok ? `<span class="badge ok">OK</span>` : `<span class="badge no">ZLE</span>`}
            ${d.visible ? `<span class="small"> (visible)</span>` : `<span class="small"> (hidden)</span>`}

            ${evalKind === "function" ? (
              d.visible ? `
                <div class="kv" style="margin-top:8px;">
                  <div class="small">expected return</div>
                  <pre>${escapeHtml(d.expected)}</pre>
                  <div class="small">got return</div>
                  <pre>${escapeHtml(d.got)}</pre>
                  ${d.mutationActive ? `
                    <div class="small">mutation</div>
                    <pre>${d.okMutation ? "OK (no mutation)" : ("FAIL (changed args: " + (d.mutationFailedIndices ?? []).join(", ") + ")")}</pre>
                  ` : ``}
                </div>
              ` : `
                <div class="small" style="margin-top:8px;">
                  Skrytý test: ${d.ok ? "prešiel" : "neprešiel"}.
                </div>
                ${(!d.runtimeOk && d.stderr) ? `<pre>${escapeHtml(d.stderr)}</pre>` : ``}
              `
            ) : (
              d.visible ? `
                <div class="kv" style="margin-top:8px;">
                  <div class="small">expected</div>
                  <pre>${escapeHtml(d.expected)}</pre>
                  <div class="small">got</div>
                  <pre>${escapeHtml(d.got)}</pre>
                </div>
              ` : `
                <div class="small" style="margin-top:8px;">
                  Skrytý test: ${d.ok ? "prešiel" : "neprešiel"}.
                </div>
                ${(!d.runtimeOk && d.stderr) ? `<pre>${escapeHtml(d.stderr)}</pre>` : ``}
              `
            )}
          </li>
        `).join("")}
      </ol>
    </div>
  `;
}

function renderPredictComparison({ testsEl, ok, guess, got }) {
  testsEl.innerHTML = `
    <p>${ok ? `<span class="badge ok">PREDICT OK</span>` : `<span class="badge no">PREDICT ZLE</span>`}
       <span class="small">Porovnanie odhadu vs výstup</span></p>
    <div class="kv" style="margin-top:8px;">
      <div class="small">tvoj odhad</div>
      <pre>${escapeHtml(guess)}</pre>
      <div class="small">skutočný stdout</div>
      <pre>${escapeHtml(got)}</pre>
    </div>
  `;
}

function renderTestReport({ testsEl, overallPassed, structure, functional, evalKind }) {
  const overallBadge = overallPassed
    ? `<span class="badge ok">PASS</span>`
    : `<span class="badge no">FAIL</span>`;

  const firstFailedSummary = renderFirstFailedSummary({ overallPassed, structure, functional, evalKind });

  testsEl.innerHTML = `
    <p>${overallBadge} <span class="small">Celkové vyhodnotenie (štruktúra + funkcia)</span></p>
    ${firstFailedSummary}
    ${renderStructureResults(structure)}
    ${renderFunctionalResults(functional, evalKind)}
  `;
}

export function setupTestActionHandlers({
  problem,
  state,
  codeEl,
  runInputEl,
  outEl,
  testsEl,
  btnRun,
  btnTest,
  setStatus,
  showOutput,
  predictController,
  refreshHintAvailability,
  refreshLearningNextStep,
  renderMap
}) {
  btnRun?.addEventListener("click", async () => {
    try {
      incAttempts(state, problem.id, "run");
      recordEvent(state, "run", { problemId: problem.id });

      if (problem.mode === "predict" && !predictController?.isPredictReady()) {
        setStatus("Predict režim: najprv uzamkni svoj odhad.");
        return;
      }

      setStatus("Načítavam Python runtime (Pyodide)… prvýkrát to môže chvíľu trvať.");

      const stdin = runInputEl?.value ?? "";
      const res = await runPython(codeEl.value, stdin);
      showOutput(res.stdout, res.stderr);

      setLastDiag(state, problem.id, {
        at: new Date().toISOString(),
        evalKind: "run",
        overall: { passed: Boolean(res.ok) },
        functional: {
          passed: Boolean(res.ok),
          firstFail: res.ok ? null : { runtimeOk: false, stderr: res.stderr, got: res.stdout, expected: null }
        },
        run: { ok: Boolean(res.ok), stdin, stdout: res.stdout, stderr: res.stderr }
      });
      refreshHintAvailability();

      if (problem.mode === "predict") {
        if (!res.ok) {
          setStatus("Program spadol — najprv oprav chybu, potom porovnávaj odhad.");
          return;
        }

        const guess = predictController.getLockedGuess();
        const got = predictController.normalizeRunOutput(res.stdout);
        const ok = guess === got;

        recordEvent(state, "predict_result", { problemId: problem.id, ok });
        if (ok) {
          setResult(state, problem.id, "PASS");
          recordEvent(state, "pass", { problemId: problem.id, mode: problem.mode, via: "predict_run" });
        } else {
          setResult(state, problem.id, "FAIL");
        }

        renderPredictComparison({ testsEl, ok, guess, got });
        setStatus(ok ? "Odhad sedel ✅ Testy prešli; doplň ešte mikroobhajobu." : "Odhad nesedel ❌");

        const e = refreshHeaderProgress(problem);
        refreshLearningNextStep(e);
        if (ok) enableMicroDefenseAfterPass();
        try { if (typeof renderMap === "function") renderMap(); } catch {}
        return;
      }

      if (!res.ok) setStatus("Chyba pri behu programu. (Run)");
      else if (stdin) setStatus("Hotovo. (Run so zadaným vstupom)");
      else setStatus("Hotovo. (Run bez vstupu)");
    } catch (e) {
      const errMsg = String(e && e.message ? e.message : e);
      setStatus(errMsg.includes("TIMEOUT")
        ? "Chyba: Časový limit prekročený – pravdepodobne nekonečný cyklus alebo pomalé prvé načítanie runtime."
        : pyodideFallbackMessage(e));
      setLastDiag(state, problem.id, {
        at: new Date().toISOString(),
        evalKind: "run",
        overall: { passed: false },
        timeout: String(e).includes("TIMEOUT"),
        errorMessage: errMsg,
        functional: { passed: false, firstFail: { runtimeOk: false, stderr: errMsg, got: "", expected: null } }
      });
      refreshHintAvailability();
      showOutput("", errMsg);
    }
  });

  btnTest?.addEventListener("click", async () => {
    try {
      if (problem.mode === "predict") {
        setStatus("Predict úloha sa nerieši tlačidlom Testy. Uzamkni odhad a použi Run.");
        return;
      }
      incAttempts(state, problem.id, "test");
      recordEvent(state, "test", { problemId: problem.id });

      setStatus("Spúšťam testy…");

      const structure = await runStructureChecks(problem, codeEl.value);
      const evalKind = (problem.evaluation && problem.evaluation.kind) ? problem.evaluation.kind : "stdout";
      const functional = (evalKind === "function")
        ? await runFunctionEvaluation(problem, codeEl.value)
        : await runAllTests(problem, codeEl.value);

      const overallPassed = structure.passed && functional.passed;
      const firstFail = (functional.details ?? []).find(d => !d.ok) ?? null;
      const diag = {
        at: new Date().toISOString(),
        evalKind,
        overallPassed,
        structure: {
          passed: structure.passed,
          violations: structure.violations ?? []
        },
        functional: {
          passed: functional.passed,
          fatal: functional.fatal ?? null,
          firstFail
        }
      };
      setLastDiag(state, problem.id, diag);
      refreshHintAvailability();

      renderTestReport({ testsEl, overallPassed, structure, functional, evalKind });

      if (overallPassed) {
        setResult(state, problem.id, "PASS");
        recordEvent(state, "pass", { problemId: problem.id, mode: problem.mode });
        setStatus("✅ Testy prešli. Teraz odpovedz na otázku mikroobhajoby. Ak nevieš, pozri prvý test alebo klikni Poraď mi.");
        enableMicroDefenseAfterPass();
      } else {
        setResult(state, problem.id, "FAIL");
        recordEvent(state, "fail", { problemId: problem.id, mode: problem.mode });
        setStatus(!structure.passed && functional.passed
          ? "❌ Štruktúra neprešla. Pred ďalším pokusom vysvetli prvý problém v časti Testy."
          : (!functional.passed && structure.passed
            ? "❌ Funkčné testy neprešli. Najprv pozri prvý problém: vstup/argumenty, očakávanie a tvoj výsledok."
            : "❌ Neprešlo. Pred ďalším pokusom si vysvetli prvý problém v časti Testy."));
      }

      const e = refreshHeaderProgress(problem);
      refreshLearningNextStep(e);
      try { if (typeof renderMap === "function") renderMap(); } catch {}
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);

      setLastDiag(state, problem.id, {
        at: new Date().toISOString(),
        evalKind: (problem.evaluation && problem.evaluation.kind) ? problem.evaluation.kind : "stdout",
        overallPassed: false,
        timeout: msg.includes("TIMEOUT"),
        errorMessage: msg
      });
      refreshHintAvailability();

      if (msg.includes("TIMEOUT")) {
        setStatus("⏱️ Časový limit prekročený – pravdepodobne nekonečný cyklus alebo pomalé prvé načítanie runtime.");
      } else {
        setStatus("Chyba pri testoch: " + pyodideFallbackMessage(msg));
      }
      showOutput("", msg);
    }
  });
}
