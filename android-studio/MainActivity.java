/*
 * The tablet app: one full-screen page showing the checklist, which is the
 * file app/src/main/assets/index.html. Plain Android, no extra libraries,
 * so it builds with nothing but Android Studio.
 *
 * - The screen stays on while the app is open, however long without a tap.
 * - Ticks and night mode are remembered (the page's own storage).
 * - Back button: closes the pop-up, else goes back a page, else leaves the app.
 *
 * The first line must match the project's package name.
 */
package com.bdolach.sufa;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        /* Keep the screen on while the app is on the screen */
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); /* remembers ticks and night mode */
        web.setWebViewClient(new WebViewClient()); /* links open inside the app */

        /* The page sits inside a dark frame that keeps it clear of the */
        /* status bar and the navigation bar. */
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.parseColor("#1f2933"));
        frame.addView(web);
        frame.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                if (Build.VERSION.SDK_INT >= 30) {
                    android.graphics.Insets bars = insets.getInsets(
                            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                } else {
                    v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                            insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
                }
                return insets;
            }
        });
        setContentView(frame);

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl("file:///android_asset/index.html");
        }

        /* Back button on Android 13 and newer */
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }
    }

    /* Back button on Android 12 and older */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        goBack();
    }

    /* Asks the page to go back; it answers false when there is nothing to */
    /* go back to, and then the app closes. */
    private void goBack() {
        web.evaluateJavascript("window.bdolachBack ? window.bdolachBack() : false", result -> {
            if (!"true".equals(result)) {
                finish();
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }
}
