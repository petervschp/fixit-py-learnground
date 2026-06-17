import { escapeHtml } from "./utils.js";

export function renderStatusBadge(entry) {
  if (entry?.status === "explained" || entry?.selfRating >= 3) {
    return `<span class="badge ok" style="margin-left:8px;">VYSVETLENÉ</span>`;
  }
  if (entry?.lastResult === "PASS" || entry?.solved) {
    return `<span class="badge ok" style="margin-left:8px;">TESTY PREŠLI</span>`;
  }
  return "";
}

export function microDefenseFor(problem, route, taskMeta = {}) {
  const prompt = problem.microDefense?.prompt
    || taskMeta.microDefense?.prompt
    || route?.microDefense?.defaultPrompt
    || "Jednou vetou vysvetli, čo bol stav, čo sa zmenilo a prečo riešenie prešlo testom.";
  const scale = problem.microDefense?.selfCheckScale || [
    { value: 1, label: "neviem vysvetliť" },
    { value: 2, label: "viem s pomocou" },
    { value: 3, label: "viem samostatne" },
  ];
  return { prompt, scale };
}

export function renderMicroDefenseCard(entry, md) {
  const rating = Number.isFinite(entry.selfRating) ? entry.selfRating : null;
  const disabled = entry.lastResult !== "PASS";
  return `
    <section class="card microdefense-card" id="microDefenseCard" style="margin-top:12px;">
      <h3 style="margin-top:0;">Mikroobhajoba porozumenia</h3>
      <p class="small">PASS znamená iba to, že testy prešli. Porozumenie si označ až po tom, čo vieš odpovedať.</p>
      <p><strong>Otázka:</strong> ${escapeHtml(md.prompt)}</p>
      <div class="row">
        ${md.scale.map(x => `<button class="btn secondary btnMicroDefense" data-rating="${x.value}" ${disabled ? "disabled" : ""}>${escapeHtml(x.label)}${rating === x.value ? " ✓" : ""}</button>`).join("")}
      </div>
      <div id="microDefenseStatus" class="small" style="margin-top:8px;">${disabled ? "Najprv spusti testy a dostaň PASS." : (rating ? "Sebakontrola uložená." : "Vyber, ako vieš riešenie vysvetliť.")}</div>
    </section>
  `;
}

export function renderLearningNextStepCard(entry) {
  const status = entry?.status ?? "new";
  const lastResult = entry?.lastResult ?? null;
  let title = "Ďalší krok";
  let text = "Najprv si prečítaj zadanie, potom spusti Run alebo Testy.";
  let cls = "next-step-card";

  if (lastResult === "FAIL") {
    title = "Najprv vysvetli prvý problém";
    text = "Pred ďalším pokusom si pozri prvý zlyhaný test: čo test poslal, čo očakával a čo tvoj kód vrátil alebo vypísal.";
    cls += " needs-explain";
  } else if (lastResult === "PASS" && status !== "explained") {
    title = "Testy prešli — ešte porozumenie";
    text = "Teraz odpovedz na otázku mikroobhajoby. Ak nevieš, vráť sa k prvému testu alebo klikni Poraď mi. Po vysvetlení pokračuj na ďalšiu úlohu.";
    cls += " needs-defense";
  } else if (status === "explained") {
    title = "Hotovo pre tento blok";
    text = "Úloha má prejdené testy aj označené porozumenie. Pokračuj na ďalšiu jadrovú úlohu alebo skonči krátky tréningový blok.";
    cls += " done";
  }

  return `
    <section class="card ${cls}" id="nextStepCard" style="margin-top:12px;">
      <h3 style="margin-top:0;">${escapeHtml(title)}</h3>
      <p id="nextStepText" class="small">${escapeHtml(text)}</p>
    </section>
  `;
}

