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

test('Falhas HTTP 5xx da pagina principal mostram recuperacao sem bloquear APIs', () => {
  assert.match(activity, /void onReceivedHttpError\(/);
  assert.match(activity, /request\.isForMainFrame\(\) && errorResponse\.getStatusCode\(\) >= 500/);
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
  assert.match(activity, /if \(!hasLoadedPage\) loadingPanel\.setVisibility\(View\.VISIBLE\)/);
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
