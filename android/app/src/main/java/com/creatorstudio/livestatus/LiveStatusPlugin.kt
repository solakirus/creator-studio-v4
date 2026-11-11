package com.creatorstudio.livestatus

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * An ongoing notification showing the day's progress.
 *
 * On Android 16 QPR1 (API 36.1) and above it is promoted to a Live Update, which puts it at the
 * top of the shade, on the lock screen, and as a chip in the status bar. Below that it is still a
 * perfectly good ongoing notification — it just isn't promoted.
 *
 * The chip is at most 96dp wide and only renders text that fits whole, so shortText should stay
 * under about seven characters. "2/5" is safe; "Day 1 · 2/5" is not.
 */
@CapacitorPlugin(name = "LiveStatus")
class LiveStatusPlugin : Plugin() {

    companion object {
        private const val CHANNEL_ID = "day_progress"
        private const val NOTIFICATION_ID = 4201
        /** Notification.EXTRA_REQUEST_PROMOTED_ONGOING — a string key, so no compileSdk 36.1 needed. */
        private const val EXTRA_PROMOTED = "android.requestPromotedOngoing"
    }

    override fun load() {
        val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && mgr.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Day progress",
                NotificationManager.IMPORTANCE_LOW      // silent: it updates constantly
            ).apply {
                description = "Shows how far through today you are"
                setShowBadge(false)
            }
            mgr.createNotificationChannel(channel)
        }
    }

    @PluginMethod
    fun show(call: PluginCall) {
        val title = call.getString("title") ?: "Today"
        val body = call.getString("body") ?: ""
        val done = call.getInt("done") ?: 0
        val total = call.getInt("total") ?: 0
        val shortText = call.getString("shortText") ?: "$done/$total"
        val actionLabel = call.getString("actionLabel")

        val open = packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            context, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setOngoing(true)                 // required for promotion
            .setOnlyAlertOnce(true)           // updating must not buzz
            .setSilent(true)
            .setShowWhen(false)
            .setContentIntent(contentIntent)
            .setProgress(if (total > 0) total else 1, done, false)

        if (actionLabel != null) {
            builder.addAction(0, actionLabel, contentIntent)
        }

        // Ask for Live Update treatment. Ignored on older versions.
        builder.addExtras(android.os.Bundle().apply { putBoolean(EXTRA_PROMOTED, true) })

        val notification = builder.build()

        // setShortCriticalText is API 36. Reflection keeps this compiling on lower compileSdk.
        if (Build.VERSION.SDK_INT >= 36) {
            try {
                notification.extras.putCharSequence("android.shortCriticalText", shortText)
            } catch (_: Throwable) { /* chip text is a nicety, not a requirement */ }
        }

        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
            call.resolve(JSObject().put("shown", true))
        } catch (e: SecurityException) {
            // POST_NOTIFICATIONS was refused
            call.reject("Notification permission not granted", e)
        }
    }

    @PluginMethod
    fun clear(call: PluginCall) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
        call.resolve()
    }

    @PluginMethod
    fun isPromotable(call: PluginCall) {
        call.resolve(JSObject().put("value", Build.VERSION.SDK_INT >= 36))
    }
}
