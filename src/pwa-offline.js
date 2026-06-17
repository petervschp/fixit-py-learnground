const PWA_STATUS_ID = "pwaStatus";
let simplePwaMode = false;

function setPwaStatus(message, detail = "", state = "idle") {
  if (typeof document === "undefined") return;
  const box = document.querySelector(`#${PWA_STATUS_ID}`);
  if (!box) return;
  box.className = `pwa-status pwa-${state} ${simplePwaMode ? "pwa-simple" : ""}`;
  if (simplePwaMode) {
    const simple = simplifyPwaStatus(message, state);
    box.innerHTML = `
      <strong>Stav appky</strong>
      <span>${escapeHtml(simple.message)}</span>
      ${simple.detail ? `<div class="small">${escapeHtml(simple.detail)}</div>` : ""}
    `;
    return;
  }
  box.innerHTML = `
    <strong>Offline shell</strong>
    <span>${escapeHtml(message)}</span>
    ${detail ? `<div class="small">${escapeHtml(detail)}</div>` : ""}
  `;
}

export function setupPwaOfflineStatus(options = {}) {
  simplePwaMode = Boolean(options.simpleMode);
  if (typeof window === "undefined" || typeof navigator === "undefined") return;

  const updateConnection = () => {
    if (navigator.onLine === false) {
      setPwaStatus(
        "Prehliadač je offline.",
        "App shell a lokálne JSON úlohy môžu fungovať z cache. Python Run/Testy stále závisia od Pyodide runtime.",
        "offline"
      );
    }
  };

  window.addEventListener("online", () => {
    setPwaStatus(
      "Online. Offline shell ostáva pripravený po úspešnej registrácii service workera.",
      "Pyodide sa načíta pri prvom Run/Testy podľa PYODIDE_BASE_URL konfigurácie.",
      "ok"
    );
  });
  window.addEventListener("offline", updateConnection);

  if (!("serviceWorker" in navigator)) {
    setPwaStatus("Service worker nie je v tomto prehliadači dostupný.", "Aplikáciu spúšťaj cez moderný prehliadač a lokálny/HTTPS server.", "warn");
    return;
  }

  if (location.protocol === "file:") {
    setPwaStatus("Offline shell nie je aktívny pri otvorení cez file://.", "Spusti appku cez lokálny server, napríklad python -m http.server 8000.", "warn");
    return;
  }

  setPwaStatus("Registrujem offline shell…", "Cacheuje sa app shell, trasy a JSON úlohy. Pyodide runtime sa lokálne nebalí do hlavného ZIPu.", "loading");
  navigator.serviceWorker.register("./sw.js")
    .then(reg => {
      const detail = reg.waiting
        ? "Nová verzia offline shellu čaká na obnovenie stránky."
        : "App shell, moduly, trasy a úlohy sú pripravené na cacheovanie.";
      setPwaStatus("Offline shell registrovaný.", detail, "ok");
      return navigator.serviceWorker.ready;
    })
    .then(() => {
      if (navigator.onLine === false) updateConnection();
      else setPwaStatus("Offline shell pripravený.", "Run/Testy však stále potrebujú Pyodide CDN alebo nastavenú lokálnu runtime cestu.", "ok");
    })
    .catch(err => {
      setPwaStatus("Offline shell sa nepodarilo registrovať.", String(err?.message || err), "error");
    });

  updateConnection();
}

function simplifyPwaStatus(message, state) {
  if (state === "ok") return { message: "Zadanie a trasy sú dostupné.", detail: "Python sa rieši samostatne v paneli Stav Pythonu." };
  if (state === "offline") return { message: "Si offline. Zadania môžu fungovať z cache.", detail: "Run/Testy nemusia fungovať." };
  if (state === "loading") return { message: "Pripravujem appku na offline čítanie.", detail: "" };
  if (state === "warn" || state === "error") return { message: "Offline režim appky nie je pripravený.", detail: "Použi online pripojenie alebo zavolaj učiteľa." };
  return { message, detail: "" };
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}
