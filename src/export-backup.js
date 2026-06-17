import { copyToClipboard } from "./utils.js";
import { terminatePythonWorker } from "./runner-client.js";
import {
  loadState,
  recordEvent,
  buildAnonymousSummaryExport,
  buildPrivateBackupExport,
  importStateReplace,
  CONTENT_VERSION
} from "../storage.js";

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearFixItBrowserState() {
  try {
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("fixit.")) keysToDelete.push(k);
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));
  } catch {}

  try {
    const keysToDelete = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("fixit.")) keysToDelete.push(k);
    }
    keysToDelete.forEach(k => sessionStorage.removeItem(k));
  } catch {}
}

async function clearFixItCachesAndWorkers() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith("fixit.") || k.includes("fixit")).map(k => caches.delete(k)));
    }
  } catch {}

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs
        .filter(r => {
          const scriptURL = String(r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "");
          const sameOrigin = scriptURL.startsWith(location.origin + "/");
          const fixitScript = scriptURL.includes("/fixit/") || scriptURL.endsWith("/sw.js");
          const sameScope = String(r.scope || "").startsWith(location.origin);
          return sameOrigin && sameScope && fixitScript;
        })
        .map(r => r.unregister())
      );
    }
  } catch {}
}

function reloadWithFlag(flagName) {
  const url = new URL(location.href);
  url.searchParams.set(flagName, String(Date.now()));
  location.href = url.toString();
}

export function setupExportBackupHandlers({
  btnExport,
  btnCode,
  btnSummary,
  btnBackup,
  btnImport,
  fileImport,
  btnFactoryReset,
  btnOfflineCacheReset,
  problem,
  route,
  setStatus,
  renderMap
}) {
  btnImport?.addEventListener("click", () => {
    fileImport?.click();
  });

  fileImport?.addEventListener("change", async () => {
    const f = fileImport.files?.[0];
    if (!f) return;

    const ok = confirm("Import prepíše aktuálny stav aplikácie na tomto zariadení. Pokračovať?");
    if (!ok) {
      fileImport.value = "";
      return;
    }

    try {
      const text = await f.text();
      const data = JSON.parse(text);
      importStateReplace(data);
      reloadWithFlag("import");
    } catch (e) {
      alert("Import zlyhal: " + String(e?.message ?? e));
    } finally {
      fileImport.value = "";
    }
  });

  btnFactoryReset?.addEventListener("click", () => {
    const ok = confirm(
      "Vymazať môj progres odstráni lokálne uložené riešenia, pokusy, nastavenia a udalosti na tomto zariadení. Offline cache appky ostane zachovaná.\n\nChceš pokračovať?"
    );
    if (!ok) return;

    terminatePythonWorker();
    clearFixItBrowserState();
    reloadWithFlag("progress-reset");
  });

  btnOfflineCacheReset?.addEventListener("click", () => {
    const ok = confirm(
      "Vymazať offline cache odstráni service worker/cache app shellu a lokálnych zadaní. Tvoj progres ostane zachovaný. Po tomto kroku appku znova otvor online.\n\nChceš pokračovať?"
    );
    if (!ok) return;

    (async () => {
      terminatePythonWorker();
      await clearFixItCachesAndWorkers();
      reloadWithFlag("offline-cache-reset");
    })();
  });

  btnBackup?.addEventListener("click", async () => {
    const fresh = loadState();
    const exportObj = await buildPrivateBackupExport(fresh, {
      currentProblem: { id: problem.id, title: problem.title, level: problem.level },
      route: route ? { id: route.id, title: route.title } : null
    });

    const day = exportObj.exportedAt.slice(0, 10);
    downloadJson(`fixit-private-backup-${day}-${exportObj.submission.code}.json`, exportObj);

    recordEvent(fresh, "private_backup_export", { code: exportObj.submission.code, routeId: route?.id ?? null });
    setStatus("Súkromná záloha stiahnutá. Obsahuje tvoje lokálne riešenia — neodovzdávaj ju ako anonymný summary export.");
  });

  btnExport?.addEventListener("click", async () => {
    const fresh = loadState();
    const exportObj = await buildAnonymousSummaryExport(fresh, route, {
      currentProblem: { id: problem.id, title: problem.title, level: problem.level },
      routeMode: Boolean(route)
    });

    const day = exportObj.exportedAt.slice(0, 10);
    downloadJson(`fixit-anonymous-summary-${day}-${exportObj.submission.code}.json`, exportObj);

    recordEvent(fresh, "anonymous_summary_export", { code: exportObj.submission.code, routeId: route?.id ?? null });
    setStatus(`Anonymný summary export stiahnutý. Kód: ${exportObj.submission.code}`);
  });

  btnCode?.addEventListener("click", async () => {
    const fresh = loadState();
    const exportObj = await buildAnonymousSummaryExport(fresh, route);
    const code = exportObj.submission.code;
    const ok = await copyToClipboard(code);
    recordEvent(fresh, "anonymous_submission_code", { codeCopied: ok, code, routeId: route?.id ?? null });
    setStatus(ok ? `Anonymný kód skopírovaný: ${code}` : `Anonymný kód: ${code} (nepodarilo sa skopírovať)`);
  });

  btnSummary?.addEventListener("click", async () => {
    const fresh = loadState();
    const exportObj = await buildAnonymousSummaryExport(fresh, route, {
      currentProblem: { id: problem.id, title: problem.title, level: problem.level }
    });
    const sum = exportObj.summary;
    const topKindsText = (sum.topFailureKinds?.length ?? 0) === 0
      ? "—"
      : sum.topFailureKinds.map(t => `${t.kind}(${t.n}×)`).join(", ");

    const text =
`FIXIT ANONYMNÉ ZHRNUTIE PRE UČITEĽA
code: ${exportObj.submission.code}
content: ${CONTENT_VERSION}
route: ${exportObj.route?.id ?? "—"}
tasksTouched: ${sum.tasksTouched}
testsPassed: ${sum.testsPassed}
explained: ${sum.explained}
attempts: ${sum.attempts}
hintsUsed: ${sum.hintsUsed}
topFailureKinds: ${topKindsText}
current: ${problem.id} — ${problem.title}
privacy: bez mena, bez kódu, bez stdin, bez voľného textu`;

    const ok = await copyToClipboard(text);
    recordEvent(fresh, "anonymous_teacher_summary", { copied: ok, code: exportObj.submission.code, routeId: route?.id ?? null });

    setStatus(ok ? "Krátke anonymné zhrnutie skopírované do schránky." : "Krátke zhrnutie sa nepodarilo skopírovať.");
    renderMap?.();
  });
}
