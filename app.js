import {
  loadState,
  saveState,
  ensureProblemEntry,
  recordEvent,
  incAttempts,
  incHints,
  setResult,
  getRunInput,
  setRunInput,
  buildSignedExport,
  CONTENT_VERSION,
  computeSummaryFromState,
  getUiPrefs,
  setLastSelection
} from "./storage.js";

const app = document.querySelector("#app");

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function loadLevel(level) {
  const res = await fetch(`./problems/level-${String(level).padStart(2, "0")}.json`);
  if (!res.ok) throw new Error(`Failed to load level ${level}: ${res.status}`);
  return await res.json();
}

/** ---------- PYODIDE (singleton) ---------- **/
let pyodidePromise = null;

async function getPyodide() {
  if (!pyodidePromise) {
    if (typeof loadPyodide !== "function") {
      throw new Error("Pyodide sa nenačítal. Skontroluj index.html (pyodide.js musí byť nad app.js).");
    }
    pyodidePromise = (async () => {
      const py = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/",
      });

      const bootstrap = `
import sys, io, traceback

def __run(user_code: str, input_data: str):
    old_stdin, old_stdout, old_stderr = sys.stdin, sys.stdout, sys.stderr
    sys.stdin = io.StringIO(input_data)
    sys.stdout = io.StringIO()
    sys.stderr = io.StringIO()
    try:
        ns = {}
        exec(user_code, ns, ns)
        return {"ok": True, "stdout": sys.stdout.getvalue(), "stderr": sys.stderr.getvalue()}
    except Exception:
        tb = traceback.format_exc()
        return {"ok": False, "stdout": sys.stdout.getvalue(), "stderr": sys.stderr.getvalue() + tb}
    finally:
        sys.stdin, sys.stdout, sys.stderr = old_stdin, old_stdout, old_stderr
`;
      await py.runPythonAsync(bootstrap);
      return py;
    })();
  }
  return pyodidePromise;
}

async function runPython(userCode, inputData = "") {
  const py = await getPyodide();

  py.globals.set("__USER_CODE", userCode);
  py.globals.set("__INPUT_DATA", inputData);

  const resultProxy = await py.runPythonAsync(`__run(__USER_CODE, __INPUT_DATA)`);
  const result = resultProxy.toJs ? resultProxy.toJs({ dict_converter: Object.fromEntries }) : resultProxy;

  py.globals.delete("__USER_CODE");
  py.globals.delete("__INPUT_DATA");

  return {
    ok: Boolean(result.ok),
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
  };
}

/** ---------- TESTS ---------- **/
function normalizeStdout(s) {
  return String(s).replaceAll("\r\n", "\n");
}

async function runAllTests(problem, userCode) {
  const tests = problem.tests ?? [];
  if (tests.length === 0) return { passed: true, details: [] };

  const details = [];
  let allOk = true;

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const res = await runPython(userCode, t.input ?? "");
    const got = normalizeStdout(res.stdout);
    const exp = normalizeStdout(t.expected_stdout ?? "");

    const ok = res.ok && got === exp;
    if (!ok) allOk = false;

    details.push({
      index: i + 1,
      ok,
      visible: Boolean(t.visible),
      input: t.input ?? "",
      expected: exp,
      got,
      stderr: res.stderr,
      runtimeOk: res.ok,
    });

    if (!res.ok) break;
  }

  return { passed: allOk, details };
}

/** ---------- UTIL ---------- **/
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function getSampleInput(problem) {
  const tests = problem.tests ?? [];
  const firstVisible = tests.find(t => t.visible && (t.input ?? "") !== "");
  const firstAny = tests.find(t => (t.input ?? "") !== "");
  return (firstVisible?.input ?? firstAny?.input ?? "");
}

/** ---------- UI ---------- **/
function render(problem, state, allProblems, currentLevel) {
  const entry = ensureProblemEntry(state, problem.id);

  const buggyList = Array.isArray(problem.buggy_solutions) ? problem.buggy_solutions : [];
  const isFix = problem.mode === "fix";
  const defaultBuggy = isFix ? (buggyList[0]?.id ?? null) : null;

  app.innerHTML = `
    <section class="card">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div>
          <h2 style="margin:0;">
            ${escapeHtml(problem.title)}
            <span class="pill">Level ${problem.level}</span>
            ${entry.solved ? `<span class="badge ok" style="margin-left:8px;">SOLVED</span>` : ``}
          </h2>
          <div class="small">
            pokusy: ${entry.attempts}, hinty: ${entry.hintsUsed}, posledný: ${entry.lastResult ?? "—"}, content: ${CONTENT_VERSION}
          </div>
        </div>

        <div class="kv" style="grid-template-columns: 120px 260px;">
  <div class="small">Level</div>
  <select id="levelSelect">
    <option value="1">Level 1</option>
    <option value="2">Level 2</option>
    <option value="3">Level 3</option>
    <option value="4">Level 4</option>
    <option value="5">Level 5</option>
    <option value="6">Level 6</option>
  </select>

  <div class="small">Úloha</div>
  <select id="problemSelect">
    ${allProblems.map(p => `<option value="${escapeHtml(p.id)}" ${p.id===problem.id ? "selected":""}>${escapeHtml(p.id)} — ${escapeHtml(p.title)}</option>`).join("")}
  </select>
</div>
      </div>

      <p>${escapeHtml(problem.statement)}</p>

      ${problem.mode === "predict" ? `
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
      ` : ""}

      ${isFix ? `
        <div class="kv" style="grid-template-columns: 160px 1fr; margin-top:10px;">
          <div class="small">Chybné riešenie</div>
          <select id="buggySelect">
            ${buggyList.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.title)} (${escapeHtml(b.misconceptionTag ?? "bug")})</option>`).join("")}
          </select>
        </div>
        <div class="small" style="margin-top:6px;">
          Cieľ: opraviť kód tak, aby prešiel <strong>aj skrytými testami</strong>.
        </div>
      ` : ""}

      <label class="label">Kód</label>
      <textarea id="code" class="code" rows="12"></textarea>

      <div class="kv" style="grid-template-columns: 140px 1fr; margin-top:10px;">
        <div class="small"><strong>Vstup pre Run</strong><br><span class="small">stdin</span></div>
        <div>
          <textarea id="runInput" class="code" rows="3" placeholder="Sem napíš, čo má input() čítať. Každý riadok = jeden input."></textarea>
          <div class="row" style="margin-top:8px;">
            <button id="btnUseSample" class="btn secondary">Použi vzor z testu</button>
            <button id="btnClearInput" class="btn secondary">Vyčisti stdin</button>
          </div>
          <div class="small" style="margin-top:6px;">
            Tip: testy posielajú vstup automaticky. Tento box ovplyvňuje iba tlačidlo <strong>Run</strong>.
          </div>
        </div>
      </div>

      <div class="row">
        <button id="btnRun" class="btn">Run</button>
        <button id="btnTest" class="btn">Testy</button>
        <button id="btnHint" class="btn secondary">Poraď mi</button>
        <button id="btnReset" class="btn secondary">Reset</button>
      </div>

      <div class="row" style="margin-top:8px;">
        <button id="btnExport" class="btn secondary">Export JSON</button>
        <button id="btnCode" class="btn secondary">Skopíruj odovzdávací kód</button>
        <button id="btnSummary" class="btn secondary">Skopíruj Teacher summary</button>
      </div>

      <div class="small" id="status"></div>
      <div id="hintBox" class="hint hidden"></div>
    </section>
    
    <section class="card">
      <h3 style="margin-top:0;">Mapa úloh</h3>
      <div class="small">Klikni na úlohu. Farby: zelená = solved, žltá = skúšané, sivá = nové.</div>
      <div id="mapBox" class="map"></div>
    </section>

    <section class="card">
      <h3>Mini-štatistiky (tvoje chyby)</h3>
      <div id="statsBox" class="small">Načítavam…</div>
    </section>

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

  const problemSelect = document.querySelector("#problemSelect");
  const levelSelect = document.querySelector("#levelSelect");
  levelSelect.value = String(currentLevel);
  const codeEl = document.querySelector("#code");
  const runInputEl = document.querySelector("#runInput");
  const outEl = document.querySelector("#out");
  const testsEl = document.querySelector("#tests");
  const statusEl = document.querySelector("#status");
  const hintBox = document.querySelector("#hintBox");
  const statsBox = document.querySelector("#statsBox");

  const btnRun = document.querySelector("#btnRun");
  const btnTest = document.querySelector("#btnTest");
  const btnHint = document.querySelector("#btnHint");
  const btnReset = document.querySelector("#btnReset");
  const btnExport = document.querySelector("#btnExport");
  const btnCode = document.querySelector("#btnCode");
  const btnSummary = document.querySelector("#btnSummary");
  const mapBox = document.querySelector("#mapBox");

  const btnUseSample = document.querySelector("#btnUseSample");
  const btnClearInput = document.querySelector("#btnClearInput");

  const buggySelect = document.querySelector("#buggySelect");

  const predictGuessEl = document.querySelector("#predictGuess");
  const btnLockGuess = document.querySelector("#btnLockGuess");
  const btnClearGuess = document.querySelector("#btnClearGuess");
  const predictStatusEl = document.querySelector("#predictStatus");

  function setStatus(msg) {
    statusEl.textContent = msg || "";
  }
  function showOutput(stdout, stderr = "") {
    const parts = [];
    if (stdout) parts.push(stdout);
    if (stderr) parts.push("\n[stderr]\n" + stderr);
    outEl.textContent = parts.join("\n");
  }

  /** --- Fill editor --- **/
  function setEditorToStarter() {
    if (problem.mode === "fix") {
      const current = buggySelect?.value ?? defaultBuggy;
      const found = buggyList.find(b => b.id === current) || buggyList[0];
      codeEl.value = found?.code ?? "";
    } else {
      codeEl.value = problem.starter_code ?? "";
    }
  }
  setEditorToStarter();

  /** --- Run input: init from saved or sample --- **/
  const savedRunInput = getRunInput(state, problem.id);
  const initialRunInput = savedRunInput !== "" ? savedRunInput : getSampleInput(problem);
  runInputEl.value = initialRunInput;
  if (savedRunInput === "" && initialRunInput !== "") {
    setRunInput(state, problem.id, initialRunInput);
  }

  let runInputTimer = null;
  runInputEl.addEventListener("input", () => {
    if (runInputTimer) clearTimeout(runInputTimer);
    runInputTimer = setTimeout(() => {
      setRunInput(state, problem.id, runInputEl.value);
      recordEvent(state, "run_input_change", { problemId: problem.id, length: runInputEl.value.length });
    }, 250);
  });

  btnUseSample.addEventListener("click", () => {
    const sample = getSampleInput(problem);
    runInputEl.value = sample;
    setRunInput(state, problem.id, sample);
    recordEvent(state, "run_input_use_sample", { problemId: problem.id, length: sample.length });
    setStatus(sample ? "Použitý vzor z testu pre Run." : "Táto úloha nemá žiadny vzorový vstup.");
  });

  btnClearInput.addEventListener("click", () => {
    runInputEl.value = "";
    setRunInput(state, problem.id, "");
    recordEvent(state, "run_input_clear", { problemId: problem.id });
    setStatus("stdin pre Run vyčistené.");
  });

  /** --- Switch problem --- **/
  problemSelect.addEventListener("change", () => {
  const id = problemSelect.value;
  const next = allProblems.find(p => p.id === id);
  if (!next) return;

  const fresh = loadState();
  setLastSelection(fresh, currentLevel, id);
  render(next, fresh, allProblems, currentLevel);
});

  levelSelect.addEventListener("change", async () => {
  const nextLevel = Number(levelSelect.value);

  // ulož preferenciu
  const fresh0 = loadState();
const ui0 = getUiPrefs(fresh0);
ui0.lastLevel = nextLevel;
saveState(fresh0);

  // načítaj nový level json
  const nextProblems = await loadLevel(nextLevel);

  // zisti “poslednú úlohu” pre tento level
  const fresh = loadState();
  const ui = getUiPrefs(fresh);
  const lastProblemId = ui.lastProblemByLevel[String(nextLevel)];
  const nextProblem =
    nextProblems.find(p => p.id === lastProblemId) || nextProblems[0];

  render(nextProblem, fresh, nextProblems, nextLevel);
});

  /** --- Fix: pick buggy solution (store misconceptionTag) --- **/
  if (buggySelect) {
    buggySelect.addEventListener("change", () => {
      setEditorToStarter();
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

    // record initial selection once
    const bug0 = buggyList.find(b => b.id === (buggySelect.value ?? defaultBuggy));
    recordEvent(state, "fix_initial_bug", {
      problemId: problem.id,
      bugId: buggySelect.value ?? defaultBuggy,
      misconceptionTag: bug0?.misconceptionTag ?? null
    });
  }

  /** --- Hint --- **/
  let hintLevel = 0;
  btnHint.addEventListener("click", () => {
    hintBox.classList.remove("hidden");
    hintBox.textContent = problem.hints?.[hintLevel] ?? "";
    hintLevel = Math.min(2, hintLevel + 1);

    incHints(state, problem.id);
    recordEvent(state, "hint", { problemId: problem.id, hintLevel });
    setStatus("Hint použitý. (Ukladám progres)");
  });

  /** --- Reset --- **/
  btnReset.addEventListener("click", () => {
    hintLevel = 0;
    hintBox.classList.add("hidden");
    hintBox.textContent = "";
    outEl.textContent = "";
    testsEl.innerHTML = "";
    setStatus("");
    setEditorToStarter();
  });

  /** ---------- Predict logic ---------- **/
  let guessLocked = false;

  function setPredictStatus(msg) {
    if (predictStatusEl) predictStatusEl.textContent = msg || "";
  }

  function normalizeGuess(s) {
    // normalize newlines and auto-append trailing newline if missing (key fix)
    let x = String(s ?? "").replaceAll("\r\n", "\n");
    if (x !== "" && !x.endsWith("\n")) x += "\n";
    return x;
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

  if (problem.mode === "predict" && predictGuessEl) {
    // load last guess
    const lastGuessEv = [...(state.events?.items ?? [])]
      .reverse()
      .find(e => e.type === "predict_guess" && e.payload?.problemId === problem.id);
    if (lastGuessEv?.payload?.guess != null) {
      predictGuessEl.value = String(lastGuessEv.payload.guess);
    }

    // if locked earlier, lock
    const lastLockEv = [...(state.events?.items ?? [])]
      .reverse()
      .find(e => e.type === "predict_lock" && e.payload?.problemId === problem.id);
    if (lastLockEv) lockGuess();

    predictGuessEl.addEventListener("input", () => {
      recordEvent(state, "predict_guess", { problemId: problem.id, guess: predictGuessEl.value });
      setPredictStatus("Odhad uložený (neuzamknutý).");
      // if they type again, unlock
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

  /** --- Run --- **/
  btnRun.addEventListener("click", async () => {
    try {
      incAttempts(state, problem.id, "run");
      recordEvent(state, "run", { problemId: problem.id });

      // Predict rule: must be locked before run
      if (problem.mode === "predict") {
        const lockEv = [...(state.events?.items ?? [])].reverse()
          .find(e => e.type === "predict_lock" && e.payload?.problemId === problem.id);
        if (!lockEv) {
          setStatus("Predict režim: najprv uzamkni svoj odhad.");
          return;
        }
      }

      setStatus("Načítavam Python runtime (Pyodide)… prvýkrát to môže chvíľu trvať.");

      const stdin = runInputEl?.value ?? "";
      const res = await runPython(codeEl.value, stdin);
      showOutput(res.stdout, res.stderr);

      // Predict: compare guess vs stdout and DO NOT overwrite status with generic one
      if (problem.mode === "predict") {
        if (!res.ok) {
          setStatus("Program spadol — najprv oprav chybu, potom porovnávaj odhad.");
          return;
        }
        const lockEv = [...(state.events?.items ?? [])].reverse()
          .find(e => e.type === "predict_lock" && e.payload?.problemId === problem.id);

        const guess = normalizeGuess(lockEv?.payload?.guess ?? "");
        const got = normalizeStdout(res.stdout);

        const ok = guess === got;
        recordEvent(state, "predict_result", { problemId: problem.id, ok });

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

        setStatus(ok ? "Odhad sedel ✅" : "Odhad nesedel ❌");
        return; // IMPORTANT: do not fall-through to generic status
      }

      // Non-predict generic status
      if (!res.ok) setStatus("Chyba pri behu programu. (Run)");
      else if (stdin) setStatus("Hotovo. (Run so zadaným vstupom)");
      else setStatus("Hotovo. (Run bez vstupu)");

    } catch (e) {
      setStatus("Chyba: " + String(e));
      showOutput("", String(e));
    }
  });

  /** --- Tests (visible + hidden) --- **/
  btnTest.addEventListener("click", async () => {
    try {
      incAttempts(state, problem.id, "test");
      recordEvent(state, "test", { problemId: problem.id });

      setStatus("Spúšťam testy (viditeľné aj skryté)…");
      const results = await runAllTests(problem, codeEl.value);

      const badge = results.passed
        ? `<span class="badge ok">PASS</span>`
        : `<span class="badge no">FAIL</span>`;

      testsEl.innerHTML = `
        <p>${badge} <span class="small">Všetky testy</span></p>
        <ol>
          ${results.details.map(d => `
            <li style="margin-bottom:10px;">
              ${d.ok ? `<span class="badge ok">OK</span>` : `<span class="badge no">ZLE</span>`}
              ${d.visible ? `<span class="small"> (visible)</span>` : `<span class="small"> (hidden)</span>`}

              ${d.visible ? `
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
              `}
            </li>
          `).join("")}
        </ol>
      `;

      if (results.passed) {
        setResult(state, problem.id, "PASS");
        recordEvent(state, "pass", { problemId: problem.id, mode: problem.mode });
        setStatus("Testy prešli ✅ (Ukladám SOLVED)");
      } else {
        setResult(state, problem.id, "FAIL");
        recordEvent(state, "fail", { problemId: problem.id, mode: problem.mode });
        setStatus("Niečo nesedí ❌ (Ukladám FAIL)");
      }

      // re-render so header shows SOLVED and updated counters
      const fresh = loadState();
      render(problem, fresh, allProblems, currentLevel);

    } catch (e) {
      setStatus("Chyba pri testoch: " + String(e));
      showOutput("", String(e));
    }
  });

  /** --- Export signed JSON --- **/
  btnExport.addEventListener("click", async () => {
    const exportObj = await buildSignedExport(state, {
      currentProblem: { id: problem.id, title: problem.title, level: problem.level }
    });

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const day = exportObj.exportedAt.slice(0, 10);
    a.download = `fixit-export-${day}-${exportObj.submission.code}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    recordEvent(state, "export", { code: exportObj.submission.code });
    setStatus(`Export stiahnutý. Kód: ${exportObj.submission.code}`);
  });

  /** --- Copy submission code --- **/
  btnCode.addEventListener("click", async () => {
    const exportObj = await buildSignedExport(state);
    const code = exportObj.submission.code;
    const ok = await copyToClipboard(code);
    recordEvent(state, "submission_code", { codeCopied: ok, code });
    setStatus(ok ? `Odovzdávací kód skopírovaný: ${code}` : `Odovzdávací kód: ${code} (nepodarilo sa skopírovať)`);
  });
    btnSummary?.addEventListener("click", async () => {
    // podpis exportu (kód) + summary
    const exportObj = await buildSignedExport(state, {
      currentProblem: { id: problem.id, title: problem.title, level: problem.level }
    });

    const sum = computeSummaryFromState(state);

    const topTagsText = (sum.topTags.length === 0)
      ? "—"
      : sum.topTags.map(t => `${t.tag}(${t.n}×)`).join(", ");

    const text =
`FIXIT SUMMARY
code: ${exportObj.submission.code}
content: ${CONTENT_VERSION}
solved: ${sum.solved}
attempts: ${sum.attempts}
hints: ${sum.hints}
topTags: ${topTagsText}
current: ${problem.id} — ${problem.title}`;

    const ok = await copyToClipboard(text);
    recordEvent(state, "teacher_summary", { copied: ok, code: exportObj.submission.code });

    setStatus(ok ? "Teacher summary skopírované do schránky." : "Teacher summary (nepodarilo sa skopírovať).");
    // aby sa mapa vždy prepočíta po aktivitách:
    renderMap();
  });

  /** --- Mini stats: top misconception tags --- **/
  function computeMisconceptionStats(state) {
    const items = state.events?.items ?? [];
    const counts = new Map();

    for (const ev of items) {
      if (ev.type === "fix_pick_bug" || ev.type === "fix_initial_bug") {
        const tag = ev.payload?.misconceptionTag || null;
        if (!tag) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    const arr = [...counts.entries()].map(([tag, n]) => ({ tag, n }));
    arr.sort((a, b) => b.n - a.n);
    return arr.slice(0, 5);
  }
    function renderMap() {
    if (!mapBox) return;

    const s = loadState(); // fresh state, aby mapa reflektovala posledné zmeny
    mapBox.innerHTML = allProblems.map(p => {
      const e = ensureProblemEntry(s, p.id);
      const isSolved = Boolean(e.solved);
      const isTried = !isSolved && (e.attempts > 0 || e.hintsUsed > 0);

      const chipClass = isSolved ? "solved" : (isTried ? "tried" : "new");
      const chipText = isSolved ? "SOLVED" : (isTried ? "SKÚŠANÉ" : "NOVÉ");

      const mode = p.mode ?? "solve";
      const modeChip = `<span class="chip">${escapeHtml(mode.toUpperCase())}</span>`;
      const statusChip = `<span class="chip ${chipClass}">${chipText}</span>`;

      return `
        <div class="tile" data-problem-id="${escapeHtml(p.id)}">
          <div class="title">${escapeHtml(p.id)} — ${escapeHtml(p.title)}</div>
          <div class="meta">
            ${statusChip}
            ${modeChip}
            <span class="chip">pokusy: ${e.attempts}</span>
          </div>
        </div>
      `;
    }).join("");

    // klik handler pre tiles
    mapBox.querySelectorAll(".tile").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-problem-id");
        const next = allProblems.find(pp => pp.id === id);
        if (!next) return;
        const fresh = loadState();
        setLastSelection(fresh, currentLevel, next.id);
        render(next, fresh, allProblems, currentLevel);
      });
    });
  }

  renderMap();

  if (statsBox) {
    const top = computeMisconceptionStats(state);
    if (top.length === 0) {
      statsBox.innerHTML = "Zatiaľ nemáš dosť údajov. Skús pár Fix úloh a potom sa tu ukáže, na čom najčastejšie padáš.";
    } else {
      statsBox.innerHTML = `
        <ol>
          ${top.map(x => `<li><strong>${escapeHtml(x.tag)}</strong> — ${x.n}×</li>`).join("")}
        </ol>
        <div class="small">Počítané z tvojich výberov chybného riešenia (Fix).</div>
      `;
    }
  }
}

async function boot() {
  const state = loadState();
  saveState(state);

  const ui = getUiPrefs(state);
  const level = Number(ui.lastLevel) || 1;

  const problems = await loadLevel(level);

  const lastProblemId = ui.lastProblemByLevel[String(level)];
  const startProblem = problems.find(p => p.id === lastProblemId) || problems[0];

  render(startProblem, state, problems, level);
}

boot().catch(err => {
  app.innerHTML = `<pre style="color:red;">${escapeHtml(String(err))}</pre>`;
});