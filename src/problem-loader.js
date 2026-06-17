import { getStdoutTests } from "./test-engine.js";

export async function loadLevel(level) {
  const res = await fetch(`./problems/level-${String(level).padStart(2, "0")}.json`);
  if (!res.ok) throw new Error(`Failed to load level ${level}: ${res.status}`);
  return await res.json();
}

export async function loadStudentRoutes() {
  try {
    const res = await fetch("./student_routes.json");
    if (!res.ok) return [];
    const routes = await res.json();
    return Array.isArray(routes) ? routes : [];
  } catch {
    return [];
  }
}

export async function loadProblemsForRoute(route) {
  const routeTasks = [...(route.coreTasks ?? []), ...(route.reserveTasks ?? [])];
  const byLevel = new Map();
  for (const t of routeTasks) {
    const lvl = Number(t.level ?? String(t.id || "").match(/^L(\d+)/)?.[1]);
    if (!Number.isFinite(lvl)) continue;
    if (!byLevel.has(lvl)) byLevel.set(lvl, await loadLevel(lvl));
  }
  const out = [];
  for (const t of routeTasks) {
    const lvl = Number(t.level ?? String(t.id || "").match(/^L(\d+)/)?.[1]);
    const found = (byLevel.get(lvl) ?? []).find(p => p.id === t.id);
    if (found) out.push({ ...found, _routeTask: t });
  }
  return out;
}

export function buildRouteTaskMeta(route) {
  const meta = {};
  for (const t of route.coreTasks ?? []) meta[t.id] = { ...t, role: "core" };
  for (const t of route.reserveTasks ?? []) meta[t.id] = { ...t, role: "reserve" };
  return meta;
}


export function getSampleInput(problem) {
  const tests = getStdoutTests(problem);
  const firstVisible = tests.find(t => t.visible && (t.input ?? "") !== "");
  const firstAny = tests.find(t => (t.input ?? "") !== "");
  return (firstVisible?.input ?? firstAny?.input ?? "");
}

