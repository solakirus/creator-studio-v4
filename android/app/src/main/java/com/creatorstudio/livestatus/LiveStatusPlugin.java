package com.creatorstudio.livestatus;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * An ongoing notification showing the day's progress.
 *
 * On Android 16 QPR1 and above it is promoted to a Live Update: top of the shade, on the lock
 * screen, and a chip in the status bar. Below that it is still an ordinary ongoing notification.
 *
 * The chip is capped at 96dp and only renders text that fits whole, so shortText should stay
 * under about seven characters. "2/5" is safe; "Day 1 - 2/5" is not.
 */
@CapacitorPlugin(name = "LiveStatus")
public class LiveStatusPlugin extends Plugin {

    private static final String CHANNEL_ID = "day_progress";
    private static final int NOTIFICATION_ID = 4201;

    /** Notification.EXTRA_REQUEST_PROMOTED_ONGOING - a string key, so no new SDK types needed. */
    private static final String EXTRA_PROMOTED = "android.requestPromotedOngoing";
    private static final String EXTRA_SHORT_TEXT = "android.shortCriticalText";

    /** What the web layer should open when the notification is tapped. */
    private static final String EXTRA_TARGET = "cs_target";

    @Override
    public void load() {
        Context ctx = getContext();
        NotificationManager mgr =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && mgr != null && mgr.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Day progress",
                    NotificationManager.IMPORTANCE_LOW);   // silent: it updates constantly
            channel.setDescription("Shows how far through today you are");
            channel.setShowBadge(false);
            mgr.createNotificationChannel(channel);
        }
    }

    @PluginMethod
    public void show(PluginCall call) {
        Context ctx = getContext();

        String title = call.getString("title", "Today");
        String body = call.getString("body", "");
        int done = call.getInt("done", 0);
        int total = call.getInt("total", 0);
        String shortText = call.getString("shortText", done + "/" + total);
        String actionLabel = call.getString("actionLabel", null);
        String target = call.getString("target", null);

        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) {
            open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (target != null) open.putExtra(EXTRA_TARGET, target);
        }
        // A distinct request code per target, or Android reuses the old extras.
        int requestCode = target == null ? 0 : Math.abs(target.hashCode()) % 100000;
        PendingIntent contentIntent = PendingIntent.getActivity(
                ctx, requestCode, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setOngoing(true)          // required for promotion
                .setOnlyAlertOnce(true)    // updating must not buzz
                .setSilent(true)
                .setShowWhen(false)
                .setContentIntent(contentIntent)
                .setProgress(total > 0 ? total : 1, done, false);

        if (actionLabel != null) {
            builder.addAction(0, actionLabel, contentIntent);
        }

        // Ask for Live Update treatment. Ignored on older versions.
        Bundle extras = new Bundle();
        extras.putBoolean(EXTRA_PROMOTED, true);
        builder.addExtras(extras);

        Notification notification = builder.build();

        // Status bar chip text is Android 16+, and is a nicety rather than a requirement.
        if (Build.VERSION.SDK_INT >= 36) {
            try {
                notification.extras.putCharSequence(EXTRA_SHORT_TEXT, shortText);
            } catch (Throwable ignored) { }
        }

        try {
            NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, notification);
            JSObject ret = new JSObject();
            ret.put("shown", true);
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("Notification permission not granted", e);
        }
    }

    /**
     * Fires when a notification is tapped while the app is already running.
     * The web layer may be foreground and idle, so it never notices on its own —
     * push the target at it rather than waiting to be asked.
     */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null) return;
        String target = intent.getStringExtra(EXTRA_TARGET);
        if (target == null) return;
        intent.removeExtra(EXTRA_TARGET);
        JSObject data = new JSObject();
        data.put("target", target);
        notifyListeners("openTarget", data, true);
    }

    /**
     * Returns whatever the notification asked us to open, then forgets it,
     * so a later resume does not navigate again.
     */
    @PluginMethod
    public void consumeTarget(PluginCall call) {
        JSObject ret = new JSObject();
        String target = null;
        try {
            Intent intent = getActivity().getIntent();
            if (intent != null) {
                target = intent.getStringExtra(EXTRA_TARGET);
                if (target != null) intent.removeExtra(EXTRA_TARGET);
            }
        } catch (Throwable ignored) { }
        ret.put("target", target == null ? "" : target);
        call.resolve(ret);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
        call.resolve();
    }

    @PluginMethod
    public void isPromotable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", Build.VERSION.SDK_INT >= 36);
        call.resolve(ret);
    }
}
