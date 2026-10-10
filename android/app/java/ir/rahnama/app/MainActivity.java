package ir.rahnama.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * رهنما — پوستهٔ اندروید
 * ---------------------------------------------------------------------------
 * کل سایت داخل خود اپ ذخیره شده است (assets/site) و از میزبان داخلی
 * «appassets.androidplatform.net» سرو می‌شود. چرا این میزبان؟
 * چون خودِ کد سایت (hk-auth.js) همین نام را به‌عنوان «حالت آفلاین/اپ» می‌شناسد
 * و حساب کاربری را روی دستگاه می‌سازد. مزیت دیگر: منشأ https است، پس
 * localStorage و fetch درون‌صفحه‌ای درست کار می‌کنند (برخلاف file://).
 *
 * هیچ کتابخانهٔ بیرونی (AndroidX) لازم نیست؛ همه‌چیز با خودِ اندروید.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final String UA_TAG = " RahnamaApp/1.0";

    private WebView web;
    private ProgressBar bar;
    private TextView splash;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFFF5F6FB);

        web = new WebView(this);
        web.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(0xFFF5F6FB);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        try {
            s.setUserAgentString(s.getUserAgentString() + UA_TAG);
        } catch (Throwable ignored) { }

        splash = new TextView(this);
        splash.setText("رهنما\nدر حال آماده‌سازی…");
        splash.setTextColor(0xFF454A63);
        splash.setTextSize(16f);
        splash.setGravity(Gravity.CENTER);
        splash.setBackgroundColor(0xFFF5F6FB);

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        FrameLayout.LayoutParams barLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 8);
        barLp.gravity = Gravity.TOP;
        bar.setLayoutParams(barLp);
        bar.setMax(100);
        bar.setProgress(0);

        root.addView(web);
        root.addView(splash);
        root.addView(bar);
        setContentView(root);

        web.setWebViewClient(new WebViewClient() {

            private WebResourceResponse serve(Uri u) {
                if (u == null) return null;
                if (!HOST.equals(u.getHost())) return null;   // بقیه: مثل مرورگر عادی

                String p = u.getPath();
                if (p == null || p.length() == 0 || "/".equals(p)) p = "/index.html";

                // مسیرهای API روی سرور وجود دارد، نه داخل اپ.
                // ۴۰۴ می‌دهیم تا سایت خودکار به «حالت محلی» برگردد.
                if (p.startsWith("/api/")) {
                    return new WebResourceResponse("application/json", "utf-8",
                            404, "Not Found", noStore(), stream("{\"error\":\"app-offline\"}"));
                }

                String asset = "site" + p;
                InputStream in = openAsset(asset);
                if (in == null && !p.endsWith(".html") && p.indexOf('.') < 0) {
                    in = openAsset(asset + ".html");
                }
                if (in == null && !p.endsWith("/")) {
                    in = openAsset("site" + p + "/index.html");
                }
                if (in == null) {
                    return new WebResourceResponse("text/plain", "utf-8",
                            404, "Not Found", noCache(), stream("404"));
                }
                return new WebResourceResponse(mimeOf(p), "utf-8", 200, "OK", noStore(), in);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                try { return serve(req.getUrl()); } catch (Throwable t) { return null; }
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, String url) {
                try { return serve(Uri.parse(url)); } catch (Throwable t) { return null; }
            }

            private boolean handle(Uri u) {
                if (u == null) return false;
                String h = u.getHost();
                if (h == null || HOST.equals(h)) return false;   // داخل اپ
                if ("http".equals(u.getScheme()) || "https".equals(u.getScheme())) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, u);
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                    } catch (Throwable ignored) { }
                }
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return handle(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return handle(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                try {
                    if (splash != null) { splash.setVisibility(View.GONE); splash = null; }
                } catch (Throwable ignored) { }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int p) {
                try {
                    if (bar == null) return;
                    bar.setProgress(p);
                    bar.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
                } catch (Throwable ignored) { }
            }
        });

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try { getWindow().setStatusBarColor(0xFF6D5EFC); } catch (Throwable ignored) { }
        }

        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    private InputStream openAsset(String path) {
        try {
            return getAssets().open(path);
        } catch (IOException e) {
            return null;
        }
    }

    private static InputStream stream(String s) {
        return new ByteArrayInputStream(s.getBytes());
    }

    private static Map<String, String> noStore() {
        Map<String, String> m = new HashMap<String, String>();
        m.put("Cache-Control", "no-store");
        m.put("Access-Control-Allow-Origin", "*");
        return m;
    }

    private static Map<String, String> noCache() {
        return Collections.emptyMap();
    }

    private static String mimeOf(String p) {
        String q = p.toLowerCase();
        if (q.endsWith(".html") || q.endsWith(".htm")) return "text/html";
        if (q.endsWith(".js") || q.endsWith(".mjs")) return "application/javascript";
        if (q.endsWith(".css")) return "text/css";
        if (q.endsWith(".json") || q.endsWith(".webmanifest")) return "application/json";
        if (q.endsWith(".svg")) return "image/svg+xml";
        if (q.endsWith(".png")) return "image/png";
        if (q.endsWith(".jpg") || q.endsWith(".jpeg")) return "image/jpeg";
        if (q.endsWith(".webp")) return "image/webp";
        if (q.endsWith(".gif")) return "image/gif";
        if (q.endsWith(".woff2")) return "font/woff2";
        if (q.endsWith(".woff")) return "font/woff";
        if (q.endsWith(".ttf")) return "font/ttf";
        if (q.endsWith(".mp3")) return "audio/mpeg";
        if (q.endsWith(".mp4")) return "video/mp4";
        if (q.endsWith(".xml")) return "application/xml";
        if (q.endsWith(".txt")) return "text/plain";
        if (q.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        try {
            if (web != null) {
                web.loadUrl("about:blank");
                web.destroy();
                web = null;
            }
        } catch (Throwable ignored) { }
        super.onDestroy();
    }
}
