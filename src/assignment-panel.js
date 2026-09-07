import { escapeHtml } from "./utils.js";

const KEY_TERMS = [
  "input()",
  "print()",
  "return",
  "tasks",
  "items",
  "state",
  "stav",
  "render",
  "localStorage"
];

function modeLabel(problem) {
  const m = String(problem.mode ?? "solve").toLowerCase();
  if (m === "fix") return "Oprav kód";
  if (m === "predict") return "Predpovedz výstup";
  if (problem.evaluation?.kind === "function" || problem.type === "function") return "Napíš funkciu";
  return "Vyrieš úlohu";
}

function functionNamesFor(problem) {
  const names = new Set();
  const target = problem.evaluation?.target?.name;
  if (target) names.add(target);
  const title = String(problem.title ?? "");
  const match = title.match(/\b([A-Za-z_]\w*)\s*\(/);
  if (match?.[1]) names.add(match[1]);
  return Array.from(names);
}

function renderInlineCodeText(text, problem) {
  let html = escapeHtml(text ?? "");
  const terms = [...functionNamesFor(problem), ...KEY_TERMS]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const raw of terms) {
    const escaped = escapeHtml(raw);
    const pattern = escaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundaryPrefix = /^[A-Za-z_]/.test(raw) ? "\\b" : "";
    const boundarySuffix = /[A-Za-z_]$/.test(raw) ? "\\b" : "";
    html = html.replace(new RegExp(`${boundaryPrefix}${pattern}${boundarySuffix}`, "g"), `<code>${escaped}</code>`);
  }
  return html;
}

function renderFocusList({ problem, md, currentRouteTask, simpleMode }) {
  const items = [];

  if (problem.mode === "fix") items.push("Najprv prečítaj chybné riešenie, potom oprav príčinu chyby.");
  if (problem.mode === "predict") items.push("Najprv napíš a uzamkni odhad, až potom použi Run.");
  if (problem.evaluation?.kind === "function" || problem.type === "function") items.push("Nepoužívaj input()/print(), výsledok vráť cez return.");
  if (currentRouteTask?.why) items.push(currentRouteTask.why);
  if (!simpleMode && md?.prompt) items.push(`Mikroobhajoba: ${md.prompt}`);

  const limit = simpleMode ? 2 : 3;
  const selected = items.slice(0, limit);
  if (selected.length === 0) return "";
  return `
    <div class="assignment-focus">
      <div class="assignment-subtitle">Čo si máš všimnúť</div>
      <ul>
        ${selected.map(x => `<li>${renderInlineCodeText(x, problem)}</li>`).join("")}
      </ul>
    </div>
  `;
}

export function renderAssignmentPanelHtml({ problem, md = {}, currentRouteTask = {}, simpleMode = false }) {
  return `
    <section class="assignment-panel ${simpleMode ? "assignment-simple" : ""}" id="assignmentPanel" aria-labelledby="assignmentTitle">
      <div class="assignment-eyebrow">TVOJA ÚLOHA</div>
      <h2 id="assignmentTitle">${escapeHtml(modeLabel(problem))}</h2>
      <p class="assignment-statement">${renderInlineCodeText(problem.statement, problem)}</p>
      ${renderFocusList({ problem, md, currentRouteTask, simpleMode })}
    </section>
  `;
}
