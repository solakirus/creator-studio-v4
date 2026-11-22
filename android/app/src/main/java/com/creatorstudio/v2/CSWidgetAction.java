package com.creatorstudio.v2;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/* A check box or Done on a widget, without opening the app. The tap waits in
 * CSWidgetStore until the app runs (right away if it's open) and is saved the
 * normal way, so it syncs like any other change. Tap again first to undo. */
public class CSWidgetAction extends BroadcastReceiver {

    static final String DONE = "cs4.widget.DONE";
    static final String EXTRA_KEY = "key";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null || !DONE.equals(intent.getAction())) return;
        String id = intent.getStringExtra(EXTRA_KEY);
        if (id == null) return;
        CSWidgetStore.tap(ctx, "done", id, true);
        CSWidgetRender.updateAll(ctx);
        CSWidgetPlugin.queueChanged();
    }
}
