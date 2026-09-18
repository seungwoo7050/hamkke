package com.hamkke.app;

import com.getcapacitor.BridgeActivity;
import com.hamkke.app.widget.WidgetRefresher;

public class MainActivity extends BridgeActivity {
    @Override
    public void onPause() {
        super.onPause();
        WidgetRefresher.refresh(this);
    }
}
