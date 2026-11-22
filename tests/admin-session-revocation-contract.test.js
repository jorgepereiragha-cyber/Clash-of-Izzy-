import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
test("Master token TTL is 60 minutes, carries random jti and is revoked server-side",async()=>{
 const [worker,migration,ui]=await Promise.all([
  read("worker.js"),read("migrations/0046_admin_session_revocations.sql"),read("admin.html")
 ]);
 assert.match(worker,/jti:crypto\.randomUUID\(\)\.replaceAll\("-", ""\)/);
 assert.match(worker,/expiresIn:3600/);
 assert.match(worker,/SELECT 1 AS revoked FROM admin_session_revocations/);
 assert.match(worker,/INSERT OR IGNORE INTO admin_session_revocations/);
 assert.match(worker,/if\(!await adminSessionActive\(env,payload\)\)/);
 assert.match(worker,/\/api\/admin\/logout/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS admin_session_revocations/);
 assert.match(migration,/token_id TEXT PRIMARY KEY/);
 assert.doesNotMatch(migration,/DROP TABLE|UPDATE players|DELETE FROM players/i);
 assert.match(ui,/api\("\/admin\/logout"/);
 assert.match(ui,/revogação remota não confirmada/);
});
