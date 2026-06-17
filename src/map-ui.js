import { escapeHtml } from "./utils.js";
import { loadState, ensureProblemEntry, setLastSelection } from "../storage.js";

export function computeMisconceptionStats(state) {
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

export function renderTaskMap({ mapBox, allProblems, route, currentLevel, context, onSelectProblem }) {
  if (!mapBox) return;

  const s = loadState();
  mapBox.innerHTML = allProblems.map(p => {
    const e = ensureProblemEntry(s, p.id);
    const isSolved = Boolean(e.solved || e.lastResult === "PASS");
    const isExplained = e.status === "explained" || e.selfRating >= 3;
    const isTried = !isSolved && (e.attempts > 0 || e.hintsUsed > 0);

    const chipClass = isSolved ? "solved" : (isTried ? "tried" : "new");
    const chipText = isExplained ? "VYSVETLENÉ" : (isSolved ? "TESTY PREŠLI" : (isTried ? "SKÚŠANÉ" : "NOVÉ"));

    const mode = p.mode ?? "solve";
    const modeChip = `<span class="chip">${escapeHtml(mode.toUpperCase())}</span>`;
    const statusChip = `<span class="chip ${chipClass}">${chipText}</span>`;

    return `
      <button type="button" class="tile" data-problem-id="${escapeHtml(p.id)}">
        <div class="title">${escapeHtml(p.id)} — ${escapeHtml(p.title)}</div>
        <div class="meta">
          ${statusChip}
          ${modeChip}
          <span class="chip">pokusy: ${e.attempts}</span>
        </div>
      </button>
    `;
  }).join("");

  mapBox.querySelectorAll(".tile").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-problem-id");
      const next = allProblems.find(pp => pp.id === id);
      if (!next) return;
      const fresh = loadState();
      setLastSelection(fresh, route ? `route:${route.id}` : (next.level ?? currentLevel), next.id);
      onSelectProblem?.(next, fresh, context);
    });
  });
}
