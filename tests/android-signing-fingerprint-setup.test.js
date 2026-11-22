import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(
  new URL('../.github/workflows/diagnostico-assinatura-android.yml', import.meta.url),
  'utf8'
);
const steps = workflow.split('        run: |\n')[1] || '';

test('o diagnostico deriva o fingerprint somente apos validar a chave privada', () => {
  const verifyKey = steps.indexOf('keytool -certreq');
  const digest = steps.indexOf('actual="$(sha256sum');
  const unconfiguredPin = steps.indexOf('if ! [[ "$normalized" =~ ^[0-9a-f]{64}$ ]]');
  assert.ok(verifyKey >= 0 && digest > verifyKey && unconfiguredPin > digest);
  assert.match(steps, /exit 1\n\s*fi\n\s*if \[\[ "\$actual" != "\$normalized" \]\]/);
});

test('mostra somente hash publico, sem ignorar pin nem publicar APK', () => {
  assert.match(steps, /::notice::Fingerprint publico do certificado: \$actual/);
  assert.match(steps, /\$GITHUB_STEP_SUMMARY/);
  assert.doesNotMatch(steps, /set -x|gh release create|echo "\$KS"|echo "\$SP"|echo "\$KP"/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
});
