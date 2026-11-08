# Flat rota

Cleaning rota for Jimmy and his flatmate Euan (Brockley flat, plus Jimmy's cat Joni). Live at
**https://jimmymozzer.github.io/flat-rota/** and used on both their phones, ticks syncing live.

## How Jimmy wants changes handled

- When he asks for a change, apply it **straight away and in full, including the current week**. Don't
  defer it to next week or quietly decide not to do part of it. If a change would affect something
  already ticked, ask first.
- Write in British English, plainly. Lead with the answer.
- After any change: build, check it, deploy, and tell him in a line or two what changed.

## Layout

```
index.html            the live page (a single self-contained bundle; GitHub Pages serves this)
app/                  source: React 18 + TypeScript + Tailwind, bundled with Parcel into one HTML file
  src/tasks.ts        every job: schedule, minutes estimate, kit, how-to steps, tips
  src/schedule.ts     week maths, who's turn it is, carried-over logic, legacy tick mapping
  src/timing.ts       logged job times (median of 2+ logs replaces the estimate)
  src/store.ts        Supabase connection, flat code gate, live sync, one-off jobs
  src/config.ts       Supabase URL + publishable key (public by design)
  src/App.tsx         all UI
supabase/             SQL already run in the Supabase project (see "Database")
tools/                smoke test (Playwright, mocked Supabase) and the balance search script
```

## Build and deploy

```
cd app
pnpm install          # first time only
pnpm deploy           # bundles to app/bundle.html and copies it to ../index.html
cd .. && git add -A && git commit -m "..." && git push
```

GitHub Pages redeploys from `main` / root within a minute or two. Pages caches for 10 minutes, and a
tab left open keeps the old version until it's refreshed.

Check before deploying: `node tools/smoke-test.cjs` (needs `pnpm add -D playwright` or a global
Playwright). It routes the Supabase calls to an in-memory fake, so it never touches real data.

## Data (Supabase, project `krpkuwjptablxyoukrkv`, London region)

The browser only ever calls `security definer` functions that check the flat code; RLS is on with no
policies, so the tables can't be read directly. The flat code is stored only as a bcrypt hash and is
never in the repo. The page asks for it once per phone and keeps it in localStorage.

Tables: `rota_settings` (names, code hash), `rota_ticks` (key → by 0/1, at), `rota_custom` (one-off jobs).
Functions: `rota_state`, `rota_tick`, `rota_names`, `rota_custom_save`, `rota_custom_delete`.

`supabase/01-setup.sql` was run on 5 Nov 2026. `supabase/02-one-off-jobs.sql` was sent on 8 Nov.
Ask Jimmy whether he has run it if adding a one-off job errors. To change the flat code:
`update public.rota_settings set code_hash = extensions.crypt('NEWCODE', extensions.gen_salt('bf')) where id = 1;`

### Keys stored in `rota_ticks` (no schema change needed for these)

| Key | Meaning |
|---|---|
| `2026-11-02_hob2` | job `hob2` ticked in the week starting Mon 2 Nov |
| `2026-11-02_binrun_<ts36>` | one bin run (5 min credit to `by`) |
| `2026-11-02_dur_<taskId>_<mins>` | logged time for that job that week |
| `2026-11-02_c-<customId>` | one-off job ticked |
| `2026-11-02_bins` | legacy bins tick, counted as one run |

Live updates use a Supabase Realtime broadcast channel named from a hash of the flat code, with a
15-second poll as backup. Free Supabase projects pause after about a week with no use.

## Scheduling model (`tasks.ts`)

Week 0 is the week starting Monday 2 November 2026. Each job has `freq` (weeks), `phase` (first due
week) and `owner0` (0 = Jimmy, 1 = Euan, for the first occurrence), and alternates owner every
occurrence. Extra fields:

- `weekOwners: { 0: 1 }` overrides the owner for a given week, used to keep a week's assignments when the pattern changes mid-week
- `alsoDue: [n]` makes a job due in extra weeks
- `until: n` retires a job after week n (`-1` = gone everywhere); kept so old ticks still resolve
- `replaces: "old" | ["a","b"]` means a tick on a retired combined job counts for each job that replaced it
- `fixed: 0` means always Jimmy's and left out of the fair-share comparison (Joni's jobs)
- `runsOnly: true` is bins: logged per run, never ticked or assigned

Any current job ticked in a week shows in that week even if it isn't due then (`dutiesWithTicked`).
Unticked jobs move to "Carried over" until ticked or until their next occurrence.

**Balancing:** after changing frequencies or minutes, re-pick the `owner0`/`phase` values so the two
weekly loads stay close. `tools/balance-search.py` is the brute-force search used last time; it has the
current minutes hard-coded, so update it first. The current schedule keeps the two loads within about
20 minutes in any week. Constraints used: the hallway hoover and the bathroom floor go to the same
person each week, and the current week's owners stay as they are (via `weekOwners`).

## Time estimates

Built from parts: clearing the area + getting kit out + the cleaning itself (small London flat) +
emptying, rinsing and putting away. Waiting time (soaks, drying, wash cycles) is not counted. Earlier
estimates left out set-up and pack-away and were far too low; Jimmy pushed back hard on that. Ticking
a job pops up a "how long did it take?" panel; once a job has 2+ logs, the median replaces the
estimate everywhere, Fair share included.

## Current decisions (8 Nov 2026)

- Target: the minimum that keeps the flat properly clean, about 2 hours each a week on average.
- Aim to finish by Sunday evening; nothing is flagged late, and unfinished jobs carry over on Monday.
- Floors: hoovering weekly everywhere; the bathroom floor is hoovered and mopped weekly; the kitchen
  tiles, living area and hallway are mopped fortnightly (kitchen and living in alternate weeks).
  Each room is its own job.
- Bins: no turn-taking; anyone taps "+ I took them down" per run (5 min each).
- One-off jobs: added from the week view, assigned to Jimmy, Euan or either; they carry over until done or removed.
- Joni's jobs are always Jimmy's.
- Dishes are off the rota: whoever didn't cook washes up.
- The oven and freezer are first due in the week starting 4 Jan 2027, then every 12 weeks.
- Floors: kitchen is black ceramic tiles; elsewhere wood-effect laminate. The weekly cleaner is Ecoleaf
  hard floor cleaner (60 ml per 5 l, mildly acidic, cat-safe). Soda crystals are for tiles only, then
  rinse twice. Damp mop only on the laminate.
- Cleaning advice must be cat-safe: no phenols or pine oil, no essential oils, no ammonia near the
  litter. Never combine bleach with acids or limescale remover.

## Other copies

An early version also exists as a claude.ai artifact, storing its ticks in Claude's own storage. It
is obsolete; only the GitHub Pages link is in use.
