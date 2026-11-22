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
import android.widget.ImageView;
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

        ImageView heroEmblem = new ImageView(this);
        heroEmblem.setImageResource(R.drawable.ic_launcher);
        heroEmblem.setContentDescription("Emblema de Clash of Izzy, herói com espada e coroa");
        heroEmblem.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams heroParams = new LinearLayout.LayoutParams(dp(118), dp(118));
        heroParams.bottomMargin = dp(14);
        loadingPanel.addView(heroEmblem, heroParams);

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
        offlinePanel.setContentDescription("Recuperação de conexão de Clash of Izzy");
        GradientDrawable recoveryBackground = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[] { Color.rgb(9, 20, 32), Color.rgb(17, 34, 49) });
        offlinePanel.setBackground(recoveryBackground);

        LinearLayout recoveryCard = new LinearLayout(this);
        recoveryCard.setOrientation(LinearLayout.VERTICAL);
        recoveryCard.setGravity(Gravity.CENTER);
        recoveryCard.setPadding(dp(22), dp(27), dp(22), dp(25));
        GradientDrawable recoveryCardBackground = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[] { Color.rgb(29, 50, 62), Color.rgb(14, 27, 44) });
        recoveryCardBackground.setCornerRadius(dp(18));
        recoveryCardBackground.setStroke(dp(1), Color.rgb(198, 162, 93));
        recoveryCard.setBackground(recoveryCardBackground);

        ImageView emblem = new ImageView(this);
        emblem.setImageResource(R.drawable.ic_launcher);
        emblem.setContentDescription("Emblema de herói medieval com espada");
        emblem.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams emblemParams = new LinearLayout.LayoutParams(dp(100), dp(100));
        emblemParams.bottomMargin = dp(10);
        recoveryCard.addView(emblem, emblemParams);

        TextView title = new TextView(this);
        title.setText("CLASH OF IZZY");
        title.setTextColor(Color.rgb(244, 210, 143));
        title.setLetterSpacing(0.07f);
        title.setTextSize(27);
        title.setGravity(Gravity.CENTER);
        recoveryCard.addView(title);

        TextView recoverySubtitle = new TextView(this);
        recoverySubtitle.setText("Eldoria está fora de alcance");
        recoverySubtitle.setTextColor(Color.rgb(240, 231, 209));
        recoverySubtitle.setTextSize(18);
        recoverySubtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subtitleParams.topMargin = dp(16);
        recoveryCard.addView(recoverySubtitle, subtitleParams);

        TextView details = new TextView(this);
        details.setText("Não foi possível abrir o reino. Verifique a conexão e tente novamente. Seu progresso permanece salvo no servidor.");
        details.setTextColor(Color.rgb(210, 222, 231));
        details.setTextSize(15);
        details.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        textParams.topMargin = dp(10);
        textParams.bottomMargin = dp(22);
        recoveryCard.addView(details, textParams);

        Button retry = new Button(this);
        retry.setText("Tentar novamente");
        retry.setAllCaps(false);
        retry.setTextColor(Color.rgb(18, 28, 38));
        retry.setTextSize(16);
        retry.setMinimumHeight(dp(54));
        GradientDrawable retryBackground = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[] { Color.rgb(251, 221, 157), Color.rgb(212, 171, 98) });
        retryBackground.setCornerRadius(dp(9));
        retryBackground.setStroke(dp(1), Color.rgb(255, 239, 197));
        retry.setBackground(retryBackground);
        retry.setOnClickListener(v -> {
            offlinePanel.setVisibility(View.GONE);
            hasLoadedPage = false;
            loadingPanel.setVisibility(View.VISIBLE);
            if (webView != null) webView.loadUrl(GAME_URL);
        });
        recoveryCard.addView(retry, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView recoveryHint = new TextView(this);
        recoveryHint.setText("Internet necessária para sincronizar batalhas e construções");
        recoveryHint.setTextColor(Color.rgb(174, 194, 205));
        recoveryHint.setTextSize(12);
        recoveryHint.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams hintParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        hintParams.topMargin = dp(18);
        recoveryCard.addView(recoveryHint, hintParams);

        int availableWidth = Math.max(dp(240),
                getResources().getDisplayMetrics().widthPixels - dp(56));
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                Math.min(dp(420), availableWidth), ViewGroup.LayoutParams.WRAP_CONTENT);
        cardParams.gravity = Gravity.CENTER;
        offlinePanel.addView(recoveryCard, cardParams);
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

    // Evita manter renderização WebGL e tarefas do WebView rodando em segundo plano.
    // onResume devolve o WebView ao estado normal sem recarregar o reino.
    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
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
