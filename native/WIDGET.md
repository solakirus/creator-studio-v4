# Home screen widget — what to change on your machine

Three widgets, all drawing the same snapshot:

| Widget | Shows | Taps to |
|---|---|---|
| **Day** (3×2) | Day, tally, next task, what's left to film | Today |
| **Small** (2×1) | Day and tally only | Today |
| **Filming** (3×2) | What you're shooting, with the day small above | That day's sequences |

The web half is in the zip already (`js/widget.js`, refreshed whenever Today
redraws). Below is the native half. I cannot build or run any of it, so expect
one or two rounds of fixing.

**Do the shortcuts first** (`SHORTCUTS.md`) — this reuses their deep link, and
proving that link works first means one less unknown here.

---

## 1. Twelve files

Two Java files go beside your existing `MainActivity.java`. Find it with:

```
dir /s /b android\app\src\main\java\*MainActivity.java
```

It will be in `android\app\src\main\java\com\creatorstudio\v2\`. Copy both into
**that same folder**:

| From `www\native\` | To |
|---|---|
| `CSWidgetBase.java` | `...\java\com\creatorstudio\v2\` |
| `CSWidgetPlugin.java` | `...\java\com\creatorstudio\v2\` |
| `CSWidgetProvider.java` | `...\java\com\creatorstudio\v2\` |
| `CSWidgetSmall.java` | `...\java\com\creatorstudio\v2\` |
| `CSWidgetShoot.java` | `...\java\com\creatorstudio\v2\` |

Then the resource files:

| From `www\native\` | To |
|---|---|
| `cs_widget.xml` | `android\app\src\main\res\layout\` |
| `cs_widget_small.xml` | `android\app\src\main\res\layout\` |
| `cs_widget_shoot.xml` | `android\app\src\main\res\layout\` |
| `cs_widget_bg.xml` | `android\app\src\main\res\drawable\` |
| `cs_widget_info.xml` | `android\app\src\main\res\xml\` |
| `cs_widget_small_info.xml` | `android\app\src\main\res\xml\` |
| `cs_widget_shoot_info.xml` | `android\app\src\main\res\xml\` |

Create `layout` or `drawable` if they are not there. The `xml` folder already
exists from the shortcuts.

---

## 2. Register the three widgets in the manifest

In `AndroidManifest.xml`, inside `<application>` but **outside** the
`<activity>` block — after `</activity>`, next to the `<provider>`.

If you already added the first receiver, keep it and add the two below it.

```xml
<receiver
    android:name=".CSWidgetProvider"
    android:exported="false">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/cs_widget_info" />
</receiver>

<receiver
    android:name=".CSWidgetSmall"
    android:exported="false">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/cs_widget_small_info" />
</receiver>

<receiver
    android:name=".CSWidgetShoot"
    android:exported="false">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/cs_widget_shoot_info" />
</receiver>
```

---

## 3. Register the plugin

Capacitor needs to be told the plugin class exists. Open
`MainActivity.java` in the same folder. If it looks like this:

```java
public class MainActivity extends BridgeActivity {
}
```

change it to:

```java
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CSWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

If it already has an `onCreate` with `registerPlugin` lines in it — you may have
one for LiveStatus — just add `registerPlugin(CSWidgetPlugin.class);` beside
them and leave the rest alone.

**`registerPlugin` must come before `super.onCreate`.** After it, the bridge is
already built and the plugin is silently missing.

---

## 4. Build

```
npx cap sync android
build-apk.bat
```

---

## What to check on the phone

1. **Open the app once first.** The widget draws what the app last wrote; before
   that it says "Open the app to start".
2. **Long-press the home screen → Widgets → Creator Studio.** Three should be
   offered. Drag each out in turn.
3. It should show your day, `2/7 done`, the next task, and what you are filming.
4. **Tick a task off in the app**, then go back to the home screen. The widget
   should have changed within a second.
5. **Tap the widget.** It should open today's filming — or the episode list if
   nothing is scheduled for today.

### If something is wrong

**Only one or two offered** → the missing one's `<receiver>` in step 2, or its
`*_info.xml` is in the wrong folder.

**No Creator Studio at all** → the receivers in step 2, or the `*_info.xml`
files are in the wrong folder.

**Widget appears but always says "Open the app to start"** → the plugin is not
registered (step 3), or `registerPlugin` is after `super.onCreate`. The app
writes nothing and never errors, so this one is quiet.

**Shows numbers but never changes** → it is writing but not poking. Tell me and
I will look at the poke path in the plugin.

**Tapping does nothing** → the deep link. Confirm the Shoot long-press shortcut
still works; they use the same link, so if that works and this does not, it is
the PendingIntent.

**Build fails on `R.layout.cs_widget` or `R.id.w_day`** → a resource file is in
the wrong folder. `cs_widget.xml` must be in `layout`, not `xml`.
