package com.creatorstudio.v2;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/* What every Creator Studio widget has in common: it redraws from the latest
 * snapshot the app wrote (CSWidgetRender). Each subclass only says which kind
 * it is. Android identifies a placed widget by its class name, so the three
 * original classes (CSWidgetProvider, CSWidgetSmall, CSWidgetShoot) keep their
 * names: widgets already on a home screen stay there and get the new look. */
public abstract class CSWidgetBase extends AppWidgetProvider {

    abstract int kind();

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        CSWidgetRender.update(ctx, mgr, ids, kind());
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle options) {
        CSWidgetRender.update(ctx, mgr, new int[] { id }, kind());
    }
}
