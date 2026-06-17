import { escapeHtml } from "./utils.js";
import { loadLevel } from "./problem-loader.js";
import { loadState, saveState, getUiPrefs, setLastSelection } from "../storage.js";

export function renderProblemNavigationHtml({ problem, allProblems, currentLevel, route = null, routeTaskMetaById = {}, simpleMode = false }) {
  if (route) {
    return `
      <div class="kv" style="grid-template-columns: 120px 300px;">
        <div class="small">Úloha v trase</div>
        <select id="problemSelect">
          ${allProblems.map(p => {
            const tm = routeTaskMetaById[p.id] ?? p._routeTask ?? {};
            const role = tm.role === "reserve" ? "rezerva" : "jadro";
            return `<option value="${escapeHtml(p.id)}" ${p.id === problem.id ? "selected" : ""}>${escapeHtml(p.id)} — ${escapeHtml(p.title)} [${role}]</option>`;
          }).join("")}
        </select>
        <div class="small">Režim</div>
        <div class="row compact-row">
          <a class="btn secondary linkbtn" href="./">Moje trasy</a>
          <a class="btn secondary linkbtn" href="?level=${encodeURIComponent(problem.level)}&problem=${encodeURIComponent(problem.id)}${simpleMode ? "&simple=1" : ""}">Voľné precvičovanie</a>
          <a class="btn secondary linkbtn" href="${simpleMode ? `?route=${encodeURIComponent(route.id)}&problem=${encodeURIComponent(problem.id)}` : `?route=${encodeURIComponent(route.id)}&problem=${encodeURIComponent(problem.id)}&simple=1`}">${simpleMode ? "Plný režim" : "Jednoduchý režim"}</a>
        </div>
      </div>
    `;
  }

  return `
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
        ${allProblems.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === problem.id ? "selected" : ""}>${escapeHtml(p.id)} — ${escapeHtml(p.title)}</option>`).join("")}
      </select>
      <div class="small">Trasy</div>
      <a class="btn secondary linkbtn" href="./">Moje trasy</a>
    </div>
  `;
}

export function setupProblemNavigation({ problemSelect, levelSelect, allProblems, currentLevel, route = null, context = {}, onRender }) {
  problemSelect?.addEventListener("change", () => {
    const id = problemSelect.value;
    const next = allProblems.find(p => p.id === id);
    if (!next) return;

    const fresh = loadState();
    setLastSelection(fresh, route ? `route:${route.id}` : (next.level ?? currentLevel), id);
    onRender(next, fresh, allProblems, next.level ?? currentLevel, context);
  });

  levelSelect?.addEventListener("change", async () => {
    const nextLevel = Number(levelSelect.value);

    const fresh0 = loadState();
    const ui0 = getUiPrefs(fresh0);
    ui0.lastLevel = nextLevel;
    saveState(fresh0);

    const nextProblems = await loadLevel(nextLevel);

    const fresh = loadState();
    const ui = getUiPrefs(fresh);
    const lastProblemId = ui.lastProblemByLevel[String(nextLevel)];
    const nextProblem = nextProblems.find(p => p.id === lastProblemId) || nextProblems[0];

    onRender(nextProblem, fresh, nextProblems, nextLevel, {});
  });
}
