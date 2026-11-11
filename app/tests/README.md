# Test harnesses

These run under Node against the files in `app/`, from the directory above this
one:

    node tests/chdelete.test.js

They are packaged with the app on purpose. They used to live outside it and
were lost when a working container reset — the app survived because it was
zipped, the tests did not because they were not.

Most assert on the source rather than running the whole app: the failures worth
catching here are "this screen no longer offers the thing it used to" and "this
push names a screen that does not exist", which a source check catches cheaply
and a browser test catches slowly.

`npm test` runs every `*.test.js` here. The harnesses under `browser/` are not
in that run — they drive a real Chromium and need Playwright, so they are run by
hand when a change is about behaviour rather than wiring:

    cd app && bash build-preview.sh          # they load the single-file build
    node tests/browser/addtask.browser.js

In a container with no route to Google, Chromium spends its first minute trying
anyway; the newer harnesses pass `--disable-component-update` and friends to
stop that, and `--no-sandbox` because there is no sandbox to use.

## Sync (2026-10-20)

`sync.e2e.js` runs two (then three) devices, each with its own database,
against a real Sync Hub server. It is not in `npm test` because it needs the
server and `fake-indexeddb`:

    cd app
    npm i --no-save fake-indexeddb
    SYNC_HUB=/path/to/sync-hub node tests/sync.e2e.js

It checks the cases that decide whether sync loses work: a delete on one
device and an add on another both landing, newest edit winning, an edit after
a delete bringing the item back, pictures surviving byte for byte, backup
bookkeeping staying per-device, and a device joining by replace or combine.
