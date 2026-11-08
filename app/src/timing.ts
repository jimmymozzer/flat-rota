import type { Tick } from "./schedule";
import { weekId } from "./schedule";

// Logged durations are stored as ordinary rows in the ticks table, with the minutes in the key:
//   <weekId>_dur_<taskId>_<minutes>
// so no database change was needed. One log per job per week.
const DUR_RE = /^(\d{4}-\d{2}-\d{2})_dur_(.+)_(\d+)$/;

export const TIME_CHOICES = [10, 15, 20, 30, 45, 60, 90];

export function durKey(week: number, taskId: string, mins: number) {
  return `${weekId(week)}_dur_${taskId}_${mins}`;
}

export type Durations = {
  byTask: Record<string, number[]>; // every logged time for a job, any week, either person
  thisWeek: Record<string, { key: string; mins: number }>; // keyed by `${weekId}_${taskId}`
};

export function parseDurations(ticks: Record<string, Tick>): Durations {
  const byTask: Record<string, number[]> = {};
  const thisWeek: Durations["thisWeek"] = {};
  for (const k of Object.keys(ticks)) {
    const m = DUR_RE.exec(k);
    if (!m) continue;
    const [, wk, id, minsStr] = m;
    const mins = Number(minsStr);
    if (!Number.isFinite(mins) || mins <= 0) continue;
    (byTask[id] ||= []).push(mins);
    thisWeek[`${wk}_${id}`] = { key: k, mins };
  }
  return { byTask, thisWeek };
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// Once a job has two or more logged times, their median replaces the estimate.
// Median rather than mean, so one unusually long deep clean doesn't skew it.
export function effectiveMinutes(taskId: string, estimate: number, d: Durations): { mins: number; fromLogs: number } {
  const xs = d.byTask[taskId] || [];
  if (xs.length < 2) return { mins: estimate, fromLogs: 0 };
  return { mins: Math.round(median(xs) / 5) * 5 || 5, fromLogs: xs.length };
}
