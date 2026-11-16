import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseProductionEndpoint } from "../scripts/diagnose-production-endpoint.js";

test("forensic diagnostic records the same GET response headers and body", async () => {
  let request;
  const log = [];
  const fakeFetch = async (url, options) => {
    request = { url: String(url), options };
    return {
      status: 405,
      statusText: "Method Not Allowed",
      url: "https://clash-of-izzy.jorgepereiragha.workers.dev/api/account/status",
      redirected: false,
      type: "basic",
      headers: new Headers({
        "content-type": "application/json",
        "allow": "POST, OPTIONS",
        "cf-ray": "example-ray-id",
        "server": "cloudflare",
        "set-cookie": "session=must-not-be-logged",
      }),
      text: async () => '{"error":"Method not allowed"}',
    };
  };

  const result = await diagnoseProductionEndpoint({
    url: "https://clash-of-izzy.jorgepereiragha.workers.dev/api/account/status",
    fetchImpl: fakeFetch,
    logger: { log: message => log.push(message) },
  });

  assert.equal(request.options.method, "GET");
  assert.equal(request.options.redirect, "follow");
  assert.equal(request.options.headers.Accept, "application/json");
  assert.equal(result.response.status, 405);
  assert.equal(result.response.headers.allow, "POST, OPTIONS");
  assert.equal(result.response.headers["cf-ray"], "example-ray-id");
  assert.equal(result.response.headers.server, "cloudflare");
  assert.equal("set-cookie" in result.response.headers, false);
  assert.equal(result.response.bodyPreview, '{"error":"Method not allowed"}');
  assert.equal(log.length, 1);
  assert.match(log[0], /"status": 405/);
  assert.match(log[0], /Method not allowed/);
});

test("forensic diagnostic truncates large response bodies", async () => {
  const result = await diagnoseProductionEndpoint({
    url: "https://example.workers.dev/api/account/status",
    fetchImpl: async () => ({
      status: 500,
      statusText: "Internal Server Error",
      url: "",
      redirected: false,
      type: "basic",
      headers: new Headers(),
      text: async () => "x".repeat(4_500),
    }),
    logger: { log() {} },
  });

  assert.equal(result.response.bodyLength, 4_500);
  assert.equal(result.response.bodyPreview.length < 4_100, true);
  assert.match(result.response.bodyPreview, /CORPO TRUNCADO/);
});

test("forensic diagnostic rejects non-HTTPS endpoints", async () => {
  await assert.rejects(
    diagnoseProductionEndpoint({
      url: "http://example.workers.dev/api/account/status",
      fetchImpl: async () => { throw new Error("não deveria chamar a rede"); },
      logger: { log() {} },
    }),
    /HTTPS/
  );
});
