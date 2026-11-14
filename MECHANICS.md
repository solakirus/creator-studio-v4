# Mechanics sheet — Library and Templates in Creator Studio 3

Creator Studio 3 is the person's own Electron + Capacitor app in plain JavaScript (no build
step), so it was kept exactly as it was and extended in its own code. Shotline 0.23 (the
source the person pointed at, `shotline-0-23-source`) is a Rust/egui program; there is no
machine code to decompile in either, so every rule below was read straight from Shotline's
source and is cited as *file · function (line)*. The same values are in `mechanics.json`.

## Where it lives
| What | Value | Source |
|---|---|---|
| Library and Templates | two new sections in the Content tab's nav (after Boards) | person's request; Tools must keep 8 tiles (`app/tests/checks.test.js` §7) |
| Database | `creator-studio-3` version 34 → 35, six new stores (`lib-items`, `lib-blob`, `lib-poster`, `lib-boards`, `shot-templates`, `nb-music`) | `app/js/store.js` |
| Backup | new stores are included automatically (store list read from the database) | `app/js/transfer.js` |

## Library (Shotline library.rs, ui_lib.rs, ui_deck.rs)
| Rule | Value | Source |
|---|---|---|
| Kinds | GIF (`.gif`), Clip (`mp4 webm mov m4v ogv`), Still (`jpg jpeg png webp avif bmp jfif`) | library.rs `kind_of` (31) |
| Animated WebP counts as a GIF | VP8X flag `0x02` at byte 20, or an `ANIM` chunk | library.rs `is_animated_webp` (540) |
| Folders skipped when reading | `_Shotlists _Boards _logs _Deleted _Shotline`, dot-folders, deeper than 6 | library.rs `SKIP`, `walk` (141–170) |
| Page from a file's folder | parent folder, minus a trailing `gifs/videos/images/stills/clips` | library.rs `add_source` (251–256) |
| Collections | grouped by name, A→Z; pages newest grab first | library.rs `reindex` (308–341) |
| Find a frame after a library moved | by id, else by its path inside the library | library.rs `find` (344) |
| Default folder | `~/Shot Library` | model.rs `default_root` (667) |
| Delete | in-app frames are removed; frames in folders move into `Shot Library/_Deleted`, keeping their folders | library.rs `trash` (441) |
| Board groups | Activity, Location, Mood, Subject, Other | library.rs `BOARD_GROUPS` (370) |
| Board name | trimmed; group ≤ 30 characters, empty = Other | ui_lib.rs dialogs (581) |
| Board → folder | `Shot Library/_Boards/<group>/<board>`, names made safe (≤ 120 chars, no `\/:*?"<>|`) | ui_lib.rs (101), library.rs `safe_name` (407) |
| Search | every word typed must be found in name, label, caption, kind, page, library | Shotline views-clips.js search (63–66), per Shotline MECHANICS |
| Item title | label, else caption, else file name | library.rs `Item::title` (60) |
| Clips | play muted and looping while pointed at | views-clips.js `hoverPlay` (29–39) |
| GIFs | move unless "Play GIFs" is off (then their first frame) | Shotline rebuild's choice, ui_deck.rs |
| Biggest moving GIF | 30 MB | clips.js `MAX_GIF` (13) |
| Grabber | `grabber/grab.mjs` under: the setting, `~/Documents/Craft Anything/eyecannndy-com/app`, `grabber-kit`; set up = `node_modules/playwright` exists | grab.rs `find_grabber`, `is_set_up` (75–99) |
| Grab arguments | `--out --follow --max --yt-every --yt-max --yt-sens --yt-mode --yt-what --gif-secs --gif-mode --gif-max [--no-video]`, ranges 1–500 pages, 0–600 s, 1–10000 stills, 0–15 s GIFs, 1–5000 GIFs | grab.rs `start_grab` (213–242) |
| Find links | `--scan --scan-max` (1–2000), `@@LINK {json}` lines | grab.rs `start_scan`, `spawn_job` (131) |

## Templates (Shotline model.rs, ui_videos.rs, ui_plan.rs, app.rs)
| Rule | Value | Source |
|---|---|---|
| Kinds | Notebook pages, Weekly video, Short, Vlog day, Task list | model.rs `TEMPLATE_KINDS` (410) |
| Formats | Weekly video · 16:9, Short · 9:16 | model.rs `Format::label` (167) |
| Roles | Action, Insert, B-roll, Talking, Reaction, Transition | model.rs `ROLES` (93) |
| Shot types | —, Wide, Medium, Close-up, Extreme close-up, Overhead, Low angle, High angle, POV, Over the shoulder, Insert | model.rs `SIZES` (95) |
| Moves | —, Static, Handheld, Pan, Tilt, Push in, Pull out, Tracking, Orbit, Slow motion, Speed ramp | model.rs `MOVES` (97) |
| Transitions | Cut, Match cut, Jump cut, Whip pan, Speed ramp, Dissolve, J-cut, L-cut, End | model.rs `TRANSITIONS` (99) |
| Lengths offered | 0.5 1 1.5 2 2.5 3 4 5 6 8 10 12 15 20 30 s | model.rs `DURATIONS` (101) |
| Shot length when not set | 4 s (weekly video), 2 s (short) | model.rs `VLOG_SHOT_SECONDS`, `SHORT_SHOT_SECONDS` (108) |
| New empty shot | Wide, Static, Action, Cut, the format's length | ui_plan.rs (296) |
| Frame → shot | GIF = Transition, else Action; still 3 s, clip/GIF 2 s, then the offered length nearest the clip's own | app.rs `shot_from_item` (349), `add_items` (451–457), model.rs `nearest_duration` (115) |
| GIF length | frame times added up; 2.5 s when it can't be read | clips.js `gifInfo`, thumbs.rs `GIF_GUESS_SECONDS` |
| Coverage line | "2 action · 1 talking" in ROLES order; unset counts as Action | sheet.rs `role_line` (218) |
| Missing roles | of Action, Insert, B-roll, Reaction | sheet.rs `TASK_NEEDS`, `missing_roles` (212–215) |
| Time format | under 60 s "4.5 s", else "m:ss" | theme.rs `fmt_time` |
| Look | palette (default 5 colours, up to 8), mood, colour grade, music, transitions, titles, reference link, reference frames | model.rs `Look` (278–301), ui_plan.rs `look_editor` (421) |
| Samples | Weekly vlog (8 shots, 8 tasks, look), Short: 3-shot hook, Gym day, Self-care / slow day, Post day | model.rs `Store::sample` (863–951) |
| Notebook templates | the carousel (8 pages, 8 tasks, notebook look), one per page, Task sequence · steps | sheet.rs `notebook_templates` (439), `steps_template` (226) |
| Library ＋ target | a template's shots, one notebook page (fills empty spots in order), or the look's reference frames | app.rs `add_items` (414–466) |
| New video from a template | Creator Studio video: title, shots as its shot list, look and tasks in its notes | ui_videos.rs `project_from_template` (13); CS3 `videos.js` |
| Put on a day | each task becomes a task on that date; shots become the steps of one "Shoot — <name>" task | ui_week.rs `apply_template_to_day` (336); CS3 `videos.js schedule` |
| Duplicate | "<name> copy", shots get new ids | ui_videos.rs (175–182) |

## Notebook pages (Shotline sheet.rs, ui_pages.rs)
| Value | Number | Source |
|---|---|---|
| Page | 720 × 900 (4:5) | sheet.rs `PAGE_W`, `PAGE_H` (10) |
| Video | 24 fps, length per page (1–30 s) | sheet.rs `PAGE_FPS` (13), page_form (974) |
| Picture | 1080 × 1350 PNG | Shotline MECHANICS "Saving" |
| Graph paper | 29 squares across | sheet.rs `GRID_SQUARES` (15) |
| Layouts and spots | frames 9, compare 2, character 4, soundtrack 3, cover 1, steps 6 (1–14) | sheet.rs `LAYOUTS` (20), `MAX_STEPS` (30) |
| Carousel lengths | 5.00, 8.17, 5.00, 6.00, 7.13, 5.08, 4.83, 7.08 s | sheet.rs page builders (242–422) |
| Frames palette | #07121B #0C2836 #094158 #4F717E #91A8A6 + #7A3A30 #1E5A3C | sheet.rs `FRAMES_PALETTE` (130) |
| Palette chips | x/width 114/62, 183.5/62, 253/62, 322.5/62, 392/62, 465/35, 507/35 at y 603–657 | ui_pages.rs `SWATCHES` (158) |
| Field of view | 2·atan(36 / 2f), rounded: 16 mm 97°, 35 mm 54°, 70 mm 29°, 200 mm 10° | sheet.rs `fov_degrees` (511) |
| Focal list | numbers 4–1200, at most 6 | sheet.rs `focal_list` (516) |
| Fan radii (4 lenses) | 45, 105, 195, 305 | ui_pages.rs `deco_frames` (623) |
| Red dot | radius 18 (cover 14) | ui_pages.rs `dot` calls |
| Picture spots | every rectangle, step cells (3 to a row, rows ≥ 2, caption 44, portrait ≤ 4:5) | ui_pages.rs `slot_rects` (376), `step_cells` (171) |
| Text spots | every key and box | ui_pages.rs `text_spots` (63) |
| Ungraded look | grey copy at alpha 150, then rgba(132,136,140,120) | ui_pages.rs `page_picture` (458–465) |
| Colours | paper (233,233,230), pen (26,26,28), red (196,40,52), dot (226,58,66), label (52,52,56), rule (78,78,82) | ui_pages.rs (10–15) |
| Task steps | 9: B-roll, Action, Action, Insert, Insert, B-roll, Talking, Reaction, Transition | sheet.rs `TASK_STEPS` (199) |
| A task's shots | usually 8 to 14 | sheet.rs `TASK_SHOTS_MIN`, `MAX_STEPS` |
| Palette from frames | spots shrunk to 48 px; k-means 5 groups, 12 rounds, from brightness quantiles, dark → light; family: green if g > r+4 and g > b+4, blue if b > r, else warm; accents: s > 0.3, v > 0.15, ≥ 60° from the family's hue (210°/25°/120°), k-means 2 (10 rounds) if ≥ n/200 + 4 pixels, else the two most colourful tones | sheet.rs `palette_of` (591–641) |
| Fill empty spots | random frames from everything, a board or a library, no repeats until the pool runs out (20 tries) | ui_pages.rs `fill_empty` (998) |
| Waveform | 150 bars (steps strip 120) of RMS loudness scaled to the loudest; drawn bars when no music | ui_pages.rs `deco_soundtrack` (1133), `steps_music` (1223) |
| Music name | at most 80 characters | ui_pages.rs `MUSIC_NAME_MAX` (192) |

## Estimated (looked for, not in Shotline's code)
- Fonts: Shotline's egui families "marker", "hand", "mono", "bold" are drawn with the board's own
  offline fonts: Permanent Marker, Caveat 700, Courier Prime, Inter 700 (estimated stand-ins).
- Saved video: MP4 (H.264) when the device can record it, else WebM; Shotline used ffmpeg.
- In-app frames are grouped as library "My library" (or the name typed) and a page per batch
  ("Added Nov 11 12:30"), standing in for a grabbed page.
- A shot's task-sequence page opens as its own screen (Shotline opens it as its own page too).

## A task's shot page (asked for by the person, 2026-11-11 — new, not in either app)
The task screen no longer shows the Shot list or Required coverage sections (their data is kept
on the task, only hidden). In Steps, a dropdown links any notebook page from Templates; the
nine-shot "Task shot sequence" pages are listed first.

| Rule | Value | Source |
|---|---|---|
| Linked page | the task keeps its own copy; ticks never change the template | person's request |
| Step ↔ shot | each step may stand for one picture spot (`step.shot`, 0-based) | person's request |
| Linking with no steps | one step per shot, named after the shot's words | estimated |
| Linking with steps | steps without a shot get the free shots in order | estimated |
| Shot done | every step standing for it is ticked | estimated |
| Next shot | first shot in page order with an open step; ringed orange on the page, NEXT on the step | estimated |
| Done shots | hidden from the list by default ("n done shots hidden · Show"), washed out with a green tick on the page | estimated |
| Tapping a spot on the page | ticks/unticks its steps, or adds a done step for it | estimated |
| Ticking a box in the page editor | ticks the steps for that shot | estimated |

### Round 3 (2026-11-11, the person's request with two pictures)
| Rule | Value | Source |
|---|---|---|
| Steps section layout (laptop) | steps on the left, the shot page on the right (right column 240–340 px, about a third, stays in view while scrolling) | person's request |
| Steps section layout (under 900 px: phone or narrow window) | steps first, the page under them | original styles.css `@media (min-width: 900px)` (laptop rail 92 px) — the app's own laptop/phone switch |
| Shot page card, always shown | "Shot page", the page name, a done/total count, a thin bar, the page, Next up, Open the page | person's request ("condensed") |
| Shot page card, in the More menu | where it came from, Hide done shots, Add the unused shots as steps, Add another page, Change page, Remove page | person's request ("drop down menu") |
| Pages per task | one shot page (its ticks are the steps) plus any number of extra pages (`t.morePages`) | decided for the person: they wrote "page or pages" |
| Full-page view | every page of the task in the notebook editor, shot page first and marked; it can't be deleted there | estimated |
| Today task card | "page" / "n pages" link with the shot count, and "Open the full page(s)" under the steps dropdown; both open the full-page view | person's request ("in the task menu") |

### Where these values were looked up (Deep mode, round 3)
The original is an Electron app. Its executable (`dist/win-unpacked/Creator Studio 3.exe`,
sha256 7a24496c…) is the Chromium/Electron runtime: `native_strings_find` for the app's own words
("Add a step and press Enter") finds nothing in it (evidence ev_8cfacbec…), and the matches for
"steps/subs" are all Chromium internals (ev_22ea6a82…). The app's code is the 153 JavaScript
files in `resources/app.asar`, read with js_app_map (ev_78aec920…) and js_function_explain.
Shotline's folder has its Rust source but no built program to decompile, so its constants are
cited from the source by file and line.

| Value | Found | Where |
|---|---|---|
| Today card steps: n, d, pct = round(d / n × 100); no steps → no chip | read | original `www/js/views/today.js` subStats (line 24), ev_8722513a… |
| Task Steps section: "d of n" / "none yet", Tick all, Clear all, add with Enter | read; kept as is | original `www/js/screens/task.js` stepsBlock (line 192), ev_12414aaf… |
| Laptop layout from 900 px wide, rail 92 px | read | original `app/styles.css` (line 3963) |
| Page size 720 × 900 (4:5) — the shot page canvas | read | Shotline `src/sheet.rs:10-11` PAGE_W, PAGE_H |
| Steps on a page: at most 14, a task wants at least 8 | read | Shotline `src/sheet.rs:30-31` MAX_STEPS, TASK_SHOTS_MIN |
| Task shot sequence: 9 shots | read | Shotline `src/sheet.rs:199` TASK_STEPS |
| Picture spots on a steps page / other layouts | read | Shotline `src/ui_pages.rs:171` step_cells, `:376` slot_rects |
| Shot-page column width 240–340 px, next-shot colour #F59E0B, "More" menu | not in either app (new) | estimated |
## Round 4 (2026-11-11): default shot page, and a grabber that works on this laptop

### Every new task starts with the task sequence (`app/js/taskpages.js`)
| Rule | Value | Source |
|---|---|---|
| Default page | the Templates steps page named "Sequence · Task" (Shotline `src/sheet.rs:199` TASK_STEPS, 9 shots); else the first steps page | person's request |
| When | on creating a task (Today add form, Month/Week/Day form, QuickAdd) and on opening any task that has none | person's request |
| New task with no steps | the 9 shots become its steps | same rule as linking a page by hand (round 2) |
| New task with steps | steps keep their names; each takes the next free shot | same rule as round 2 |
| Removed page | `t.pageOff = true`; the default does not come back; picking a page again clears it | estimated |

### The built-in grabber (`electron/grab-builtin.js`)
Neither Shotline nor CS3 ships the grabber itself: both run an outside kit, `grabber/grab.mjs`
plus Playwright (Shotline `src/grab.rs:70` is_root, `:97` is_set_up). No grab.mjs is anywhere
on this laptop (searched Documents, Desktop, Projects, Downloads; eyecannndy-com/app has no
grabber folder), which is why the card said "The grabber files weren't found". The app now
grabs on its own with yt-dlp and ffmpeg (both already installed here by winget). An outside
kit is still used when one is set up.

| Rule | Value | Source |
|---|---|---|
| Tools | yt-dlp + ffmpeg, found on PATH, in WinGet\Links, or WinGet\Packages | this laptop |
| Missing tools | "Install yt-dlp and ffmpeg" runs `winget install -e --id yt-dlp.yt-dlp` / `yt-dlp.FFmpeg` | estimated |
| Video links | youtube, youtu.be, instagram, tiktok, vimeo, x/twitter, facebook, dailymotion, twitch, reddit, pinterest, streamable, bilibili, or a direct .mp4/.webm/.mov | estimated |
| Download | best ≤720p mp4 (`bv*[height<=720][ext=mp4]+ba[ext=m4a]/…`) | estimated |
| Cut detection | ffmpeg scene score > 0.2 / 0.3 / 0.45 for high / normal / low sensitivity, on a 320-px copy | estimated |
| Shortest shot | 0.6 s (shorter cuts are merged) | estimated |
| "Stills every N s" | a cut every N seconds instead of scene detection | Shotline UI option ytEvery |
| Still | one JPEG per shot, 1 s into the shot (or its middle if shorter), up to 1280 px wide | estimated |
| GIF | from the shot start, `gifSecs` long (default 3 s), cut at the next shot unless "run across cuts"; 12 fps, up to 480 px, 128 colours | estimated |
| Caps | stills up to `ytMax` (200), GIFs up to `gifMax` (200) | Shotline UI defaults |
| Pages | img/srcset (widest), video/source, og:image/og:video, links to media files; up to 300 files, each up to 200 MB | estimated |
| Find links | yt-dlp `--flat-playlist` for channels/profiles; otherwise the page's same-site links and media | estimated |
| Signed-in sites | optional `--cookies-from-browser` firefox / chrome / edge | estimated |
| Layout on disk | `<Shot Library>/<library>/<site>/<page>/{gifs,images,videos}` + manifest.json (site, page, title, source, grabbedAt, items[file,label,link,order]) | Shotline library.rs layout, read by electron/library.js scanRoot |
| Tested | a 4-cut test video gave 4 stills + 4 GIFs; a test page gave its picture, GIF and clip | local test, round 4 |
### Round 5 (2026-11-11): steps and page half and half
| Rule | Value | Source |
|---|---|---|
| Steps / shot page split (900 px and wider) | 50 / 50 (two equal columns, 18 px gap) | person's request with picture 6 |
| Page in its half | centred, as wide as min(600 px, (window height − 250 px) × 0.8) so the whole 4:5 page fits the window, never under 240 px | estimated |
## Round 6 (2026-11-11): grabbing JS / Cloudflare pages with their bigger GIFs, and phone ⇄ laptop

### Grabbing pages in a browser (`electron/grab-browser.js`)
Looked at https://eyecannndy.com/technique/crash-transition (evidence ev_7cf18f65…, ev_e44e06b4…,
checks/eyecandy-page, checks/eyecandy-scripts): a plain download gets Cloudflare's 403 "Just a
moment…" page; the page is server HTML with htmx; each thumbnail is an animated WebP
(`media/clip/…/<n>.webp`, 0.6–2 MB) on an `<img hx-get="/clip_info_g/<id>/?…">`; the popup that
returns has a Download link `/downloads/<base64 of …/clip/…_1080p_<x>.gif>/<name>/` (the bigger
GIF, 3–9 MB), the title in `<h1>`, "Technique / Director / Original Source" list items and
`/search/?q=` tags (custom.js line 162 loads the same kind of popup). The page also loads
6-KB `media/CACHE/…gif` placeholders.

| Rule | Value | Source |
|---|---|---|
| Page reader | the app's own browser window, saved profile `persist:cs3-grab` (a passed check is remembered), user agent without the app's name | eyecannndy test: passes the check by itself |
| Check not passed in 20 s | the window shows itself so the person can tick "Verify you are human"; waits up to 3 min | estimated |
| Scrolling | to the bottom until the height stops growing twice, up to 40 times, 1.3 s apart | estimated |
| Thumbnails kept | img (data-src, srcset widest, currentSrc), video/source, background images, links to media; at least 120 px on a side; spinners/logos/icons dropped | estimated |
| Popup or detail page | the element's (or 3 parents') hx-get / data-url / data-href / data-full / data-gif / link; fetched with the page's cookies and `HX-Request: true`, else opened as a page; up to 400 per page | eyecannndy htmx markup |
| Bigger GIF | a download link whose path segment is base64 of a media URL; else the highest-ranked GIF > clip > picture named in the popup | eyecannndy popup |
| Default ("link") | the moving thumbnail is saved (animated WebP goes with the GIFs), named after the clip's title, linked to its bigger GIF; "download" saves the bigger GIF itself; "off" skips popups | person's request |
| Saved with each item | label = title, link + big = bigger GIF, caption = credits, source = original video, tags | eyecannndy popup |
| Extra media the page loaded | kept unless under 20 KB (blur-up placeholders) | eyecannndy CACHE gifs are ~6 KB |
| Tested | crash-transition: 6 of 6 GIFs, each with its 1080p GIF link, director, Vimeo/YouTube source and tags | local run in the app's Electron |

### Phone ⇄ laptop (Library → Add & grab → "Phone ⇄ laptop")
| Rule | Value | Source |
|---|---|---|
| File | the app's backup format (Transfer.exportAll) limited to lib-items, lib-blob, lib-poster, lib-boards, shot-templates, tasks | transfer.js |
| Import | merge: adds and updates by id, never clears; a store the file lacks is untouched | transfer.js importAll |
| Grabbed files | first "Copy grabbed files into the app" (MediaLib.bringIn): disk frames become app frames with title, links, source, tags; boards point at the copies; a frame copied before isn't copied again | person's request |
| Android app | rebuilt from this code (npm run android:sync + gradlew assembleDebug) → dist/Creator Studio 3.apk | build.bat steps |
| Tested | phonesync.browser.js: 11/11 (frame + file + links + board + task pages + templates arrive; second import adds nothing) | round 6 |
## Transitions (2026-11-14): Eyecandy by link, placed between shots
| Rule | Value | Source |
|---|---|---|
| Where | Content → Transitions, next to Swipe; Boards left Content's nav (screen and data kept; the clip page's Board button stays) | person's request |
| Starter techniques | transition, crash-transition, match-cut, match-motion, match-split, whip-pan, jump-cut, flash-cut, light-flash, morphing, object-portal, pass-through, set-transition, masking, speed-ramping, freeze-frame, glitch, datamosh; any of Eyecandy's 136 can be added (settings `transition-techs`) | Eyecandy technique list (checks/eyecandy-page) |
| Reading | laptop only: the grabber's scan (`CS3Lib.grabRun({mode:'scan'})`, the Library's Find links) on eyecannndy.com/technique/<slug>; keeps links on asset.eyecannndy.com/media/clip/ only; nothing downloaded | grab-browser.js pageLinks |
| Record | store `transitions` { id:'ec_'+file name, img, title, tech[], page, kept? } — synced | estimated |
| On a shot | `tr:{id,n}` = the transition out of that shot into the next (shotlist.js extras), carried to subs, beats, clips, videos, shoot tasks | person's request |
| Shot page | hidden; "⇄ N transitions · Show" toggles faint markers (localStorage cs4-show-tr, every page) | person's request |
| Edit cut list | a row between the cuts (Watch, Change, ×); empty gaps have "+ transition" | mockup approved 2026-11-14 |
| Tested | v4-transitions.browser.js 42/42 | round 7 |
