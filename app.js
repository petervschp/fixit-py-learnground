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
  getDraftCode,
  setDraftCode,
  buildSignedExport,
  CONTENT_VERSION,
  getLastDiag,
  setLastDiag,
  computeSummaryFromState,
  getUiPrefs,
  setLastSelection,
  importStateReplace,
  resetAllState
} from "./storage.js";

const app = document.querySelector("#app");

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function stableStringify(value) {
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
      if (typeof v === "undefined") continue; // mimic JSON.stringify omitting undefined in objects
      parts.push(JSON.stringify(k) + ":" + stableStringify(v));
    }
    return "{" + parts.join(",") + "}";
  }
  // fallback for functions/symbols/etc.
  return JSON.stringify(String(value));
}


async function loadLevel(level) {
  const res = await fetch(`./problems/level-${String(level).padStart(2, "0")}.json`);
  if (!res.ok) throw new Error(`Failed to load level ${level}: ${res.status}`);
  return await res.json();
}

/** ---------- PYODIDE (singleton) ---------- **/
/** ---------- PYODIDE (Worker runner + timeout) ---------- **/
let _pyWorker = null;
let _reqSeq = 0;
const _pending = new Map();

function _startWorker() {
  _pyWorker = new Worker("./py-worker.js", { type: "classic" });

  _pyWorker.onmessage = (e) => {
    const msg = e.data || {};
    const entry = _pending.get(msg.id);
    if (!entry) return;
    _pending.delete(msg.id);

    if (msg.ok) entry.resolve(msg.result);
    else entry.reject(new Error(msg.error?.message || "Worker error"));
  };

  _pyWorker.onerror = () => {
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

async function runPython(userCode, inputData = "") {
  const res = await _callWorker("run", { userCode, inputData }, 2000);
  return {
    ok: Boolean(res.ok),
    stdout: String(res.stdout ?? ""),
    stderr: String(res.stderr ?? ""),
  };
}

async function runPythonFunction(userCode, fnName, args = [], kwargs = {}, mutSpec = null) {
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

async function runAstChecks(userCode, astCfg) {
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

async function runGenFunctionCases(generatorCfg) {
  return await _callWorker("gen_cases", { generatorCfg }, 1500);
}

/** ---------- TESTS ---------- **/

function normalizeStdout(s) {
  return String(s ?? "").replaceAll("\r\n", "\n");
}

function getStdoutTests(problem) {
  // Native current format: problem.tests with expected_stdout.
  if (Array.isArray(problem.tests) && problem.tests.length > 0) {
    return problem.tests.map((t, i) => ({
      ...t,
      input: t.input ?? "",
      expected_stdout: t.expected_stdout ?? t.output ?? t.expected ?? "",
      accepted_stdout: t.accepted_stdout ?? t.accepted_outputs ?? t.outputs ?? null,
      visible: t.visible ?? true,
      _source: "tests",
      _index: i + 1
    }));
  }

  // Compatibility format for the L6 template / future JSONs:
  // test_cases: [{ input: "5", output: "25" }]
  if (Array.isArray(problem.test_cases) && problem.test_cases.length > 0) {
    return problem.test_cases.map((t, i) => ({
      ...t,
      input: t.input ?? t.stdin ?? "",
      expected_stdout: t.expected_stdout ?? t.output ?? t.expected_output ?? t.expected ?? "",
      accepted_stdout: t.accepted_stdout ?? t.accepted_outputs ?? t.outputs ?? null,
      visible: t.visible ?? true,
      _source: "test_cases",
      _index: i + 1
    }));
  }

  // Very old / simple format fallback.
  if (problem.expected_output != null || problem.expected_stdout != null || Array.isArray(problem.accepted_outputs)) {
    return [{
      input: problem.input ?? problem.stdin ?? "",
      expected_stdout: problem.expected_stdout ?? problem.expected_output ?? "",
      accepted_stdout: problem.accepted_outputs ?? null,
      visible: true,
      _source: "expected_output",
      _index: 1
    }];
  }

  return [];
}

function getAcceptedStdouts(test) {
  const values = [];
  if (test.expected_stdout != null) values.push(test.expected_stdout);

  const extra = test.accepted_stdout;
  if (Array.isArray(extra)) values.push(...extra);
  else if (extra != null) values.push(extra);

  // Deduplicate after newline normalization.
  return [...new Set(values.map(v => normalizeStdout(v)))];
}


/** ---------- STRUCTURE CHECKS (Phase 2) ---------- **/



async function runStructureChecks(problem, userCode) {
  const checks = problem.checks ?? {};
  const forbidden = checks.forbiddenPatterns ?? [];
  const violations = [];

  // Map common forbidden call names to custom messages (if user provided them via forbiddenPatterns)
  const msgByCall = {};
  for (const rule of forbidden) {
    if (!rule || typeof rule !== "object") continue;
    const pat = rule.pattern ?? rule.regex ?? "";
    const msg = rule.message ?? "";
    if (!pat || !msg) continue;
    if (pat.includes("print")) msgByCall.print = msg;
    if (pat.includes("input")) msgByCall.input = msg;
    if (pat.includes("open")) msgByCall.open = msg;
    if (pat.includes("while")) msgByCall.while = msg;
  }

  // 1) Optional AST checks (more reliable than text search)
  if (checks.ast && checks.ast.enabled) {
    try {
      const astRes = await runAstChecks(userCode, checks.ast);
      for (const v of astRes.violations) {
        let message = v.message;
        if (v.name && msgByCall[v.name]) message = msgByCall[v.name];
        if (v.type === "forbidden_while_true" && msgByCall.while) message = msgByCall.while;

        violations.push({
          source: "ast",
          type: v.type,
          name: v.name ?? null,
          lineno: v.lineno,
          col: v.col,
          message
        });
      }
    } catch (e) {
      violations.push({
        source: "ast",
        type: "ast_error",
        name: null,
        lineno: 1,
        col: 0,
        message: "Nepodarilo sa vykonať AST kontrolu (interná chyba)."
      });
    }
  }

  // 2) Text/regex forbidden pattern checks (fallback or extra rules)
// When AST is enabled, avoid double-enforcing common call/while rules via regex,
// because regex can false-positive inside strings/comments.
// We still keep forbiddenPatterns for other custom textual rules.
  const astEnabled = Boolean(checks.ast && checks.ast.enabled);
    function isRedundantCallRule(pat) {
    const s = String(pat || "");
    // If AST is enabled, skip regex rules that attempt to ban common calls/while,
    // because regex can false-positive in strings/comments.
    return (
      s.includes("print") ||
      s.includes("input") ||
      s.includes("open") ||
      s.includes("while") && s.includes("True")
    );
  }

  for (const rule of forbidden) {
    let pattern = null;
    let flags = "m";
    let message = "Zakázaný vzor v kóde.";

    if (typeof rule === "string") {
      pattern = rule;
    } else if (rule && typeof rule === "object") {
      pattern = rule.pattern ?? rule.regex ?? null;
      flags = rule.flags ?? flags;
      message = rule.message ?? message;
    }

    if (!pattern) continue;

    if (astEnabled && isRedundantCallRule(pattern)) continue;

    try {
      const re = new RegExp(pattern, flags);
      const match = re.exec(userCode);
      if (match) {
        violations.push({
          source: "pattern",
          pattern,
          message,
          match: match[0],
          index: match.index
        });
      }
    } catch (e) {
      violations.push({
        source: "pattern",
        pattern,
        message: "Chyba v konfigurácii pravidla (neplatný regex).",
        match: "",
        index: -1
      });
    }
  }

  return { passed: violations.length === 0, violations };
}



async function runAllTests(problem, userCode) {
  const tests = getStdoutTests(problem);
  if (tests.length === 0) return { passed: true, details: [] };

  const details = [];
  let allOk = true;

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const res = await runPython(userCode, t.input ?? "");
    const got = normalizeStdout(res.stdout);
    const accepted = getAcceptedStdouts(t);
    const exp = accepted[0] ?? "";

    const ok = Boolean(res.ok) && accepted.includes(got);
    if (!ok) allOk = false;

    details.push({
      index: i + 1,
      ok,
      visible: Boolean(t.visible),
      input: t.input ?? "",
      expected: accepted.length > 1 ? accepted.join("\n--- alebo ---\n") : exp,
      accepted,
      got,
      stderr: res.stderr,
      runtimeOk: res.ok,
      source: t._source ?? "tests"
    });

    if (!res.ok) break;
  }

  return { passed: allOk, details };
}
async function runFunctionEvaluation(problem, userCode) {
  const evalSpec = problem.evaluation || {};
  const target = evalSpec.target || {};
  const fnName = target.name;

  const baseCases = Array.isArray(evalSpec.cases) ? evalSpec.cases : [];
  if (!fnName) {
    return { passed: false, details: [], fatal: "Missing function target name." };
  }

  // Optional generator: adds deterministic hidden cases
  let genCases = [];
  if (evalSpec.generator && evalSpec.generator.enabled) {
    const genRes = await runGenFunctionCases(evalSpec.generator);
    if (genRes.ok) genCases = genRes.cases;
    else {
      return { passed: false, details: [], fatal: "Generator failed: " + String(genRes.error || "unknown") };
    }
  }

  const allCases = [...baseCases, ...genCases];
  if (allCases.length === 0) {
    return { passed: false, details: [], fatal: "No cases defined." };
  }

  const details = [];
  let allOk = true;

  let hiddenTotal = 0;
  let hiddenPassed = 0;

  const mutSpec = evalSpec.mutation || null;

  // Avoid UI spam: include all visible cases; from hidden include only failures (up to 5)
  let hiddenFailuresIncluded = 0;

  for (let i = 0; i < allCases.length; i++) {
    const c = allCases[i];
    const isVisible = Boolean(c.visible);
    const args = c.args ?? [];
    const kwargs = c.kwargs ?? {};
    const expected = c.expected_return;

    const res = await runPythonFunction(userCode, fnName, args, kwargs, mutSpec);

    const expStr = stableStringify(expected);
    const gotStr = res.return_json ? res.return_json : "";

    const okReturn = res.ok && gotStr === expStr;
    const okMutation = (!mutSpec || !mutSpec.check) ? true : Boolean(res.mutation_ok);
    const ok = okReturn && okMutation;

    if (!ok) allOk = false;

    if (!isVisible) {
      hiddenTotal += 1;
      if (ok) hiddenPassed += 1;
    }

    if (isVisible || (!ok && hiddenFailuresIncluded < 5)) {
      if (!isVisible && !ok) hiddenFailuresIncluded += 1;

      details.push({
        index: i + 1,
        ok,
        visible: isVisible,
        generated: Boolean(c.generated),
        args,
        kwargs,
        expected: expStr,
        got: gotStr,
        runtimeOk: res.ok,
        kind: res.kind,
        stderr: res.stderr,
        mutationActive: Boolean(mutSpec && mutSpec.check),
        okMutation,
        mutationFailedIndices: res.mutation_failed_indices ?? []
      });
    }

    if (!res.ok) break;
  }

  return { passed: allOk, details, hiddenTotal, hiddenPassed, generatedCount: genCases.length };
}



function classifyFailureCause(evalKind, detail) {
  const stderr = String(detail?.stderr || "");
  const expected = String(detail?.expected ?? "");
  const got = String(detail?.got ?? "");

  if (detail?.runtimeOk === false || stderr) {
    if (stderr.includes("EOFError")) return { cause: "Program čakal vstup cez input(), ale pri teste ho nedostal alebo ho číta na nesprávnom mieste.", next: "Skontroluj, či úloha naozaj chce input(), a či ho používaš len tam, kde treba." };
    if (stderr.includes("IndentationError")) return { cause: "Python narazil na problém s odsadením bloku.", next: "Skontroluj riadky po if/for/while/def a použi rovnaké odsadenie, ideálne 4 medzery." };
    if (stderr.includes("SyntaxError")) return { cause: "Kód má syntaktickú chybu, takže test sa nedostal k overeniu logiky.", next: "Skontroluj dvojbodky, zátvorky, úvodzovky a či príkazy nie sú napísané mimo platnej Python syntaxe." };
    if (stderr.includes("NameError")) return { cause: "Používaš názov premennej alebo funkcie, ktorý Python nepozná.", next: "Skontroluj preklepy a či je premenná vytvorená skôr, než ju používaš." };
    if (stderr.includes("TypeError")) return { cause: "Operácia dostala nesprávny typ hodnoty alebo nesprávny počet argumentov.", next: "Pri vstupe skontroluj int()/float(); pri funkcii skontroluj parametre a return." };
    return { cause: "Program počas testu spadol, preto sa výsledok nedal porovnať.", next: "Pozri chybovú hlášku v detaile testu alebo v Output a oprav najprv pád programu." };
  }

  if (evalKind === "function") {
    if (got === "" || got === "null") return { cause: "Funkcia pravdepodobne nič nevracia, alebo používa print() namiesto return.", next: "V mindset úlohách má funkcia výsledok vrátiť cez return, nie iba vypísať." };
    if (detail?.mutationActive && !detail?.okMutation) return { cause: "Funkcia zmenila vstupné dáta, hoci mala vrátiť nový výsledok bez vedľajšieho efektu.", next: "Nevpisuj výsledok späť do pôvodného zoznamu/slovníka; vytvor novú hodnotu a tú vráť." };
    return { cause: "Funkcia beží, ale vracia inú hodnotu, než test očakáva.", next: "Porovnaj argumenty testu s expected/got a prejdi si výpočet ručne na malom príklade." };
  }

  if (got === "" && expected !== "") return { cause: "Program nič nevypísal, hoci test očakáva výstup.", next: "Skontroluj, či máš print(...) a či sa program dostane do vetvy alebo cyklu, kde sa má vypísať výsledok." };
  if (expected.trim() === got.trim() && expected !== got) return { cause: "Obsah je takmer správny, ale nesedí formátovanie: medzery alebo nové riadky.", next: "Porovnaj počet riadkov a medzier. Najčastejšie pomôže upraviť print(...)." };
  if (expected.toLowerCase() === got.toLowerCase() && expected !== got) return { cause: "Výstup sa líši veľkosťou písmen.", next: "Skontroluj malé/veľké písmená v texte, ktorý vypisuješ." };
  return { cause: "Program beží, ale výstup sa nezhoduje s očakávaním.", next: "Skús si pre daný vstup vypočítať výsledok ručne a porovnať ho s tým, čo vypísal program." };
}

function renderFirstFailedSummary({ overallPassed, structure, functional, evalKind }) {
  if (overallPassed) return "";
  const firstStructure = (!structure?.passed && (structure?.violations?.length ?? 0) > 0) ? structure.violations[0] : null;
  const firstFail = (functional?.details ?? []).find(d => !d.ok) ?? null;

  if (!firstStructure && !firstFail && functional?.fatal) {
    return `<div class="card first-fail-summary"><h4 style="margin:0 0 8px 0;">❌ Prvý problém</h4><p><strong>Testovací harness zlyhal:</strong> ${escapeHtml(functional.fatal)}</p><p class="small">Skontroluj konfiguráciu úlohy alebo názov funkcie v zadaní.</p></div>`;
  }

  if (firstStructure && (!firstFail || firstStructure.lineno != null)) {
    return `<div class="card first-fail-summary"><h4 style="margin:0 0 8px 0;">❌ Prvý problém</h4><p><strong>Štrukturálna kontrola neprešla.</strong></p><p>${escapeHtml(firstStructure.message || "Porušené pravidlo v kóde.")}</p>${firstStructure.lineno != null ? `<p class="small">Miesto: riadok ${escapeHtml(firstStructure.lineno)}:${escapeHtml(firstStructure.col ?? 0)}</p>` : ``}<p class="small"><strong>Ďalší krok:</strong> oprav najprv zakázaný vzor v kóde; až potom má zmysel riešiť expected/got.</p></div>`;
  }

  if (!firstFail) return "";
  const visible = firstFail.visible !== false;
  const { cause, next } = classifyFailureCause(evalKind, firstFail);

  if (!visible) {
    return `<div class="card first-fail-summary"><h4 style="margin:0 0 8px 0;">❌ Prvý problém</h4><p><strong>Nezlyhal viditeľný, ale skrytý test ${escapeHtml(firstFail.index ?? "")}.</strong></p><p class="small">To zvyčajne znamená, že riešenie funguje iba pre vzorový príklad, ale nie všeobecne.</p><p><strong>Možná príčina:</strong> ${escapeHtml(cause)}</p><p><strong>Ďalší krok:</strong> ${escapeHtml(next)}</p><p class="small">Tip: klikni na <strong>Poraď mi</strong>; rada bude vychádzať z tejto diagnostiky.</p></div>`;
  }

  const inputBlock = evalKind === "function"
    ? `<div class="small">argumenty</div><pre>${escapeHtml(JSON.stringify(firstFail.args ?? []))}</pre>${(firstFail.kwargs && Object.keys(firstFail.kwargs).length) ? `<div class="small">kwargs</div><pre>${escapeHtml(JSON.stringify(firstFail.kwargs))}</pre>` : ``}`
    : `<div class="small">vstup</div><pre>${escapeHtml(firstFail.input ?? "")}</pre>`;
  const labelExpected = evalKind === "function" ? "očakávaný return" : "očakávaný výstup";
  const labelGot = evalKind === "function" ? "tvoj return" : "tvoj výstup";

  return `<div class="card first-fail-summary"><h4 style="margin:0 0 8px 0;">❌ Prvý problém: test ${escapeHtml(firstFail.index ?? "")} zlyhal</h4><div class="kv" style="margin-top:8px;">${inputBlock}<div class="small">${labelExpected}</div><pre>${escapeHtml(firstFail.expected ?? "")}</pre><div class="small">${labelGot}</div><pre>${escapeHtml(firstFail.got ?? "")}</pre></div>${firstFail.stderr ? `<div class="small">chyba</div><pre>${escapeHtml(firstFail.stderr)}</pre>` : ``}<p><strong>Možná príčina:</strong> ${escapeHtml(cause)}</p><p><strong>Ďalší krok:</strong> ${escapeHtml(next)}</p><p class="small">Tip: klikni na <strong>Poraď mi</strong>; rada bude vychádzať z tejto diagnostiky.</p></div>`;
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
  const tests = getStdoutTests(problem);
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
            <span id="solvedBadgeSlot">${entry.solved ? `<span class="badge ok" style="margin-left:8px;">SOLVED</span>` : ``}</span>
          </h2>
          <div class="small">
            pokusy: <span id="attemptsVal">${entry.attempts}</span>,
            hinty: <span id="hintsVal">${entry.hintsUsed}</span>,
            posledný: <span id="lastResultVal">${entry.lastResult ?? "—"}</span>,
            content: ${CONTENT_VERSION}
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
    <option value="7">Level 7</option>
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
            <button id="btnClearGuess" class="btn secondary">Vymaž odhad</button></div>
          <div id="predictStatus" class="small"></div>
        </section>
      ` : ""}

      ${isFix ? `
        <div class="kv" style="grid-template-columns: 160px 1fr; margin-top:10px;">
          <div class="small">Chybné riešenie</div>
          <select id="buggySelect">
            ${buggyList.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.title)} (${escapeHtml(b.misconceptionTag ?? "bug")})</option>`).join("")}
          </select></div>
        <div class="small" style="margin-top:6px;">
          Cieľ: opraviť kód tak, aby prešiel <strong>aj skrytými testami</strong>.</div>
      ` : ""}

      <label class="label">Kód</label>
      <textarea id="code" class="code" rows="12"></textarea>

      <div class="kv" style="grid-template-columns: 140px 1fr; margin-top:10px;">
        <div class="small"><strong>Vstup pre Run</strong><br><span class="small">stdin</span></div>
        <div>
          <textarea id="runInput" class="code" rows="3" placeholder="Sem napíš, čo má input() čítať. Každý riadok = jeden input."></textarea>
          <div class="row" style="margin-top:8px;">
            <button id="btnUseSample" class="btn secondary">Použi vzor z testu</button>
            <button id="btnClearInput" class="btn secondary">Vyčisti stdin</button></div>
          <div class="small" style="margin-top:6px;">
            Tip: testy posielajú vstup automaticky. Tento box ovplyvňuje iba tlačidlo <strong>Run</strong>.</div></div></div>

      <div class="row">
        <button id="btnRun" class="btn">Run</button>
        <button id="btnTest" class="btn">Testy</button>
        <button id="btnHint" class="btn secondary">Poraď mi</button>
        <button id="btnReset" class="btn secondary">Reset</button></div>

      <div class="row" style="margin-top:8px;">
        <button id="btnExport" class="btn secondary">Export JSON</button>
        <button id="btnCode" class="btn secondary">Skopíruj odovzdávací kód</button>
        <button id="btnSummary" class="btn secondary">Skopíruj Teacher summary</button>
        <button id="btnImport" class="btn secondary">Import JSON</button>
        <input id="fileImport" type="file" accept="application/json" style="display:none;" />
        <button id="btnFactoryReset" class="btn secondary">Reset aplikácie</button></div>

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
  const btnImport = document.querySelector("#btnImport");
  const fileImport = document.querySelector("#fileImport");
  const btnFactoryReset = document.querySelector("#btnFactoryReset");
  const mapBox = document.querySelector("#mapBox");

  const btnUseSample = document.querySelector("#btnUseSample");
  const btnClearInput = document.querySelector("#btnClearInput");

  const buggySelect = document.querySelector("#buggySelect");

  const predictGuessEl = document.querySelector("#predictGuess");
  const btnLockGuess = document.querySelector("#btnLockGuess");
  const btnClearGuess = document.querySelector("#btnClearGuess");
  const predictStatusEl = document.querySelector("#predictStatus");

  function installPythonIndentation(textarea) {
    if (!textarea) return;
    textarea.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      e.preventDefault();

      const value = textarea.value;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const indent = "    ";

      if (e.shiftKey) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const before = value.slice(0, lineStart);
        const selected = value.slice(lineStart, end);
        const after = value.slice(end);
        const lines = selected.split("\n");
        let removedBeforeCursor = 0;
        const out = lines.map((line, idx) => {
          const remove = line.startsWith(indent) ? 4 : (line.match(/^ {1,3}/)?.[0].length ?? 0);
          if (idx === 0) removedBeforeCursor = remove;
          return line.slice(remove);
        }).join("\n");
        textarea.value = before + out + after;
        textarea.selectionStart = Math.max(lineStart, start - removedBeforeCursor);
        textarea.selectionEnd = Math.max(textarea.selectionStart, end - (selected.length - out.length));
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }

      if (start !== end && value.slice(start, end).includes("\n")) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const before = value.slice(0, lineStart);
        const selected = value.slice(lineStart, end);
        const after = value.slice(end);
        const out = selected.split("\n").map(line => indent + line).join("\n");
        textarea.value = before + out + after;
        textarea.selectionStart = start + indent.length;
        textarea.selectionEnd = end + (out.length - selected.length);
      } else {
        textarea.value = value.slice(0, start) + indent + value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + indent.length;
      }
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

btnImport?.addEventListener("click", () => {
  fileImport?.click();
});

fileImport?.addEventListener("change", async () => {
  const f = fileImport.files?.[0];
  if (!f) return;

  const ok = confirm("Import prepíše aktuálny stav aplikácie na tomto zariadení. Pokračovať?");
  if (!ok) {
    fileImport.value = "";
    return;
  }

  try {
    const text = await f.text();
    const data = JSON.parse(text);

    importStateReplace(data);

    // cache-busting reload
    const url = new URL(location.href);
    url.searchParams.set("import", String(Date.now()));
    location.href = url.toString();
  } catch (e) {
    alert("Import zlyhal: " + String(e?.message ?? e));
  } finally {
    fileImport.value = "";
  }
});

btnFactoryReset?.addEventListener("click", () => {
  console.log("Reset clicked");
  const ok = confirm(
    "Reset aplikácie vymaže lokálne uložený progres, rozpracovaný kód, nastavenia a udalosti.\n\nChceš pokračovať?"
  );
  if (!ok) return;

  (async () => {
    // 1) terminate worker
    try {
      if (typeof _pyWorker !== "undefined" && _pyWorker) {
        _pyWorker.terminate();
        _pyWorker = null;
      }
    } catch {}

    // 2) vymaž localStorage (fixit.* + fallback)
    try {
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("fixit.") || k.includes("fixit")) keysToDelete.push(k);
      }
      keysToDelete.forEach(k => localStorage.removeItem(k));
      if (keysToDelete.length === 0) localStorage.clear();
    } catch {}

    // 3) sessionStorage
    try { sessionStorage.clear(); } catch {}

    // 4) caches
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {}

    // 5) unregister SW
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch {}

    // 6) cache-busting reload
    const url = new URL(location.href);
    url.searchParams.set("reset", String(Date.now()));
    location.href = url.toString();
  })();
});

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
  function getBaseCodeForProblem() {
    if (problem.mode === "fix") {
      const current = buggySelect?.value ?? defaultBuggy;
      const found = buggyList.find(b => b.id === current) || buggyList[0];
      return found?.code ?? "";
    }
    return problem.starter_code ?? "";
  }

  function setEditorInitialFromDraftOrBase() {
    const draft = getDraftCode(state, problem.id);
    if (draft && draft.trim() !== "") {
      codeEl.value = draft;
    } else {
      const base = getBaseCodeForProblem();
      codeEl.value = base;
      setDraftCode(state, problem.id, base);
    }
  }

  function overwriteDraftWithBase() {
    const base = getBaseCodeForProblem();
    codeEl.value = base;
    setDraftCode(state, problem.id, base);
  }

  setEditorInitialFromDraftOrBase();
  installPythonIndentation(codeEl);
  installPythonIndentation(runInputEl);
  installPythonIndentation(predictGuessEl);

  // Auto-save rozpracovaného kódu (draft) – aby sa nestrácal po testoch a po refresh
  let codeDraftTimer = null;
  codeEl.addEventListener("input", () => {
    if (codeDraftTimer) clearTimeout(codeDraftTimer);
    codeDraftTimer = setTimeout(() => {
      setDraftCode(state, problem.id, codeEl.value);
    }, 250);
  });

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

    const diag = getLastDiag(state, problem.id);

    // 0) No diagnostics yet
    if (!diag) {
      hintBox.textContent = "Najprv spusti Run alebo Testy, aby som vedel dať konkrétnu radu k tvojmu kódu.";
      incHints(state, problem.id);
      recordEvent(state, "hint2", { problemId: problem.id, kind: "no_diag" });
      setStatus("Hint: najprv spusti test.");
      return;
    }

    // 0b) Everything passed
    if (diag?.overall?.passed === true || diag?.overallPassed === true) {
      const nextMsg = (problem.evaluation?.kind === "function")
        ? "Testy už prešli ✅ Skús sa pozrieť, či funkcia používa čisté parametre a return (bez vedľajších efektov), a potom pokračuj na ďalšiu úlohu."
        : "Testy už prešli ✅ Ak chceš, skús ešte raz skontrolovať formát výstupu (riadky/medzery) a pokračuj na ďalšiu úlohu.";
      hintBox.textContent = nextMsg;
      incHints(state, problem.id);
      recordEvent(state, "hint2", { problemId: problem.id, kind: "passed" });
      setStatus("Hint: testy prešli.");
      return;
    }

    function stderrHint(stderr) {
      const s = String(stderr || "");
      if (!s) return null;

      if (s.includes("EOFError")) {
        return "EOFError: program čítal input(), ale nedostal žiadny vstup. V tejto úlohe buď doplň stdin pre Run, alebo (pri mindset úlohách) nepoužívaj input() a pracuj s parametrami funkcie.";
      }
      if (s.includes("IndentationError")) {
        return "IndentationError: problém s odsadením. Skontroluj, že bloky po if/for/while/def majú rovnaké odsadenie (typicky 4 medzery).";
      }
      if (s.includes("SyntaxError")) {
        return "SyntaxError: syntaktická chyba. Skontroluj dvojbodky po if/for/while/def, uzatváranie zátvoriek a úvodzoviek.";
      }
      if (s.includes("NameError")) {
        return "NameError: používaš názov, ktorý neexistuje (premenná/funkcia). Skontroluj preklepy a či si funkciu naozaj definoval.";
      }
      if (s.includes("TypeError")) {
        return "TypeError: nesprávne typy alebo počet argumentov. Pri CLI úlohách skontroluj int()/float(); pri mindset úlohách skontroluj parametre funkcie a návratovú hodnotu.";
      }
      if (s.includes("IndexError")) {
        return "IndexError: index je mimo rozsah. Skontroluj dĺžku zoznamu/reťazca a hranice v range().";
      }
      if (s.includes("KeyError")) {
        return "KeyError: v slovníku chýba kľúč. Skontroluj, či existuje, alebo použi dict.get().";
      }
      if (s.includes("RecursionError")) {
        return "RecursionError: príliš hlboká rekurzia (možno nekonečná). Skontroluj ukončovaciu podmienku.";
      }
      return null;
    }

    // 1) Timeout
    if (diag?.timeout) {
      hintBox.textContent = "Časový limit prekročený – pravdepodobne nekonečný cyklus. Skontroluj podmienku while/for, či sa mení premenná v podmienke, prípadne či máš break. Pri funkcii si daj pozor na rekurziu bez ukončenia.";
      incHints(state, problem.id);
      recordEvent(state, "hint2", { problemId: problem.id, kind: "timeout" });
      setStatus("Hint: nekonečný cyklus / timeout.");
      return;
    }

    // 2) Structure violations
    if (diag?.structure && !diag.structure.passed && (diag.structure.violations?.length ?? 0) > 0) {
      const v = diag.structure.violations[0];
      hintBox.textContent =
        "Štruktúra neprešla: " + (v.message || "porušené pravidlo") +
        "\n\nTip: mindset úlohy chcú parametre + return (nie input/print). Odstráň zakázané volanie a nech funkcia vracia výsledok.";
      incHints(state, problem.id);
      recordEvent(state, "hint2", { problemId: problem.id, kind: "structure", type: v.type, name: v.name ?? null });
      setStatus("Hint: štruktúra (zakázaný vzor).");
      return;
    }

    // 3) Functional failures
    if (diag?.functional && !diag.functional.passed) {
      // generator / fatal
      if (diag.functional.fatal) {
        hintBox.textContent = "Testovací harness hlási: " + diag.functional.fatal + "\nSkontroluj definíciu funkcie, názov a že existujú test cases.";
        incHints(state, problem.id);
        recordEvent(state, "hint2", { problemId: problem.id, kind: "fatal" });
        setStatus("Hint: interné nastavenie úlohy / fatal.");
        return;
      }

      const f = diag.functional.firstFail;
      if (f) {
        if (f.runtimeOk === false && f.stderr) {
          const h = stderrHint(f.stderr);
          if (h) {
            hintBox.textContent = h;
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "stderr" });
            setStatus("Hint: chyba v behu programu.");
            return;
          }
        }

        // Function-specific hints
        if ((diag.evalKind === "function" || problem.evaluation?.kind === "function")) {
          if (String(f.got ?? "") === "null" || String(f.got ?? "") === "") {
            hintBox.textContent = "Vyzerá to, že funkcia nevracia výsledok (vracia None). Pri mindset úlohách nepoužívaj print() ako výstup – namiesto toho použi return hodnoty.";
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "return_none" });
            setStatus("Hint: return vs print.");
            return;
          }
          if (f.mutationActive && !f.okMutation) {
            hintBox.textContent = "Zlyhala kontrola mutácie: meníš vstupné dáta. Pri 'filter' úlohách vráť NOVÝ zoznam a pôvodný neupravuj (nepoužívaj nums[:] = ...).";
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "mutation" });
            setStatus("Hint: nemutuj vstup.");
            return;
          }
        }

        // stdout-specific: output mismatch / formatting.
        // exp/got are intentionally scoped here so the Hint button cannot crash
        // after a failed stdout test.
        const isStdoutEval = (diag.evalKind === "stdout" || !problem.evaluation || problem.evaluation.kind === "stdout");
        const exp = (f.expected != null) ? String(f.expected) : null;
        const got = (f.got != null) ? String(f.got) : null;

        if (isStdoutEval && exp != null && got != null) {
          if (exp.trim() === got.trim() && exp !== got) {
            hintBox.textContent = "Výstup je skoro správny, ale nesedí presne formátovanie (medzery alebo nový riadok). Skontroluj presný počet riadkov a medzier.";
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "whitespace" });
            setStatus("Hint: formátovanie výstupu.");
            return;
          }

          if (got === "" && exp !== "") {
            hintBox.textContent = "Zdá sa, že program nič nevypísal. Skontroluj, či máš na konci print(...) a či sa dostaneš do vetvy/cyklu, kde sa má vypísať výsledok.";
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "no_output" });
            setStatus("Hint: nič nevypisuje.");
            return;
          }

          if (exp.replace(/\s+$/g, "") === got.replace(/\s+$/g, "") && exp !== got) {
            hintBox.textContent = "Výsledok sa líši iba koncovými medzerami alebo novým riadkom. Skontroluj, či používaš print(...) a či nepridávaš alebo neuberáš zbytočné znaky.";
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "trailing_whitespace" });
            setStatus("Hint: koniec výstupu / newline.");
            return;
          }

          hintBox.textContent = "Výstup nesedí presne. Porovnaj expected a got v časti Testy: hľadaj chýbajúci znak, preklep, rozdiel vo veľkosti písmen alebo interpunkcii.";
          incHints(state, problem.id);
          recordEvent(state, "hint2", { problemId: problem.id, kind: "stdout_mismatch" });
          setStatus("Hint: porovnaj expected vs got.");
          return;
        }
      }
    }

    // 4) Fallback to scripted hints
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
    overwriteDraftWithBase();
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

  if (problem.mode === "predict") {
    btnTest?.setAttribute("disabled", "disabled");
    btnTest?.setAttribute("title", "V Predict úlohách sa nerobia testy. Uzamkni odhad a použi Run.");
  }

  function refreshHintAvailability() {
    const diag = getLastDiag(state, problem.id);
    if (diag) {
      btnHint?.removeAttribute("disabled");
      btnHint?.removeAttribute("title");
    } else {
      btnHint?.setAttribute("disabled", "disabled");
      btnHint?.setAttribute("title", "Najprv spusti Run alebo Testy.");
    }
  }
  refreshHintAvailability();

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
        if (ok) {
          setResult(state, problem.id, "PASS");
          recordEvent(state, "pass", { problemId: problem.id, mode: problem.mode, via: "predict_run" });
        } else {
          setResult(state, problem.id, "FAIL");
        }

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

        setStatus(ok ? "Odhad sedel ✅ Úloha je označená ako SOLVED." : "Odhad nesedel ❌");
        const fresh = loadState();
        const e = ensureProblemEntry(fresh, problem.id);
        const attemptsEl = document.querySelector("#attemptsVal");
        const hintsEl = document.querySelector("#hintsVal");
        const lastResEl = document.querySelector("#lastResultVal");
        const solvedSlot = document.querySelector("#solvedBadgeSlot");
        if (attemptsEl) attemptsEl.textContent = String(e.attempts);
        if (hintsEl) hintsEl.textContent = String(e.hintsUsed);
        if (lastResEl) lastResEl.textContent = String(e.lastResult ?? "—");
        if (solvedSlot) solvedSlot.innerHTML = e.solved ? '<span class="badge ok" style="margin-left:8px;">SOLVED</span>' : '';
        try { if (typeof renderMap === "function") renderMap(); } catch {}
        return; // IMPORTANT: do not fall-through to generic status
      }

      // Non-predict generic status
      if (!res.ok) setStatus("Chyba pri behu programu. (Run)");
      else if (stdin) setStatus("Hotovo. (Run so zadaným vstupom)");
      else setStatus("Hotovo. (Run bez vstupu)");

    } catch (e) {
      setStatus("Chyba: " + String(e));
      setLastDiag(state, problem.id, {
        at: new Date().toISOString(),
        evalKind: "run",
        overall: { passed: false },
        timeout: String(e).includes("TIMEOUT"),
        errorMessage: String(e),
        functional: { passed: false, firstFail: { runtimeOk: false, stderr: String(e), got: "", expected: null } }
      });
      refreshHintAvailability();
      showOutput("", String(e));
      if (String(e).includes("TIMEOUT")) setStatus("Chyba: Časový limit prekročený – pravdepodobne nekonečný cyklus.")

    }
  });

  /** --- Tests (visible + hidden) --- **/
  btnTest.addEventListener("click", async () => {
    try {
      if (problem.mode === "predict") {
        setStatus("Predict úloha sa nerieši tlačidlom Testy. Uzamkni odhad a použi Run.");
        return;
      }
      incAttempts(state, problem.id, "test");
      recordEvent(state, "test", { problemId: problem.id });

      setStatus("Spúšťam testy…");

      // 1) Structure checks (forbidden patterns / later AST)
      const structure = await runStructureChecks(problem, codeEl.value);

      // 2) Functional evaluation (stdout OR function)
      const evalKind = (problem.evaluation && problem.evaluation.kind) ? problem.evaluation.kind : "stdout";
      const functional = (evalKind === "function")
        ? await runFunctionEvaluation(problem, codeEl.value)
        : await runAllTests(problem, codeEl.value);

      const overallPassed = structure.passed && functional.passed;
      // Save last diagnostics for "Poraď mi 2.0"
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


      const overallBadge = overallPassed
        ? `<span class="badge ok">PASS</span>`
        : `<span class="badge no">FAIL</span>`;

      const structureBadge = structure.passed
        ? `<span class="badge ok">OK</span>`
        : `<span class="badge no">FAIL</span>`;

      const functionalBadge = functional.passed
        ? `<span class="badge ok">PASS</span>`
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
        // pattern-based
        return `
          <li>
            <div><strong>${escapeHtml(v.message)}</strong></div>
            <div class="small">Vzorec: <code>${escapeHtml(v.pattern ?? "")}</code></div>
            ${(v.match) ? `<div class="small">Nájdené: <code>${escapeHtml(v.match)}</code></div>` : ``}
          </li>
        `;
      }).join("");
const structureHtml = `
        <div class="card" style="margin-top:10px;">
          <h4 style="margin:0 0 6px 0;">Štrukturálne kontroly ${structureBadge}</h4>
          ${structure.passed ? `
            <div class="small">Žiadne zakázané vzory neboli nájdené.</div>
          ` : `
            <ol>
              ${structureItemsHtml}
            </ol>
          `}
        </div>
      `;

      const functionalHeader = evalKind === "function"
        ? `Funkčné testy (return) ${functionalBadge}`
        : `Funkčné testy (stdin/stdout) ${functionalBadge}`;

      const hiddenSummary = (evalKind === "function" && Number.isFinite(functional.hiddenTotal) && functional.hiddenTotal > 0)
        ? `<div class="small">hidden: ${functional.hiddenPassed}/${functional.hiddenTotal} OK (generované: ${functional.generatedCount ?? 0})</div>`
        : ``;


      const functionalList = `
        <div class="card" style="margin-top:10px;">
          <h4 style="margin:0 0 6px 0;">${functionalHeader}</h4>
          ${hiddenSummary}
          <ol>
            ${functional.details.map(d => `
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

      const firstFailedSummary = renderFirstFailedSummary({ overallPassed, structure, functional, evalKind });

      testsEl.innerHTML = `
        <p>${overallBadge} <span class="small">Celkové vyhodnotenie (štruktúra + funkcia)</span></p>
        ${firstFailedSummary}
        ${structureHtml}
        ${functionalList}
      `;
if (overallPassed) {
        setResult(state, problem.id, "PASS");
        recordEvent(state, "pass", { problemId: problem.id, mode: problem.mode });
        setStatus("✅ Prešlo: štruktúra aj funkčné testy. (Ukladám SOLVED)");
      } else {
        setResult(state, problem.id, "FAIL");
        recordEvent(state, "fail", { problemId: problem.id, mode: problem.mode });
        setStatus(!structure.passed && functional.passed ? "❌ Štruktúra neprešla (zakázaný vzor), hoci výstup/return sedí." : (!functional.passed && structure.passed ? "❌ Funkčné testy neprešli (výstup/return nesedí)." : "❌ Neprešlo: štruktúra aj/alebo funkčné testy."));
      }
      // UI update in-place (do not re-render; keeps code + results visible)
      const fresh = loadState();
      const e = ensureProblemEntry(fresh, problem.id);
      const attemptsEl = document.querySelector("#attemptsVal");
      const hintsEl = document.querySelector("#hintsVal");
      const lastResEl = document.querySelector("#lastResultVal");
      const solvedSlot = document.querySelector("#solvedBadgeSlot");
      if (attemptsEl) attemptsEl.textContent = String(e.attempts);
      if (hintsEl) hintsEl.textContent = String(e.hintsUsed);
      if (lastResEl) lastResEl.textContent = String(e.lastResult ?? "—");
      if (solvedSlot) solvedSlot.innerHTML = e.solved ? `<span class="badge ok" style="margin-left:8px;">SOLVED</span>` : ``;
      // refresh map if present
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
        setStatus("⏱️ Časový limit prekročený – pravdepodobne nekonečný cyklus.");
      } else {
        setStatus("Chyba pri testoch: " + msg);
      }
      showOutput("", msg);
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
