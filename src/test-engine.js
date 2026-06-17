import { stableStringify } from "./utils.js";
import { runPython, runPythonFunction, runAstChecks, runGenFunctionCases } from "./runner-client.js";

export function normalizeStdout(s) {
  return String(s ?? "").replaceAll("\r\n", "\n");
}

export function getStdoutTests(problem) {
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

export function getAcceptedStdouts(test) {
  const values = [];
  if (test.expected_stdout != null) values.push(test.expected_stdout);

  const extra = test.accepted_stdout;
  if (Array.isArray(extra)) values.push(...extra);
  else if (extra != null) values.push(extra);

  // Deduplicate after newline normalization.
  return [...new Set(values.map(v => normalizeStdout(v)))];
}



export async function runStructureChecks(problem, userCode) {
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



export async function runAllTests(problem, userCode) {
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
export async function runFunctionEvaluation(problem, userCode) {
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



