import { escapeHtml } from "./utils.js";
import {
  renderStatusBadge,
  microDefenseFor,
  renderMicroDefenseCard,
  renderLearningNextStepCard
} from "./microdefense.js";
import { CONTENT_VERSION, ensureProblemEntry } from "../storage.js";

export function buildTaskPresentation({ problem, state, route = null, routeTaskMetaById = {} }) {
  const entry = ensureProblemEntry(state, problem.id);
  const currentRouteTask = routeTaskMetaById[problem.id] ?? problem._routeTask ?? {};
  const md = microDefenseFor(problem, route, currentRouteTask);
  return { entry, currentRouteTask, md, badgeHtml: renderStatusBadge(entry) };
}

export function renderTaskHeaderHtml({ problem, entry, badgeHtml, navHtml }) {
  return `
    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
      <div>
        <h2 style="margin:0;">
          ${escapeHtml(problem.title)}
          <span class="pill">Level ${problem.level}</span>
          <span id="solvedBadgeSlot">${badgeHtml}</span>
        </h2>
        <div class="small">
          pokusy: <span id="attemptsVal">${entry.attempts}</span>,
          hinty: <span id="hintsVal">${entry.hintsUsed}</span>,
          posledný: <span id="lastResultVal">${entry.lastResult ?? "—"}</span>,
          content: ${CONTENT_VERSION}
        </div>
      </div>
      ${navHtml}
    </div>
  `;
}

export function renderRouteContextHtml({ route, currentRouteTask, md }) {
  if (route) {
    return `
      <section class="route-context">
        <div class="small">Aktívna trasa</div>
        <h3>${escapeHtml(route.title)}</h3>
        <p>${escapeHtml(route.purpose ?? "")}</p>
        ${currentRouteTask.why ? `<p class="small"><strong>Prečo táto úloha:</strong> ${escapeHtml(currentRouteTask.why)}</p>` : ""}
        <p class="small"><strong>Čo mám vedieť povedať:</strong> ${escapeHtml(md.prompt)}</p>
      </section>
    `;
  }

  return `
    <section class="route-context muted-context">
      <strong>Voľné precvičovanie.</strong> Hlavná žiacka cesta sú krátke kurátorské trasy. Túto obrazovku používaj najmä ako rezervu alebo diagnostiku.
    </section>
  `;
}

export function renderTaskContextPanelHtml({ problem, entry, md }) {
  return `
    <p>${escapeHtml(problem.statement)}</p>
    ${renderMicroDefenseCard(entry, md)}
    ${renderLearningNextStepCard(entry)}
  `;
}
