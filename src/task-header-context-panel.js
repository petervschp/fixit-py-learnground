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

export function renderTaskHeaderHtml({ problem, entry, badgeHtml, navHtml, simpleMode = false }) {
  return `
    <div class="task-header ${simpleMode ? "task-header-simple" : ""}">
      <div>
        <h2 class="task-title">
          ${escapeHtml(problem.title)}
          <span class="pill">Level ${problem.level}</span>
          <span id="solvedBadgeSlot">${badgeHtml}</span>
        </h2>
        ${simpleMode ? `
          <div class="small student-mode-note">Jednoduchý režim: sústredíš sa na zadanie, editor, Run/Testy a vysvetlenie.</div>
        ` : `
          <div class="small">
            pokusy: <span id="attemptsVal">${entry.attempts}</span>,
            hinty: <span id="hintsVal">${entry.hintsUsed}</span>,
            posledný: <span id="lastResultVal">${entry.lastResult ?? "—"}</span>,
            content: ${CONTENT_VERSION}
          </div>
        `}
      </div>
      ${navHtml}
    </div>
  `;
}

export function renderRouteContextHtml({ route, currentRouteTask, md, simpleMode = false }) {
  if (route) {
    if (simpleMode) {
      return `
        <section class="route-context route-context-simple">
          <div class="small">Trasa</div>
          <strong>${escapeHtml(route.title)}</strong>
          ${currentRouteTask.why ? `<div class="small"><strong>Prečo teraz:</strong> ${escapeHtml(currentRouteTask.why)}</div>` : ""}
        </section>
      `;
    }

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
    <section class="route-context muted-context ${simpleMode ? "route-context-simple" : ""}">
      <strong>Voľné precvičovanie.</strong>${simpleMode ? "" : " Hlavná žiacka cesta sú krátke kurátorské trasy. Túto obrazovku používaj najmä ako rezervu alebo diagnostiku."}
    </section>
  `;
}

export function renderTaskContextPanelHtml({ entry, md }) {
  return `
    <section class="understanding-panel" id="understandingPanel">
      ${renderMicroDefenseCard(entry, md)}
      ${renderLearningNextStepCard(entry)}
    </section>
  `;
}
