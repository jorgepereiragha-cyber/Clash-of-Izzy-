import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, readFileSync as read, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const workflow = readFileSync(new URL(".github/workflows/provision-beta-d1.yml", root), "utf8");
const sqlBlock = workflow.match(/^ {10}python3 - <<'PY'\n([\s\S]*?)^ {10}PY$/m);
assert.ok(sqlBlock, "real protected D1 audit Python must be present");
const auditPython = sqlBlock[1].split("\n").map(line =>
  line.startsWith("          ") ? line.slice(10) : line
).join("\n");
const production = JSON.parse(readFileSync(new URL("wrangler.jsonc", root), "utf8"));
const prod = production.d1_databases[0].database_id;
const preview = production.previews.d1_databases[0].database_id;
const betaUuid = "c8a942d1-d6c3-4ee8-9f21-8b2240217cc2";
const placeholder = "REPLACE_WITH_NEW_BETA_D1_UUID";

const bootstrap = `
import os, io, json, urllib.request
def mock_urlopen(request, timeout=30):
    method = request.get_method()
    with open(os.environ["MOCK_NETWORK_LOG"], "a", encoding="utf8") as log:
        log.write(method + " " + request.full_url + "\\n")
    if method == "GET":
        rows = [
            {"uuid": os.environ["MOCK_PROD"], "name": "clash-of-izzy-db"},
            {"uuid": os.environ["MOCK_PREVIEW"], "name": "izzy-preview-17112026"}
        ]
        if os.environ["MOCK_BETA"] != "none":
            rows.append({"uuid": os.environ["MOCK_BETA"], "name": "clash-of-izzy-beta-db"})
        return io.BytesIO(json.dumps({"success": True, "result": rows,
            "result_info": {"total_count": len(rows)}}).encode())
    if method == "POST":
        return io.BytesIO(json.dumps({"success": True, "result": {
            "uuid": os.environ["MOCK_NEW"], "name": "clash-of-izzy-beta-db"}}).encode())
    raise AssertionError("unexpected network method: " + method)
urllib.request.urlopen = mock_urlopen
`;

function runAudit({ bound = placeholder, remote = "none", operation = "audit",
  confirmation = "" } = {}) {
  const work = mkdtempSync(join(tmpdir(), "coi-beta-provision-contract-"));
  try {
    writeFileSync(join(work, "wrangler.jsonc"), JSON.stringify(production));
    writeFileSync(join(work, "wrangler-beta-readonly.json"), JSON.stringify({
      name: "clash-of-izzy-beta",
      vars: {ENVIRONMENT:"beta", INVITE_ONLY:"true",BETA_LIVE_PAYMENTS_APPROVED:"false"},
      d1_databases: [{binding:"DB", database_name:"clash-of-izzy-beta-db", database_id:bound}]
    }));
    const logFile = join(work, "network.log");
    const summaryFile = join(work, "summary.md");
    const result = spawnSync("python3", ["-c", bootstrap + "\n" + auditPython], {
      cwd:work, encoding:"utf8", timeout:10000, env:{
        ...process.env, RUNNER_TEMP:work, GITHUB_STEP_SUMMARY:summaryFile,
        CLOUDFLARE_ACCOUNT_ID:"1".repeat(32), CLOUDFLARE_BETA_D1_TOKEN:"synthetic-test-token",
        OPERATION:operation, CONFIRMATION:confirmation, LOCATION_HINT:"enam",
        MOCK_PROD:prod, MOCK_PREVIEW:preview, MOCK_BETA:remote, MOCK_NEW:betaUuid,
        MOCK_NETWORK_LOG:logFile
      }
    });
    let requests = [];
    try { requests = read(logFile,"utf8").trim().split("\n").filter(Boolean); } catch {}
    return {status:result.status, stdout:result.stdout, stderr:result.stderr,
      summary: (()=>{try{return read(summaryFile,"utf8")}catch{return ""}})(),requests};
  } finally {
    rmSync(work, {recursive:true,force:true});
  }
}

test("fresh D1 audit is read-only and reports no beta DB",()=>{
  const r = runAudit();
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/ainda nao existe/);
  assert.equal(r.requests.length,1);
  assert.ok(r.requests.every(s=>s.startsWith("GET ")));
});

test("auditing after beta D1 provisioning succeeds if UUID matches Cloudflare",()=>{
  const r=runAudit({bound:betaUuid,remote:betaUuid});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.summary,/Binding beta corresponde ao D1 remoto/);
  assert.ok(r.requests.length>0 && r.requests.every(s=>s.startsWith("GET ")));
});

test("wrong or missing remote beta D1 never passes a configured audit",()=>{
  for(const remote of ["none","a8d3e612-3ee1-4a22-95f1-b81a62e57d21"]){
    const r=runAudit({bound:betaUuid,remote});
    assert.notEqual(r.status,0,"Unexpected audit success for "+remote);
    assert.ok(!r.requests.some(s=>s.startsWith("POST ")));
  }
});

test("configured UUID cannot create a second D1 even with explicit confirmation",()=>{
  const r=runAudit({bound:betaUuid,remote:betaUuid,operation:"create",
    confirmation:"CRIAR-D1-BETA"});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/ja vinculado/);
  assert.ok(!r.requests.some(s=>s.startsWith("POST ")));
});

test("placeholder with existing D1 never creates a duplicate",()=>{
  const r=runAudit({remote:betaUuid,operation:"create",confirmation:"CRIAR-D1-BETA"});
  assert.notEqual(r.status,0);
  assert.ok(!r.requests.some(s=>s.startsWith("POST ")));
});

test("first-time creation only calls POST with literal double confirmation",()=>{
  const denied=runAudit({operation:"create"});
  assert.notEqual(denied.status,0);
  assert.ok(!denied.requests.some(s=>s.startsWith("POST ")));
  const approved=runAudit({operation:"create",confirmation:"CRIAR-D1-BETA"});
  assert.equal(approved.status,0,approved.stderr);
  assert.equal(approved.requests.filter(s=>s.startsWith("POST ")).length,1);
});
