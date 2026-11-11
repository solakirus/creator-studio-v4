# Creator Studio 3 — design decisions

Status: **for Kris to review.** Steps 1–7 built (see §12); nastime sync is the one thing left for later. Sections marked ✅ were agreed in chat. Sections marked 🟠 are
Claude's recommendation, decided on his behalf so planning could finish — change any of them.
Nothing has been built yet.

Sources read: `creator-studio.zip` (phone app, DB v33, 50 stores), `CREATOR-STUDIO-3.md`,
`HANDOVER.md`, `creator-studio-migration-kit.zip` (laptop Planner), `storyboard-migration.zip`
(Storyboard `www/index.html`, `MIGRATION.md`, `STORYBOARD.md`, packaging).

---

## 1. What it is ✅

- A **new, separate app** named **Creator Studio 3**. Creator Studio v2, the laptop Planner and
  Storyboard stay installed and untouched as a fallback.
- **One codebase** (`app/` web layer), wrapped twice: **Capacitor → Android APK**, **Electron →
  Windows .exe**. Replaces the phone-app / laptop-Planner split and the three-app live-link plan.
- BlockNotes stays its own app.

## 2. Identity ✅ / 🟠

| | Value |
|---|---|
| Android package / Electron appId ✅ | `com.solakirus.creatorstudio3` |
| IndexedDB name ✅ | `creator-studio-3` (never opens v2's or Storyboard's database) |
| Link scheme ✅ | `cs3://` — `cs3://go/<key>`, `cs3://go/<kind>/<id>`, `cs3://board/<id>` |
| GitHub 🟠 | new private repo `solakirus/creator-studio-3`; old repos stay frozen |
| Project folder 🟠 | `C:\Users\Khale\Projects\creator-studio-3`, **under git from day one** |
| Windows wrapper 🟠 | **Electron** (already used by the Planner and Storyboard; no Rust toolchain) |

## 3. Navigation ✅

Keep v2's bar exactly: **Today · Month · Tools · Content · Profile**, Tools stays at **8 tiles**.
On the laptop the same five tabs become a left sidebar so the canvas gets full width.

Where the merged features land:

| Feature | Home |
|---|---|
| Video board (infinite canvas) | **Episode** screen: Plan · **Board** · Shoot · Edit. **Clip** screen gets the same Board view |
| Free boards + folders | **Content** tab: Episodes · Series · Clips · Swipe · **Boards** |
| Action → shot → angle breakdown | **Shots** tool tile and the Board — same records |
| Week board (drag tasks across days) | **Month** tab gets a **Month · Week** toggle; laptop opens on Week |
| AI *Suggest shots* | button on each action in the Shots list and on each action section on the Board |
| Paper planner | **Today** gets List · Timeline · **Paper**; week/month paper pages from Month |
| Handwriting | **Notes** gets a handwritten note type; paper pages take ink |
| AI clip studio / Ideas | AI section on the **Clip** screen; Ideas at the top of Content → Clips |

## 4. Boards ✅

- **Every episode and every clip gets a board automatically.** The board's status and due date
  *are* the video's — not copies.
- **Free boards** exist for everything else (gig workflows, mood boards, batch planning) and can
  hold board cards pointing at several videos.

## 5. Shots on the board 🟠 (the core of the merge)

**Problem found in the code:** v2 stores shots two different ways, and neither has an id.
- Task shots: `task.shots[i]` with `angles[]` (framing/angle/movement/cam/done).
- Episode shots: `vlog.acts[].beats[].shots[i]` with a single `framing` string and one `done`, no angles.
- Both are addressed by array position (`task:<id>:<i>`), so a canvas card can't point at one safely.

**Decision (revised while building step 3):** shots **stay where they live** — on the task or the
sequence — and every shot and angle gets a permanent `id` (`app/js/shotids.js`). Moving them into a
store of their own would have meant rewriting 123 places in 23 files that read `.shots`; giving them
ids gets the same thing — a board card can point at a shot and find it after any reorder — with no
screen changed. A card keeps a `ref`: `{type:'task', owner, id}` or `{type:'beat', owner, vlog, id}`,
and `Shots.find / update / twin` resolve it.

- A sequence sent to the task list is copied onto the shoot task (that's where Shoot mode ticks
  angles). The copy now carries `src: {beat, shot}`, existing copies are linked at start-up, the Shot
  list shows the pair once, and a location set on one is set on both.
- Fixed on the way: those copies were written with `name` and untyped angles, so the task screen showed
  **"undefined"** for every shot sent from an episode and coverage never counted them; and the Shot
  list showed **"Shot"** for every shot added on a task. One shape now: `text` + angles with `type`.

- **Episodes get angles too.** The beat's old single `framing` becomes its first angle.
- **"Action"** is the beat (sequence) on an episode and the step (`subs`) on a task, so
  "Put up the tent" is the same thing everywhere.
- **On the Board:** each action is a **Section**, and its shots are **shot cards** inside it, in order.
  Acts/day blocks are **Headings** above their sections. Moving a card between sections changes its
  action; reordering inside a section changes its order. The Shots list shows the same records.
- **Shot card face:** number · name · reference still (top) · angle chips (A Wide, B Close…) with
  ticks · must-get flag. Storyboard extras (voiceover, transition, duration) sit on the card and
  feed the Timeline and Script views.
- Coverage, Shoot mode and the Shots console all read this one store, so a tick anywhere shows everywhere.

## 6. Stills picker 🟠

- The pop-out picker from Storyboard is kept as-is: browse folders → step through stills one at a
  time in a frame → pick one for the shot or image card.
- **It browses CS3's References** (the Shots console's References section, `refs` + `ref-img`),
  grouped by folder and tag. Shot Grabber / Loupe stay merged into the separate **Reference Library**
  app, which sends favourites in by **plan pack** (already supported: `refUids` land on shots).
- Also allowed: pick from phone gallery / laptop files directly.

## 7. Canvas features 🟠

Keep **everything** on Storyboard's checklist: pan/zoom/Fit, touch press-and-hold, all 20 card
types, guides and snap, lines, layers, Tabs card, fonts/sizes, 100-step undo, Boards panel,
export/import, templates.

- **Views:** Canvas · Timeline · Script toggle on each board. **Pipeline** becomes a view in
  Content (every episode and clip by status).
- **Status mapping:** Storyboard `idea / scripted / ready / shot / edited / published` →
  clip lifecycle `idea / planned / planned / shot / editing / published`.
- **Templates:** all built-ins and saved templates kept. Fix the Weekly episode numbering bug —
  code still counts from **27 Sep 2026**; Day 1 should be **1 Oct 2026** (`DAY1` in index.html).
- **Media:** Storyboard keeps images inline as data URLs inside cards. CS3 moves them into a
  `board-media` blob store (like v2's other image stores) so records stay small — which matters for
  later sync.
- **Styling:** Storyboard's CSS uses generic class names (`.card`, `.menu`, `.tool`, `.top`) that
  collide with v2's. All of it gets scoped under `.bd-`. Colours come from v2's palette variables, so
  all 6 palettes × light/dark apply to the board; card colours (tape, mint, sky…) are kept.

## 8. Phone ↔ laptop ✅

- **Now:** Settings → **Export everything / Import**. One JSON file, all stores, images included.
- **Later:** sync through **nastime over Tailscale** (Docker on CasaOS). To make that a drop-in,
  every record gets a permanent `id` and an `updatedAt` from day one, so merging can be
  record-by-record with newest-edit-wins.

## 9. Getting existing data in 🟠

Copy, never move. Old apps keep their data.

| From | How |
|---|---|
| Storyboard | ⋯ → Export everything → CS3 Import. Boards matched to a video by name join it; the rest become free boards. Shot cards become shot records. |
| Laptop Planner | Its existing **Send to phone** plan pack → CS3 Import plan pack. |
| Creator Studio v2 | ⚠️ **Decision for Kris.** v2's JSON backup covers only **19 of 50 stores** (drops episodes, quarters, months, sources, runs, routines, challenges and every image). Options: **(a, recommended)** ship v2 one export-only fix to `transfer.js` so its backup covers all 50 stores — no data or screen changes; **(b)** start CS3 fresh and use only the 13 CSV datasets + partial backup. A new app can't read v2's database directly. |

## 10. Desktop paths for the native bits ✅ (built in step 1)

Changed from the first draft: instead of a `platform.js` shim that eleven files would have to be
edited to use, the Windows app gets a **Capacitor-shaped bridge** (`electron/preload.js` +
`electron/main.js`). The web code already looks for `Capacitor.Plugins.<Name>` and skips anything
missing, so not one of those eleven files had to change.

| Plugin | Android | Windows |
|---|---|---|
| `App` (deep links, back) | Capacitor | `cs3://` registered with Windows; cold and warm links both route |
| `CapacitorHttp` (`linkmeta.js`, `thumb.js`) | Capacitor | request made by the Electron main process, no CORS |
| `Filesystem` + `Share` (`saver.js`) | write + share sheet | write + **Save As** dialog; "Documents" = `Documents\Creator Studio 3` |
| `LocalNotifications` (`reminders.js`, `notify.js`) | Android alarms | Windows notifications **while CS3 is open**; a reminder due while it's closed is skipped |
| `CSWidget`, `LiveStatus`, `SendIntent`, GPS | native | not offered — the app already treats them as "not on this device" |
| `storyboard.js` | link to old Storyboard app | removed in step 4, when boards are built in |

## 11. Build and safety 🟠

- Repo holds **everything**: `app/`, `electron/`, Capacitor config, `native/`, build scripts,
  `tests/`, these docs. (The lost-working-dir incident that took 50 harnesses won't repeat.)
- Keep `build-preview.sh` → single-file preview for testing in a browser without a rebuild.
- One `build.bat`: copy `app\` → `www\`, `npx cap sync android`, build APK, build .exe.
- Every change checked against the brief's seven recurring mistakes (stub-DOM harness, grep for
  `global.` without `(function(global)`, every `Screens.push` has a `register`, every tool slug in
  `TOOL_ROUTES`, no `[data-mode]` handlers, no stacked `.view`).

## 12. Build order 🟠

Each step ends with something to install and test on device.

1. **Shell.** ✅ Built. v2 copied into the new repo, identity renamed (§2), Electron + bridge (§10),
   Android project copied from v2 by script. CS3 runs identical to v2, with its own empty database.
2. **Export/Import fixed** ✅ Built. Every store, read from the database itself; pictures and voice
   notes included (or left out on request); v2 backups still restore. The same `app/js/transfer.js`
   dropped into v2 would give v2 the full backup too (§9 option a) — one file, no other change.
3. **Shot ids** (§5) ✅ Built. Permanent ids, one shape, sequence ↔ shoot-task copies linked.
4. **Board.** ✅ Built. Storyboard's canvas, whole, as `app/board/board.html`, in a frame on the Board
   screen — so its generic class names can't collide with the app's, and nothing of it had to be
   rewritten. `scripts/port-board.py` records every change made to the original. Boards are stored
   in the app's database (`board-items`, DB v34), so Export everything carries them. Episode:
   Plan · **Board** · Shoot · Edit, and the old "Link a board" block now opens the built-in board.
   Clip: **Board** button. Content: **Boards** (all boards, list open). Each video's board has a fixed
   id (`vb-vlog-<id>`, `vb-clip-<id>`) in a **Videos** folder; its name and status come from the video.
   Colours and light/dark follow the app's palette. Links: `cs3://board/<id>`.
5. **Shots ↔ Board** ✅ Built (`app/js/boardsync.js`, `app/js/stillspicker.js`). On an episode's board
   each sequence is a section and each shot a card in it, made on opening; nothing you placed is moved.
   Card description / shot type ↔ shot text / framing (and the shoot task's copy); drag between
   sections moves the shot; left-to-right order is the sequence order and the numbering; a card typed
   into a section becomes a shot; renaming a section renames the sequence; deleting a card deletes
   the shot **unless any of it is filmed** (Undo restores it with its id). Cards show progress from
   Shoot mode (Not shot · 1/2 angles · In the can). Image boxes open the **stills picker**: Reference
   Library folders and framings, one still at a time, swipe or arrows, filmstrip, "From files…"; the
   chosen still also becomes the shot's reference. Deleting a section only removes it from the board.
   **Clip boards** follow the same idea for a clip's flow (its plan lines): one *Flow* section, a card per
   line; edits, left-to-right order, new cards and deletes (with Undo) go back to the clip.
   Fixed on the way: Storyboard's shot-card header ran ~180px past the card's edge.
6. **Importers** ✅ Built.
   - **Creator Studio v2** → Settings → *Restore from backup* (v2's own Export everything file).
   - **Storyboard** → Content → Boards → *Import a board or backup* (Storyboard's Export everything
     file). Storyboard's own importer already re-ids everything; on top of it, a board an episode was
     linked to in v2 (`boardId`), or one named exactly like an episode or clip, is folded into that
     video's board with its status and due date. Everything else arrives as one "(imported)" board.
   - **Laptop Planner** → Settings → *Open a plan pack* (its *Send to phone* file). `planpack.js` from
     the Planner kit, unchanged except that shot names land in `text`. Safe to open twice; never
     touches a tick.
7. **Planner features** (§3):
   - ✅ **Suggest shots** (`js/shotai.js`) — sequence screen and episode sections on the board; your
     own key (Settings → Planning help, stored as `secret:ai`, never in a backup) or copy/paste a chat.
   - ✅ **Week board** (`js/screens/week-board.js`) — Month tab → Week; drag to move, tap to open;
     the laptop opens on it.
   - ✅ **Paper** (`js/paper.js` from the Planner kit + `js/screens/paper-screen.js`) — the pen button on
     Today. Today's tasks printed, ticks are the real ticks, ink saved per page, handwriting read by
     Claude (key or paste).
   - ✅ **Handwritten notes** — pen button in Notes (`js/inkpad.js` from the Planner kit +
     `js/screens/ink-note.js`). Ink saved with the note, a picture of it in the list, *Read it* puts the
     words in the note's text.
   - ✅ **Clip ideas** (`js/clipideas.js`, `js/screens/clip-ideas.js`) — *✦ Ideas* at the top of
     Content → Clips: pitch angles (channel, series, your topic) or *Suggest for me*, built from the
     channel's about/audience/voice, what's already on it and the next three weeks of your days; keep
     ideas in a backlog; *Draft the clip* makes a clip with its whole plan (hook, flow, CTA, script…).
     On a clip, **✦** drafts only the empty parts of its plan. Your key or a pasted chat answer.
8. Later: nastime sync.

## Open items for Kris

1. §9 — OK to ship v2 a single export-only fix so all your data can come across?
2. Anything in the 🟠 sections you'd change.
3. When building starts: the Storyboard **Export everything** file and a v2 backup.
