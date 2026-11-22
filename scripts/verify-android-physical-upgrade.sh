#!/usr/bin/env bash
# Non-destructive physical Android upgrade smoke test. No uninstall, reset, or payment calls.
set -euo pipefail
if [[ $# -ne 3 ]]; then
  echo "Usage: $0 DEVICE_SERIAL BASELINE_SIGNED.apk CANDIDATE_SIGNED.apk" >&2
  exit 2
fi
serial="$1"; baseline="$2"; candidate="$3"
for tool in adb apksigner; do command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 2; }; done
for file in "$baseline" "$candidate"; do [[ -s "$file" ]] || { echo "Missing APK: $file" >&2; exit 2; }; done
[[ -n "$serial" ]] || { echo "Explicit Android device serial required" >&2; exit 2; }
[[ "$(adb -s "$serial" get-state)" == "device" ]] || { echo "Device not ready" >&2; exit 2; }
package="com.clashofizzy.android"
fingerprint() {
  apksigner verify --verbose --print-certs "$1" >&2
  apksigner verify --print-certs "$1" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -n 1
}
base_cert="$(fingerprint "$baseline")"
new_cert="$(fingerprint "$candidate")"
[[ "$base_cert" =~ ^[0-9a-fA-F]{64}$ && "$base_cert" == "$new_cert" ]] || {
  echo "Signer mismatch or missing certificate; refusing installation" >&2; exit 1;
}
# aapt is part of the Android build-tools; use it to verify package and monotonically increasing versionCode.
command -v aapt >/dev/null || { echo "Missing aapt (Android build-tools)" >&2; exit 2; }
metadata() { aapt dump badging "$1" | head -n 1; }
base_meta="$(metadata "$baseline")"; new_meta="$(metadata "$candidate")"
for meta in "$base_meta" "$new_meta"; do
  [[ "$meta" == *"name='$package'"* ]] || { echo "Unexpected applicationId" >&2; exit 1; }
done
version_code() { sed -n "s/.*versionCode='\([0-9][0-9]*\)'.*/\1/p" <<< "$1"; }
base_code="$(version_code "$base_meta")"; new_code="$(version_code "$new_meta")"
[[ "$base_code" =~ ^[0-9]+$ && "$new_code" =~ ^[0-9]+$ ]] || exit 1
(( 10#$new_code > 10#$base_code )) || { echo "Candidate versionCode must increase" >&2; exit 1; }
echo "Verified same certificate and versionCode $base_code -> $new_code"
echo "Installing baseline without uninstalling existing data (adb install -r)"
adb -s "$serial" install -r "$baseline"
echo "Upgrading in place; no uninstall or data clearing"
adb -s "$serial" install -r "$candidate"
adb -s "$serial" shell monkey -p "$package" -c android.intent.category.LAUNCHER 1
adb -s "$serial" shell dumpsys package "$package" | grep -m 1 'versionCode='
echo "ADB install and launch commands succeeded. Manually verify login, navigation, graphics, API and persisted player data on device."
