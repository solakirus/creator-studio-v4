package com.creatorstudio.v2;

/* The day widget: day count, how many tasks are done, the next one, and what
 * is left to film. Tapping opens Today, because that is the list the numbers
 * are about.
 *
 * Named CSWidgetProvider rather than CSWidgetDay so that anyone who already has
 * it on a home screen keeps it — Android identifies a widget by its class name,
 * and renaming this would silently remove it.
 */
public class CSWidgetProvider extends CSWidgetBase {
    @Override protected int layoutId() { return R.layout.cs_widget; }
    @Override protected String link() { return "cs3://go/today"; }
}
