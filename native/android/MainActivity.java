// The app's Android screen. The APK build (.github/workflows/android.yml)
// copies this over the MainActivity that Capacitor generates.
//
// Keeps the screen on for as long as the app is on the screen, however long
// it goes without a tap. This is set here, natively, when the app starts, so it
// doesn't depend on any JavaScript running first.
//
// The package must match "appId" in capacitor.config.json.
package com.bdolach.sufa;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
