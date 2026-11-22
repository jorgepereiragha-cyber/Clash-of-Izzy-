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
import org.json.JSONObject;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.CustomCredential;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

public final class MainActivity extends Activity {
    private static final String BROWSER_STATE_KEY = "coi.saved.webview";
    private static final String BROWSER_URL_KEY = "coi.saved.webview.url";
    private static final String GAME_URL =
            "https://clash-of-izzy.jorgepereiragha.workers.dev/kingdom.html";
    private static final String GAME_HOST = "clash-of-izzy.jorgepereiragha.workers.dev";
    private boolean googleSignInInProgress = false;
    // Evita loop de reinicio quando o processo WebView falha repetidamente (ex.: GPU sem memoria).
    private static final long RENDERER_RESTART_WINDOW_MS = 60_000L;
    private static long lastRendererFailureMs = 0L;
    private static int recentRendererFailures = 0;


    private FrameLayout root;
    private WebView webView;
    private WebView popupWebView;
    private LinearLayout offlinePanel;
    private LinearLayout loadingPanel;
    private boolean hasLoadedPage;
    private ProgressBar progress;
    private boolean mainFrameFailed;
    // Limita telas de abertura presas em rede lenta, DNS ou Worker indisponivel.
    private static final long STARTUP_TIMEOUT_MS = 45_000L;
    private Runnable pendingLoadTimeout;

    // Fullscreen game shell: system bars remain available through edge swipes.
    // Keep the WebView and its CSS safe-area insets responsible for hit targets.
    private void enterImmersiveGameMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.view.WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(
                        android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(android.view.WindowInsets.Type.statusBars()
                        | android.view.WindowInsets.Type.navigationBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveGameMode();
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(8, 24, 49));
        getWindow().setNavigationBarColor(Color.rgb(8, 24, 49));
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 24, 49));
        setContentView(root);
        enterImmersiveGameMode();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(8, 24, 49));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); // O motor web do jogo requer JavaScript.
        // The trusted site detects the Android shell and requests Credential Manager,
        // never a Google OAuth redirect embedded in Android WebView.
        settings.setUserAgentString(settings.getUserAgentString() + " ClashOfIzzyAndroid/1");
        settings.setDomStorageEnabled(true); // Sessão e preferências da conta.
        // HUD HTML usa escalonamento responsivo CSS; validar acessibilidade em aparelhos reais.
        settings.setTextZoom(100);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        // Checkout Mercado Pago abre uma janela apos o clique e recebe a URL depois da API.
        // O destino HTTPS e enviado ao navegador externo, nunca renderizado no app.
        settings.setSupportMultipleWindows(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
            // Prioridade de renderer apenas enquanto a atividade estiver visível.
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
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
                new int[] { Color.rgb(3, 13, 32), Color.rgb(15, 49, 103), Color.rgb(4, 17, 36) });
        loadingPanel.setBackground(loadingGradient);

        TextView royalOverline = new TextView(this);
        royalOverline.setText("A ERA DOS REIS");
        royalOverline.setTextColor(Color.rgb(245, 207, 134));
        royalOverline.setTextSize(12);
        royalOverline.setLetterSpacing(0.19f);
        royalOverline.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams royalParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        royalParams.bottomMargin = dp(18);
        loadingPanel.addView(royalOverline, royalParams);

        // Moldura de ouro leve, nativa e sem imagens remotas ou contexto WebGL extra.
        GradientDrawable emblemBorder = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[] { Color.rgb(255, 232, 169), Color.rgb(197, 136, 42), Color.rgb(119, 72, 24) });
        emblemBorder.setCornerRadius(dp(26));
        FrameLayout royalFrame = new FrameLayout(this);
        royalFrame.setPadding(dp(5), dp(5), dp(5), dp(5));
        royalFrame.setBackground(emblemBorder);
        ImageView heroEmblem = new ImageView(this);
        heroEmblem.setImageResource(R.drawable.royal_king);
        heroEmblem.setContentDescription("Rei guerreiro do Clash of Izzy com espada, coroa e brasão dourado");
        heroEmblem.setScaleType(ImageView.ScaleType.FIT_CENTER);
        royalFrame.addView(heroEmblem, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        LinearLayout.LayoutParams heroParams = new LinearLayout.LayoutParams(dp(152), dp(152));
        heroParams.bottomMargin = dp(20);
        loadingPanel.addView(royalFrame, heroParams);

        TextView loadingTitle = new TextView(this);
        loadingTitle.setText("CLASH OF IZZY");
        loadingTitle.setTextColor(Color.rgb(255, 219, 147));
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

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog,
                                          boolean isUserGesture, android.os.Message resultMsg) {
                // O checkout primeiro abre about:blank de forma sincrona ao toque.
                // O destino e recebido em seguida; nao o carregue dentro da WebView do jogo.
                if (!isUserGesture || resultMsg == null || popupWebView != null) return false;
                WebView popup = new WebView(MainActivity.this);
                popupWebView = popup;
                WebSettings popupSettings = popup.getSettings();
                popupSettings.setJavaScriptEnabled(false);
                popupSettings.setAllowFileAccess(false);
                popupSettings.setAllowContentAccess(false);
                popupSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
                popup.setVisibility(View.INVISIBLE);
                final boolean[] handled = { false };
                popup.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        root.post(() -> closePopup(window));
                    }
                });
                popup.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                        if (!request.isForMainFrame()) return true;
                        return handlePopupNavigation(popup, request.getUrl(), handled);
                    }

                    @Override
                    public void onPageStarted(WebView child, String url, android.graphics.Bitmap favicon) {
                        // Fallback quando a navegacao da janela nao chama o override.
                        handlePopupNavigation(popup, Uri.parse(url), handled);
                    }
                });
                // Manter a janela tecnica associada a hierarquia, sem exibir o checkout no app.
                root.addView(popup, new FrameLayout.LayoutParams(1, 1));
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public void onCloseWindow(WebView window) {
                root.post(() -> closePopup(window));
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if ("clashofizzy-google".equalsIgnoreCase(uri.getScheme())) {
                    if (view.getUrl() != null && isGameUrl(Uri.parse(view.getUrl())) &&
                            "signin".equalsIgnoreCase(uri.getHost())) {
                        startNativeGoogleSignIn(uri);
                    } else {
                        googleError("Solicitação Google fora da página oficial bloqueada.");
                    }
                    return true;
                }
                if (isGameUrl(uri)) return false;
                openOutsideApp(uri);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                mainFrameFailed = false;
                offlinePanel.setVisibility(View.GONE);
                if (!hasLoadedPage) {
                    loadingPanel.setVisibility(View.VISIBLE);
                    scheduleStartupTimeout();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    cancelStartupTimeout();
                    mainFrameFailed = true;
                    loadingPanel.setVisibility(View.GONE);
                    offlinePanel.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                            WebResourceResponse errorResponse) {
                // Falhas HTTP da pagina principal (inclusive 404) nao acionam onReceivedError.
                // Não bloquear a interface por falhas de subrecursos ou APIs.
                if (request.isForMainFrame() && errorResponse.getStatusCode() >= 400) {
                    cancelStartupTimeout();
                    mainFrameFailed = true;
                    loadingPanel.setVisibility(View.GONE);
                    offlinePanel.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                cancelStartupTimeout();
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
                // Uma imagem/recurso externo com TLS invalido nao deve derrubar a pagina principal.
                String failedUrl = error != null ? error.getUrl() : null;
                String pageUrl = view.getUrl();
                String originalUrl = view.getOriginalUrl();
                if (failedUrl != null && pageUrl != null &&
                        !failedUrl.equals(pageUrl) && !failedUrl.equals(originalUrl)) return;
                cancelStartupTimeout();
                mainFrameFailed = true;
                loadingPanel.setVisibility(View.GONE);
                offlinePanel.setVisibility(View.VISIBLE);
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                cancelStartupTimeout();
                long now = android.os.SystemClock.elapsedRealtime();
                recentRendererFailures = now - lastRendererFailureMs <= RENDERER_RESTART_WINDOW_MS
                        ? recentRendererFailures + 1 : 1;
                lastRendererFailureMs = now;
                root.removeView(view);
                view.destroy();
                webView = null;
                // No maximo duas recuperacoes em um minuto: evita loop e aquecimento do aparelho.
                if (recentRendererFailures <= 2) {
                    recreate();
                } else {
                    Toast.makeText(MainActivity.this,
                            "O motor gráfico foi encerrado repetidamente. Atualize o Android System WebView e abra o jogo novamente.",
                            Toast.LENGTH_LONG).show();
                    finish();
                }
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
        emblem.setImageResource(R.drawable.royal_king);
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
            scheduleStartupTimeout();
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
        // Restaurar exclusivamente navegacao salva do host HTTPS do jogo.
        // DOM e sessoes remotas continuam sendo reconstruidos pelo servidor.
        boolean restored = false;
        if (state != null) {
            Bundle saved = state.getBundle(BROWSER_STATE_KEY);
            String trustedUrl = state.getString(BROWSER_URL_KEY);
            if (saved != null && trustedUrl != null && isGameUrl(Uri.parse(trustedUrl))) {
                try {
                    android.webkit.WebBackForwardList history = webView.restoreState(saved);
                    restored = history != null && history.getCurrentItem() != null
                            && trustedUrl.equals(history.getCurrentItem().getUrl());
                } catch (RuntimeException ignored) {
                    restored = false;
                }
            }
        }
        if (!restored) webView.loadUrl(GAME_URL);
    }

    private void scheduleStartupTimeout() {
        cancelStartupTimeout();
        pendingLoadTimeout = () -> {
            pendingLoadTimeout = null;
            if (isFinishing() || webView == null || hasLoadedPage || mainFrameFailed) return;
            mainFrameFailed = true;
            loadingPanel.setVisibility(View.GONE);
            offlinePanel.setVisibility(View.VISIBLE);
        };
        root.postDelayed(pendingLoadTimeout, STARTUP_TIMEOUT_MS);
    }

    private void cancelStartupTimeout() {
        if (pendingLoadTimeout != null && root != null) {
            root.removeCallbacks(pendingLoadTimeout);
        }
        pendingLoadTimeout = null;
    }

    private void googleError(String message) {
        if (webView == null || webView.getUrl() == null || !isGameUrl(Uri.parse(webView.getUrl()))) return;
        webView.evaluateJavascript("window.clashOfIzzyGoogleError && window.clashOfIzzyGoogleError(" +
                JSONObject.quote(message) + ")", null);
    }

    private void startNativeGoogleSignIn(Uri uri) {
        if (googleSignInInProgress || webView == null) return;
        String nonce = uri.getQueryParameter("nonce");
        String clientId = uri.getQueryParameter("clientId");
        // Reject malformed cross-frame or external requests; no credentials are hardcoded.
        if (nonce == null || !nonce.matches("(?i)^[0-9a-f-]{73}$") ||
                clientId == null || !clientId.matches("^[0-9]{6,}-[A-Za-z0-9_-]+\\.apps\\.googleusercontent\\.com$")) {
            googleError("Configuração Google inválida. Atualize o aplicativo.");
            return;
        }
        googleSignInInProgress = true;
        try {
            GetSignInWithGoogleOption googleOption =
                    new GetSignInWithGoogleOption.Builder(clientId).setNonce(nonce).build();
            GetCredentialRequest credentialRequest = new GetCredentialRequest.Builder()
                    .addCredentialOption(googleOption).build();
            CredentialManager.create(this).getCredentialAsync(
                    this, credentialRequest, null, command -> runOnUiThread(command),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse result) {
                            googleSignInInProgress = false;
                            if (webView == null || webView.getUrl() == null || !isGameUrl(Uri.parse(webView.getUrl()))) return;
                            if (!(result.getCredential() instanceof CustomCredential)) {
                                googleError("O Android não retornou uma conta Google válida.");
                                return;
                            }
                            CustomCredential credential = (CustomCredential) result.getCredential();
                            if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                                googleError("Credencial Google não reconhecida.");
                                return;
                            }
                            try {
                                String idToken = GoogleIdTokenCredential.createFrom(credential.getData()).getIdToken();
                                // Forward only to the trusted top-level game page, never third-party frames.
                                webView.evaluateJavascript(
                                        "window.clashOfIzzyGoogleCredential && window.clashOfIzzyGoogleCredential(" +
                                                JSONObject.quote(idToken) + ")", null);
                            } catch (RuntimeException error) {
                                googleError("Não foi possível validar a credencial no aplicativo.");
                            }
                        }

                        @Override
                        public void onError(GetCredentialException error) {
                            googleSignInInProgress = false;
                            googleError("A seleção da conta Google não foi concluída.");
                        }
                    });
        } catch (RuntimeException error) {
            googleSignInInProgress = false;
            googleError("O seletor Google do Android não está disponível.");
        }
    }

    private boolean isGameUrl(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme())
                && GAME_HOST.equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private boolean handlePopupNavigation(WebView popup, Uri uri, boolean[] handled) {
        if (uri != null && "about".equalsIgnoreCase(uri.getScheme())
                && "blank".equalsIgnoreCase(uri.getSchemeSpecificPart())) return false;
        if (handled[0]) return true;
        handled[0] = true;
        if (uri != null && isGameUrl(uri)) {
            if (webView != null) webView.loadUrl(uri.toString());
        } else if (uri != null) {
            openOutsideApp(uri);
        }
        // Postergue destroy para nao destruir uma WebView dentro do proprio callback.
        root.post(() -> closePopup(popup));
        return true;
    }

    private void closePopup(WebView popup) {
        if (popup == null || popup != popupWebView) return;
        popupWebView = null;
        root.removeView(popup);
        popup.stopLoading();
        popup.destroy();
    }

    private void openOutsideApp(Uri uri) {
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme)
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
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView == null || webView.getUrl() == null) return;
        String currentUrl = webView.getUrl();
        if (!isGameUrl(Uri.parse(currentUrl))) return;
        Bundle navigation = new Bundle();
        if (webView.saveState(navigation) != null) {
            outState.putBundle(BROWSER_STATE_KEY, navigation);
            outState.putString(BROWSER_URL_KEY, currentUrl);
        }
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
        cancelStartupTimeout();
        if (popupWebView != null) closePopup(popupWebView);
        if (webView != null) {
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
