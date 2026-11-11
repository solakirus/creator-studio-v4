package com.creatorstudio.v2;

/* The filming one: leads with what you are shooting today rather than the task
 * tally, and taps straight through to that day's sequences.
 */
public class CSWidgetShoot extends CSWidgetBase {
    @Override protected int layoutId() { return R.layout.cs_widget_shoot; }
    @Override protected String link() { return "cs3://go/shoot"; }
}
