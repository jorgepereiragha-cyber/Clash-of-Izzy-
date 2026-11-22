import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const activity = read('android-sideload/app/src/main/java/com/clashofizzy/android/MainActivity.java');
const manifest = read('android-sideload/app/src/main/AndroidManifest.xml');
const gradle = read('android-sideload/app/build.gradle');
const workflow = read('.github/workflows/android-apk.yml');

test('APK abre o jogo no mesmo Worker HTTPS de producao', () => {
  assert.match(activity, /https:\/\/clash-of-izzy\.jorgepereiragha\.workers\.dev\/kingdom\.html/);
  assert.match(activity, /isGameUrl\(uri\)/);
  assert.match(activity, /openOutsideApp\(uri\)/);
});
test('WebView bloqueia acesso a arquivos, mixed content e SSL invalido', () => {
  for (const item of [
    'settings.setAllowFileAccess(false)',
    'settings.setAllowContentAccess(false)',
    'settings.setAllowFileAccessFromFileURLs(false)',
    'settings.setAllowUniversalAccessFromFileURLs(false)',
    'settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW)',
    'handler.cancel()'
  ]) assert.ok(activity.includes(item), item);
  assert.doesNotMatch(activity, /addJavascriptInterface\s*\(/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:hardwareAccelerated="true"/);
});
test('build de teste nao tem o mesmo ID da release e requer Android moderno', () => {
  assert.match(gradle, /applicationId 'com\.clashofizzy\.android'/);
  assert.match(gradle, /applicationIdSuffix '\.debug'/);
  assert.match(gradle, /minSdk 24/);
  assert.match(gradle, /targetSdk 35/);
});
test('release nunca e publicada unsigned e nao toca D1', () => {
  assert.match(workflow, /ANDROID_RELEASE_KEYSTORE_BASE64/);
  assert.match(workflow, /test -n "\$KEYSTORE_B64"/);
  assert.match(workflow, /apksigner" verify/);
  assert.doesNotMatch(workflow, /wrangler|d1 migrations|deploy-cloudflare/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});

test('Falhas HTTP 4xx/5xx da pagina principal mostram recuperacao sem bloquear APIs', () => {
  assert.match(activity, /void onReceivedHttpError\(/);
  assert.match(activity, /request\.isForMainFrame\(\) && errorResponse\.getStatusCode\(\) >= 400/);
  assert.match(activity, /offlinePanel\.setVisibility\(View\.VISIBLE\)/);
});

test('APK publicado inclui checksum e assinatura verificada', () => {
  assert.match(workflow, /apksigner" verify --verbose "\$dir\/app-debug\.apk"/);
  assert.match(workflow, /apksigner" verify --verbose "\$dir\/app-release\.apk"/);
  assert.match(workflow, /sha256sum app-debug\.apk > app-debug\.apk\.sha256/);
  assert.match(workflow, /sha256sum app-release\.apk > app-release\.apk\.sha256/);
  assert.match(workflow, /app-debug\.apk\*/);
  assert.match(workflow, /app-release\.apk\*/);
});

test('APK client keeps city navigation and official game backend separate', () => {
  const city = read('kingdom.html');
  assert.match(city, /coi:command-state/);
  assert.match(city, /href="\/world\.html"/);
  assert.match(city, /src="\/scripts\/kingdom-command-hud\.js"/);
  assert.match(activity, /https:\/\/clash-of-izzy\.jorgepereiragha\.workers\.dev\/kingdom\.html/);
});

test('Tela de abertura nativa usa a identidade do jogo e libera acesso quando a pagina conclui', () => {
  assert.match(activity, /GradientDrawable\.Orientation\.TOP_BOTTOM/);
  assert.match(activity, /loadingTitle\.setText\("CLASH OF IZZY"\)/);
  assert.match(activity, /loadingPanel\.setVisibility\(View\.GONE\)/);
  assert.match(activity, /if \(!hasLoadedPage\) \{\s*loadingPanel\.setVisibility\(View\.VISIBLE\);\s*scheduleStartupTimeout\(\);/);
  assert.match(activity, /progress\.setProgressTintList/);
  assert.match(activity, /offlinePanel\.setVisibility\(View\.VISIBLE\)/);
  assert.doesNotMatch(activity, /WebView\.setWebContentsDebuggingEnabled\(true\)/);
});

test('A recuperação offline usa cartão medieval, botão acessível e largura limitada', () => {
  assert.match(activity, /recoveryCardBackground\.setCornerRadius\(dp\(18\)\)/);
  assert.match(activity, /recoveryCardBackground\.setStroke\(dp\(1\)/);
  assert.match(activity, /retry\.setMinimumHeight\(dp\(54\)\)/);
  assert.match(activity, /retry\.setBackground\(retryBackground\)/);
  assert.match(activity, /Math\.min\(dp\(420\), availableWidth\)/);
  assert.match(activity, /hasLoadedPage = false;/);
});

test('Android pausa a renderização WebView em segundo plano e retoma sem recarregar a página',()=>{
  assert.match(activity,/protected void onPause\(\)/);
  assert.match(activity,/if \(webView != null\) webView\.onPause\(\)/);
  assert.match(activity,/protected void onResume\(\)/);
  assert.match(activity,/if \(webView != null\) webView\.onResume\(\)/);
  const resume = activity.slice(activity.indexOf('protected void onResume()'),activity.indexOf('protected void onDestroy()'));
  assert.doesNotMatch(resume,/loadUrl\(|recreate\(/);
});

test('Checkout Mercado Pago abre navegador externo sem substituir o reino no WebView', () => {
  const arena = read('arena.html');
  assert.match(arena, /window\.open\('about:blank','_blank'\)/);
  assert.match(arena, /checkoutWindow\.location\.href=checkoutUrl\.href/);
  assert.match(activity, /settings\.setSupportMultipleWindows\(true\)/);
  assert.match(activity, /settings\.setJavaScriptCanOpenWindowsAutomatically\(false\)/);
  assert.match(activity, /boolean onCreateWindow\(WebView view, boolean isDialog,/);
  assert.match(activity, /if \(!isUserGesture \|\| resultMsg == null \|\| popupWebView != null\) return false/);
  assert.match(activity, /transport\.setWebView\(popup\)/);
  assert.match(activity, /handlePopupNavigation\(popup, request\.getUrl\(\), handled\)/);
  assert.match(activity, /openOutsideApp\(uri\)/);
  assert.match(activity, /if \(popupWebView != null\) closePopup\(popupWebView\)/);
  assert.match(activity, /popupSettings\.setJavaScriptEnabled\(false\)/);
  assert.match(activity, /popupSettings\.setAllowFileAccess\(false\)/);
  assert.match(activity, /popupSettings\.setAllowContentAccess\(false\)/);
});

test('Abertura WebView tem limite de espera, cancela em sucesso e recupera conexao', () => {
  assert.match(activity, /STARTUP_TIMEOUT_MS = 45_000L/);
  assert.match(activity, /void scheduleStartupTimeout\(\)/);
  assert.match(activity, /root\.postDelayed\(pendingLoadTimeout, STARTUP_TIMEOUT_MS\)/);
  assert.match(activity, /root\.removeCallbacks\(pendingLoadTimeout\)/);
  assert.match(activity, /if \(isFinishing\(\) \|\| webView == null \|\| hasLoadedPage \|\| mainFrameFailed\) return/);
  assert.match(activity, /loadingPanel\.setVisibility\(View\.GONE\);\s*offlinePanel\.setVisibility\(View\.VISIBLE\)/);
  assert.match(activity, /onPageFinished\(WebView view, String url\) \{\s*cancelStartupTimeout\(\)/);
  assert.match(activity, /onDestroy\(\) \{\s*cancelStartupTimeout\(\)/);
});

test('tela nativa segue o visual rei guerreiro azul e ouro sem downloads na abertura',()=>{
  assert.match(activity,/royalOverline\.setText\("A ERA DOS REIS"\)/);
  assert.match(activity,/Color\.rgb\(15, 49, 103\)/);
  assert.match(activity,/GradientDrawable emblemBorder/);
  assert.match(activity,/Color\.rgb\(255, 232, 169\)/);
  assert.match(activity,/heroEmblem\.setImageResource\(R\.drawable\.royal_king\)/);
  const start=activity.slice(activity.indexOf('loadingPanel = new LinearLayout'),activity.indexOf('webView.setWebChromeClient'));
  assert.doesNotMatch(start,/https?:\/\//);
  assert.match(read('android-sideload/app/src/main/res/values/styles.xml'),/#081831/);
});


test("TLS invalido de subrecurso nao bloqueia o jogo, e URL HTTP externa fica bloqueada", () => {
  const ssl = activity.slice(activity.indexOf("public void onReceivedSslError("),
    activity.indexOf("public boolean onRenderProcessGone("));
  assert.ok(ssl.includes("handler.cancel()"));
  assert.ok(ssl.includes("String failedUrl = error != null ? error.getUrl() : null;"));
  assert.ok(ssl.includes("!failedUrl.equals(pageUrl) && !failedUrl.equals(originalUrl)) return;"));
  const external = activity.slice(activity.indexOf("private void openOutsideApp("),
    activity.indexOf("private int dp("));
  assert.ok(external.includes('"https".equalsIgnoreCase(scheme)'));
  assert.ok(external.includes('"mailto".equalsIgnoreCase(scheme)'));
  assert.ok(!external.includes('"http".equalsIgnoreCase(scheme)'));
});

test("Renderizador WebGL tem limite de reinicializacao para impedir loop", () => {
  assert.ok(activity.includes("RENDERER_RESTART_WINDOW_MS = 60_000L"));
  assert.ok(activity.includes("lastRendererFailureMs = now"));
  assert.ok(activity.includes("if (recentRendererFailures <= 2) {"));
  assert.ok(activity.includes("recreate();"));
  assert.ok(activity.includes("Atualize o Android System WebView"));
  assert.ok(activity.includes("finish();"));
});

test('Modo imersivo Android restaura tela cheia sem bloquear gestos do sistema', () => {
  assert.match(activity, /void enterImmersiveGameMode\(\)/);
  assert.match(activity, /BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE/);
  assert.match(activity, /WindowInsets\.Type\.statusBars\(\)/);
  assert.match(activity, /WindowInsets\.Type\.navigationBars\(\)/);
  assert.match(activity, /SYSTEM_UI_FLAG_IMMERSIVE_STICKY/);
  assert.match(activity, /onWindowFocusChanged\(boolean hasFocus\)/);
  assert.match(manifest, /android:screenOrientation="unspecified"/);
});
