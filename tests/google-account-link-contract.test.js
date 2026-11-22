import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
test("Google account link remains opt-in and unique, with expiry, one-use nonce and no email auto merge",async()=>{
  const [schema,routes,worker,ui]=await Promise.all([
    source("migrations/0033_google_account_links.sql"),source("player-accounts.js"),
    source("worker.js"),source("account.html")
  ]);
  assert.match(schema,/google_sub TEXT NOT NULL UNIQUE/);
  assert.match(schema,/player_id INTEGER PRIMARY KEY/);
  assert.match(schema,/consumed_at INTEGER/);
  assert.match(schema,/expires_at INTEGER/);
  assert.doesNotMatch(schema,/email.*UNIQUE|id_token TEXT/i);
  assert.match(routes,/verifyGoogleIdToken\(body\.idToken/);
  assert.match(routes,/UPDATE google_auth_challenges SET consumed_at/);
  assert.match(routes,/const playerId = await ctx\.gameIdentity\(request,env\)/);
  assert.match(routes,/GOOGLE_NOT_LINKED/);
  assert.match(routes,/INSERT OR IGNORE INTO google_account_links/);
  assert.match(worker,/google_account_links/);
  assert.match(worker,/Number\.isSafeInteger\(p\.av\)/);
  assert.match(ui,/clashofizzy-google:\/\/signin/);
  assert.match(ui,/VINCULAR GOOGLE AO REINO ATUAL/);
  assert.match(ui,/ENTRAR COM GOOGLE/);
});
test("Android uses native Credential Manager and does not open Google OAuth inside WebView",async()=>{
 const [activity,build]=await Promise.all([source("android-sideload/app/src/main/java/com/clashofizzy/android/MainActivity.java"),source("android-sideload/app/build.gradle")]);
 assert.match(activity,/GetSignInWithGoogleOption/);
 assert.match(activity,/getCredentialAsync/);
 assert.match(activity,/request\.isForMainFrame\(\)/);
 assert.match(activity,/GoogleIdTokenCredential/);
 assert.match(activity,/isGameUrl\(Uri\.parse\(view\.getUrl\(\)\)\)/);
 assert.match(build,/androidx\.credentials:credentials/);
 assert.match(build,/googleid:googleid/);
});
