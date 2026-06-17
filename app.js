import { escapeHtml } from "./src/utils.js";
import { loadState, saveState, getUiPrefs, setCurrentRoute, setLastSelection } from "./storage.js";
import { loadLevel, loadStudentRoutes, loadProblemsForRoute, buildRouteTaskMeta } from "./src/problem-loader.js";
import { render } from "./src/task-renderer.js";
import { renderRoutesHome } from "./src/routes-renderer.js";
import { setupPwaOfflineStatus } from "./src/pwa-offline.js";

const app = document.querySelector("#app");

async function boot() {
  const params = new URLSearchParams(location.search);
  const simpleMode = params.get("simple") === "1";
  setupPwaOfflineStatus({ simpleMode });
  const state = loadState();
  saveState(state);

  const ui = getUiPrefs(state);
  const routes = await loadStudentRoutes();
  const requestedRouteId = params.get("route");

  if (requestedRouteId) {
    const route = routes.find(r => r.id === requestedRouteId);
    if (!route) throw new Error(`Neznáma FixIt trasa: ${requestedRouteId}`);
    setCurrentRoute(state, route.id);
    const problems = await loadProblemsForRoute(route);
    if (problems.length === 0) throw new Error(`Trasa ${requestedRouteId} neobsahuje dostupné úlohy.`);
    const requestedProblemId = params.get("problem");
    const lastProblemId = ui.lastProblemByLevel[`route:${route.id}`] || ui.lastProblemByLevel[String(problems[0].level)];
    const startProblem = problems.find(p => p.id === requestedProblemId)
      || problems.find(p => p.id === lastProblemId)
      || problems[0];
    setLastSelection(state, `route:${route.id}`, startProblem.id);
    render(startProblem, state, problems, startProblem.level, { route, routeTaskMetaById: buildRouteTaskMeta(route), routes, simpleMode });
    return;
  }

  const requestedLevel = Number(params.get("level"));
  const hasDirectProblem = params.has("level") || params.has("problem");
  if (!hasDirectProblem && routes.length > 0) {
    renderRoutesHome(state, routes);
    return;
  }

  const level = Number.isFinite(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 7
    ? requestedLevel
    : (Number(ui.lastLevel) || 1);

  const problems = await loadLevel(level);

  const requestedProblemId = params.get("problem");
  const lastProblemId = ui.lastProblemByLevel[String(level)];
  const startProblem = problems.find(p => p.id === requestedProblemId)
    || problems.find(p => p.id === lastProblemId)
    || problems[0];

  if (startProblem?.id) {
    setLastSelection(state, level, startProblem.id);
  }

  render(startProblem, state, problems, level, { routes, simpleMode });
}

boot().catch(err => {
  app.innerHTML = `<pre style="color:red;">${escapeHtml(String(err))}</pre>`;
});
