package com.creatorstudio.v2;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import org.json.JSONArray;

/* The bridge between the app and the home-screen widgets.
 *
 * A widget runs in the launcher's process, so it can't read IndexedDB or call
 * into the WebView. The app hands it a snapshot (js/widget.js) and the widgets
 * draw from that; taps that change something (a check box, Done) wait in
 * CSWidgetStore until the app takes them with takeQueue().
 *
 * App → widgets: update({ snapshot }) after anything that could move the numbers.
 *   An older web build sends only { day, progress, next, nextAt, shoot }; that
 *   still draws, as a snapshot with just those lines.
 * Widgets → app: takeQueue() [{ type: "done", key, date, at }], and the
 *   "widgetQueue" event while the app is open. Buttons that open a screen use
 *   cs4://go/... links, which js/shortcuts.js already handles.
 */
@CapacitorPlugin(name = "CSWidget")
public class CSWidgetPlugin extends Plugin {

    private static WeakReference<CSWidgetPlugin> current = new WeakReference<>(null);

    @Override
    public void load() {
        current = new WeakReference<>(this);
        CSWidgetRender.updateAll(getContext());
    }

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        JSObject snap = call.getObject("snapshot");
        if (snap == null) {
            // an older web build: the five lines it knows
            snap = new JSObject();
            snap.put("legacy", true);
            snap.put("day", call.getString("day", ""));
            snap.put("progress", call.getString("progress", ""));
            snap.put("next", call.getString("next", ""));
            snap.put("nextAt", call.getString("nextAt", ""));
            snap.put("shoot", call.getString("shoot", ""));
        }
        CSWidgetStore.saveSnapshot(ctx, snap.toString());
        CSWidgetRender.updateAll(ctx);
        call.resolve();
    }

    /* Whether any widget is on the home screen, so the app can skip the work. */
    @PluginMethod
    public void isPlaced(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("placed", CSWidgetRender.placed(getContext()).length() > 0);
        call.resolve(ret);
    }

    /* Which kinds are on the home screen, e.g. ["today", "meals"]. */
    @PluginMethod
    public void placed(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("kinds", CSWidgetRender.placed(getContext()));
        call.resolve(ret);
    }

    /* Check-offs made on a widget since the last call. */
    @PluginMethod
    public void takeQueue(PluginCall call) {
        JSONArray q = CSWidgetStore.takeQueue(getContext());
        JSObject ret = new JSObject();
        ret.put("actions", q);
        call.resolve(ret);
    }

    static void queueChanged() {
        CSWidgetPlugin p = current.get();
        if (p != null) p.notifyListeners("widgetQueue", new JSObject());
    }
}
