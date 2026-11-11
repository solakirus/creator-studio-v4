# Creator Studio v2 — full export (one file)

v2's **Export everything** only wrote 19 of its 50 stores, so episodes' quarters and months, runs,
routines, challenges and every picture would be left behind on the way to Creator Studio 3.

This `transfer.js` fixes the export and nothing else:

- **Export only reads.** Nothing in v2's data is changed or deleted.
- **Restore is byte-for-byte v2's own**, and it still reads files made by the new export.
- No screens, no database version, no Android changes.
- API keys (settings starting `secret:`) are left out of the file.

Tested: export from v2's code → 50 stores, pictures included → restored into Creator Studio 3 with
episodes, quarters, months, runs and photos intact; v2's data untouched afterwards.

## Install (2 minutes)

1. In `C:\Users\Khale\Projects\creator-studio-v2\www\js\`, rename `transfer.js` to `transfer.js.bak`
   (that's your way back).
2. Copy this `transfer.js` into that folder.
3. Build the APK the usual way (`build-apk.bat`) and install it over v2 as normal — same app, data kept.
4. In v2: Settings → **Export everything**. Save the file somewhere you can reach from CS3.
5. In Creator Studio 3: Settings → **Restore from backup** → pick that file.

To undo: delete this `transfer.js`, rename `transfer.js.bak` back, rebuild.

If you have a lot of photos the file can be big; if the export ever fails on the phone, nothing is
lost — tell Claude and it can split pictures into a separate file.
