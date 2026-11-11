# Creator Studio — handover

Give this file to a new chat along with `creator-studio.zip`. Between them, a
fresh session has everything it needs to carry on.

---

## What this is

A personal productivity app for a multi-channel content creator. Vanilla JS,
IndexedDB, **zero build step**, wrapped in Capacitor for Android.

**Owner:** Kris (Khaleem Catten), @solakirus.

---

## Where things live

| | |
|---|---|
| Source | `app/` in the zip |
| Preview | `creator-studio-preview.html` — one file, opens in a browser |
| Rebuild preview | `bash build-preview.sh` inside `app/` |
| Android extras | `android-plugin/` — native plugin, icons, install notes |
| His machine | `C:\Users\Khale\Projects\creator-studio-v2` |

**His build loop:** copy the zip's `app\` contents over `www\`, double-click
`build-apk.bat`. Web files go in `www\` **only** — never touch `android\`.

---

## Design system — do not renegotiate

**Colours:** bg `#151515`, surface-1 `#1F1C17`, surface-2 `#27241F`, line
`#2F2C26`, shadow `#0A0806`. Orange `#FB6900`, orange-hi `#FDB37E`. Cream
`#EDE5D2`, cream-raised `#F6EFDD`, muted `#969185`, dim `#605F57`. Green
`#5BBE6A`, red `#E2564A`, amber `#E8A33D`.

**Type:** Red Hat Display Black (display), DM Sans (body). **Self-hosted** in
`app/fonts/` — the app makes no network calls.

**Geometry:** `--r:4px` everywhere, 14dp gutter, 5px hard offset shadow,
42dp tab bar.

**Three treatments:** dark warm (default), cream/paper (`.screen.paper` — the
Academy reader, the perfect-day card), glass-over-art.

---

## Structure

**Tabs (5):** Today · Weekly · Tools · Series · Profile.
Icons are solid silhouettes with `evenodd` holes — *not* stroke outlines. He
tried outlines and disliked them; filled is what reads bright when selected.

**Tools dock (8 tiles, keep it at 8):** Workout, Nutrition, Swipe File, Shots,
Episodes, Quick Capture, Calendar, Journal.

Tile routing is `slug(tile.name)` → `TOOL_ROUTES` in `app.js`. **Renaming a tile
breaks its route** unless the new slug is added — this has bitten twice.

**Consoles** (own bottom nav): Workout = Workouts/Progress/Runs. Nutrition =
Dashboard/Meals/Prep. Shots = Shot list/References.

---

## What works

**Today** — program clock, swipe right Done / left Skipped, list or timeline,
day sheet. Header is 3 chips + 3 icons; he asked for it to stay at six.

**Tasks** — steps, shot lists, planned angles, coverage. A task can carry a
`kind` (shoot/edit/publish/workout) driving a coloured tag and timeline colour,
a `mins` time block, a `routineId`, a `series` for recurrence, and linked
references per shot.

**Recurrence** — weekday toggles + weeks, on any task. Creates real dated tasks
sharing a `series` key; opening one offers "End it".

**Production pipeline** — per-channel cadence and **shoot days**. Calendar →
Auto-schedule works backwards, batches shoots, writes shoot/edit/publish tasks
and clips. Idempotent via `slotKey`; removing a piece unpicks the chain.

**Clips** — planner with hook, flow, length, CTA, three titles, thumbnail,
keywords, success metric, script editor with word count, readiness score. Clip
state advances automatically when the matching task is ticked.

**Episodes** — story structure via `story.js`: eleven beat **functions**
(hook, promise, complication, payoff…), four **shapes** to scaffold a week, a
story-ready score, and an arc drawn from the beat functions. "Put the beats on
my days" turns scheduled beats into real shoot tasks (tracked by `beat.taskId`
so it never duplicates).

**Shots console** — every shot from every task and beat in one list, grouped by
**location**, filterable by outstanding/captured. Plus the reference library
(stills, GIFs, clips, or pasted links; video imports auto-poster a frame).

**Nutrition** — dashboard folds, meals + templates, prep with per-meal batch
scaling, portions-in-stock vs the rest of the week. Grocery converts recipe
amounts to **shelf quantities** and refuses to guess. Pantry grouped into 10
food groups with a guided inventory walk. Weeks run **Sunday→Saturday**.

**Workout** — 72-exercise library with muscle tags, cover art and demo GIFs
(overlay player mid-set). Saved **routines**, a gallery of **29 ready-made
workouts across 12 types** with editable filters, **working loads** with
scheduled **progressive overload** (default 10% / 3 weeks, scoped per routine,
per-lift hold). Runs with live lap tracking.

**Academy** — 3 shipped courses / 17 lessons, plus imported ones. Paper reader
with try-this blocks and takeaways.

**Gamification** — perfect-day streak with **streak freezes** (one earned per 7
days, max 2, spent automatically), 21+ achievements, levels with XP breakdown,
an avatar ladder unlocked by level.

**Import / export** — `datasets.js` describes 10 datasets; Settings → Import and
export. **An export is the template**: full headers plus a `#`-prefixed example
row even when empty. Images travel as `*_url` links.

---

## Known state

**Working on device:** live notification with progress, action button, status
chip, deep link.

**Needs installing** (`npm i @capacitor/filesystem @capacitor/share` then
`npx cap sync android`): all file exports. Check Settings → Notifications →
diagnostics for a green "File saving" row.

**Optional manual step:** copy `android-plugin/icon/res/*` and
`android-plugin/res/drawable/ic_stat_studio.xml` into `android\app\src\main\res\`.

**Untested:** scheduled reminders have never been confirmed firing.

**Open items:** partial shoot days (ticking 2 of 3 subtasks doesn't move those
clips); avatar transformation animation on level-up; light theme; green
nutrition accent; "Playlist" in Episodes.

---

## How he works

- Tests on device, sends screenshots. Trust them over assumptions.
- Often looking at a stale build — if something "isn't there", ask whether he
  rebuilt before digging.
- Wants honest pushback, not agreement.
- Notices empty, bland or mis-sized screens. Placeholder art and legible type
  matter to him.
- Prefers things consolidated over scattered — he has repeatedly asked to merge
  or collapse rather than add another entry point.

---

## The failure mode in this codebase

**Parsing clean is not evidence of working.** Every real bug in this build was
mine, and every one of them parsed fine:

- a text-slice edit that removed `KINDS` and `kindTag` while leaving their uses
- the same mistake removing the exercise art functions
- a missing comma in `store.js` that took down the whole app
- a guard flag shared across tabs that silently killed every tab's handlers
- markup styled but never inserted
- a renamed tile whose route key was never updated

**So:** after any edit, grep for the string you inserted and count it. Then run
the screen against a stub DOM — stub `Store`, `U`, `Data`, `Screens`, `App`,
capture `innerHTML`, assert on what rendered. Do that before saying it works.

## Added in the "Creator studio App for 1k Content Creation" chat (Sep 23)

Merged onto this build's own swipe.js, clip.js, task.js, views/clips.js and views/today.js
(three-way merge — the embeds, multi-select, cuts and lifecycle from this build are kept).

- **js/versions.js** — one shoot, many posts. Version formats (Original, Tutorial, Story, ASMR,
  Carousel, Bloopers, BTS, Aesthetic clip + quote, Final vs attempts, Custom), templates
  (built-in + saved in settings 'version-templates'), progress (todo → edited → posted), shoot
  needs. `stageOf(clip)` maps the Lifecycle stage to a work tab:
  idea→plan, planned→shoot, shot→edit, editing→post, published→post (done).
- **js/swiperefs.js** — swipe reference cards + picker. Clip: `plan.swipeIds`; task: `swipeIds`
  (legacy `swipeId` still shown); tasks inherit their clip's refs.
- **js/linkmeta.js** — title / creator / cover for a link. Native (CapacitorHttp) reads IG, TikTok,
  FB with the crawler UA; browser only YouTube (noembed). Sets `title`, `author`, `imageUrl`,
  a "Creator:" line in `why`, and downloads the cover into 'swipe-thumb'.
- **Clip page** — Plan / Shoot / Edit / Post tabs (sections can appear on several), Versions,
  References, move-on buttons that advance Lifecycle (never back, except "Move it to …").
  Shot list on Shoot; Cuts and Where it is on Post.
- **Clips list** — segmented Plan / Shoot / Edit / Post tabs replace Library/Queue and the stage
  dropdown; channel dropdown and long-press select kept. Published clips group at the bottom of Post.
- **Swipe file** — icon header (import CSV, add links); CSV file picker, busy lock, duplicate skip;
  bulk "Add links" with background detail fetch + "Fill in missing details"; per-swipe "Fetch
  details"; "Used in" + "Use for a clip". Grid: Instagram without a cover uses a cropped, zoomed
  live embed (reels fill the card); TikTok/Facebook keep Embed. Entry keeps Embed for all.
- **Today** — timed items split by thin dividers into 3-hour periods (Early morning 3–6A … Night
  6–9P, Late night either side of midnight).
- Fixed: `coverFor` wrapped imageUrl in double quotes inside a double-quoted style attribute.

## Month page + episode linking (Sep 23, spec: month-page-spec.md)

- **Store `months`** (DB_VERSION 32, additive). Fields: id, name, quarter, quarterTheme, quarterId,
  challenge, startDate (Sunday), endDate (Saturday), verdictReleaseDate (Thu after end), reward,
  penaltyOptions[], result null|W|L, notes, createdAt. Dates are "YYYY-MM-DD" strings.
- **Episodes stay in `vlogs`.** New optional fields: monthId, skill, weeklyChallenge, passLine,
  releaseDate (only when set by hand), isVerdict, result, segments[{key,label,status todo|shot|done}],
  scriptBeats{intro,history,wisdom,science,backToMe}. `week` is the one source of truth for
  film dates (filmStart/filmEnd/release are computed by Months.datesOf — not stored).
- A challenge month's week slot = project week number; an episode fills it when monthId matches
  and week matches. One episode per slot, enforced by create/link/tag and the week changer.
- **js/months.js** — data + date math (snapSunday/snapSaturday/thursdayAfter, weeks(),
  createEpisode, linkEpisode, linkable, fitFor, slotHolder, withExtras, datesOf).
- **js/screens/months.js** — 'months' (list, form) and 'month' (page: result, stakes, week ladder,
  verdict date). Also injects the CSS for the episode page panel.
- **views/month.js** — Calendar tab now hosts Calendar | Months via the Content-style floating nav.
  calendar.js untouched.
- **screens/vlog.js** — additive: Month field + Step 5 panel (episodePanelHTML) in Plan and Edit
  modes; week changer refuses a week another episode of the same month holds.
- **transfer.js** — backup now includes vlogs and months; "replace" import only clears stores the
  backup actually contains (an older backup can no longer wipe episodes).
- Today (views/today.js) is not touched by any of this.

## Step 6 — Research library (built on the existing `sources` store, no new store)

- **js/research.js** — `Research` API over `sources`: type→`kind` (added experiment, history,
  popculture to Quarters.KINDS; article/video/podcast still read), item→`passage`,
  source→`work`/`author`/`url`, new optional `useIn` (intro|history|wisdom|science|backToMe) and
  `status` (idea|verified|used; missing reads as idea), episode→`vlogId` (null = unassigned).
  quickAdd / edit / pickFor sheets, groupedHTML for an episode.
- **js/screens/research.js** — 'research' list with type / status / assigned filters.
- **Episodes list** (vlog.js mountList) — Research bar: unassigned count + one-tap "+ Log".
- **Episode page** — "This week's reading" is now "Research", grouped by segment, with + Add and
  Link existing; rows open the full editor. The old sourceSheet is still there, unused.
- Backup now also carries `sources` and `quarters`.

## Step 7 — Scoreboard (feeds the existing level)

- **js/scoreboard.js** — habits (vlog, training, german); episodes carry `habitDays{…}` 0–7; months
  carry `habits` (null = all three). XP weights in settings 'scoreboard-xp' (defaults habitDay 10,
  weeklyWin 50, monthlyWin 200); optional level thresholds in settings 'level-thresholds' (total XP
  each level starts at, from level 2; empty = built-in curve). Registers 'scoreboard-settings'
  (Settings → Challenge XP) and 'statcard' (screenshot view).
- **levels.js** — WEIGHTS gains habitDay / weeklyWin / monthlyWin (overridden from settings);
  points() adds them from Scoreboard.counts(); state() uses custom thresholds when set, the curve
  otherwise. Nothing is stored — XP is always recomputed.
- **profile.js** — the level breakdown lists the three challenge rows.
- **Episode panel** — habit-day steppers for the month's active habits, Stat card button; result and
  habit changes call Celebrate.checkLevel(). **Month page** — Month totals (habit days per habit,
  weekly record, XP earned); month W calls checkLevel().

## Step 8 — Import plan (phase1.json)

- **js/planimport.js** — `PlanImport.parse / preview / apply` for format "creator-studio-phase-plan".
  Preview writes nothing. Months skip when one already starts on the same Sunday (episodes then link
  to that existing month); episodes skip when their id exists or their week already has an episode.
  Week comes from filmStart against the program start (plan weekNumber only checked, with a warning).
  Plan ids are kept (m-2026-10, ep-w01…) so a second import skips everything. Imported episodes get
  the weekly day-by-day acts and the default segments; releaseDate is stored only if not the usual
  Thursday.
- **Channel series** (optional, on by default in the preview): `series` → the series store as drafts
  (cadence Weekly = the app's default, total = number of ideas); skipped when the same name already
  exists on that channel (ideas then go into yours). `seriesEpisodes` → `videos` at stage idea in
  their series, keeping `order` and `parts`; notes = idea + "When: timing" + numbered parts.
  createdAt = import time − order so the plan's order reads top to bottom. Skipped when that series
  already has a video with the same title.
- **Months view** — "Import plan" button → file picker (no type filter) → preview sheet → report toast.

## Episode delete + series bulk import (Sep 23)

- **Episodes list** — long-press select (Select.enable on .mediacard) → Delete. **Episode page** —
  "Delete outline" is now "Delete episode" and asks first. Both use deleteEpisodes(): research
  (sources.vlogId) goes back to unassigned, tasks already sent stay, month slots just free up.
- **PlanImport.parseAny** — plan JSON, series-only JSON ({series, seriesEpisodes} or a bare array of
  ideas), or a CSV (series, channel, title, idea|notes, timing|when, order, parts ; -separated).
  Ideas without a listed series create it from their own series + channel.
- **Series tab** — IMPORT header button → the same preview sheet (titled "Import series" when there
  are no months/episodes). Exposed as window.PlanImportUI.fromFile from screens/months.js.
- **Series page** — "Add several ideas at once": paste one per line ("Title — note" / "Title | note");
  numbered/bulleted lines are cleaned; titles already in the series skip. Videos list by `order`.

## Series delete, series video filters, episode order (Sep 23)

- **Series tab** — long-press select → Delete (views/series.js removeSeries): a series' videos still at
  Idea are deleted with it; anything further along is kept with seriesId cleared. The series form's
  Delete now asks first and uses the same rule (it used to leave every video pointing at nothing).
  multiselect.js no longer adds an "s" to a noun that already ends in one ("2 series").
- **Series page** — search (title, notes, tags) and a stage filter with counts over its videos; typing
  redraws only the list.
- **Episodes list** — earliest first (lowest week at the top), grouped by challenge month when the
  episode is tagged (so week 1 sits under October), calendar month otherwise, "No week set" last.

## Channels (Sep 23)

- **Settings → Channels** — renaming a channel now carries every series, clip, video and swipe tagged
  with the old name over to the new one (renameChannel in settings.js). A box lists channel names
  your series/clips/videos use that aren't set up, with one tap to add them all (palette colours).
- **Series form** — hint that colours and names live in Settings → Channels.

## Fixes (Sep 23, late)

- **Long-press Delete bar was invisible app-wide.** A later `.selbar` rule in styles.css (the
  reference library's in-page bar) overrode the multiselect bar on <body>, making it a sticky strip
  at the end of the document. That rule is now scoped to `.view .selbar`.
- **Series page Edit** opens the series form in place (ViewSeries.edit(id, after)); it used to just
  pop back to the list. Deleting from there closes the page.
- **Series form** — "Edit channels" link opens Settings → Channels (colours, names, and one-tap adding
  of channels that are in use but not set up).

## Series description, video types, channel duplicates (Sep 23, late)

- **Series** gain `about`, `kinds[]` (Short (vertical), Long-form, Vlog, How-to, Talking head, Review,
  Multi-part build, Behind the scenes, Podcast, Live — multi-pick) and `format` (free text). Edited in
  the series form, shown on the series page (with a "Describe this series" prompt when empty).
- **Channels.match(name, list)** — case/punctuation/"&"/little-word-insensitive, plus ≤2-letter
  typos on longer names. Used by: the series form (a near-duplicate channel shows as your saved one,
  and saving files it there), Settings → Channels ("Used in your work but not set up": per name,
  File under <your channel> (pre-picked when it matches) / Add as new / Leave — File under runs
  renameChannel across series, clips, videos, swipes), and the plan importer (incoming channel names
  are filed under yours).

## Program plans: linked videos (Sep 23, late)

- Plans carry `swipeIds[]`. Each plan card shows a "How to do it" strip (SwipeRefs.fill into
  [data-refslot]) or a "+ Link a video for how to do it" button; handled in screens/program.js's own
  click handler (open / unlink / link). The editor deep-copies the plan, so swipeIds survive edits.
- **Task page** — a task with planId shows the plan's videos in References, marked "from plan".
- Backups now also carry `videos` and `plans`.

## Swipe folders (Sep 23, late)

- **js/folders.js** — `SwipeFolders`: folder list in settings 'swipe-folders' ({id,name,emoji,pinned,
  order,createdAt}); swipes carry `folders[]` (many allowed). remove() clears the id from swipes,
  never deletes them. contents() → { folderId: swipes, __none: swipes in no folder }.
- **Swipe tab** — All · Folders switch. Folders = 2×2 cover-mosaic tiles (pinned first), a "Not in a
  folder" tile, and New folder. An open folder shows the same card grid with search only, a back
  button and Edit (name, icon, pin, delete). Add links has "Save into a folder" (pre-picked inside a
  folder). The swipe entry has folder chips (+ New folder).
- **multiselect.js** — opts.extra: [{label, run(ids, done)}] buttons before Delete. Swipes use it for
  "+ Folder" and, inside a folder, "Remove".

## The run-up to Day 1 (brought over from v2, 2026-10-13)

CS3's baseline was the v2 copy that did **not** have v2's prep-phase work, so
three things were missing. They are in now.

**Day numbers run below 1.** `currentDay()` was already unclamped here, so the
app could already sit on day 0 or a negative day — but a lot of code tested a
day for truthiness, which silently treats **day 0 as no day at all**. Day 0 is
a real date: the day before Day 1. Every such test is now `!= null`, and every
`x.day || null` normalisation is `?? null`. Seventeen spots across eleven files.
`checks.test.js` now fails if one comes back.

**The run-up has a name.** `program.preName`, default "Prep" (quick picks Prep
and Red phase), set in Settings → Program start. `Data.phaseOf(n)` returns
`{pre, name, toGo}` and `Data.dayLabel(n)` gives either "Day 12 · week 2" or
"Prep · 4 days to Day 1". The day sheet, the profile badge and the shot list all
read through those, so they agree. `Data.todayDay()` exists as an alias of
`currentDay()` only so code ported from v2 or the laptop Planner keeps working.

**Moving Day 1 no longer moves the plans.** This was a live bug: the start-date
sheet called `Data.setProgram({ start })` and nothing else, so every task, beat
and milestone slid onto a different real date. It now calls `Data.moveStart(ts,
preName)`, which shifts stored day numbers by the same amount the start moved —
tasks, episode acts and beats, program plans (`startDay`, `add`, `skip`),
one-off videos, and challenge weeks — so a shoot planned for Saturday is still
on Saturday afterwards. `tests/prep.test.js` proves that against a fake store:
a shoot on day 10 stays on Wed 14 Oct while its number moves to day 6.

**Also fixed:** `store.js` opens a newer database as-is instead of failing with
`VersionError` — the thing that stops a stale build taking the phone down, which
is what happened on 5 Oct 2026. And it honours `CS_DB_NAME` so tests use a
throwaway database. The task detail printed a missing value as a word for any
task made from a clip, a shot, a quick capture or a vlog day — none of those set
a cadence or priority. Three spots fixed.

**Tests:** `node app/tests/prep.test.js` (moveStart against a fake store),
`node app/tests/prep-render.test.js` (the three screens against a stub DOM),
`node app/tests/checks.test.js` (whole-app invariants, now 23 of them). No
install needed.

## Paper on the laptop (2026-10-13)

**Paper is now a tab in Planning**, beside Quarters and Months, as well as the
pen button on Today. On a laptop you plan from Planning, so having the only way
in be a small pen icon on Today was the wrong way round. Hosted there it drops
its own title bar — the tab strip already names it, and a second bar would eat
the height the page needs.

**The page fits the window.** `fit()` used to size by width alone and cap at
1.25×. That is right on a phone, where screen and page are both portrait. On a
laptop the window is landscape and the page is not, so width-only produced a
tall sheet you scrolled through rather than a page you could look at. There are
now two modes, on a button in the toolbar:

- **Whole page** (default) — fits both ways, measuring the room under the
  toolbar with `getBoundingClientRect` rather than assuming it.
- **Fill width** — the old behaviour, capped at 2×. Bigger, and the better one
  to actually write at.

The choice is remembered in `paper-meta.prefs.fit`.

Worth knowing: `spreadOn()` already turns on the two-page spread from 900px
wide, so a laptop gets two pages side by side. With whole-page fit that is
1086×760 in a 1450×760 window — a far better use of a landscape screen than one
portrait page at 543px wide.

**Also fixed:** `paper-screen.js` filtered tasks with `t => t.day`, so a task on
a prep day never reached the page at all. Now `!= null`, like the rest.

**Tests:** `node app/tests/paper-tab.test.js` — 18 checks covering the Planning
tab, the embedded bar, the prep-day filter, and the fit arithmetic at laptop,
spread and phone sizes.

## Paper: full view, page turning, journal (2026-10-13)

**Full view** — a toolbar button puts the planner on its own, as a `pp-full`
class on the host rather than the Fullscreen API: the dialogs, toolbar and pen
all have to keep working, and a real fullscreen request puts `<dialog>` behind
the page. The toolbar stays sticky at the top with a ✕, and Escape leaves.

**Turning the pages** — a wide strip down each edge of the stage, plus
←/→ and PageUp/PageDown. The strips are sized in `fit()` to the margin
*beside* the sheet and disabled when there is none, so a pen stroke down the
edge of the page stays a pen stroke rather than turning it. The keyboard
handler stands down while something is being typed into and while a dialog is
open, and is unbound when full view closes.

**Mindful morning and Evening reflection can go to the journal.** Those two
zones carry `journal:'<heading>'`, which reaches the element as `data-journal`
and the typed dialog as a checkbox. The writer lives in `paper-screen.js`,
since paper.js has no business knowing the store: it appends under `## <heading>`
in that date's `journal` record, and re-reading the same box **replaces its own
section** rather than stacking another copy. Handwriting stays on the page
either way; this is an addition, not a move.

**What the zones already did**, which is worth writing down because it is easy
to assume otherwise:

| Box | Becomes |
|---|---|
| To-do | tasks on that date, no time |
| Top 3 priorities | tasks on that date, no time |
| Schedule | tasks at the hour written in — 5 PM block → `at` 17:00, one hour |
| Month calendar | tasks on that day of the month |
| Notes, Main focus | typed copy kept with the page, searchable |

The schedule prompt already asks for start and end, and a bracket spanning
several hour boxes becomes a longer `mins`. So "write it in the 5 PM block and
get a 5 PM task" was already the design — if it misreads, that is the
handwriting step, not the mapping.

**Tests:** `node app/tests/paper-full.test.js` — 30 checks, including the
journal writer run for real against a fake store.

## A day's visuals on the episode's board (2026-10-13)

The episode↔board sync already existed: every episode has one board
(`vb-vlog-<id>`), each sequence is a Section, each shot a card, and edits go
both ways. What was missing was the **day**.

`boardsync.js` was already sending `act` (the day's title) with every
sequence, and `board.html` threw it away in a ternary whose branches were
identical:

```js
title: beat.act ? `${beat.title}` : beat.title     // did nothing either way
```

Now each sequence carries `actId` and `actDay` too, and the Section stores
`act` and `actName` in its data — not in the title, which the episode owns and
writes back. Sections made before this get tagged the next time the board
opens.

**Each day in the episode has a Board button** (beside its date and Rename).
It opens the *same* board with `focus=act:<id>`, and `fit()` now takes an
optional subset so the board frames that day's sections instead of the whole
week. A week is one board; a day is a view of it. If the day has no sequences
yet the button says so rather than opening an empty stage.

**Tests:** `node app/tests/board-day.test.js` (22 checks on the chain), and
`xvfb-run node app/tests/browser/boardday.browser.js` which drives the real
canvas: two days, opens one, and checks that row ends up centred on the stage
and that the episode is unchanged by looking at it. Run `bash build-preview.sh`
in `app/` first — the browser tests load the single-file preview.

## Dragging a card on the week board (2026-10-15)

On the phone a card could not be dragged — it only ever opened. The cause was
one CSS declaration:

```css
.wk-card{ … touch-action: pan-x pan-y }
```

That tells the browser the touch belongs to scrolling, so it claims the gesture
as soon as the finger moves and fires `pointercancel`. The 280ms long-press
never got the chance to lift the card. The mouse path worked, which is why it
looked fine on the laptop.

Cards are now `touch-action: none`, so every gesture that starts on one reaches
the handler. The cost is that scrolling from a card is the board's job, and
`week-board.js` does it: until the hold turns the gesture into a drag, a finger
pans `.wk-cols` horizontally or the page vertically by hand, whichever axis it
moved furthest on. The slop also went from 6px to 10px — a resting finger
wanders a few pixels, and at 6 the hold was being cancelled before it could
fire. A gesture that panned sets `noClick`, so scrolling the board no longer
opens whatever task the finger started on.

**Test:** `xvfb-run node app/tests/browser/weekdrag.browser.js` — a real touch
pointer through CDP: press, hold past 280ms, drag to the edge until the board
scrolls the next day in, drop, and check the task moved to the day it was
dropped on. It also checks a quick tap still opens the task, and that
`touch-action` is `none`.

**Worth knowing for the other boards:** any element that wants a long-press
drag on touch needs `touch-action: none` and its own panning. `.tlitem`,
`.wbeat` and the clip rows still say `pan-y` and will have the same problem if
a drag is ever added to them.

## On the iPad, as an installed web app (2026-10-15)

No Apple Developer account, no Mac, no $99. Safari's **Add to Home Screen**
gives a fullscreen app with its own icon, its own database and offline use.
The app already ran without Capacitor — every plugin call is guarded, and the
browser tests have always loaded it with no Capacitor present — so this was
packaging, not a rewrite.

**Served from GitHub Pages**, by `.github/workflows/pages.yml`: it stages
`app/` minus the tests, stamps the service worker, runs `scripts/check-site.js`
and publishes. Only `app/` reaches the web; `android/`, `electron/` and `docs/`
stay in the repo, and the check fails the deploy if any of them appear.

**It must be Add to Home Screen, not a bookmark.** Safari clears an ordinary
site's storage after 7 unused days; installed web apps are exempt. A bookmark
would quietly lose the database in a week.

**The service worker** (`app/sw.js`, stamped by `scripts/build-sw.js`):

- the precache list is read off disk at build time, never kept by hand — a
  hand-kept list goes stale the first time a script is added, and it fails
  *only offline*, which is when it cannot be debugged
- `BUILD` is a content hash, so rebuilding unchanged files keeps the cache,
  and any real change makes a new one; every older cache is deleted on activate
- the page is network-first, assets cache-first — so a deploy is picked up as
  soon as there is signal, rather than the device being stranded on an old build
- it is **not** registered inside the APK or Electron, where the files already
  come off disk
- IndexedDB is untouched by any of it; a worker update never clears data

**iOS specifics added:** `-webkit-touch-callout:none` on the gestures that use
a long press (the week board's cards, the ink canvas) — `user-select` alone
does not stop Safari raising the copy/share callout; `overscroll-behavior:
contain` so scrollers do not rubber-band, which in a home-screen app reads as
the page coming loose; and `-webkit-text-size-adjust:100%` so landscape does
not resize text and reflow the planner's fixed sheet.

**The Apple Pencil already works** — `paper.js` reads `e.pressure` for
`pointerType === 'pen'`, ignores touches once a pen has been seen (palm
rejection, unless "Finger writes" is on), and flips `touch-action` on the
canvas so a finger scrolls but the pen draws. Not changed; worth knowing it was
written for this. `getCoalescedEvents()` is not used and would make fast
strokes smoother if it ever matters.

**Tests:** `node app/tests/browser/pwa.browser.js _site` serves the staged site
from `/creator-studio-3/` — a subpath, because that is how a project site is
served and a single rooted `/` path would pass locally and break there — then
installs it, writes a task, reloads, pulls the network, and checks the app
still opens with the task intact and **zero** requests reaching the server.
`npm run site` does the stamp-and-check locally.

## Backup (2026-10-15)

On 13 Oct 2026 v2 was uninstalled from the phone and the database went with it.
What came back came back from a laptop LevelDB that happened to hold a stale
plan pack. `js/backup.js` exists so that cannot repeat.

**The rule: a backup inside the app is not a backup.** Every sink writes
outside the app's own storage.

| sink | where | when |
|---|---|---|
| file | `Documents/Creator Studio backups/` | daily, automatic |
| server | a PUT to a configured URL (nastime) | same run, if set |
| download | the save dialog | iOS and browsers, on a tap |

`Documents` is shared storage and survives uninstall — that is the whole
point, and `checks.test.js` fails if the code ever writes to `CACHE` instead,
which is inside the app and would have gone with it.

**Records daily, pictures weekly.** `Transfer.exportAll({photos:false})` is
tens of KB, so seven are kept. With pictures it can be hundreds of MB, so that
runs weekly and keeps two. Losing a week of photos is a bad day; losing the
records is the year.

**It runs itself**, on an idle callback after boot, never before first paint —
it reads every store. Nothing is toasted; Settings → **Automatic backup** is
where it reports, with a light: green today, amber a few days, red at a week.
A backup whose state you cannot see is one you are only assuming works.

**Android and Windows share one code path.** The Electron preload already
offered a Capacitor-shaped `Filesystem`; `stat`, `readdir` and `deleteFile`
were added to it (and to `main.js`, confined to the same two directories), so
there is one implementation rather than two to keep in step.

**Things it deliberately does not do:**

- *claim a success it did not have* — the file size is read back after writing,
  and a short write is a failure. A backup you half-trust is worse than none,
  because you stop making the other kind
- *lose the local copy when the server is down* — the sinks are independent;
  a failed PUT is recorded and the file still lands
- *paint an iPad red* — a device that cannot write without a tap, and has no
  server set, is amber and says "needs a tap". An alarm that is always on is
  one you stop reading
- *run twice in a day*, or at all once turned off

**Tests:** `node app/tests/backup.test.js` — 32 checks against a fake device,
including the sweep keeping seven oldest-first, a short write failing, a dead
server not costing the local copy, and a no-filesystem device refusing to
pretend. `checks.test.js` guards the invariants.

**For the other apps:** `backup.js` depends only on `Store`, `Transfer` and the
Capacitor-shaped `Filesystem`. Any of the other apps gains it by shipping the
file, calling `Backup.auto()` at boot, and adding the Settings row.

## Paper: the palm, and a real full screen (2026-10-15)

**The palm was winning because it lands first.** Writing with a stylus means
the heel of the hand touches before the tip does. The old code only ignored
touches *after* a pen had been seen — and worse, the palm took the pointer,
so `if(pid !== null) return` then turned the real pen stroke away. Palm drew,
pen did not. Three changes:

- a pen now takes the pointer from whatever holds it, releasing the palm's
  capture rather than deferring to it
- the last touch-started stroke is remembered, and a pen landing within 500ms
  retracts it — that gap is about hand-settles-then-tip-touches; much longer
  and deliberate finger strokes would vanish under the next pen mark
- `penSeen` is saved in `paper-meta.prefs`, so being a stylus user is
  remembered between launches. Before this the first palm of *every session*
  got through
- before any pen has been seen there is nothing to judge by but the contact
  patch, so a broad one (`e.width`/`e.height` over 38) is treated as a palm

**Full view is now actually full.** It was stopping 92px short on a laptop and
iPad, because `position:fixed` does not escape an ancestor that is a containing
block — the left rail was one. The planner is moved to `<body>` while full and
put back on exit, which is the only version of this that is true on every
screen. If the owning screen is closed while full, the planner leaves with it;
that check runs 320ms after the announcement because `pop()` announces
immediately and removes the screen 280ms later, once it has slid out.

**The toolbar floats** instead of taking the top of the window: pen tools and
colours in a pill along the bottom, where you are and which page pinned top
left, out of the way of a right hand on the sheet. `fit()` keeps 104px clear
for the bar, since a floating element is not in the layout.

One trap worth recording: **the blur sits on `.pp-bar::before`, not on
`.pp-bar`.** An element with a `backdrop-filter` becomes the containing block
for its `position:fixed` children, which pinned the navigation groups inside
the toolbar — they appeared stacked at the bottom of the screen instead of in
the corner. Same family of bug as the rail.

## Publishing an update (2026-10-15)

Two speeds:

- **`update.bat`** — commits everything and pushes. Seconds. This is the one
  for a web-only change: GitHub rebuilds the Pages site and the iPad picks it
  up next time it has signal.
- **`build.bat`** — builds the Windows app and the Android APK, then offers to
  commit and push at the end. Minutes. Use it when the phone or laptop needs
  the change too.

`update.bat` **re-adds the git remote if it has gone missing**, which it does
every time a zip is extracted over the folder — the zip carries its own `.git`
and takes `origin` with it. Without that the first command of every update
would fail with "not a git repository" or a push to nowhere.

It also refuses to force past a rejected push. A non-fast-forward means GitHub
has something the laptop does not, and forcing is how that gets destroyed.

## Paper: why writing stuck, and typing a task instead (2026-10-15)

**The stick was undo.** `pushUndo` ran `JSON.stringify` over every stroke on
the page at the *start* of each new one — O(everything written so far), on the
main thread, on pen-down. The more you had written the longer each stroke
hitched before it began, which is why the schedule box felt worst: it is the
zone that fills up.

Adding a stroke only appends, so undoing it is a truncate: the marker is now
`{k, side, len}` and undo does `strokes.length = min(length, len)`. The `min`
matters — a stale marker must never be able to grow the array back. The eraser
still takes a full snapshot (`pushUndoFull`), because it removes strokes from
anywhere and there is nothing cheaper to record, but that is one action rather
than every stroke.

**Typing a task, instead of writing one and hoping.** `+ Task` in the toolbar
opens a title, a time and a duration, defaults to the date the page is showing
(not today — you plan Thursday on Wednesday evening), and lists what is already
on that day so the gaps are visible. It goes through the same `H.addTasks` the
handwriting route uses, so a typed task lands exactly like a read one: printed
in the to-do zone with a tick box, and as a block on the schedule. That tick
box *is* the "did this become a task" indicator — ink has none.

The handwriting route is untouched and still there. This is the same
destination by a road that cannot misread you, and it works on the hour boxes,
which are too small to write in comfortably whatever the recognition does.

**Day view** sits beside it and opens that date's day sheet through a new
`H.openDay` hook — a hook rather than a direct `Screens.push`, because
`paper.js` is shared with the laptop Planner and must not know about this app's
screens. Back returns to the page, still drawn.

**A note on the tests:** `paper-full.test.js` pulled the journal writer out of
`paper-screen.js` with a regex that terminated on `ai:`. Adding `openDay:`
between them broke it. It now terminates on the next key at that indent,
whatever it is called — a test should not care what sits next to the thing it
is testing.

## Sync through nastime (2026-10-20)

**Server:** Sync Hub, a single `server.js` (Node 22, built-in SQLite, no npm)
running in CasaOS on nastime at `http://192.168.4.23:8787`, data in
`/DATA/AppData/Projects/sync-hub/data` with 14 daily DB backups. Bearer-token
auth (`SYNC_TOKEN`). Endpoints: `GET/POST /sync/<app>`, `GET /stats`, `/health`.
Pulls page by a server sequence number, so device clock drift never skips a
change. Newest `updatedAt` wins; on a tie an edit beats a delete.

**App (`js/sync.js`, loaded straight after `store.js`):** wraps `Store.put/del/
clear` and notes each changed key (store + key + time) in a side database,
`creator-studio-3-sync`. A sync pushes the CURRENT value of each noted key (or a
delete if it's gone), then pulls other devices' changes and writes them with
`Store.raw` so they aren't noted again. Pictures ride inside records using
Transfer's `{__blob,b64}` encoding. Not synced: `settings` keys starting
`backup:` or `sync:`. The board page writes IndexedDB directly, so its
`DB.put/del` call `parent.Sync.touch('board-items', id)`.

Runs on open, on returning to the app, 5 s after a change, every 3 min, and on
Settings → Data → **Sync with your server**. First connect: empty server →
upload; empty device (settings ignored) → take the server's; both have data →
asks "replace this device" (backs up first) or "combine" (server wins clashes).

**Task ids changed.** Every "highest id + 1" is now `U.taskId()` — ms × 1000 +
three random digits, still a plain safe integer and still larger than every old
id. Counting ids collide across devices; these don't. 17 creation sites.

**Plain http is allowed** for the home server: `capacitor.config.json`
(`server.cleartext`, `android.allowMixedContent`) — run `npx cap sync android`
after pulling — and Electron's `allowRunningInsecureContent`. The **iPad cannot**
reach `http://` from the https GitHub Pages site (Safari blocks it, no setting);
it needs the Tailscale HTTPS address.

**Also fixed:** `scripts/build-sw.js` stamped `app/sw.js` in place, destroying
its placeholders, so every deploy after that shipped the same BUILD id and the
iPad's cache-first scripts never refreshed. It now matches BUILD/FILES by shape.

Test: `tests/sync.e2e.js` (see tests/README.md).

## Self-updating phone and Windows apps (2026-10-21)

The web half (app/) is what GitHub Pages serves the iPad. The APK and the
Windows app now fetch new versions of those files from there themselves, so
only **native** changes (android/, electron/, plugins) need build.bat.

- **update.json** — every file with its SHA-256 + a build id, written by
  `scripts/web-manifest.js`, called from build-sw.js (so Pages' `_site/` gets
  it) and copy-web.js (so the copy inside the APK/exe knows what it has).
  `NATIVE_LEVEL` there: bump it when web code starts needing a newer shell;
  devices on an older APK/exe then stay put until rebuilt.
- **Android** — `js/updater.js`. 8 s after start, compares update.json with the
  site's; downloads only changed files (unchanged ones copied from what is
  running), verifies each, writes to app storage `web/<build>/`. Next launch:
  Capacitor's WebView plugin `setServerBasePath` + `persistServerBasePath` —
  same https://localhost origin, so IndexedDB/sync untouched. Pending build not
  confirmed by `Updater.ok()` (app.js, 3 s after first screen) in 3 starts →
  back to the previous one or `setServerAssetPath('public')`, build marked bad.
  `android-setup.js --patch-only` now sets versionCode = minutes since 2024, so
  Capacitor's isNewBinary() sees every new APK and drops downloaded files.
- **Windows** — `WebUpdate` in electron/main.js does the same into
  `%APPDATA%/Creator Studio 3/web/<build>/` and serves it through app://cs3/.
  A new installer always resets to its own copy. Preload exposes `CS3Update`.
- **Settings → Data → App updates** shows the running build; tap checks now.
- Needs GitHub Pages' `Access-Control-Allow-Origin: *` (it sends it).

Also: `js/aspectfix.js` — height from width for every `aspect-ratio` box on
browsers without it (iPadOS < 15). Loaded first; does nothing elsewhere.

Tests: `node app/tests/webupdate-win.e2e.js`, `python3 app/tests/browser/updater.browser.py`.
