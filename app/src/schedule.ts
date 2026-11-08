import { TASKS, Task } from "./tasks";

const DAY = 86400000;
// Week 0 starts Monday 2 November 2026.
const EPOCH = new Date(2026, 10, 2);

function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - dow);
  return x;
}

export function weekIndexOf(d: Date): number {
  return Math.round((mondayOf(d).getTime() - EPOCH.getTime()) / (7 * DAY));
}

export function weekStart(idx: number): Date {
  const x = new Date(EPOCH);
  x.setDate(x.getDate() + idx * 7);
  return x;
}

export function weekId(idx: number): string {
  const d = weekStart(idx);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function weekLabel(idx: number): string {
  const s = weekStart(idx);
  const e = new Date(s); e.setDate(e.getDate() + 6);
  const f = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString("en-GB", withMonth ? { day: "numeric", month: "short" } : { day: "numeric" });
  const sameMonth = s.getMonth() === e.getMonth();
  return `${f(s, !sameMonth)} – ${f(e, true)}`;
}

export function isDue(t: Task, idx: number): boolean {
  if (t.until !== undefined && idx > t.until) return false;
  if (t.alsoDue && t.alsoDue.includes(idx)) return true;
  return idx >= t.phase && (idx - t.phase) % t.freq === 0;
}

export function ownerFor(t: Task, idx: number): 0 | 1 {
  if (t.fixed !== undefined) return t.fixed;
  if (t.weekOwners && t.weekOwners[idx] !== undefined) return t.weekOwners[idx];
  const occ = Math.floor((idx - t.phase) / t.freq);
  return ((((t.owner0 + occ) % 2) + 2) % 2) as 0 | 1;
}

export type Duty = { task: Task; week: number; owner: 0 | 1; key: string; anyone?: boolean };

export function tickKey(week: number, taskId: string) {
  return `${weekId(week)}_${taskId}`;
}

export function dutiesFor(idx: number): Duty[] {
  if (idx < 0) return [];
  return TASKS.filter((t) => !t.runsOnly && isDue(t, idx)).map((t) => ({
    task: t, week: idx, owner: ownerFor(t, idx), key: tickKey(idx, t.id),
  }));
}

// The most recent past occurrence of each task, if it hasn't been ticked.
export function carriedOver(current: number, ticks: Record<string, Tick>): Duty[] {
  const out: Duty[] = [];
  for (const t of TASKS) {
    if (t.runsOnly) continue;
    if (t.until !== undefined && current > t.until) continue; // retired: replaced by newer jobs
    let prev = current - 1;
    while (prev >= 0 && !isDue(t, prev)) prev--;
    if (prev < 0) continue;
    const key = tickKey(prev, t.id);
    if (!ticks[key]) out.push({ task: t, week: prev, owner: ownerFor(t, prev), key });
  }
  return out;
}

export function nextDue(t: Task, from: number): number {
  let i = Math.max(from, 0);
  while (!isDue(t, i)) { i++; if (i > from + 200) return -1; }
  return i;
}

export type Tick = { by: number; at: string; legacy?: string };

// A tick on a retired combined job counts for each job that replaced it, unless that job has its own tick.
export function withLegacy(ticks: Record<string, Tick>): Record<string, Tick> {
  const out = { ...ticks };
  for (const k of Object.keys(ticks)) {
    const sep = k.indexOf("_");
    const wk = k.slice(0, sep), id = k.slice(sep + 1);
    for (const t of TASKS) {
      const reps = Array.isArray(t.replaces) ? t.replaces : t.replaces ? [t.replaces] : [];
      if (reps.includes(id) && !out[`${wk}_${t.id}`]) out[`${wk}_${t.id}`] = { ...ticks[k], legacy: k } as Tick;
    }
  }
  return out;
}

export function weekIndexOfId(id: string): number {
  const [y, m, d] = id.split("-").map(Number);
  return weekIndexOf(new Date(y, m - 1, d));
}

// Everything due in a week, plus any current job ticked that week even though it wasn't due
// (e.g. done early, or done before its schedule changed), so the work still shows and counts.
export function dutiesWithTicked(idx: number, ticks: Record<string, Tick>): Duty[] {
  const due = dutiesFor(idx);
  if (idx < 0) return due;
  const extra = TASKS.filter((t) => !t.runsOnly && !isDue(t, idx) && !(t.until !== undefined && idx > t.until) && ticks[tickKey(idx, t.id)])
    .map((t) => ({ task: t, week: idx, owner: ownerFor(t, idx), key: tickKey(idx, t.id) }));
  return [...due, ...extra];
}
