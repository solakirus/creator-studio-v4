package com.creatorstudio.v2;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.creatorstudio.livestatus.LiveStatusPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LiveStatusPlugin.class);
        registerPlugin(CSWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        // singleTask means a tap on the notification arrives here rather than
        // replacing the launch intent — keep it so the plugin can read the target.
        setIntent(intent);
        super.onNewIntent(intent);
    }
}