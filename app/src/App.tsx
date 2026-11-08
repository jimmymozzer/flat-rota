import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, Lightbulb, RotateCcw, Cloud, CloudOff, Loader2 } from "lucide-react";
import { TASKS, FREQ_LABEL, Task } from "./tasks";
import { withLegacy, carriedOver, dutiesFor, dutiesWithTicked, Duty, nextDue, ownerFor, Tick, weekId, weekIndexOf, weekIndexOfId, weekLabel } from "./schedule";
import { useMe, useRotaStore, SyncStatus, Custom } from "./store";
import { durKey, effectiveMinutes, parseDurations, TIME_CHOICES } from "./timing";

const PC = ["#1F6F6B", "#C4572A"]; // person colours
const PC_SOFT = ["#DCEBE8", "#F6E1D6"];
const NEUTRAL = "#6B655C";
export const BIN_RUN_MINUTES = 5;
const BINS = TASKS.find((t) => t.id === "bins")!;

// A one-off job someone added, shaped like a rota job so it renders, ticks and logs time the same way.
function customDuty(c: Custom): Duty {
  const task: Task = {
    id: `c-${c.id}`, name: c.name, area: "One-off", freq: 1, phase: 0, owner0: 0, minutes: c.minutes,
    kit: [], steps: [], custom: { id: c.id, anyone: c.owner === null, weekId: c.week },
  };
  return { task, week: weekIndexOfId(c.week), owner: (c.owner ?? 0) as 0 | 1, key: `${c.week}_c-${c.id}`, anyone: c.owner === null };
}
function binRunsFor(ticks: Record<string, Tick>, week: number) {
  const id = weekId(week);
  const prefix = `${id}_binrun_`;
  const legacy = `${id}_bins`; // a tick from when bins was a tick-off job counts as one run
  return Object.entries(ticks).filter(([k]) => k.startsWith(prefix) || k === legacy).map(([key, t]) => ({ key, ...t }))
    .sort((a, b) => a.at.localeCompare(b.at));
}
const AREA_ORDER = ["One-off", "Kitchen", "Living area", "Bathroom", "Hallway", "Whole flat", "Joni"];

function sundayNote(): string {
  const dow = (new Date().getDay() + 6) % 7; // Mon = 0
  const left = 6 - dow;
  if (left === 0) return "Sunday: aim to have it done by this evening";
  if (left === 1) return "Aim: done by Sunday evening · tomorrow";
  return `Aim: done by Sunday evening · ${left} days to go`;
}

type View = "week" | "balance" | "setup";

export default function App() {
  const { ticks: rawTicks, config, status, setTick, saveConfig, submitCode, codeError, forget, custom, saveCustom, deleteCustom } = useRotaStore();
  const ticks = useMemo(() => withLegacy(rawTicks), [rawTicks]);
  const durs = useMemo(() => parseDurations(rawTicks), [rawTicks]);
  const effMins = (t: Task) => t.custom
    ? (durs.thisWeek[`${t.custom.weekId}_${t.id}`]?.mins ?? t.minutes)
    : effectiveMinutes(t.id, t.minutes, durs).mins;
  const customDuties = useMemo(() => custom.map(customDuty), [custom]);
  const withEff = (d: Duty): Duty => ({ ...d, task: { ...d.task, minutes: effMins(d.task) } });
  const [justTicked, setJustTicked] = useState<string | null>(null);
  const [me, setMe] = useMe();
  const today = weekIndexOf(new Date());
  const current = Math.max(today, 0);
  const [week, setWeek] = useState(current);
  const [view, setView] = useState<View>("week");
  const [filter, setFilter] = useState<"all" | 0 | 1>("all");
  const [open, setOpen] = useState<string | null>(null);
  const names = config.names;
  const canEdit = status === "live" || status === "offline";

  const duties = useMemo(() => [...dutiesWithTicked(week, ticks), ...customDuties.filter((d) => d.week === week)].map(withEff), [week, ticks, durs, customDuties]);
  const carried = useMemo(() => (week === current
    ? [...carriedOver(current, ticks), ...customDuties.filter((d) => d.week < current && !ticks[d.key])].map(withEff)
    : []), [week, current, ticks, durs, customDuties]);

  const toggle = (d: Duty) => {
    if (!canEdit || d.week > current) return;
    const cur = ticks[d.key];
    if (cur?.legacy) {
      // Unticking one part of an old combined job: keep the other parts ticked as their own ticks.
      const legacyKey = cur.legacy;
      Object.entries(ticks).forEach(([k, t]) => { if (t.legacy === legacyKey && k !== d.key) setTick(k, { by: t.by, at: t.at }); });
      setTick(legacyKey, null);
    } else if (cur) setTick(d.key, null);
    else { setTick(d.key, { by: me ?? d.owner, at: new Date().toISOString() }); setJustTicked(d.key); }
  };

  const logTime = (d: Duty, mins: number | null) => {
    if (!canEdit) return;
    const prev = durs.thisWeek[`${weekId(d.week)}_${d.task.id}`];
    if (prev) setTick(prev.key, null);
    if (mins !== null && mins !== prev?.mins) setTick(durKey(d.week, d.task.id, mins), { by: me ?? d.owner, at: new Date().toISOString() });
    setJustTicked(null);
  };
  const rowTiming = (d: Duty) => {
    const oneOff = !!d.task.custom;
    const est = oneOff
      ? (custom.find((c) => `c-${c.id}` === d.task.id)?.minutes ?? d.task.minutes)
      : TASKS.find((t) => t.id === d.task.id)!.minutes;
    return {
      est, oneOff, fromLogs: oneOff ? 0 : effectiveMinutes(d.task.id, est, durs).fromLogs,
      logged: durs.thisWeek[`${weekId(d.week)}_${d.task.id}`]?.mins,
      prompt: justTicked === d.key,
      onLogTime: (m: number | null) => logTime(d, m),
      onSkip: () => setJustTicked(null),
    };
  };

  const runs = binRunsFor(ticks, week);
  const logRun = () => {
    if (me === null || !canEdit) return;
    setTick(`${weekId(week)}_binrun_${Date.now().toString(36)}`, { by: me, at: new Date().toISOString() });
  };
  const show = (d: Duty) => filter === "all" || d.owner === filter;
  const todo = duties.filter((d) => !ticks[d.key] && show(d)).sort((a, b) =>
    a.owner - b.owner || AREA_ORDER.indexOf(a.task.area) - AREA_ORDER.indexOf(b.task.area) || b.task.minutes - a.task.minutes);
  const done = duties.filter((d) => ticks[d.key] && show(d));
  const carriedShown = carried.filter(show);

  const stats = [0, 1].map((p) => {
    const mine = duties.filter((d) => d.owner === p && d.task.fixed === undefined && !d.anyone);
    const doneMine = mine.filter((d) => ticks[d.key]);
    const late = carried.filter((d) => d.owner === p && d.task.fixed === undefined && !d.anyone).length;
    return {
      total: mine.length, done: doneMine.length, late,
      mins: mine.reduce((s, d) => s + d.task.minutes, 0),
      doneMins: doneMine.reduce((s, d) => s + d.task.minutes, 0),
    };
  });

  const rel = week - current;
  const relLabel = rel === 0 ? "This week" : rel === 1 ? "Next week" : rel === -1 ? "Last week" : rel > 0 ? `In ${rel} weeks` : `${-rel} weeks ago`;

  if (status === "needcode") return <CodeGate onSubmit={submitCode} error={codeError} />;

  return (
    <div className="min-h-screen bg-[#F3EFE6] text-[#1E1C19] font-body">
      <div className="mx-auto max-w-[640px] px-4 pb-24 pt-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[30px] font-extrabold leading-none tracking-tight">Flat rota</h1>
            <p className="mt-1 text-[13px] text-[#6B655C]">{names[0]} &amp; {names[1]} · taking turns</p>
          </div>
          <SyncPill status={status} />
        </header>

        <nav className="mt-5 grid grid-cols-3 border border-[#1E1C19] text-[13px] font-semibold">
          {(["week", "balance", "setup"] as View[]).map((v, i) => (
            <button key={v} onClick={() => setView(v)}
              className={`py-2 ${i ? "border-l border-[#1E1C19]" : ""} ${view === v ? "bg-[#1E1C19] text-[#F3EFE6]" : "hover:bg-[#E8E2D5]"}`}>
              {v === "week" ? "This week" : v === "balance" ? "Fair share" : "Setup & how-to"}
            </button>
          ))}
        </nav>

        {me === null && (
          <div className="mt-4 border border-dashed border-[#1E1C19] bg-[#FBF9F4] p-3">
            <p className="text-[14px] font-semibold">Who's using this phone?</p>
            <p className="text-[13px] text-[#6B655C]">So ticks get credited to the right person.</p>
            <div className="mt-2 flex gap-2">
              {[0, 1].map((p) => (
                <button key={p} onClick={() => setMe(p as 0 | 1)} className="px-3 py-1.5 text-[14px] font-semibold text-white" style={{ background: PC[p] }}>I'm {names[p]}</button>
              ))}
            </div>
          </div>
        )}

        {status === "offline" && (
          <p className="mt-4 bg-[#F1DDD6] p-3 text-[13px]">Can't reach the rota right now. Ticks may not have saved; it will retry automatically.</p>
        )}

        {view === "week" && (
          <>
            <div className="mt-5 flex items-center justify-between">
              <button aria-label="Previous week" onClick={() => setWeek((w) => Math.max(0, w - 1))} disabled={week === 0}
                className="grid h-10 w-10 place-items-center border border-[#1E1C19] disabled:opacity-25"><ChevronLeft size={18} /></button>
              <button onClick={() => setWeek(current)} className="text-center">
                <div className="font-display text-[20px] font-bold leading-tight">{relLabel}</div>
                <div className="text-[13px] text-[#6B655C]">{weekLabel(week)}</div>
              </button>
              <button aria-label="Next week" onClick={() => setWeek((w) => w + 1)}
                className="grid h-10 w-10 place-items-center border border-[#1E1C19]"><ChevronRight size={18} /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {[0, 1].map((p) => {
                const s = stats[p];
                const active = filter === p;
                const pct = s.mins ? Math.round((s.doneMins / s.mins) * 100) : 0;
                return (
                  <button key={p} onClick={() => setFilter(active ? "all" : (p as 0 | 1))}
                    className="relative bg-[#FBF9F4] p-3 text-left transition"
                    style={{ outline: active ? `2px solid ${PC[p]}` : "1px solid #DDD6C8", outlineOffset: active ? 0 : -1 }}>
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-[17px] font-bold" style={{ color: PC[p] }}>{names[p]}{me === p ? " (you)" : ""}</span>
                    </div>
                    <div className="mt-1 text-[22px] font-display font-extrabold leading-none">{s.done}<span className="text-[14px] font-semibold text-[#6B655C]">/{s.total} done</span></div>
                    <div className="mt-2 h-1.5 w-full bg-[#E8E2D5]"><div className="h-full transition-all" style={{ width: `${pct}%`, background: PC[p] }} /></div>
                    <div className="mt-1.5 text-[12px] text-[#6B655C]">
                      {s.doneMins}/{s.mins} min
                      {s.late > 0 && <span className="ml-1 font-semibold text-[#A9341F]">· {s.late} carried over</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {week === current && (
              <p className="mt-3 text-[13px] text-[#6B655C]">{sundayNote()}. Anything left moves to Carried over on Monday, no drama.</p>
            )}
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="mt-2 text-[13px] underline underline-offset-2">Showing {names[filter]}'s tasks only. Show everyone's</button>
            )}

            {week < 0 || duties.length === 0 ? (
              <p className="mt-6 text-[14px] text-[#6B655C]">Nothing scheduled this week.</p>
            ) : null}

            {week <= current && week >= 0 && (
              <BinRuns runs={runs} names={names} me={me} canLog={canEdit && week === current} onLog={logRun} onRemove={(k) => setTick(k, null)}
                open={open === "bins"} onOpen={() => setOpen(open === "bins" ? null : "bins")} />
            )}

            {week === current && canEdit && (
              <AddJob names={names} me={me} onAdd={(name, owner, minutes) =>
                saveCustom({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), week: weekId(week), name, owner, minutes })} />
            )}

            {carriedShown.length > 0 && (
              <Section title="Carried over" note="Not ticked when it was last due" tone="late">
                {carriedShown.map((d) => (
                  <TaskRow key={d.key} d={d} tick={ticks[d.key]} names={names} late timing={rowTiming(d)} onRemove={() => d.task.custom && deleteCustom(d.task.custom.id)} onToggle={() => toggle(d)}
                    open={open === d.key} onOpen={() => setOpen(open === d.key ? null : d.key)} canTick={canEdit} />
                ))}
              </Section>
            )}

            {todo.length > 0 && (
              <Section title={week > current ? "Coming up" : "Outstanding"} note={`${todo.length} task${todo.length === 1 ? "" : "s"}`}>
                {todo.map((d) => (
                  <TaskRow key={d.key} d={d} tick={ticks[d.key]} names={names} timing={rowTiming(d)} onRemove={() => d.task.custom && deleteCustom(d.task.custom.id)} onToggle={() => toggle(d)}
                    open={open === d.key} onOpen={() => setOpen(open === d.key ? null : d.key)} canTick={canEdit && week <= current} />
                ))}
              </Section>
            )}

            {done.length > 0 && (
              <Section title="Done" note={`${done.length}`}>
                {done.map((d) => (
                  <TaskRow key={d.key} d={d} tick={ticks[d.key]} names={names} timing={rowTiming(d)} onRemove={() => d.task.custom && deleteCustom(d.task.custom.id)} onToggle={() => toggle(d)}
                    open={open === d.key} onOpen={() => setOpen(open === d.key ? null : d.key)} canTick={canEdit} />
                ))}
              </Section>
            )}

            {week <= current && todo.length === 0 && carriedShown.length === 0 && duties.length > 0 && (
              <p className="mt-6 border-l-4 border-[#1F6F6B] bg-[#FBF9F4] p-3 text-[14px] font-semibold">All done{filter === "all" ? "" : ` for ${names[filter]}`} this week. The flat thanks you.</p>
            )}
          </>
        )}

        {view === "balance" && <Balance current={current} ticks={ticks} names={names} effMins={effMins} customDuties={customDuties} />}
        {view === "setup" && <Setup names={names} saveConfig={saveConfig} me={me} setMe={setMe} current={current} status={status} canEdit={canEdit} forget={forget} effMins={effMins} />}
      </div>
      {(() => {
        const d = [...duties, ...carried].find((x) => x.key === justTicked);
        if (!d || !ticks[d.key]) return null;
        return (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-[#1E1C19] bg-[#FBF9F4] shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="mx-auto max-w-[640px]">
              <div className="px-4 pt-3 text-[14px]">Ticked: <b>{d.task.name}</b></div>
              <TimeLogger timing={rowTiming(d)} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SyncPill({ status }: { status: SyncStatus }) {
  const map: Record<SyncStatus, { label: string; icon: JSX.Element; cls: string }> = {
    needcode: { label: "Locked", icon: <CloudOff size={13} />, cls: "bg-[#E8E2D5]" },
    checking: { label: "Connecting", icon: <Loader2 size={13} className="animate-spin" />, cls: "bg-[#E8E2D5]" },
    live: { label: "Shared live", icon: <Cloud size={13} />, cls: "bg-[#DCEBE8] text-[#174F4C]" },
    offline: { label: "Offline", icon: <CloudOff size={13} />, cls: "bg-[#F1DDD6] text-[#7A2A18]" },
  };
  const m = map[status];
  return <span className={`inline-flex shrink-0 items-center gap-1 px-2 py-1 text-[12px] font-semibold ${m.cls}`}>{m.icon}{m.label}</span>;
}

function Section({ title, note, tone, children }: { title: string; note?: string; tone?: "late"; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline gap-2 border-b border-[#1E1C19] pb-1">
        <h2 className={`font-display text-[15px] font-bold uppercase tracking-[0.08em] ${tone === "late" ? "text-[#A9341F]" : ""}`}>{title}</h2>
        {note && <span className="text-[12px] text-[#6B655C]">{note}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + ", " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

type RowTiming = { est: number; oneOff?: boolean; fromLogs: number; logged?: number; prompt: boolean; onLogTime: (m: number | null) => void; onSkip: () => void };

function TaskRow({ d, tick, names, late, onToggle, open, onOpen, canTick, extra, timing, onRemove }: {
  d: Duty; tick?: Tick; names: [string, string]; late?: boolean; onToggle: () => void; open: boolean; onOpen: () => void; canTick: boolean; extra?: React.ReactNode; timing: RowTiming; onRemove?: () => void;
}) {
  const t = d.task;
  const col = d.anyone ? NEUTRAL : PC[d.owner];
  const soft = d.anyone ? "#E8E2D5" : PC_SOFT[d.owner];
  const isDone = !!tick;
  return (
    <div className={`bg-[#FBF9F4] ${late ? "ring-1 ring-[#A9341F]" : "ring-1 ring-[#DDD6C8]"}`} style={{ borderLeft: `5px solid ${col}` }}>
      <div className="flex items-stretch">
        <button aria-label={isDone ? `Untick ${t.name}` : `Tick ${t.name}`} onClick={onToggle} disabled={!canTick}
          className="grid w-14 shrink-0 place-items-center disabled:cursor-not-allowed">
          <span className={`grid h-7 w-7 place-items-center border-2 transition ${isDone ? "text-white" : "bg-transparent"} ${!canTick && !isDone ? "opacity-30" : ""}`}
            style={{ borderColor: col, background: isDone ? col : undefined, borderRadius: 999 }}>
            {isDone && <Check size={16} strokeWidth={3} />}
          </span>
        </button>
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 py-3 pr-3 text-left">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B655C]">{t.area}</div>
            <div className={`text-[15px] font-semibold leading-snug ${isDone ? "text-[#6B655C] line-through decoration-2" : ""}`}>{t.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[#6B655C]">
              {!t.custom && <><span>{FREQ_LABEL[t.freq]}</span><span>·</span></>}
              <span>{timing.fromLogs ? `${t.minutes} min (your times)` : timing.oneOff && timing.logged !== undefined ? `${t.minutes} min` : `about ${t.minutes} min`}</span>
              {isDone && timing.logged !== undefined && <><span>·</span><span>took {timing.logged}</span></>}
            </div>
            <div className="mt-1 text-[12px]">
              {isDone ? (
                <span className="text-[#6B655C]">Done by <b style={{ color: PC[tick!.by] }}>{names[tick!.by]}</b>{tick!.at ? ` · ${fmtWhen(tick!.at)}` : ""}</span>
              ) : (
                <span className="inline-block px-1.5 py-0.5 font-semibold" style={{ background: soft, color: d.anyone ? "#1E1C19" : col }}>
                  {d.anyone ? "Either of you" : t.fixed !== undefined ? `Always ${names[d.owner]}'s` : t.custom ? `For ${names[d.owner]}` : `${names[d.owner]}'s turn`}{late ? ` · from ${weekLabel(d.week)}` : ""}
                </span>
              )}
            </div>
          </div>
          <ChevronDown size={18} className={`shrink-0 text-[#6B655C] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {extra}
      {isDone && canTick && open && <TimeLogger timing={timing} />}
      {open && (t.custom
        ? <div className="flex items-center justify-between border-t border-[#DDD6C8] px-4 py-2.5 text-[13px] text-[#6B655C]">
            <span>One-off job you added.</span>
            {onRemove && canTick && <button onClick={onRemove} className="font-semibold text-[#A9341F] underline underline-offset-2">Remove job</button>}
          </div>
        : <HowTo t={t} />)}
    </div>
  );
}

function BinRuns({ runs, names, me, canLog, onLog, onRemove, open, onOpen }: {
  runs: Array<{ key: string; by: number; at: string }>; names: [string, string]; me: 0 | 1 | null; canLog: boolean;
  onLog: () => void; onRemove: (k: string) => void; open: boolean; onOpen: () => void;
}) {
  const count = [0, 1].map((p) => runs.filter((r) => r.by === p).length);
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline gap-2 border-b border-[#1E1C19] pb-1">
        <h2 className="font-display text-[15px] font-bold uppercase tracking-[0.08em]">Bins</h2>
        <span className="text-[12px] text-[#6B655C]">whoever's around · {BIN_RUN_MINUTES} min a run</span>
      </div>
      <div className="bg-[#FBF9F4] ring-1 ring-[#DDD6C8]">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">Runs this week</div>
              <div className="mt-0.5 flex gap-4 text-[14px]">
                {[0, 1].map((p) => (
                  <span key={p}><b style={{ color: PC[p] }}>{names[p]}</b> × {count[p]}</span>
                ))}
              </div>
            </div>
            <ChevronDown size={18} className={`shrink-0 text-[#6B655C] transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {canLog && (
            <button onClick={onLog} disabled={me === null}
              className="shrink-0 px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
              style={{ background: me === null ? "#6B655C" : PC[me] }}>
              + I took them down
            </button>
          )}
        </div>
        {me === null && canLog && <p className="px-4 pb-2 text-[12px] text-[#A9341F]">Choose who's using this phone (top of the page) to log a run.</p>}
        {runs.length > 0 && (
          <ul className="space-y-1 border-t border-[#DDD6C8] px-4 py-2">
            {runs.slice().reverse().map((r) => (
              <li key={r.key} className="flex items-center gap-2 text-[12px] text-[#6B655C]">
                <span className="h-2 w-2 rounded-full" style={{ background: PC[r.by] }} />
                <span className="flex-1">{names[r.by]} · {fmtWhen(r.at)}</span>
                {canLog && me === r.by && (
                  <button onClick={() => onRemove(r.key)} className="px-1.5 underline underline-offset-2">Undo</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {open && <HowTo t={BINS} />}
      </div>
    </section>
  );
}

function AddJob({ names, me, onAdd }: {
  names: [string, string]; me: 0 | 1 | null; onAdd: (name: string, owner: 0 | 1 | null, minutes: number) => Promise<string | null>;
}) {
  const [openForm, setOpenForm] = useState(false);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<0 | 1 | null>(null);
  const [mins, setMins] = useState(15);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!openForm) {
    return (
      <button onClick={() => { setOpenForm(true); setOwner(me); }}
        className="mt-4 w-full border border-dashed border-[#1E1C19] bg-[#FBF9F4] py-2.5 text-[14px] font-semibold">+ Add a one-off job</button>
    );
  }
  const chip = (active: boolean, color = "#1E1C19") => active
    ? { background: color, color: "white", border: `1px solid ${color}` }
    : { border: `1px solid ${color}`, color };
  return (
    <form className="mt-4 bg-[#FBF9F4] p-3 ring-1 ring-[#1E1C19]" onSubmit={async (e) => {
      e.preventDefault();
      if (!name.trim()) return;
      setBusy(true); setErr(null);
      const res = await onAdd(name.trim(), owner, mins);
      setBusy(false);
      if (res) setErr(res); else { setName(""); setOpenForm(false); }
    }}>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[15px] font-bold">Add a one-off job</span>
        <button type="button" onClick={() => { setOpenForm(false); setErr(null); }} className="text-[12px] text-[#6B655C] underline underline-offset-2">Cancel</button>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus placeholder="e.g. Clean behind the fridge"
        className="mt-2 w-full border border-[#1E1C19] bg-white px-2.5 py-2 text-[15px] outline-none" />
      <div className="mt-3 text-[12px] font-semibold text-[#6B655C]">Who's doing it?</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {[0, 1].map((p) => (
          <button type="button" key={p} onClick={() => setOwner(p as 0 | 1)} className="px-3 py-1.5 text-[13px] font-semibold" style={chip(owner === p, PC[p])}>{names[p]}</button>
        ))}
        <button type="button" onClick={() => setOwner(null)} className="px-3 py-1.5 text-[13px] font-semibold" style={chip(owner === null, NEUTRAL)}>Either of us</button>
      </div>
      <div className="mt-3 text-[12px] font-semibold text-[#6B655C]">Roughly how long?</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {[10, 15, 20, 30, 45, 60, 90].map((m) => (
          <button type="button" key={m} onClick={() => setMins(m)} className="min-w-[44px] px-2 py-1.5 text-[13px] font-semibold" style={chip(mins === m)}>{m}</button>
        ))}
      </div>
      {err && <p className="mt-2 text-[13px] font-semibold text-[#A9341F]">{err}</p>}
      <button disabled={busy || !name.trim()} className="mt-3 w-full bg-[#1E1C19] py-2.5 text-[14px] font-semibold text-[#F3EFE6] disabled:opacity-40">
        {busy ? "Adding…" : "Add job"}
      </button>
      <p className="mt-2 text-[11px] text-[#6B655C]">It goes on this week's list. If it isn't done by Sunday, it moves to Carried over until someone ticks it or removes it. Once it's ticked, the time you log counts towards Fair share.</p>
    </form>
  );
}

function TimeLogger({ timing }: { timing: RowTiming }) {
  const [other, setOther] = useState("");
  return (
    <div className="border-t border-[#DDD6C8] px-4 py-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-semibold">How long did it take?</span>
        {timing.prompt && <button onClick={timing.onSkip} className="text-[12px] text-[#6B655C] underline underline-offset-2">Skip</button>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {TIME_CHOICES.map((m) => (
          <button key={m} onClick={() => timing.onLogTime(timing.logged === m ? null : m)}
            className={`min-w-[44px] px-2 py-1.5 text-[13px] font-semibold ${timing.logged === m ? "bg-[#1E1C19] text-[#F3EFE6]" : "border border-[#1E1C19]"}`}>{m}</button>
        ))}
        <form className="flex" onSubmit={(e) => { e.preventDefault(); const n = Math.round(Number(other)); if (n > 0 && n < 600) { timing.onLogTime(n); setOther(""); } }}>
          <input value={other} onChange={(e) => setOther(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="other"
            className="w-[64px] border border-[#1E1C19] bg-white px-2 py-1.5 text-[13px] outline-none" />
          <button className="border border-l-0 border-[#1E1C19] px-2 text-[13px] font-semibold">OK</button>
        </form>
      </div>
      <p className="mt-1.5 text-[11px] text-[#6B655C]">
        {timing.logged !== undefined ? `Logged: ${timing.logged} min. Tap it again to clear. ` : ""}
        {timing.oneOff ? `Estimate ${timing.est} min; your logged time replaces it in Fair share.`
          : `Estimate ${timing.est} min${timing.fromLogs ? `; now using the middle of ${timing.fromLogs} logged times` : "; after two logged times the rota uses yours instead"}.`}
      </p>
    </div>
  );
}

function HowTo({ t }: { t: (typeof TASKS)[number] }) {
  return (
    <div className="border-t border-[#DDD6C8] px-4 pb-4 pt-3 text-[14px] leading-relaxed">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B655C]">You'll need</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {t.kit.map((k) => <span key={k} className="border border-[#DDD6C8] bg-white px-2 py-0.5 text-[12px]">{k}</span>)}
      </div>
      <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B655C]">How to do it</div>
      <ol className="mt-1.5 space-y-2">
        {t.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-[1px] grid h-5 w-5 shrink-0 place-items-center bg-[#1E1C19] font-display text-[11px] font-bold text-[#F3EFE6]">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {t.safety && (
        <p className="mt-4 flex gap-2 bg-[#F1DDD6] p-2.5 text-[13px] text-[#5E2112]"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{t.safety}</p>
      )}
      {t.tip && (
        <p className="mt-3 flex gap-2 bg-[#EFEAD9] p-2.5 text-[13px]"><Lightbulb size={16} className="mt-0.5 shrink-0" />{t.tip}</p>
      )}
    </div>
  );
}

function Balance({ current, ticks, names, effMins, customDuties }: { current: number; ticks: Record<string, Tick>; names: [string, string]; effMins: (t: Task) => number; customDuties: Duty[] }) {
  const weeks = Array.from({ length: current + 1 }, (_, i) => current - i);
  const rows = weeks.map((w) => {
    const ds = [...dutiesWithTicked(w, ticks), ...customDuties.filter((d) => d.week === w)].filter((d) => d.task.fixed === undefined);
    return {
      w,
      per: [0, 1].map((p) => {
        const mine = ds.filter((d) => d.owner === p && !d.anyone);
        return {
          assigned: mine.reduce((s, d) => s + effMins(d.task), 0),
          doneOwn: mine.filter((d) => ticks[d.key]).reduce((s, d) => s + effMins(d.task), 0),
          doneBy: ds.filter((d) => ticks[d.key]?.by === p).reduce((s, d) => s + effMins(d.task), 0)
            + binRunsFor(ticks, w).filter((r) => r.by === p).length * BIN_RUN_MINUTES,
          count: mine.length, countDone: mine.filter((d) => ticks[d.key]).length,
        };
      }),
    };
  });
  const totals = [0, 1].map((p) => rows.reduce((s, r) => s + r.per[p].doneBy, 0));
  const diff = totals[0] - totals[1];
  const lead = diff === 0 ? "Dead level so far." : `${names[diff > 0 ? 0 : 1]} has done ${Math.abs(diff)} min more so far.`;
  const max = Math.max(1, ...totals);

  return (
    <div className="mt-5">
      <p className="text-[14px] text-[#6B655C]">Minutes of cleaning actually ticked off by each of you since the rota started, counting cover for each other. Each logged bin run counts {BIN_RUN_MINUTES} minutes.</p>
      <div className="mt-4 space-y-3 bg-[#FBF9F4] p-4 ring-1 ring-[#DDD6C8]">
        {[0, 1].map((p) => (
          <div key={p}>
            <div className="flex justify-between text-[14px] font-semibold"><span style={{ color: PC[p] }}>{names[p]}</span><span>{totals[p]} min</span></div>
            <div className="mt-1 h-3 bg-[#E8E2D5]"><div className="h-full" style={{ width: `${(totals[p] / max) * 100}%`, background: PC[p] }} /></div>
          </div>
        ))}
        <p className="pt-1 font-display text-[17px] font-bold">{lead}</p>
      </div>

      <h2 className="mt-6 border-b border-[#1E1C19] pb-1 font-display text-[15px] font-bold uppercase tracking-[0.08em]">Week by week</h2>
      <div className="divide-y divide-[#DDD6C8]">
        {rows.map((r) => (
          <div key={r.w} className="py-3">
            <div className="text-[13px] font-semibold">{r.w === current ? "This week" : weekLabel(r.w)}</div>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              {[0, 1].map((p) => {
                const x = r.per[p];
                const full = x.countDone === x.count;
                return (
                  <div key={p} className="text-[12px]">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold" style={{ color: PC[p] }}>{names[p]}</span>
                      <span className="text-[#6B655C]">{x.countDone}/{x.count}</span>
                      {full && x.count > 0 && <Check size={13} style={{ color: PC[p] }} strokeWidth={3} />}
                    </div>
                    <div className="mt-1 flex gap-[3px]">
                      {Array.from({ length: x.count }, (_, i) => (
                        <span key={i} className="h-2 flex-1" style={{ background: i < x.countDone ? PC[p] : "#E8E2D5" }} />
                      ))}
                    </div>
                    <div className="mt-1 text-[#6B655C]">{x.doneOwn}/{x.assigned} min of own tasks</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Setup({ names, saveConfig, me, setMe, current, status, canEdit, forget, effMins }: {
  names: [string, string]; saveConfig: (c: { names: [string, string] }) => void; me: 0 | 1 | null; setMe: (v: 0 | 1 | null) => void; current: number; status: SyncStatus; canEdit: boolean; forget: () => void; effMins: (t: Task) => number;
}) {
  const [a, setA] = useState(names[0]);
  const [b, setB] = useState(names[1]);
  const dirty = a.trim() !== names[0] || b.trim() !== names[1];
  const groups = [1, 2, 4, 8, 12] as const;

  return (
    <div className="mt-5 space-y-6 text-[14px] leading-relaxed">
      <section>
        <h2 className="border-b border-[#1E1C19] pb-1 font-display text-[15px] font-bold uppercase tracking-[0.08em]">Names</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[[a, setA], [b, setB]].map(([v, set], p) => (
            <label key={p} className="block">
              <span className="text-[12px] font-semibold" style={{ color: PC[p] }}>Person {p + 1}</span>
              <input value={v as string} maxLength={20} disabled={!canEdit} onChange={(e) => (set as (s: string) => void)(e.target.value)}
                className="mt-1 w-full border border-[#1E1C19] bg-white px-2 py-1.5 text-[15px] outline-none focus:ring-2" style={{ ["--tw-ring-color" as string]: PC[p] }} />
            </label>
          ))}
        </div>
        <button disabled={!dirty || !a.trim() || !b.trim() || !canEdit}
          onClick={() => saveConfig({ names: [a.trim(), b.trim()] })}
          className="mt-3 bg-[#1E1C19] px-4 py-2 text-[14px] font-semibold text-[#F3EFE6] disabled:opacity-30">Save names</button>

        <div className="mt-4">
          <span className="text-[12px] font-semibold text-[#6B655C]">On this phone, I am</span>
          <div className="mt-1 flex gap-2">
            {[0, 1].map((p) => (
              <button key={p} onClick={() => setMe(p as 0 | 1)} className="px-3 py-1.5 text-[14px] font-semibold"
                style={me === p ? { background: PC[p], color: "white" } : { border: `1px solid ${PC[p]}`, color: PC[p] }}>{names[p]}</button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="border-b border-[#1E1C19] pb-1 font-display text-[15px] font-bold uppercase tracking-[0.08em]">How the rota works</h2>
        <p className="mt-2">This is the minimum that keeps the flat properly clean: about 2½ hours each a week on average. Every job alternates between you each time it comes round, so the weekly jobs swap every Monday. Some weeks are heavier than others, but over time you each do the same amount.</p>
        <p className="mt-2"><b>Times.</b> Each job starts with an estimate built from its parts: clearing the area, getting the kit out, the cleaning itself, and emptying and putting everything away. Waiting time like soaks and drying isn't counted. When you tick a job, log how long it really took. Once a job has two logged times, the rota uses the middle of your times instead of my estimate, so it gets more accurate the more you log.</p>
        <p className="mt-2">Aim to be done by Sunday evening so the flat starts the week clean, but any day works.</p>
        <p className="mt-2">Tick a job when it's done. Ticks are credited to whoever's phone it is, so if you cover for each other, the Fair share tab shows it. Anything left unticked when its week ends moves to <b className="text-[#A9341F]">Carried over</b> until someone does it or it comes round again.</p>
        <p className="mt-2 text-[#6B655C]">
          {status === "live" ? "Ticks are shared live: whatever one of you ticks, the other sees within a few seconds." :
            status === "offline" ? "Can't reach the rota right now; it keeps retrying." :
            "Connecting to the shared rota…"}
        </p>
      </section>

      <section>
        <h2 className="border-b border-[#1E1C19] pb-1 font-display text-[15px] font-bold uppercase tracking-[0.08em]">House rules</h2>
        <p className="mt-2"><b>Dishes</b> stay off the rota: whoever didn't cook washes up, and otherwise you each do your own, ideally the same day.</p>
        <p className="mt-2"><b>Joni's jobs</b> are always {names[0]}'s. They appear on the rota as reminders but don't count towards the fair share.</p>
        <p className="mt-2"><b>Bins</b> aren't anyone's turn: whoever's around takes them down when they're full and taps “+ I took them down” at the top of the week. Each run counts {BIN_RUN_MINUTES} minutes towards their fair share.</p>
      </section>

      <section>
        <h2 className="border-b border-[#1E1C19] pb-1 font-display text-[15px] font-bold uppercase tracking-[0.08em]">All jobs</h2>
        {groups.map((f) => (
          <div key={f} className="mt-3">
            <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#6B655C]">{FREQ_LABEL[f]}</div>
            <div className="mt-1 divide-y divide-[#DDD6C8] bg-[#FBF9F4] ring-1 ring-[#DDD6C8]">
              {TASKS.filter((t) => t.freq === f && !t.runsOnly && (t.until === undefined || t.until >= current)).map((t) => {
                const n = nextDue(t, current);
                const o = ownerFor(t, n);
                return <JobRow key={t.id} t={{ ...t, minutes: effMins(t) }} next={n === current ? "this week" : weekLabel(n)} owner={o} names={names} />;
              })}
            </div>
          </div>
        ))}
      </section>
      <p className="flex items-center gap-1.5 text-[12px] text-[#6B655C]"><RotateCcw size={12} />Rota started the week of 2 November 2026.</p>
      <button onClick={forget} className="text-[13px] underline underline-offset-2 text-[#6B655C]">Lock this phone (forget the flat code)</button>
    </div>
  );
}

function JobRow({ t, next, owner, names }: { t: (typeof TASKS)[number]; next: string; owner: 0 | 1; names: [string, string] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PC[owner] }} />
        <span className="flex-1">
          <span className="font-semibold">{t.name}</span>
          <span className="block text-[12px] text-[#6B655C]">{t.area} · {t.minutes} min · next {next}, {names[owner]}</span>
        </span>
        <ChevronDown size={16} className={`text-[#6B655C] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <HowTo t={t} />}
    </div>
  );
}

function CodeGate({ onSubmit, error }: { onSubmit: (c: string) => void; error: string | null }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-screen bg-[#F3EFE6] font-body text-[#1E1C19]">
      <form className="mx-auto max-w-[420px] px-5 pt-16" onSubmit={async (e) => { e.preventDefault(); setBusy(true); await onSubmit(v); setBusy(false); }}>
        <h1 className="font-display text-[34px] font-extrabold leading-none tracking-tight">Flat rota</h1>
        <p className="mt-3 text-[15px] text-[#6B655C]">Enter the flat code. You only need to do this once on each phone.</p>
        <input value={v} onChange={(e) => setV(e.target.value)} autoFocus autoCapitalize="none" autoCorrect="off" type="password"
          className="mt-5 w-full border-2 border-[#1E1C19] bg-white px-3 py-3 text-[17px] outline-none focus:border-[#1F6F6B]" placeholder="Flat code" />
        {error && <p className="mt-2 text-[14px] font-semibold text-[#A9341F]">{error}</p>}
        <button disabled={busy || !v.trim()} className="mt-4 w-full bg-[#1E1C19] py-3 text-[16px] font-semibold text-[#F3EFE6] disabled:opacity-40">
          {busy ? "Checking…" : "Open the rota"}
        </button>
      </form>
    </div>
  );
}
