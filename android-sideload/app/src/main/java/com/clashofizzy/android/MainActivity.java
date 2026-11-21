package com.clashofizzy.android;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String GAME_URL =
            "https://clash-of-izzy.jorgepereiragha.workers.dev/kingdom.html";
    private static final String GAME_HOST = "clash-of-izzy.jorgepereiragha.workers.dev";

    private FrameLayout root;
    private WebView webView;
    private LinearLayout offlinePanel;
    private LinearLayout loadingPanel;
    private boolean hasLoadedPage;
    private ProgressBar progress;
    private boolean mainFrameFailed;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16, 26, 43));
        getWindow().setNavigationBarColor(Color.rgb(16, 26, 43));
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16, 26, 43));
        setContentView(root);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16, 26, 43));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); // O motor web do jogo requer JavaScript.
        settings.setDomStorageEnabled(true); // Sessão e preferências da conta.
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        // This small native splash prevents a blank screen before WebView has painted.
        // Assets stay local; no additional network requests or WebGL contexts.
        loadingPanel = new LinearLayout(this);
        loadingPanel.setOrientation(LinearLayout.VERTICAL);
        loadingPanel.setGravity(Gravity.CENTER);
        loadingPanel.setPadding(dp(30), dp(24), dp(30), dp(24));
        GradientDrawable loadingGradient = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[] { Color.rgb(7, 18, 29), Color.rgb(28, 49, 59) });
        loadingPanel.setBackground(loadingGradient);

        TextView loadingTitle = new TextView(this);
        loadingTitle.setText("CLASH OF IZZY");
        loadingTitle.setTextColor(Color.rgb(242, 206, 133));
        loadingTitle.setTextSize(29);
        loadingTitle.setLetterSpacing(0.08f);
        loadingTitle.setGravity(Gravity.CENTER);
        loadingPanel.addView(loadingTitle, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView loadingMessage = new TextView(this);
        loadingMessage.setText("Preparando Eldoria e sincronizando seu reino…");
        loadingMessage.setTextColor(Color.rgb(216, 228, 233));
        loadingMessage.setTextSize(14);
        loadingMessage.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        messageParams.topMargin = dp(14);
        loadingPanel.addView(loadingMessage, messageParams);

        ProgressBar loadingSpinner = new ProgressBar(this);
        loadingSpinner.setIndeterminateTintList(ColorStateList.valueOf(Color.rgb(233, 200, 120)));
        LinearLayout.LayoutParams spinnerParams = new LinearLayout.LayoutParams(dp(44), dp(44));
        spinnerParams.topMargin = dp(22);
        spinnerParams.gravity = Gravity.CENTER_HORIZONTAL;
        loadingPanel.addView(loadingSpinner, spinnerParams);
        root.addView(loadingPanel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progress == null) return;
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if (isGameUrl(uri)) return false;
                openOutsideApp(uri);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                mainFrameFailed = false;
                offlinePanel.setVisibility(View.GONE);
                if (!hasLoadedPage) loadingPanel.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    mainFrameFailed = true;
                    loadingPanel.setVisibility(View.GONE);
                    offlinePanel.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                            WebResourceResponse errorResponse) {
                // Falhas de backend não acionam onReceivedError.
                // Não bloquear a interface por falhas de subrecursos ou APIs.
                if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                    mainFrameFailed = true;
                    loadingPanel.setVisibility(View.GONE);
                    offlinePanel.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (progress != null) progress.setVisibility(View.GONE);
                loadingPanel.setVisibility(View.GONE);
                if (!mainFrameFailed) {
                    offlinePanel.setVisibility(View.GONE);
                    hasLoadedPage = true;
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler,
                                           SslError error) {
                handler.cancel(); // Nunca ignorar certificado inválido.
                mainFrameFailed = true;
                loadingPanel.setVisibility(View.GONE);
                offlinePanel.setVisibility(View.VISIBLE);
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                root.removeView(view);
                view.destroy();
                webView = null;
                // Recuperação controlada após encerramento do processo WebView.
                recreate();
                return true;
            }
        });

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(ColorStateList.valueOf(Color.rgb(233, 200, 120)));
        progress.setProgressBackgroundTintList(ColorStateList.valueOf(Color.rgb(38, 62, 72)));
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP);
        root.addView(progress, progressParams);

        offlinePanel = new LinearLayout(this);
        offlinePanel.setOrientation(LinearLayout.VERTICAL);
        offlinePanel.setGravity(Gravity.CENTER);
        offlinePanel.setPadding(dp(28), dp(24), dp(28), dp(24));
        offlinePanel.setBackgroundColor(Color.rgb(16, 26, 43));

        TextView title = new TextView(this);
        title.setText("Clash of Izzy");
        title.setTextColor(Color.rgb(237, 198, 125));
        title.setTextSize(26);
        title.setGravity(Gravity.CENTER);
        offlinePanel.addView(title);

        TextView details = new TextView(this);
        details.setText("Não foi possível carregar o jogo. Verifique sua conexão e tente novamente. Seu progresso no servidor não será apagado.");
        details.setTextColor(Color.WHITE);
        details.setTextSize(16);
        details.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        textParams.topMargin = dp(14);
        textParams.bottomMargin = dp(18);
        offlinePanel.addView(details, textParams);

        Button retry = new Button(this);
        retry.setText("Tentar novamente");
        retry.setOnClickListener(v -> {
            offlinePanel.setVisibility(View.GONE);
            hasLoadedPage = false;
            loadingPanel.setVisibility(View.VISIBLE);
            if (webView != null) webView.loadUrl(GAME_URL);
        });
        offlinePanel.addView(retry);
        root.addView(offlinePanel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        offlinePanel.setVisibility(View.GONE);
        webView.loadUrl(GAME_URL);
    }

    private boolean isGameUrl(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
                && GAME_HOST.equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private void openOutsideApp(Uri uri) {
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme)
                && !"http".equalsIgnoreCase(scheme)
                && !"mailto".equalsIgnoreCase(scheme)) {
            Toast.makeText(this, "Link externo não suportado.", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Nenhum aplicativo disponível para abrir o link.",
                    Toast.LENGTH_SHORT).show();
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
