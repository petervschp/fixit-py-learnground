// py-worker.js - runs Pyodide in a Web Worker so the UI never freezes.
// The main thread can terminate this worker on timeout to stop infinite loops.

let pyodideReady = null;

async function initPyodide() {
  if (pyodideReady) return pyodideReady;

  pyodideReady = (async () => {
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js");
    const py = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/",
    });

    // IMPORTANT: sem vlož bootstrap z tvojho app.js (Python multi-line string)
    // Nájdeš ho v app.js ako: const bootstrap = ` ... `;
    // Skopíruj PRESNE obsah medzi backtickmi.
    const bootstrap = `
import sys, io, traceback, json, copy, random

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

def __run_function(user_code: str, fn_name: str, args_json: str, kwargs_json: str, mut_idxs_json: str, mut_check: str):
    old_stdin, old_stdout, old_stderr = sys.stdin, sys.stdout, sys.stderr
    sys.stdin = io.StringIO("")  # function tasks should not depend on stdin
    sys.stdout = io.StringIO()
    sys.stderr = io.StringIO()
    try:
        ns = {}
        exec(user_code, ns, ns)

        if fn_name not in ns or not callable(ns[fn_name]):
            return {"ok": False, "kind": "missing_function", "stdout": sys.stdout.getvalue(),
                    "stderr": sys.stderr.getvalue() + f"Missing callable function: {fn_name}"}

        args = json.loads(args_json) if args_json else []
        kwargs = json.loads(kwargs_json) if kwargs_json else {}

        # mutation check config
        do_mut = (str(mut_check).lower() == "true")
        mut_failed = []
        mut_idxs = json.loads(mut_idxs_json) if (mut_idxs_json and do_mut) else []

        before = {}
        if do_mut:
            for idx in mut_idxs:
                try:
                    before[int(idx)] = copy.deepcopy(args[int(idx)])
                except Exception:
                    # if we can't deepcopy, we skip that index (conservative)
                    pass

        result = ns[fn_name](*args, **kwargs)

        # mutation check after call
        mut_ok = True
        if do_mut:
            for idx, snap in before.items():
                try:
                    if args[idx] != snap:
                        mut_ok = False
                        mut_failed.append(idx)
                except Exception:
                    mut_ok = False
                    mut_failed.append(idx)

        try:
            result_json = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",",":"))
        except Exception:
            return {"ok": False, "kind": "non_json_return", "stdout": sys.stdout.getvalue(),
                    "stderr": sys.stderr.getvalue() + "Return value is not JSON-serializable."}

        return {"ok": True, "kind": "ok", "return_json": result_json,
                "mutation_check": do_mut, "mutation_ok": mut_ok, "mutation_failed_indices": mut_failed,
                "stdout": sys.stdout.getvalue(), "stderr": sys.stderr.getvalue()}
    except Exception:
        tb = traceback.format_exc()
        return {"ok": False, "kind": "exception", "stdout": sys.stdout.getvalue(),
                "stderr": sys.stderr.getvalue() + tb}
    finally:
        sys.stdin, sys.stdout, sys.stderr = old_stdin, old_stdout, old_stderr
import ast

def __ast_check(user_code: str, cfg_json: str):
    violations = []
    try:
        cfg = json.loads(cfg_json) if cfg_json else {}
    except Exception:
        cfg = {}

    forbidden_calls = set(cfg.get("forbiddenCalls", []) or [])
    forbid_while_true = bool(cfg.get("forbidWhileTrue", False))

    try:
        tree = ast.parse(user_code)
    except SyntaxError as e:
        violations.append({
            "type": "syntax",
            "lineno": e.lineno or 1,
            "col": e.offset or 0,
            "message": f"Syntax error: {e.msg}"
        })
        return {"ok": False, "violations": violations}

    class V(ast.NodeVisitor):
        def visit_Call(self, node):
            name = None
            if isinstance(node.func, ast.Name):
                name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                name = node.func.attr
            if name and name in forbidden_calls:
                violations.append({
                    "type": "forbidden_call",
                    "lineno": getattr(node, "lineno", 1),
                    "col": getattr(node, "col_offset", 0),
                    "name": name,
                    "message": f"Zakázané volanie: {name}()"
                })
            self.generic_visit(node)

        def visit_While(self, node):
            if forbid_while_true:
                # while True:
                if isinstance(node.test, ast.Constant) and node.test.value is True:
                    violations.append({
                        "type": "forbidden_while_true",
                        "lineno": getattr(node, "lineno", 1),
                        "col": getattr(node, "col_offset", 0),
                        "message": "Zakázaný nekonečný cyklus: while True"
                    })
            self.generic_visit(node)

    V().visit(tree)
    return {"ok": len(violations) == 0, "violations": violations}


import random

def __gen_function_cases(gen_cfg_json: str):
    try:
        cfg = json.loads(gen_cfg_json) if gen_cfg_json else {}
    except Exception:
        return {"ok": False, "error": "invalid_json", "cases": []}

    seed = cfg.get("seed", 0)
    count = int(cfg.get("count", 0) or 0)
    arg_cfg = cfg.get("args", {}) or {}
    ref_code = cfg.get("reference_py", "") or ""

    rnd = random.Random(seed)

    # build reference function
    rns = {}
    try:
        exec(ref_code, rns, rns)
        ref = rns.get("ref", None)
        if not callable(ref):
            return {"ok": False, "error": "ref_not_found", "cases": []}
    except Exception:
        return {"ok": False, "error": "ref_exec_failed", "cases": []}

    def gen_arg():
        t = arg_cfg.get("type", "int")
        if t == "int":
            mn = int(arg_cfg.get("min", -10))
            mx = int(arg_cfg.get("max", 10))
            return rnd.randint(mn, mx)
        if t == "list_int":
            lmn = int(arg_cfg.get("len_min", 0))
            lmx = int(arg_cfg.get("len_max", 10))
            mn = int(arg_cfg.get("min", -10))
            mx = int(arg_cfg.get("max", 10))
            ln = rnd.randint(lmn, lmx)
            return [rnd.randint(mn, mx) for _ in range(ln)]
        # fallback int
        mn = int(arg_cfg.get("min", -10))
        mx = int(arg_cfg.get("max", 10))
        return rnd.randint(mn, mx)

    cases = []
    for _ in range(count):
        a = gen_arg()
        try:
            exp = ref(copy.deepcopy(a))
        except Exception:
            # If reference fails, skip this case
            continue
        cases.append({"args": [a], "expected_return": exp, "visible": False, "generated": True})

    return {"ok": True, "cases": cases}
`;

    await py.runPythonAsync(bootstrap);
    return py;
  })();

  return pyodideReady;
}

async function handle(msg) {
  const py = await initPyodide();
  const { action, payload } = msg;

  if (action === "run") {
    py.globals.set("__USER_CODE", payload.userCode ?? "");
    py.globals.set("__INPUT_DATA", payload.inputData ?? "");
    const rp = await py.runPythonAsync(`__run(__USER_CODE, __INPUT_DATA)`);
    const r = rp.toJs ? rp.toJs({ dict_converter: Object.fromEntries }) : rp;
    py.globals.delete("__USER_CODE");
    py.globals.delete("__INPUT_DATA");
    return {
      ok: Boolean(r.ok),
      stdout: String(r.stdout ?? ""),
      stderr: String(r.stderr ?? ""),
    };
  }

  if (action === "run_function") {
    py.globals.set("__USER_CODE", payload.userCode ?? "");
    py.globals.set("__FN_NAME", payload.fnName ?? "");
    py.globals.set("__ARGS_JSON", JSON.stringify(payload.args ?? []));
    py.globals.set("__KWARGS_JSON", JSON.stringify(payload.kwargs ?? {}));
    py.globals.set("__MUT_IDXS_JSON", JSON.stringify(payload.mutIdxs ?? []));
    py.globals.set("__MUT_CHECK", JSON.stringify(Boolean(payload.mutCheck ?? false)));

    const rp = await py.runPythonAsync(
      `__run_function(__USER_CODE, __FN_NAME, __ARGS_JSON, __KWARGS_JSON, __MUT_IDXS_JSON, __MUT_CHECK)`
    );
    const r = rp.toJs ? rp.toJs({ dict_converter: Object.fromEntries }) : rp;

    py.globals.delete("__USER_CODE");
    py.globals.delete("__FN_NAME");
    py.globals.delete("__ARGS_JSON");
    py.globals.delete("__KWARGS_JSON");
    py.globals.delete("__MUT_IDXS_JSON");
    py.globals.delete("__MUT_CHECK");

    return {
      ok: Boolean(r.ok),
      kind: String(r.kind ?? ""),
      return_json: String(r.return_json ?? ""),
      mutation_check: Boolean(r.mutation_check ?? false),
      mutation_ok: Boolean(r.mutation_ok ?? false),
      mutation_failed_indices: Array.isArray(r.mutation_failed_indices)
        ? r.mutation_failed_indices
        : [],
      stdout: String(r.stdout ?? ""),
      stderr: String(r.stderr ?? ""),
    };
  }

  if (action === "ast_check") {
    py.globals.set("__USER_CODE", payload.userCode ?? "");
    py.globals.set("__AST_CFG_JSON", JSON.stringify(payload.astCfg ?? {}));
    const rp = await py.runPythonAsync(`__ast_check(__USER_CODE, __AST_CFG_JSON)`);
    const r = rp.toJs ? rp.toJs({ dict_converter: Object.fromEntries }) : rp;
    py.globals.delete("__USER_CODE");
    py.globals.delete("__AST_CFG_JSON");
    return r;
  }

  if (action === "gen_cases") {
    py.globals.set("__GEN_CFG_JSON", JSON.stringify(payload.generatorCfg ?? {}));
    const rp = await py.runPythonAsync(`__gen_function_cases(__GEN_CFG_JSON)`);
    const r = rp.toJs ? rp.toJs({ dict_converter: Object.fromEntries }) : rp;
    py.globals.delete("__GEN_CFG_JSON");
    return r;
  }

  throw new Error("Unknown action: " + action);
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  const id = msg.id;
  try {
    const result = await handle(msg);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: {
        message: String(err && err.message ? err.message : err),
        stack: String(err && err.stack ? err.stack : ""),
      },
    });
  }
};