# Creator Studio 3

Creator Studio with the storyboard canvas built in, as **one app** for your phone (APK) and laptop
(.exe). It's a **separate app**: Creator Studio v2, the Planner and Storyboard stay installed and
untouched.

**Where it's at:** steps 1–6 of the build order are built, and most of step 7 (`docs/CS3-DESIGN.md` §12):
own identity on Android and Windows, a backup that covers everything, permanent shot ids, the
canvas built in (episode and clip boards, Content → Boards), episode shots ↔ board cards with the
stills picker, importers for v2 / Storyboard / Planner, Suggest shots, the week board and Paper.
Also: the laptop sidebar, board fonts that work offline, and clip boards that follow the clip's flow.
Handwritten notes are in Notes (the pen button), and Clips has ✦ Ideas (pitch, keep, draft a clip).
Left for later: syncing phone and laptop through nastime.

---

## First time on the laptop

1. Unzip this folder to `C:\Users\Khale\Projects\creator-studio-3`.
2. Double-click **`build.bat`**. On the first run it:
   - copies v2's `android\` folder into this one and gives the copy CS3's identity. v2 is only read.
     If v2 isn't at `C:\Users\Khale\Projects\creator-studio-v2`, change the `V2=` line at the top
     of `build.bat`.
   - installs packages (a few minutes).
   - asks **Build the Windows app?** and **Build the Android APK?**
3. Results land in `dist\`:
   - `Creator Studio 3 Setup 3.0.0.exe` (installer) and `CreatorStudio3-portable-3.0.0.exe`
   - `Creator Studio 3.apk`

After that, `build.bat` is the whole loop. It also saves each build as a git commit.

## Check on the phone

- [ ] It installs **beside** Creator Studio v2. You should see two icons, and v2 still has all its data.
- [ ] CS3 opens empty, with the same tabs and tools as v2.
- [ ] Long-press the CS3 icon: Run / Capture / Shoot / Workout open **CS3**, not v2.
- [ ] Add a CS3 widget: tapping it opens **CS3**.
- [ ] Settings → restore a v2 backup file. It should bring in what v2's backup holds. That's only
      19 of 50 stores until v2's export is fixed (design doc §9).

## Check on the laptop

- [ ] The installer adds a **Creator Studio 3** shortcut, and it opens on Today.
- [ ] Settings → export a backup: a **Save As** box appears.
- [ ] Swipe file → paste an Instagram or TikTok link: the title and cover come in.
- [ ] Month tab opens on **Week**; drag a task to another day.
- [ ] Open an episode → **Board**: its sequences are sections, its shots are cards. Edit one and check
      the episode.
- [ ] The tabs are a sidebar on the left; Tools opens beside it.

## Bring your data in

1. **Creator Studio v2** → in v2: Settings → Export everything. In CS3: Settings → Restore from backup.
   (v2's backup only holds 19 of its 50 stores; dropping CS3's `app/js/transfer.js` into v2 fixes that.)
2. **Storyboard** → in Storyboard: ⋯ → Export everything. In CS3: Content → Boards → Import a board or backup.
3. **Laptop Planner** → in the Planner: Send to phone. In CS3: Settings → Open a plan pack.

## Put it on GitHub

1. On github.com, create an **empty private** repo named `creator-studio-3` (no README).
2. In this folder:

   ```
   git remote add origin https://github.com/solakirus/creator-studio-3.git
   git push -u origin main
   ```

From then on, `build.bat` offers to push after each build.

---

## Layout

| Folder | What |
|---|---|
| `app/` | **The app.** Edit files here only. `app/tests/` holds the test harnesses. |
| `www/` | Built copy of `app/` (minus tests). Recreated on every build, not in git. |
| `electron/` | Windows shell. `preload.js` gives the web layer the same plugin names Capacitor does. |
| `android/` | Created on first build from v2's. In git from then on. |
| `native/` | Widget and shortcut sources with CS3's links. Copied into `android/` on every sync. |
| `scripts/` | `android-setup.js` (copy from v2 + new identity), `copy-web.js`, `run-tests.js` |
| `docs/` | `CS3-DESIGN.md` (the plan), `CREATOR-STUDIO-3.md` (merge brief), `HANDOVER.md` (v2 handover) |

## Library and Templates (from Shotline)

Content → **Library**: GIFs, clips and stills (Deck, Boards, Folders, Add & grab). On the laptop it
also reads `~/Shot Library` and any folder you add, and runs Shot Library's grabber.
Content → **Templates**: shot structures, task lists, looks and notebook pages; use one for a new
video or put it on a day. Rules and numbers: `MECHANICS.md`. Walkthrough test:
`node app/tests/browser/library.browser.js <media folder> <out folder>`.
`npm run build` copies the web files and packages `dist/win-unpacked`; the program takes
`--screenshot <file.png> [--view library|templates]` to save a picture of itself and quit.

## For the next Claude session

- Read `docs/CS3-DESIGN.md` first, then the "Mistakes this codebase keeps producing" section of
  `docs/CREATOR-STUDIO-3.md`.
- Browser tests live in `app/tests/browser/` (playwright-core + Chromium; build the preview first).
  They cover backup, shot ids, the board, board ↔ episode and clip sync, imports, Suggest shots, Week,
  Paper, the sidebar, handwritten notes and clip ideas.
- `scripts/port-board.py` rebuilds `app/board/board.html` from Storyboard's original file; every change
  made to the canvas is in that script.
- `npm test` runs every harness, including `checks.test.js`. It checks app identity, script tags,
  stray `global.`, theme-attribute handlers, screen push/register pairs, and tool routes. Run it
  after every change.
- `cd app && bash build-preview.sh` builds `creator-studio-preview.html`, the single-file browser
  preview.
- Identity: app id `com.solakirus.creatorstudio3`, database `creator-studio-3`, links `cs3://`.
  The Java package stays `com.creatorstudio.v2` on purpose (see `scripts/android-setup.js`).
