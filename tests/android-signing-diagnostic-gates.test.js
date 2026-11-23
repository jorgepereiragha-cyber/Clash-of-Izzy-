import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/diagnostico-assinatura-android.yml', import.meta.url), 'utf8');
const run = workflow.split('        run: |\n')[1] || '';

test('diagnostico nao publica nem modifica producao', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /wrangler deploy|d1 migrations apply|gh release create|assembleDebug/);
  assert.match(workflow, /workflow_dispatch:/);
});

test('todas as credenciais e pin sao obrigatorios e falham fechado', () => {
  for (const name of ['ANDROID_RELEASE_KEYSTORE_BASE64','ANDROID_RELEASE_STORE_PASSWORD','ANDROID_RELEASE_KEY_ALIAS','ANDROID_RELEASE_KEY_PASSWORD','ANDROID_RELEASE_CERT_SHA256']) {
    assert.ok(workflow.includes(name), name);
  }
  assert.match(run, /if test "\$missing" = "1"; then[\s\S]*?exit 1/);
  assert.match(run, /\^\[0-9a-f\]\{64\}\$/);
});

test('diagnostico valida keystore, chave privada e certificado pinado', () => {
  assert.match(run, /base64 --decode/);
  assert.match(run, /keytool -exportcert/);
  assert.match(run, /keytool -certreq/);
  assert.match(run, /sha256sum/);
  assert.match(run, /"\$actual" != "\$normalized"/);
  assert.match(run, /trap 'rm -rf "\$tmp"' EXIT/);
});

test('segredos nunca sao impressos diretamente nos logs', () => {
  assert.doesNotMatch(run, /echo\s+["']?\$(?:KS|SP|ALIAS|KP)\b/);
  assert.doesNotMatch(run, /set -x|printenv|env \| sort/);
  assert.match(run, /2>\/dev\/null/);
});
