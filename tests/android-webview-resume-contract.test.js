import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const activityPath = "../android-sideload/app/src/main/java/com/clashofizzy/android/MainActivity.java";
const readActivity = () => readFile(new URL(activityPath, import.meta.url), "utf8");

test("WebView restores trusted navigation and falls back to the official game URL", async () => {
  const activity = await readActivity();
  assert.match(activity, /protected void onSaveInstanceState\(Bundle outState\)/);
  assert.match(activity, /webView\.saveState\(navigation\)/);
  assert.match(activity, /webView\.restoreState\(saved\)/);
  assert.match(activity, /isGameUrl\(Uri\.parse\(trustedUrl\)\)/);
  assert.match(activity, /trustedUrl\.equals\(history\.getCurrentItem\(\)\.getUrl\(\)\)/);
  assert.match(activity, /if \(!restored\) webView\.loadUrl\(GAME_URL\)/);
  assert.match(activity, /"https"\.equalsIgnoreCase\(uri\.getScheme\(\)\)/);
  assert.match(activity, /GAME_HOST\.equalsIgnoreCase\(uri\.getHost\(\)\)/);
});

test("renderer priority does not override background power handling or security", async () => {
  const activity = await readActivity();
  assert.match(activity, /settings\.setTextZoom\(100\)/);
  assert.match(activity, /webView\.setRendererPriorityPolicy\(WebView\.RENDERER_PRIORITY_IMPORTANT, true\)/);
  assert.match(activity, /webView\.onPause\(\)/);
  assert.match(activity, /webView\.onResume\(\)/);
  assert.match(activity, /settings\.setAllowFileAccess\(false\)/);
  assert.match(activity, /WebSettings\.MIXED_CONTENT_NEVER_ALLOW/);
});
