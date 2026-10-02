package com.hamkke.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.hamkke.app.billing.AlternativeBillingPlugin;
import com.hamkke.app.widget.WidgetRefresher;

public class MainActivity extends BridgeActivity {
    // 앱 안에 둔 플러그인은 브리지가 만들어지기 전(super.onCreate 전)에 등록한다.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlternativeBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        super.onPause();
        WidgetRefresher.refresh(this);
    }
}
