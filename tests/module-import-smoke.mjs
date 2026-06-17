// Minimal module import smoke for Node environments where a real browser is unavailable.
// It does not replace tests/browser-smoke.mjs; it only checks the ES module graph.

globalThis.document = {
  querySelector() {
    return { innerHTML: "" };
  }
};

globalThis.window = {};

const modules = [
  "../src/utils.js",
  "../src/problem-loader.js",
  "../src/pyodide-config.js",
  "../src/runtime-status.js",
  "../src/pwa-offline.js",
  "../src/runner-client.js",
  "../src/test-engine.js",
  "../src/diagnostics.js",
  "../src/diagnostic-hints.js",
  "../src/microdefense.js",
  "../src/map-ui.js",
  "../src/export-backup.js",
  "../src/routes-renderer.js",
  "../src/problem-navigation.js",
  "../src/task-header-context-panel.js",
  "../src/editor-panel.js",
  "../src/predict-fix-panel.js",
  "../src/test-action-handlers.js",
  "../src/task-renderer.js"
];

for (const mod of modules) {
  await import(mod);
}

console.log(`Module import smoke OK: ${modules.length} modules imported.`);
