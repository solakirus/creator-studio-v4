# Linking Creator Studio and the storyboard app

Two Capacitor apps on the same phone. Neither shares a database with the other
— what travels between them is an id and a way back. Android does the switching
when one opens a URL whose scheme the other has declared.

Creator Studio's half is done. This is the three things the storyboard app
needs, and they are the same three this app already does for its home-screen
shortcuts.

---

## What travels

**Out of Creator Studio**, when you tap a linked board on an episode:

```
storyboard://board/<boardId>?from=creatorstudio&back=com.creatorstudio.v2%3A%2F%2Fgo%2Fvlog%2F<vlogId>
```

**Back into Creator Studio**, from a button in the storyboard app:

```
com.creatorstudio.v2://go/vlog/<vlogId>
```

That second one already works — the `back` parameter is handed to you
url-encoded, so decode it once and open it as-is.

The return trip is the part worth having. Jumping to a board and then hunting
for where you came from is worse than not jumping at all.

---

## 1. Declare the scheme

In the storyboard app's `AndroidManifest.xml`, inside its `<activity>` — beside
the LAUNCHER intent-filter, not replacing it:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="storyboard" />
</intent-filter>
```

The activity also wants `android:launchMode="singleTask"`, so a link arriving
while the app is already open reaches `onNewIntent` rather than starting a
second copy of it.

## 2. Keep the incoming intent

In its `MainActivity.java`, the same override this app has:

```java
@Override
protected void onNewIntent(Intent intent) {
    setIntent(intent);
    super.onNewIntent(intent);
}
```

Without it, a warm launch hands the web layer the *original* launch intent and
the link is silently lost.

## 3. Route the link in JavaScript

Modelled on this app's `js/shortcuts.js`. Both paths matter: a cold start
carries the link in the launch URL, a warm one arrives as an event.

```js
(function(global){
  const App = global.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;

  function handle(url){
    const m = String(url || '').match(/board\/([\w-]+)/i);
    if(!m) return false;

    /* the way back, if the sender gave one */
    const q = String(url).split('?')[1] || '';
    const back = new URLSearchParams(q).get('back');
    if(back) rememberReturnLink(decodeURIComponent(back));

    openBoard(m[1]);          /* your own function */
    return true;
  }

  function start(){
    if(!App) return;
    App.addListener('appUrlOpen', d => { if(d && d.url) handle(d.url); });
    if(App.getLaunchUrl){
      App.getLaunchUrl().then(r => { if(r && r.url) handle(r.url); })
        .catch(() => {});
    }
  }

  global.StudioLink = { start, handle };
})(window);
```

Call `StudioLink.start()` at boot.

## 4. The way back

Wherever you kept that `back` link, show a button while it is set:

```js
function goBack(link){
  try { window.open(link, '_system'); } catch(e){ window.location.href = link; }
}
```

Worth clearing it once used, or a board keeps offering to return to an episode
you have long since left.

---

## Getting the id into Creator Studio

On an episode, in Plan mode, **Storyboard → Link a board** takes the board's id
— or the whole `storyboard://board/...` link, since which one you get depends on
how the other app offers it. Both are accepted.

Something in the storyboard app that copies a board's link to the clipboard
makes this a paste rather than a typing exercise.

---

## When it does not work

**Nothing happens on tap** → the scheme is not declared, or the app is not
installed. Android silently drops a link no app claims.

**It opens a second copy of the app** → `launchMode="singleTask"` is missing.

**It works cold but not while the app is open** → `onNewIntent` is not calling
`setIntent`.

**The board opens but the way back does not** → the `back` parameter arrives
url-encoded; decode it once before opening it.

**It works on the phone but not in a browser preview** → expected. A custom
scheme needs an app registered for it; there is nothing to register in a
desktop browser.
