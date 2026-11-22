package com.creatorstudio.v2;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * What the widgets show, kept on the phone in app-private storage.
 *
 * snapshot  what the app last sent (today, up next, filming, meals, workout)
 * queue     check-box taps on a widget that the app hasn't recorded yet
 * applying  check-offs the app has taken but not yet confirmed with a new snapshot
 */
final class CSWidgetStore {

    private static final String PREFS = "cs_widget_v2";

    private CSWidgetStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONObject snapshot(Context c) {
        String s = prefs(c).getString("snapshot", null);
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (JSONException e) {
            return null;
        }
    }

    /** A fresh snapshot already includes every check-off the app applied. */
    static synchronized void saveSnapshot(Context c, String json) {
        prefs(c).edit().putString("snapshot", json).remove("applying").commit();
    }

    private static JSONArray array(Context c, String key) {
        try {
            return new JSONArray(prefs(c).getString(key, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** Items with a Done (or Skip) tap that the latest snapshot doesn't know about yet. */
    static synchronized Set<String> pending(Context c, String type) {
        Set<String> out = new HashSet<>();
        for (String key : new String[] { "queue", "applying" }) {
            JSONArray a = array(c, key);
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null && type.equals(o.optString("type"))) out.add(o.optString("key"));
            }
        }
        return out;
    }

    /** Add a tap, or take it back if it's already waiting (toggle=false: add only once). */
    static synchronized void tap(Context c, String type, String key, boolean toggle) {
        JSONArray q = array(c, "queue");
        JSONArray next = new JSONArray();
        boolean removed = false;
        for (int i = 0; i < q.length(); i++) {
            JSONObject o = q.optJSONObject(i);
            if (o != null && type.equals(o.optString("type")) && key.equals(o.optString("key"))) {
                removed = true;
                if (!toggle) next.put(o);
            } else if (o != null) {
                next.put(o);
            }
        }
        if (!removed) {
            try {
                JSONObject o = new JSONObject();
                o.put("type", type);
                o.put("key", key);
                o.put("date", CSWidgetRender.todayIso());
                o.put("at", System.currentTimeMillis());
                next.put(o);
            } catch (JSONException ignored) {
                // a plain string key always fits
            }
        }
        prefs(c).edit().putString("queue", next.toString()).commit();
    }

    /** Hand the queue to the app. The items stay shown as done until the next snapshot. */
    static synchronized JSONArray takeQueue(Context c) {
        JSONArray q = array(c, "queue");
        if (q.length() == 0) return q;
        JSONArray applying = array(c, "applying");
        for (int i = 0; i < q.length(); i++) applying.put(q.opt(i));
        prefs(c).edit().putString("queue", "[]").putString("applying", applying.toString()).commit();
        return q;
    }
}
