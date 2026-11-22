#!/usr/bin/env bash
set -euo pipefail

# Emulator-only launch smoke. This does not authenticate, purchase or mutate D1.
package_name="com.clashofizzy.android.debug"
activity="com.clashofizzy.android.MainActivity"
apk="android-sideload/app/build/outputs/apk/debug/app-debug.apk"
mkdir -p test-results/android-emulator
test -s "$apk"
adb wait-for-device
adb install -r "$apk"
adb shell am start -W -n "$package_name/$activity"
sleep 8
pid="$(adb shell pidof "$package_name" | tr -d '\r' || true)"
if [[ -z "$pid" ]]; then
  echo "::error::APK process terminated shortly after startup."
  adb logcat -d -t 350 | grep -E 'FATAL EXCEPTION|Process: com.clashofizzy' || true
  exit 1
fi
echo "Android emulator launched the test APK."
adb exec-out screencap -p > test-results/android-emulator/launch.png
test -s test-results/android-emulator/launch.png
echo "Boot/launch passed. A real Android device test is still required." >> "$GITHUB_STEP_SUMMARY"
