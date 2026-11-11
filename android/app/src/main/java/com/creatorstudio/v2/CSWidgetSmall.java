package com.creatorstudio.v2;

/* The small one: the day count and the tally, nothing else. For people who
 * want the number on the home screen without a panel. Taps to Today.
 */
public class CSWidgetSmall extends CSWidgetBase {
    @Override protected int layoutId() { return R.layout.cs_widget_small; }
    @Override protected String link() { return "cs3://go/today"; }
}
