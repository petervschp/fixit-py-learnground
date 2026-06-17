import { escapeHtml } from "./utils.js";
import { normalizeStdout } from "./test-engine.js";
import { recordEvent } from "../storage.js";

export function renderPredictPanelHtml(problem) {
  if (problem.mode !== "predict") return "";
  return `
    <section class="card" style="margin-top:12px;">
      <h3 style="margin-top:0;">Predpoveď (Predict)</h3>
      <div class="small">Najprv napíš svoj odhad výstupu (stdout). Potom klikni <strong>Uzamkni odhad</strong> a až potom <strong>Run</strong>.</div>
      <label class="label">Môj odhad výstupu</label>
      <textarea id="predictGuess" class="code" rows="3" placeholder="Napíš, čo očakávaš na výstupe. Pozn.: koncový Enter (newline) doplníme automaticky."></textarea>
      <div class="row" style="margin-top:8px;">
        <button id="btnLockGuess" class="btn secondary">Uzamkni odhad</button>
        <button id="btnClearGuess" class="btn secondary">Vymaž odhad</button>
      </div>
      <div id="predictStatus" class="small"></div>
    </section>
  `;
}

export function renderFixPanelHtml({ isFix, buggyList }) {
  if (!isFix) return "";
  return `
    <div class="kv" style="grid-template-columns: 160px 1fr; margin-top:10px;">
      <div class="small">Chybné riešenie</div>
      <select id="buggySelect">
        ${buggyList.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.title)} (${escapeHtml(b.misconceptionTag ?? "bug")})</option>`).join("")}
      </select>
    </div>
    <div class="small" style="margin-top:6px;">
      Cieľ: opraviť kód tak, aby prešiel <strong>aj skrytými testami</strong>.
    </div>
  `;
}

export function getBaseCodeForProblem({ problem, buggySelect, buggyList, defaultBuggy }) {
  if (problem.mode === "fix") {
    const current = buggySelect?.value ?? defaultBuggy;
    const found = buggyList.find(b => b.id === current) || buggyList[0];
    return found?.code ?? "";
  }
  return problem.starter_code ?? "";
}

export function setupFixPanel({ problem, state, buggySelect, buggyList, defaultBuggy, overwriteDraftWithBase, outEl, testsEl, statusEl }) {
  if (!buggySelect) return;

  buggySelect.addEventListener("change", () => {
    overwriteDraftWithBase();
    outEl.textContent = "";
    testsEl.innerHTML = "";
    statusEl.textContent = "Načítané chybné riešenie. Skús ho opraviť.";

    const bug = buggyList.find(b => b.id === buggySelect.value);
    recordEvent(state, "fix_pick_bug", {
      problemId: problem.id,
      bugId: buggySelect.value,
      misconceptionTag: bug?.misconceptionTag ?? null
    });
  });

  const bug0 = buggyList.find(b => b.id === (buggySelect.value ?? defaultBuggy));
  recordEvent(state, "fix_initial_bug", {
    problemId: problem.id,
    bugId: buggySelect.value ?? defaultBuggy,
    misconceptionTag: bug0?.misconceptionTag ?? null
  });
}

export function normalizeGuess(s) {
  let x = String(s ?? "").replaceAll("\r\n", "\n");
  if (x !== "" && !x.endsWith("\n")) x += "\n";
  return x;
}

export function setupPredictPanel({ problem, state, predictGuessEl, btnLockGuess, btnClearGuess, predictStatusEl, btnTest }) {
  let guessLocked = false;

  function setPredictStatus(msg) {
    if (predictStatusEl) predictStatusEl.textContent = msg || "";
  }

  function lockGuess() {
    guessLocked = true;
    predictGuessEl?.setAttribute("disabled", "disabled");
    btnLockGuess?.setAttribute("disabled", "disabled");
    setPredictStatus("Odhad uzamknutý. Teraz klikni Run a porovnaj.");
  }

  function unlockGuess() {
    guessLocked = false;
    predictGuessEl?.removeAttribute("disabled");
    btnLockGuess?.removeAttribute("disabled");
    setPredictStatus("");
  }

  if (problem.mode === "predict") {
    btnTest?.setAttribute("disabled", "disabled");
    btnTest?.setAttribute("title", "V Predict úlohách sa nerobia testy. Uzamkni odhad a použi Run.");
  }

  if (problem.mode === "predict" && predictGuessEl) {
    const lastGuessEv = [...(state.events?.items ?? [])]
      .reverse()
      .find(e => e.type === "predict_guess" && e.payload?.problemId === problem.id);
    if (lastGuessEv?.payload?.guess != null) {
      predictGuessEl.value = String(lastGuessEv.payload.guess);
    }

    const lastLockEv = [...(state.events?.items ?? [])]
      .reverse()
      .find(e => e.type === "predict_lock" && e.payload?.problemId === problem.id);
    if (lastLockEv) lockGuess();

    predictGuessEl.addEventListener("input", () => {
      recordEvent(state, "predict_guess", { problemId: problem.id, guess: predictGuessEl.value });
      setPredictStatus("Odhad uložený (neuzamknutý).");
      if (guessLocked) unlockGuess();
    });

    btnLockGuess?.addEventListener("click", () => {
      const g = normalizeGuess(predictGuessEl.value);
      if (!g.trim()) {
        setPredictStatus("Najprv niečo napíš, potom uzamkni.");
        return;
      }
      recordEvent(state, "predict_lock", { problemId: problem.id, guess: g });
      lockGuess();
    });

    btnClearGuess?.addEventListener("click", () => {
      predictGuessEl.value = "";
      recordEvent(state, "predict_guess_clear", { problemId: problem.id });
      unlockGuess();
      setPredictStatus("Odhad vymazaný.");
    });
  }

  function getLockedGuessEvent() {
    return [...(state.events?.items ?? [])]
      .reverse()
      .find(e => e.type === "predict_lock" && e.payload?.problemId === problem.id);
  }

  return {
    isPredictReady() {
      return problem.mode !== "predict" || Boolean(getLockedGuessEvent());
    },
    getLockedGuess() {
      return normalizeGuess(getLockedGuessEvent()?.payload?.guess ?? "");
    },
    normalizeRunOutput(stdout) {
      return normalizeStdout(stdout);
    }
  };
}
