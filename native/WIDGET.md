# Home-screen widgets

Seven widgets, all drawn from one snapshot the app sends (`app/js/widget.js`):

| Widget | Class | Size | Shows | Tap |
|---|---|---|---|---|
| **Today** | `CSWidgetToday` | 4×4 | Day, streak, tally bar, the day in time order (tasks, vlog beats, meal prep) with check boxes | a row opens it; the box ticks it |
| **Up next** | `CSWidgetProvider` | 4×2 | The next thing with a time, counting down | **Start** (shoot mode / starts the workout / the task), **Done** |
| **Filming today** | `CSWidgetShoot` | 4×2 | Each shoot or beat to film today, with shots got | a row opens it in shoot mode |
| **Meals** | `CSWidgetMeals` | 4×2 | Breakfast, lunch, dinner, snacks planned for today, and any meal prep | Nutrition |
| **Workout** | `CSWidgetWorkout` | 3×2 | Today's workout task: routine, exercises, minutes | **Start** starts the routine, **Done** |
| **Day** | `CSWidgetSmall` | 2×2 | Day count, streak, tally | Today |
| **Capture** | `CSWidgetCapture` | 2×2 | — | Quick capture |

`CSWidgetProvider`, `CSWidgetSmall` and `CSWidgetShoot` keep the class names of the
three widgets from before 2026-11-22 (Day, Small, Filming): Android identifies a
placed widget by its class, so ones already on a home screen stay and get the new look.

Long-press the icon: **Add a task**, Capture, Shoot, Workout, Run (`shortcuts.xml`).
Launchers that show four drop Run.

## How it fits together

- **App → widgets:** `Widget.refresh()` (after task changes, sync, launch, coming
  back to the app) builds the snapshot and calls `CSWidget.update({ snapshot, ...old
  fields })`. The old five one-line fields (`day`, `progress`, `next`, `nextAt`,
  `shoot`) are still sent, so an APK from before keeps drawing its lines.
- **Widgets → app:** a check box or Done waits in `CSWidgetStore` (shown ticked at
  once); `takeQueue()` hands it over the next time the app runs (right away if it's
  open, via the `widgetQueue` event) and `widget.js` saves it like a tick on Today,
  so it syncs. Tap again before then to undo.
- **Opening screens:** buttons fire `cs4://go/...` links, the same way the shortcuts
  do: `today`, `task/<id>`, `shootrun/<id>`, `startworkout/<id>`, `meals`, `add`,
  `capture`, `shoot`, `workout` (`app/js/shortcuts.js`).
- The snapshot holds the date; on a new day the widgets say "Open Creator Studio to
  load today" instead of showing yesterday, and the day count moves on by itself.

## Files

`native/` is the source. `scripts/android-setup.js --patch-only` (part of
`npm run android:sync`) copies the Java beside `MainActivity.java` and each
resource into `res/` by its name: `*_info.xml` and `shortcuts.xml` → `xml/`,
`cs_widget.xml` / `cs_widget_<kind>.xml` → `layout/`, the shapes and icons
(`cs_widget_bg/_grad/_cream`, `cs_pill_*`, `cs_check_*`, `cs_ic_*`, `cs_div`,
`cs_progress`, `cs_streak_pill`) → `drawable/`. The receivers are in
`android/app/src/main/AndroidManifest.xml`; their labels are in `strings.xml`
(also listed in `strings-to-add.xml`).

## Building

GitHub builds the APK in the private `solakirus/kris-apps` repo (workflow "Creator
Studio APK", release "Creator Studio APK build N"), signed with a key kept there; it
passes the key to Gradle through `CS4_KEYSTORE`, `CS4_KEYSTORE_PASS` and
`CS4_KEY_ALIAS` (see `android/app/build.gradle`). A laptop build (`build.bat`)
leaves them unset and signs with the laptop's debug key, so the two can't install
over each other: pick one.

Test: `app/tests/browser/v4-widgets.browser.js` (22).
