# Creator Studio 3 — merge brief

Hand this to the chat that will build it, together with **two** source zips:

| | |
|---|---|
| `creator-studio.zip` | this app — the `app/` folder is what lives in `www\` |
| the Storyboard app's `www` | **not included here** — export it separately |

Without the second zip the canvas has to be rebuilt from scratch, which is the
one part of this merge that is genuinely hard.

---

## What is being built

A **new, separate app** — not an update to any existing one. Creator Studio,
the laptop Planner and the Storyboard app all stay installed and untouched, so
there is something to go back to if this doesn't work out.

It must:

- keep **every** Creator Studio feature (inventory below)
- fold in the Storyboard app's **infinite canvas**, shot cards and stills picker
- run as an **Android APK** and a **Windows .exe** from **one codebase**
- give **every video its own board**, plus free boards for anything else
- break every filmed action into **individual shots**

It replaces the separate phone-app / laptop-Planner split, and the earlier
plan to live-link three apps. BlockNotes stays its own thing.

---

## The architectural decision to make first

Creator Studio is a Capacitor app: vanilla JS and IndexedDB in `www\`, wrapped
for Android. **Capacitor does not produce a Windows .exe.** One codebase on
both platforms means the same `www\` wrapped twice:

- **Android** — Capacitor, as now
- **Windows** — Electron or Tauri around the same `www\`

Tauri is far smaller; Electron is better trodden. Either way the web layer must
stop assuming Android: eleven files call Capacitor plugins —
`app.js`, `linkmeta.js`, `notify.js`, `reminders.js`, `rungps.js`, `saver.js`,
`share.js`, `shortcuts.js`, `storyboard.js`, `thumb.js`, `widget.js` — and each
needs a desktop path or a clean no-op. **Decide this before writing code** — retrofitting it is worse
than planning for it.

A second decision that follows from it: IndexedDB is per-install, so phone and
laptop do **not** share a database. Plan the sync — export/import file, or a
folder on his server — rather than discovering it late.

---

## How this codebase works

**Zero build step.** No bundler, no framework, no npm for the web layer. Every
file is a plain `<script>` in `index.html`, loaded in order, each wrapping an
IIFE that hangs one global off `window`.

**Load order matters.** A module using `Quarters` must come after `quarters.js`.
`index.html` is the dependency graph.

**Screens** register themselves: `Screens.register('task', mount)`, and are
opened with `Screens.push('task', { id, onChange })`. `mountInto(id, host,
{embedded:true})` renders one inside another screen — that is how the Content
tab and the Notes/Journal tabs host their sections.

**Data** goes through `store.js` (raw IndexedDB) and `data.js` (caching, task
queries, day arithmetic). Domain modules — `nutrition.js`, `quarters.js`,
`months.js`, `channels.js` — own their own records.

**Preview build:** `bash build-preview.sh` inlines every script and font into
one `creator-studio-preview.html`, openable in a browser with no server. Keep
this: it is how he tests without rebuilding the APK.

**His build loop:** copy `app\` over `www\`, then `npx cap sync android`, then
`build-apk.bat`. **Web files go in `www\` only — never edit `android\`.**
Project folder: `C:\Users\Khale\Projects\creator-studio-v2`. Not under git.

---

## Data model

**`DB_VERSION = 33`, 50 object stores.** Upgrades are additive — stores are
created if absent, nothing is migrated or dropped. A new app starts clean, but
if you ever import his existing data, respect these shapes.

**Planning spine (top to bottom):**

`quarters` → `months` → week (an episode in `vlogs`) → day block → sequence →
shots.

- **quarter** — 13 **project weeks**, not a calendar quarter. Has real
  `startDate`/`endDate` timestamps; the calendar label ("spans Q4 2026") is
  derived, never stored. Carries topic, through-line, challenge, a week
  template, and its reading (`sources`).
- **month** — whole weeks, **Sunday→Saturday**, not calendar months. Carries a
  challenge, habit tracks, stakes (reward + penalty options), a result
  (won/pending/lost), and `quarterId`.
- **vlog** (episode) — one project week. Holds day blocks, each holding
  sequences (stored as `beats`), each holding shots. Three modes: Plan, Shoot,
  Edit.
- **clip** — a single piece. Lifecycle `idea → planned → shot → editing →
  published`, with per-platform "cuts". Belongs to a **channel**.

**Everything else:** tasks, series, meals + templates + planner + grocery +
pantry + prep, swipes, refs, loads, routines, courses, journal, inbox,
challenges, runs, awards, avatars, exercises, plans, presets, rating, videos,
sequences, sources, physique, settings — plus eleven blob stores for images
(`meal-photo`, `swipe-thumb`, `task-media`, `journal-media`, `physique-photo`,
`ref-img`, `ref-poster`, `art`, `avatar-art`, `award-art`, `exercise-art`,
`section-art`, `inbox-media`, `toolicon`, `focal`).

**A trap that cost real debugging time:** `months` stores dates as
`"YYYY-MM-DD"` strings; `quarters` stores timestamps. Comparing them directly
is silently always false. Normalise with `Months.ts()` before any comparison.

---

## Screen inventory — what "every feature" means

**Five tabs:** Today · Month · Tools · Content · Profile.

**Today** — program clock, swipe right Done / left Skipped, list or timeline
view, day sheet. Tasks carry steps, shot lists, a `kind` (shoot/edit/publish/
workout) driving colour, a time block, recurrence via a shared `series` key,
linked references per shot, and now **notes + photos**.

**Month** — calendar, auto-schedule from channel cadence, filterable **by
channel**, month themes and goals.

**Content** (four sections) — Episodes · Series · Clips · Swipe.

**Tools (8 tiles, keep it at 8):** Workout, Nutrition, Program, Shots, Quick
Capture, Notes, Insights, Planning.

Tile routing is `slug(tile.name)` → `TOOL_ROUTES` in `app.js`. **Renaming a
tile breaks its route** unless the new slug is added. This has bitten three
times.

**Consoles with their own nav:** Workout (Workouts/Progress/Runs), Nutrition
(Dashboard/Meals/Prep), Shots (Shot list/References/Swipe file).

**The rest, by area:**

- **Planning** — quarters index by year, each quarter opening its months, each
  month opening its weeks. Quarters generate 13-week blocks out to 2030.
- **Channels** — a channel has a description, voice, who-watches, colour, a
  cadence, its series and clips, and a **"bar"**: the few reference videos that
  set the standard, one per channel. Series have their own bar.
- **Swipe file** — saved videos with hook, why it worked, what's transferable,
  your angle. Previews are **platform embeds** (YouTube, TikTok, Instagram,
  Facebook) — no downloading, no API key, derived from the link.
- **Episodes** — story structure (`story.js`): beat functions, shapes, arc,
  story-ready score; sequence templates; "put the beats on my days".
- **Nutrition** — meals, templates, planner, prep with batch scaling, grocery
  converting recipe amounts to shelf quantities, pantry in 10 food groups.
  Weeks run Sunday→Saturday.
- **Workout** — 72-exercise library with art and demo GIFs, routines, 29
  ready-made workouts, working loads with progressive overload, runs with GPS.
- **Academy** — courses, lessons, paper reader.
- **Gamification** — perfect-day streak with freezes, achievements, levels, XP,
  avatar ladder.
- **Import/export** — `datasets.js` describes 13 CSV datasets; an export *is*
  the template (headers plus a `#`-prefixed example row). Settings also does a
  full JSON backup. **Note:** the JSON backup in `transfer.js` covers **19 of the 50 stores** — it
  predates most of the app, so a "full backup" silently drops episodes,
  quarters, months, sources, physique, runs, routines, challenges and every
  image. Fix it before trusting it as a migration path.
- **Theming** — 6 colour palettes × light/dark, plus two letterings
  (Red Hat Display/DM Sans, or Quicksand/Nunito). Set as `data-palette` and
  `data-mode` on `<html>`, applied before first paint.
- **Multi-select** — long-press any list to pick several and delete.
- **Deep links** — `com.creatorstudio.v2://go/<key>` for shortcuts and widget,
  and `go/<kind>/<id>` to open a specific episode, day, quarter, month, clip,
  swipe, series or channel. Home-screen shortcuts and three widgets.

---

## Design system — do not renegotiate

**Colours (default dark):** bg `#151515`, surface-1 `#1F1C17`, surface-2
`#27241F`, line `#2F2C26`, shadow `#0A0806`. Orange `#FB6900`, orange-hi
`#FDB37E`. Cream `#EDE5D2`, muted `#969185`, dim `#605F57`. Green `#5BBE6A`,
red `#E2564A`, amber `#E8A33D`. Every colour is a CSS variable on `:root` —
that is what makes the palettes possible, so keep it.

**Type:** Red Hat Display Black (display), DM Sans (body), self-hosted in
`app/fonts/`. **The app makes no network calls for assets.**

**Geometry:** `--r:4px`, 14dp gutter, 42dp tab bar, 5px hard offset shadow.

**Icons** are solid silhouettes with `evenodd` holes — not stroke outlines. He
tried outlines and disliked them.

He notices empty, bland or mis-sized screens. Placeholder art and legible type
matter.

---

## Mistakes this codebase keeps producing

**Parsing clean is not evidence of working.** Every real bug in this build
parsed fine. The recurring ones, so you can check for them directly:

1. **A text-slice edit that removes something still in use** — `KINDS`, the
   exercise art functions, a missing comma in `store.js` that took down the
   whole app. After any edit, grep for the string you inserted and count it.
2. **`global` in a file that never declared it.** Files wrapped
   `(function(global){…})(window)` have it; files wrapped `(function(){…})()`
   do not, and `global.X` there throws at runtime, taking the app down at boot.
   Four separate instances. Grep: a file using `global.` must contain
   `(function(global)`.
3. **`closest('[data-mode]')` matching `<html>`.** The theme attributes live on
   the root element, so a handler looking for `[data-mode]` or `[data-type]`
   matches the document from *any* tap and swallows every other branch. Name
   controls `data-setmode`, `data-settype`, `data-wtype`.
4. **A rendered row nothing listens for.** Six settings rows rendered and did
   nothing because no handler matched their key. Check every `data-go` against
   its handler.
5. **A push to a screen that isn't registered** — `series-detail` instead of
   `series-view`. Check every `Screens.push('x')` against a
   `Screens.register('x')`.
6. **Two stacked `.view` elements.** `.view` is `flex:1` and scrolls; two as
   siblings fight for the height and one collapses to nothing. A fixed strip
   above a hosted screen must not be a `.view`.
7. **A renamed tool tile whose route key was never added.**
8. **Truthiness on a day number.** Day numbers run below 1 — day 0 is the day
   before Day 1, a real date — so `if(x.day)` and `x.day || null` silently drop
   it. Seventeen spots had it. Use `!= null` and `?? null`.
9. **`${t.something}` on a field not every creation path sets.** A task made
   from a clip, a shot, a quick capture or a vlog day has no cadence and no
   priority, and three places printed the missing value as a word on screen.
10. **Writing the program start without shifting the stored day numbers.**
   Everything is stored by day and week number, so that slides every plan onto
   a different real date. Go through `Data.moveStart`, never `setProgram`.

`app/tests/checks.test.js` checks for 1, 2, 3, 5, 7, 8 and 10 directly — run it
after any edit; it is cheap and it catches the bugs that parse fine and then
take the app down on the device.

**The discipline that catches these:** after any edit, run the screen against a
stub DOM — stub `Store`, `U`, `Data`, `Screens`, `App`, capture `innerHTML`,
assert on what rendered. There are example harnesses in `app/tests/`. Do that
before saying it works.

---

## How he works

- Tests on device, sends screenshots. **Trust the screenshots over your
  assumptions** — several times the app was right and my mental model wasn't,
  and several times the reverse.
- Often looking at a stale build. If something "isn't there", ask whether he
  rebuilt before digging.
- Wants honest pushback, not agreement. Tell him when an idea is wrong.
- Prefers consolidation over scatter — he has repeatedly asked to merge or
  collapse rather than add another entry point. This whole merge is that
  instinct.
- Plans one idea at a time. Don't generate a bulk multi-month plan; nail the
  big concept first.
- **Package your work so it survives.** Tests and build scripts belong *inside*
  the zip — a working directory was lost once and took 50 test harnesses with
  it because they sat outside.

---

## Known state at handover

**Working on device:** live notification with progress, home-screen shortcuts,
three home-screen widgets, deep links.

**Needs installing** for file exports: `npm i @capacitor/filesystem
@capacitor/share`, then `npx cap sync android`.

**Untested:** scheduled reminders have never been confirmed firing.

**Open items:** partial shoot days (ticking 2 of 3 subtasks doesn't move those
clips); avatar level-up animation; "Playlist" in Episodes; the JSON backup's
store list is stale; native location permissions for background GPS.
