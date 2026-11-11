# Long-press shortcuts — what to change on your machine

Holding the app icon offers four actions: **Run**, **Capture**, **Shoot**,
**Workout**. Each opens the app straight onto that screen.

The web half is already in the zip (`js/shortcuts.js`, wired at boot). These are
the native changes, which I cannot build or test here — expect to report back.

---

## 0. The package name is already right

These files use `com.creatorstudio.v2`, taken from the `applicationId` in your
`android\app\build.gradle`. Nothing to change.

If you ever rename the app's package, it appears in `shortcuts.xml` eight times
— `targetPackage` and `targetClass` on each of the four shortcuts. A wrong one
shows the shortcuts but they open nothing, with no error to explain why.

---

The one thing worth a glance: the files assume your launcher activity is
`com.creatorstudio.v2.MainActivity`, which is where Capacitor puts it. Confirm
with:

```
findstr /s /c:"class MainActivity" android\app\src\main\java\*
```

---

## 1. Drop in the two files

**`native/shortcuts.xml`** → `android\app\src\main\res\xml\shortcuts.xml`

Create the `xml` folder if it isn't there.

**`native/strings-to-add.xml`** → merge its contents into
`android\app\src\main\res\values\strings.xml`, inside the existing
`<resources>` block. Don't replace the file — it already holds your app name.

---

## 2. Point the manifest at them

In `android\app\src\main\AndroidManifest.xml`, inside the `<activity>` element
for `MainActivity` — the same one that already has your SEND intent-filter —
add this line among the other `<meta-data>` entries:

```xml
<meta-data android:name="android.app.shortcuts"
           android:resource="@xml/shortcuts" />
```

---

## 3. Nothing — this step is already done

The links use `com.creatorstudio.v2://go/...`, which is the `custom_url_scheme`
already in your `strings.xml`. Capacitor's manifest catches that scheme, so
there is no intent-filter to add.

---

## 4. Build

```
npx cap sync android
build-apk.bat
```

---

## What to check once it's on the phone

1. **Hold the app icon.** Four actions should appear under the usual App info
   and Uninstall. If nothing appears, the `meta-data` line in step 2 didn't take.
2. **Tap Run from a cold start** — app fully closed. It should open on the run
   screen, not on Today.
3. **Tap Capture while the app is already open.** This is the case that breaks
   separately: a cold start reads the launch URL, a warm one needs the listener.
   If cold works and warm doesn't, it is the listener in js/shortcuts.js, not
   the manifest.
4. **Tap Shoot.** Opens Episodes. It does not yet jump to today's day page —
   that needs the day to be identified first, and I'd rather add it once the
   basic routing is proven.

If a shortcut opens the app but lands on Today, the link is arriving and the
routing isn't matching — tell me and I'll look at `keyOf` in `js/shortcuts.js`.

---

## Changing what they are

The four are defined in two places and both have to agree: the `shortcutId` and
`android:data` in `shortcuts.xml`, and the `ROUTES` map at the top of
`js/shortcuts.js`. Android caps the useful number at four or five.
