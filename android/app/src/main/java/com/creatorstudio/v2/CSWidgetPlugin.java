package com.creatorstudio.v2;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/* The bridge between the app and the home screen widget.
 *
 * A widget runs in the launcher's process, not the app's, so it cannot read
 * IndexedDB or call into the WebView. SharedPreferences is the simplest thing
 * both sides can see: the app writes, the widget reads.
 *
 * Everything stored here is already formatted for display. The widget draws
 * strings; it does not calculate.
 */
@CapacitorPlugin(name = "CSWidget")
public class CSWidgetPlugin extends Plugin {

    /* Must match the name CSWidgetProvider reads. */
    public static final String PREFS = "cs_widget";

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();

        e.putString("day",      call.getString("day", ""));
        e.putString("progress", call.getString("progress", ""));
        e.putString("next",     call.getString("next", ""));
        e.putString("nextAt",   call.getString("nextAt", ""));
        e.putString("shoot",    call.getString("shoot", ""));
        e.putLong("updatedAt",  System.currentTimeMillis());
        e.apply();

        /* Writing is not enough — the launcher only redraws when told. */
        poke(ctx);

        call.resolve();
    }

    /* Ask the launcher to redraw every instance of every widget.
     *
     * Each kind is a separate provider with its own ids, so missing one here
     * means that widget silently stops updating while the others carry on —
     * the worst kind of bug to notice. Adding a widget means adding it here. */
    static void poke(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);

        redraw(ctx, mgr, CSWidgetProvider.class,
               R.layout.cs_widget, "cs3://go/today");
        redraw(ctx, mgr, CSWidgetSmall.class,
               R.layout.cs_widget_small, "cs3://go/today");
        redraw(ctx, mgr, CSWidgetShoot.class,
               R.layout.cs_widget_shoot, "cs3://go/shoot");
    }

    private static void redraw(Context ctx, AppWidgetManager mgr,
                               Class<?> provider, int layout, String link) {
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, provider));
        if (ids != null && ids.length > 0) {
            CSWidgetBase.draw(ctx, mgr, ids, layout, link);
        }
    }

    /* Lets the web layer ask whether a widget is actually on the home screen,
     * so it can skip the work when there isn't one. */
    private static boolean any(Context ctx, AppWidgetManager mgr, Class<?> provider) {
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, provider));
        return ids != null && ids.length > 0;
    }

    @PluginMethod
    public void isPlaced(PluginCall call) {
        Context ctx = getContext();
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        JSObject ret = new JSObject();
        ret.put("placed", any(ctx, mgr, CSWidgetProvider.class)
                       || any(ctx, mgr, CSWidgetSmall.class)
                       || any(ctx, mgr, CSWidgetShoot.class));
        call.resolve(ret);
    }
}
