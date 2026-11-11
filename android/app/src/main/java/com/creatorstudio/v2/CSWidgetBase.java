package com.creatorstudio.v2;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

/* What every Creator Studio widget has in common.
 *
 * All of them draw the same snapshot the app wrote to SharedPreferences; they
 * differ only in which layout they use and where tapping takes you. Putting
 * that here means a change to how the data is read happens once rather than
 * three times, which is how the three quietly drift apart.
 *
 * Each subclass names its layout and its deep link, and that is all.
 */
public abstract class CSWidgetBase extends AppWidgetProvider {

    /* which layout to inflate */
    protected abstract int layoutId();

    /* where tapping it goes — one of the links js/shortcuts.js understands */
    protected abstract String link();

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        draw(ctx, mgr, ids, layoutId(), link());
    }

    /* Shared by every widget and by the plugin's poke. */
    static void draw(Context ctx, AppWidgetManager mgr, int[] ids, int layout, String link) {
        SharedPreferences p = ctx.getSharedPreferences(CSWidgetPlugin.PREFS, Context.MODE_PRIVATE);

        String day      = p.getString("day", "");
        String progress = p.getString("progress", "");
        String next     = p.getString("next", "");
        String nextAt   = p.getString("nextAt", "");
        String shoot    = p.getString("shoot", "");

        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), layout);

            /* Nothing written yet — the app has never been opened on this
             * install. Say that rather than drawing an empty frame. */
            if (day.isEmpty() && progress.isEmpty()) {
                setIfPresent(v, R.id.w_day, "Creator Studio");
                setIfPresent(v, R.id.w_progress, "Open the app to start");
                hideIfPresent(v, R.id.w_next);
                hideIfPresent(v, R.id.w_shoot);
            } else {
                setIfPresent(v, R.id.w_day, day);
                setIfPresent(v, R.id.w_progress, progress);

                if (next.isEmpty()) {
                    hideIfPresent(v, R.id.w_next);
                } else {
                    showIfPresent(v, R.id.w_next);
                    setIfPresent(v, R.id.w_next, nextAt.isEmpty() ? next : nextAt + "  " + next);
                }

                if (shoot.isEmpty()) {
                    hideIfPresent(v, R.id.w_shoot);
                } else {
                    showIfPresent(v, R.id.w_shoot);
                    setIfPresent(v, R.id.w_shoot, shoot);
                }
            }

            Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(link));
            open.setClassName(ctx.getPackageName(), ctx.getPackageName() + ".MainActivity");
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            /* Each widget needs its own request code or they share a
             * PendingIntent and all three end up going wherever the last one
             * was created — the small one would open the big one's screen. */
            PendingIntent pi = PendingIntent.getActivity(
                    ctx, link.hashCode(), open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            v.setOnClickPendingIntent(R.id.w_root, pi);

            mgr.updateAppWidget(id, v);
        }
    }

    /* The small layout has no "next" or "shoot" view. RemoteViews does not mind
     * being told about a view that is not in the layout — the call is simply
     * ignored — so these keep the shared draw readable rather than each layout
     * needing its own branch. */
    private static void setIfPresent(RemoteViews v, int id, String text) {
        v.setTextViewText(id, text);
    }
    private static void hideIfPresent(RemoteViews v, int id) {
        v.setViewVisibility(id, View.GONE);
    }
    private static void showIfPresent(RemoteViews v, int id) {
        v.setViewVisibility(id, View.VISIBLE);
    }
}
