import { getSampleInput } from "./problem-loader.js";
import {
  getRunInput,
  setRunInput,
  getDraftCode,
  setDraftCode,
  recordEvent
} from "../storage.js";

export function renderEditorPanelHtml() {
  return `
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
  `;
}

export function installPythonIndentation(textarea) {
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

export function setupEditorPanel({
  problem,
  state,
  codeEl,
  runInputEl,
  btnUseSample,
  btnClearInput,
  setStatus,
  getBaseCodeForProblem
}) {
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

  let codeDraftTimer = null;
  codeEl.addEventListener("input", () => {
    if (codeDraftTimer) clearTimeout(codeDraftTimer);
    codeDraftTimer = setTimeout(() => {
      setDraftCode(state, problem.id, codeEl.value);
    }, 250);
  });

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

  btnUseSample?.addEventListener("click", () => {
    const sample = getSampleInput(problem);
    runInputEl.value = sample;
    setRunInput(state, problem.id, sample);
    recordEvent(state, "run_input_use_sample", { problemId: problem.id, length: sample.length });
    setStatus(sample ? "Použitý vzor z testu pre Run." : "Táto úloha nemá žiadny vzorový vstup.");
  });

  btnClearInput?.addEventListener("click", () => {
    runInputEl.value = "";
    setRunInput(state, problem.id, "");
    recordEvent(state, "run_input_clear", { problemId: problem.id });
    setStatus("stdin pre Run vyčistené.");
  });

  return { overwriteDraftWithBase };
}
