import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/android-candidate-apk.yml", import.meta.url), "utf8");
const step = label => {
  const index = workflow.indexOf("- name: " + label);
  assert.ok(index >= 0, "Etapa ausente: " + label);
  return index;
};

test("APK assinado so e arquivado depois da verificacao do certificado e checksum", () => {
  const validate = step("Validar assinatura privada antes do build");
  const build = step("Compilar candidato com a chave comercial permanente");
  const verify = step("Conferir assinatura, identidade, versao e checksum");
  const upload = step("Guardar APK interno instalavel por 14 dias");
  assert.ok(validate < build && build < verify && verify < upload);
  const verification = workflow.slice(verify, upload);
  for (const requirement of [
    "set -euo pipefail",
    "apksigner\" verify --verbose",
    "apksigner\" verify --print-certs",
    '[[ -n "$actual" && "$actual" == "$expected" ]]',
    "com.clashofizzy.android",
    "versionCode='$ANDROID_VERSION_CODE'",
    "versionName='$ANDROID_VERSION_NAME'",
    "sha256sum -c clash-of-izzy-android-candidato-interno.apk.sha256"
  ]) assert.ok(verification.includes(requirement), "Gate ausente: " + requirement);
});

test("Artefato interno nunca e confundido com release publica", () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.doesNotMatch(workflow, /gh release (create|upload)|softprops\/action-gh-release|contents: write|gradle[^\n]*assembleDebug/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(workflow, /retention-days: 14/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /rm -f "\$RUNNER_TEMP\/clash-izzy-candidate\.jks"/);
});
