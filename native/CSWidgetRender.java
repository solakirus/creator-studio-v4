package com.creatorstudio.v2;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/* Draws every Creator Studio widget from the snapshot js/widget.js sends:
 *
 *   date      "2026-11-22", the day the snapshot is about
 *   dayN      53 (the day count), dayLabel "Day 53", streak 12
 *   items     today in time order: { id, title, at "14:30"|"", sub, done, check,
 *             link "cs4://go/task/<id>", start (link)|null, startLabel }
 *   filming   [{ title, got, total, link }]
 *   meals     { slots: [{ slot, title }], prep }
 *   workout   { id, title, sub, done, start, link } | null
 *
 * If the phone has moved on to a new day since, the widgets say so rather
 * than showing yesterday's list; the day count still moves on by itself.
 */
final class CSWidgetRender {

    static final int UP_NEXT = 0;
    static final int DAY = 1;
    static final int FILMING = 2;
    static final int TODAY = 3;
    static final int MEALS = 4;
    static final int WORKOUT = 5;
    static final int CAPTURE = 6;

    private static final String TAG = "CSWidget";
    private static final String DOT = " · ";
    private static final String[] NAMES = { "upnext", "day", "filming", "today", "meals", "workout", "capture" };
    private static final Class<?>[] PROVIDERS = {
        CSWidgetProvider.class, CSWidgetSmall.class, CSWidgetShoot.class, CSWidgetToday.class,
        CSWidgetMeals.class, CSWidgetWorkout.class, CSWidgetCapture.class
    };
    private static final int[] LAYOUTS = {
        R.layout.cs_widget, R.layout.cs_widget_small, R.layout.cs_widget_shoot, R.layout.cs_widget_today,
        R.layout.cs_widget_meals, R.layout.cs_widget_workout, R.layout.cs_widget_capture
    };

    private static final int[] TROWS = { R.id.w_trow1, R.id.w_trow2, R.id.w_trow3, R.id.w_trow4, R.id.w_trow5, R.id.w_trow6 };
    private static final int[] TDIVS = { R.id.w_tdiv1, R.id.w_tdiv2, R.id.w_tdiv3, R.id.w_tdiv4, R.id.w_tdiv5, R.id.w_tdiv6 };
    private static final int[] TATS = { R.id.w_tat1, R.id.w_tat2, R.id.w_tat3, R.id.w_tat4, R.id.w_tat5, R.id.w_tat6 };
    private static final int[] TTITLES = { R.id.w_ttitle1, R.id.w_ttitle2, R.id.w_ttitle3, R.id.w_ttitle4, R.id.w_ttitle5, R.id.w_ttitle6 };
    private static final int[] TSUBS = { R.id.w_tsub1, R.id.w_tsub2, R.id.w_tsub3, R.id.w_tsub4, R.id.w_tsub5, R.id.w_tsub6 };
    private static final int[] TCHKS = { R.id.w_tchk1, R.id.w_tchk2, R.id.w_tchk3, R.id.w_tchk4, R.id.w_tchk5, R.id.w_tchk6 };
    private static final int[] FROWS = { R.id.w_frow1, R.id.w_frow2, R.id.w_frow3 };
    private static final int[] FTITLES = { R.id.w_ftitle1, R.id.w_ftitle2, R.id.w_ftitle3 };
    private static final int[] FCOUNTS = { R.id.w_fcount1, R.id.w_fcount2, R.id.w_fcount3 };
    private static final int[] MROWS = { R.id.w_mrow1, R.id.w_mrow2, R.id.w_mrow3, R.id.w_mrow4 };
    private static final int[] MSLOTS = { R.id.w_mslot1, R.id.w_mslot2, R.id.w_mslot3, R.id.w_mslot4 };
    private static final int[] MTITLES = { R.id.w_mtitle1, R.id.w_mtitle2, R.id.w_mtitle3, R.id.w_mtitle4 };

    private static final int CREAM = 0xFFEDE5D2;
    private static final int MUTED = 0xFFA9A395;
    private static final int DIMMED = 0xFF77736A;

    private CSWidgetRender() {}

    // ---------- dates ----------

    static String todayIso() {
        Calendar n = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d", n.get(Calendar.YEAR), n.get(Calendar.MONTH) + 1, n.get(Calendar.DAY_OF_MONTH));
    }

    private static long epochDay(String iso) {
        if (iso == null || iso.length() < 10) return Long.MIN_VALUE;
        try {
            Calendar c = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
            c.clear();
            c.set(Integer.parseInt(iso.substring(0, 4)), Integer.parseInt(iso.substring(5, 7)) - 1, Integer.parseInt(iso.substring(8, 10)));
            return c.getTimeInMillis() / 86400000L;
        } catch (NumberFormatException e) {
            return Long.MIN_VALUE;
        }
    }

    /* "14:30" -> minutes after midnight, or -1 */
    private static int minutes(String at) {
        if (at == null || at.length() < 4) return -1;
        try {
            String[] p = at.split(":");
            return Integer.parseInt(p[0]) * 60 + (p.length > 1 ? Integer.parseInt(p[1]) : 0);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    /* "14:30" -> "2:30P", the way the app labels hours */
    private static String clock(String at) {
        int m = minutes(at);
        if (m < 0) return "";
        int h = m / 60, mm = m % 60, hr = h % 12 == 0 ? 12 : h % 12;
        return (mm == 0 ? String.valueOf(hr) : hr + ":" + String.format(Locale.US, "%02d", mm)) + (h >= 12 ? "P" : "A");
    }

    private static int nowMinutes() {
        Calendar n = Calendar.getInstance();
        return n.get(Calendar.HOUR_OF_DAY) * 60 + n.get(Calendar.MINUTE);
    }

    private static String until(int at) {
        int d = at - nowMinutes();
        if (d > 90) return "in " + (d / 60) + " hr" + (d % 60 >= 30 ? "+" : "");
        if (d > 0) return "in " + d + " min";
        if (d > -15) return "now";
        return d > -90 ? (-d) + " min ago" : "earlier";
    }

    // ---------- updating ----------

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        if (m == null) return;
        for (int kind = 0; kind < PROVIDERS.length; kind++) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, PROVIDERS[kind]));
            if (ids != null && ids.length > 0) update(c, m, ids, kind);
        }
    }

    static void update(Context c, AppWidgetManager m, int[] ids, int kind) {
        Model d = Model.load(c);
        for (int id : ids) {
            try {
                m.updateAppWidget(id, build(c, kind, d));
            } catch (Exception e) {
                Log.w(TAG, "Couldn't draw widget " + id, e);
            }
        }
    }

    static JSONArray placed(Context c) {
        JSONArray out = new JSONArray();
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        if (m == null) return out;
        for (int kind = 0; kind < PROVIDERS.length; kind++) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, PROVIDERS[kind]));
            if (ids != null && ids.length > 0) out.put(NAMES[kind]);
        }
        return out;
    }

    // ---------- what the snapshot says ----------

    static final class Item {
        String id, title, at, sub, link, start, startLabel;
        boolean done, check;
    }

    static final class Model {
        JSONObject snap;
        boolean legacy, stale;
        String dayLabel = "";
        int streak;
        final List<Item> items = new ArrayList<>();

        static Model load(Context c) {
            Model d = new Model();
            d.snap = CSWidgetStore.snapshot(c);
            if (d.snap == null) return d;
            d.legacy = d.snap.optBoolean("legacy", false);
            if (d.legacy) { d.dayLabel = d.snap.optString("day", ""); return d; }
            long gap = epochDay(todayIso()) - epochDay(str(d.snap, "date"));
            d.stale = gap != 0;
            int n = d.snap.optInt("dayN", Integer.MIN_VALUE);
            if (n != Integer.MIN_VALUE) {
                long today = n + gap;
                d.dayLabel = today > 0 ? "Day " + today : today == 0 ? "Starts tomorrow" : (-today) + " days to go";
            } else d.dayLabel = d.snap.optString("dayLabel", "");
            d.streak = d.stale && gap > 1 ? 0 : d.snap.optInt("streak", 0);
            if (d.stale) return d;
            Set<String> flipped = CSWidgetStore.pending(c, "done");
            JSONArray a = d.snap.optJSONArray("items");
            if (a != null) {
                for (int i = 0; i < a.length(); i++) {
                    JSONObject o = a.optJSONObject(i);
                    if (o == null) continue;
                    Item t = new Item();
                    t.id = str(o, "id");
                    t.title = str(o, "title") == null ? "Untitled" : str(o, "title");
                    t.at = str(o, "at");
                    t.sub = str(o, "sub");
                    t.link = str(o, "link");
                    t.start = str(o, "start");
                    t.startLabel = str(o, "startLabel");
                    t.check = o.optBoolean("check", false) && t.id != null;
                    t.done = o.optBoolean("done", false);
                    if (t.check && flipped.contains(t.id)) t.done = !t.done;
                    d.items.add(t);
                }
            }
            return d;
        }

        int doneCount() { int n = 0; for (Item t : items) if (t.done) n++; return n; }

        /* the next thing with a time: still to do, and not long gone */
        Item next() {
            int now = nowMinutes();
            Item firstTimed = null, firstAny = null;
            for (Item t : items) {
                if (t.done) continue;
                if (firstAny == null) firstAny = t;
                int m = minutes(t.at);
                if (m < 0) continue;
                if (firstTimed == null) firstTimed = t;
                if (m >= now - 60) return t;
            }
            return firstTimed != null ? firstTimed : firstAny;
        }
    }

    static String str(JSONObject o, String key) {
        if (o == null || !o.has(key) || o.isNull(key)) return null;
        String s = o.optString(key, null);
        return s == null || s.isEmpty() ? null : s;
    }

    private static CharSequence struck(String s) {
        SpannableString x = new SpannableString(s);
        x.setSpan(new StrikethroughSpan(), 0, x.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return x;
    }

    // ---------- building the views ----------

    private static RemoteViews build(Context c, int kind, Model d) {
        RemoteViews v = new RemoteViews(c.getPackageName(), LAYOUTS[kind]);
        switch (kind) {
            case UP_NEXT: upNext(c, v, d); break;
            case DAY: day(c, v, d); break;
            case FILMING: filming(c, v, d); break;
            case TODAY: today(c, v, d); break;
            case MEALS: meals(c, v, d); break;
            case WORKOUT: workout(c, v, d); break;
            case CAPTURE:
            default: v.setOnClickPendingIntent(R.id.w_root, link(c, "cs4://go/capture")); break;
        }
        return v;
    }

    private static String emptyLine(Model d) {
        if (d.snap == null) return "Open Creator Studio once to start this widget";
        if (d.legacy) return "Open Creator Studio to update";
        return "Open Creator Studio to load today";
    }

    private static void day(Context c, RemoteViews v, Model d) {
        v.setOnClickPendingIntent(R.id.w_root, link(c, "cs4://go/today"));
        v.setTextViewText(R.id.w_day, d.snap == null ? "Creator Studio" : d.dayLabel);
        if (d.legacy) {
            v.setTextViewText(R.id.w_progress, d.snap.optString("progress", ""));
            v.setViewVisibility(R.id.w_streak, View.GONE);
            return;
        }
        v.setViewVisibility(R.id.w_streak, d.streak > 0 ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.w_streak, d.streak + "-day streak");
        int n = d.items.size();
        v.setTextViewText(R.id.w_progress, d.snap == null || d.stale ? emptyLine(d) : n == 0 ? "Nothing scheduled" : d.doneCount() + " of " + n + " done");
    }

    private static void upNext(Context c, RemoteViews v, Model d) {
        v.setOnClickPendingIntent(R.id.w_root, link(c, "cs4://go/today"));
        Item t = d.legacy || d.stale ? null : d.next();
        if (t == null) {
            v.setTextViewText(R.id.w_label, "UP NEXT");
            v.setTextViewText(R.id.w_when, "");
            v.setViewVisibility(R.id.w_when, View.GONE);
            v.setTextViewText(R.id.w_next, d.legacy ? d.snap.optString("next", "") : d.snap == null || d.stale ? emptyLine(d) : d.items.isEmpty() ? "Nothing scheduled today" : "All done today");
            v.setTextViewText(R.id.w_sub, d.legacy ? d.snap.optString("progress", "") : "");
            v.setViewVisibility(R.id.w_btns, View.GONE);
            return;
        }
        int m = minutes(t.at);
        v.setTextViewText(R.id.w_label, "UP NEXT" + (m >= 0 ? DOT + clock(t.at) : ""));
        v.setViewVisibility(R.id.w_when, m >= 0 ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.w_when, m >= 0 ? until(m) : "");
        v.setTextViewText(R.id.w_next, t.title);
        v.setTextViewText(R.id.w_sub, t.sub == null ? "" : t.sub);
        v.setViewVisibility(R.id.w_btns, View.VISIBLE);
        v.setTextViewText(R.id.w_start, t.startLabel != null ? t.startLabel : "Open");
        v.setOnClickPendingIntent(R.id.w_start, link(c, t.start != null ? t.start : t.link != null ? t.link : "cs4://go/today"));
        if (t.check) {
            v.setViewVisibility(R.id.w_done, View.VISIBLE);
            v.setOnClickPendingIntent(R.id.w_done, tap(c, t.id));
        } else v.setViewVisibility(R.id.w_done, View.GONE);
        if (t.link != null) v.setOnClickPendingIntent(R.id.w_root, link(c, t.link));
    }

    private static void today(Context c, RemoteViews v, Model d) {
        v.setOnClickPendingIntent(R.id.w_root, link(c, "cs4://go/today"));
        v.setTextViewText(R.id.w_day, d.snap == null ? "Creator Studio" : d.dayLabel);
        v.setViewVisibility(R.id.w_streak, !d.legacy && d.streak > 0 ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.w_streak, String.valueOf(d.streak));
        int n = d.items.size(), done = d.doneCount();
        v.setTextViewText(R.id.w_progress, d.legacy ? d.snap.optString("progress", "") : n == 0 ? "" : done + " of " + n + " done");
        v.setProgressBar(R.id.w_bar, 100, n > 0 ? Math.round(100f * done / n) : 0, false);
        boolean empty = d.snap == null || d.legacy || d.stale || n == 0;
        v.setViewVisibility(R.id.w_empty, empty ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.w_empty, d.snap == null || d.legacy || d.stale ? emptyLine(d) : "Nothing scheduled today. Tap to plan the day.");
        for (int i = 0; i < TROWS.length; i++) {
            if (empty || i >= n) {
                v.setViewVisibility(TROWS[i], View.GONE);
                v.setViewVisibility(TDIVS[i], View.GONE);
                continue;
            }
            Item t = d.items.get(i);
            v.setViewVisibility(TROWS[i], View.VISIBLE);
            v.setViewVisibility(TDIVS[i], View.VISIBLE);
            v.setTextViewText(TATS[i], minutes(t.at) >= 0 ? clock(t.at) : "Any");
            v.setTextViewText(TTITLES[i], t.done ? struck(t.title) : t.title);
            v.setTextColor(TTITLES[i], t.done ? DIMMED : CREAM);
            v.setTextViewText(TSUBS[i], t.sub == null ? "" : t.sub);
            if (t.check) {
                v.setViewVisibility(TCHKS[i], View.VISIBLE);
                v.setImageViewResource(TCHKS[i], t.done ? R.drawable.cs_check_on : R.drawable.cs_check_off);
                v.setContentDescription(TCHKS[i], t.done ? "Mark " + t.title + " not done" : "Mark " + t.title + " done");
                v.setOnClickPendingIntent(TCHKS[i], tap(c, t.id));
            } else v.setViewVisibility(TCHKS[i], View.INVISIBLE);
            v.setOnClickPendingIntent(TROWS[i], link(c, t.link != null ? t.link : "cs4://go/today"));
        }
        v.setViewVisibility(R.id.w_more, !empty && n > TROWS.length ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.w_more, "+" + (n - TROWS.length) + " more in Today");
    }

    private static void filming(Context c, RemoteViews v, Model d) {
        v.setOnClickPendingIntent(R.id.w_root, link(c, "cs4://go/shoot"));
        v.setTextViewText(R.id.w_day, d.snap == null ? "Creator Studio" : d.dayLabel);
        JSONArray f = d.legacy || d.stale || d.snap == null ? null : d.snap.optJSONArray("filming");
        int n = f == null ? 0 : f.length(), got = 0, total = 0;
        for (int i = 0; i < n; i++) { JSONObject o = f.optJSONObject(i); if (o != null) { got += o.optInt("got"); total += o.optInt("total"); } }
        String head = d.legacy ? (d.snap.optString("shoot", "").isEmpty() ? "Nothing to film" : d.snap.optString("shoot", ""))
            : d.snap == null || d.stale ? emptyLine(d) : n == 0 ? "Nothing to film today" : total > 0 ? got + " of " + total + " shots got" : n + (n == 1 ? " thing" : " things") + " to film";
        v.setTextViewText(R.id.w_shoot, head);
        for (int i = 0; i < FROWS.length; i++) {
            JSONObject o = i < n ? f.optJSONObject(i) : null;
            if (o == null) { v.setViewVisibility(FROWS[i], View.GONE); continue; }
            v.setViewVisibility(FROWS[i], View.VISIBLE);
            v.setTextViewText(FTITLES[i], o.optString("title", "Shoot"));
            int t = o.optInt("total", 0);
            v.setTextViewText(FCOUNTS[i], t > 0 ? o.optInt("got", 0) + "/" + t : "");
            String l = str(o, "link");
            v.setOnClickPendingIntent(FROWS[i], link(c, l != null ? l : "cs4://go/shoot"));
        }
    }

    private static void meals(Context c, RemoteViews v, Model d) {
        v.setOnClickPendingIntent(R.id.w_root, link(c, "cs4://go/meals"));
        JSONObject ml = d.legacy || d.stale || d.snap == null ? null : d.snap.optJSONObject("meals");
        JSONArray slots = ml == null ? null : ml.optJSONArray("slots");
        int n = slots == null ? 0 : slots.length();
        String prep = ml == null ? null : str(ml, "prep");
        v.setTextViewText(R.id.w_mhead, ml == null ? emptyLine(d) : n == 0 ? "No meals planned today" : "Planned for today");
        v.setViewVisibility(R.id.w_mprep, prep != null ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.w_mprep, prep == null ? "" : prep);
        for (int i = 0; i < MROWS.length; i++) {
            JSONObject o = i < n ? slots.optJSONObject(i) : null;
            if (o == null) { v.setViewVisibility(MROWS[i], View.GONE); continue; }
            v.setViewVisibility(MROWS[i], View.VISIBLE);
            v.setTextViewText(MSLOTS[i], o.optString("slot", ""));
            v.setTextViewText(MTITLES[i], o.optString("title", ""));
        }
    }

    private static void workout(Context c, RemoteViews v, Model d) {
        v.setOnClickPendingIntent(R.id.w_root, link(c, "cs4://go/workout"));
        JSONObject w = d.legacy || d.stale || d.snap == null ? null : d.snap.optJSONObject("workout");
        if (w == null) {
            v.setTextViewText(R.id.w_wtitle, d.snap == null || d.legacy || d.stale ? emptyLine(d) : "Rest day");
            v.setTextViewText(R.id.w_wsub, d.snap == null || d.legacy || d.stale ? "" : "No workout scheduled today");
            v.setTextViewText(R.id.w_wstart, "Workouts");
            v.setOnClickPendingIntent(R.id.w_wstart, link(c, "cs4://go/workout"));
            v.setViewVisibility(R.id.w_wdone, View.GONE);
            return;
        }
        String id = str(w, "id");
        boolean done = w.optBoolean("done", false);
        if (id != null && CSWidgetStore.pending(c, "done").contains(id)) done = !done;
        String at = str(w, "at");
        v.setTextViewText(R.id.w_wlabel, "WORKOUT" + (minutes(at) >= 0 ? DOT + clock(at) : ""));
        v.setTextViewText(R.id.w_wtitle, done ? struck(w.optString("title", "Workout")) : w.optString("title", "Workout"));
        v.setTextViewText(R.id.w_wsub, done ? "Done today. Nice." : w.optString("sub", ""));
        v.setTextViewText(R.id.w_wstart, done ? "Open" : "Start");
        String start = str(w, "start"), lk = str(w, "link");
        v.setOnClickPendingIntent(R.id.w_wstart, link(c, !done && start != null ? start : lk != null ? lk : "cs4://go/workout"));
        if (id != null) {
            v.setViewVisibility(R.id.w_wdone, View.VISIBLE);
            v.setTextViewText(R.id.w_wdone, done ? "Undo" : "Done");
            v.setOnClickPendingIntent(R.id.w_wdone, tap(c, id));
        } else v.setViewVisibility(R.id.w_wdone, View.GONE);
        if (lk != null) v.setOnClickPendingIntent(R.id.w_root, link(c, lk));
    }

    // ---------- taps ----------

    /* Opens the app on a cs4:// link, the same way the long-press shortcuts do. */
    static PendingIntent link(Context c, String url) {
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        open.setClassName(c.getPackageName(), MainActivity.class.getName());
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, url.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent tap(Context c, String id) {
        Intent i = new Intent(c, CSWidgetAction.class).setAction(CSWidgetAction.DONE).putExtra(CSWidgetAction.EXTRA_KEY, id);
        return PendingIntent.getBroadcast(c, ("done" + id).hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
