import { escapeHtml } from "./utils.js";
import { getUiPrefs } from "../storage.js";

export function renderRoutesHome(state, routes) {
  const ui = getUiPrefs(state);
  const lastLevel = Number(ui.lastLevel) || 1;
  const lastProblemId = ui.lastProblemByLevel[String(lastLevel)] || "";
  app.innerHTML = `
    <section class="card routes-home">
      <h2>Moje trasy</h2>
      <p class="muted">FixIt je krátka tréningová posilňovňa. Vyber trasu podľa fázy kurzu; celé levely nechaj na voľné precvičovanie.</p>
      <p class="small"><strong>Pravidlo hodiny:</strong> trasa nie je domáca úloha celá naraz. Učiteľ vyberá zvyčajne 2–5 úloh podľa fázy hodiny.</p>
      <div class="route-grid">
        ${routes.map(route => {
          const core = route.coreTasks?.length ?? 0;
          const reserve = route.reserveTasks?.length ?? 0;
          const minimum = (route.minimumTasks ?? route.coreTasks?.slice(0, 3) ?? []).map(t => t.id).join(", ");
          return `<article class="route-card">
            <a class="route-main-link" href="?route=${encodeURIComponent(route.id)}">
              <div class="small">${escapeHtml(route.phase ?? route.id)}</div>
              <h3>${escapeHtml(route.title)}</h3>
              <p>${escapeHtml(route.purpose ?? "")}</p>
              <div class="small">jadro: ${core}, rezerva: ${reserve}</div>
              <div class="small"><strong>Mikroobhajoba:</strong> ${escapeHtml(route.microDefense?.defaultPrompt ?? "")}</div>
            </a>
            <div class="row compact-row" style="margin-top:8px;">
              <a class="btn secondary linkbtn" href="?route=${encodeURIComponent(route.id)}&simple=1">Jednoduchý režim</a>
            </div>
            <details class="teacher-card">
              <summary>Učiteľská kartička</summary>
              <div class="small"><strong>Kedy použiť:</strong> ${escapeHtml(route.recommendedUse ?? "Krátky kurátorský blok podľa fázy hodiny.")}</div>
              <div class="small"><strong>Odporúčaný čas:</strong> ${escapeHtml(route.teacherCard?.minutes ?? "10–15 min")}</div>
              <div class="small"><strong>Minimum 3 úlohy:</strong> ${escapeHtml(minimum || "vyber podľa skupiny")}</div>
              <div class="small"><strong>Otázka:</strong> ${escapeHtml(route.microDefense?.teacherPrompt ?? route.microDefense?.defaultPrompt ?? "")}</div>
            </details>
          </article>`;
        }).join("")}
      </div>
      <div class="row" style="margin-top:16px;">
        <a class="btn secondary linkbtn" href="?level=${encodeURIComponent(lastLevel)}${lastProblemId ? `&problem=${encodeURIComponent(lastProblemId)}` : ""}">Voľné precvičovanie</a>
      </div>
    </section>
  `;
}

