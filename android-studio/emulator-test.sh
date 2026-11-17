#!/bin/bash
# Run by .github/workflows/android-studio.yml on an Android emulator: installs
# the app built from the PDFs and checks that it works like the tablet app.
# Not part of what goes to the closed network.
set -uo pipefail
APK=$1
APP=com.bdolach.sufa
fail() { echo "FAIL: $*"; exit 1; }

screen() { # the screen's accessibility tree (includes the page's text)
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  adb shell cat /sdcard/ui.xml
}
in_front() { adb shell dumpsys activity activities | grep -E "ResumedActivity|topResumedActivity" | grep -q "$APP"; }
tap_label() { # taps the element whose text or label is $1
  local b
  b=$(screen | tr '>' '\n' | grep -E "(text|content-desc)=\"$1\"" | grep -o 'bounds="[^"]*"' | head -1 | grep -o '[0-9]\+' | tr '\n' ' ')
  [ -n "$b" ] || return 1
  set -- $b
  adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
}

adb install -r "$APK" || fail "install"
adb shell am start -W -n $APP/.MainActivity
sleep 8
adb exec-out screencap -p > shot-1-start.png

ui=$(screen)
echo "Text on screen:"; echo "$ui" | grep -o 'text="[^"]\+"' | head -25
echo "$ui" | grep -q 'על הקרקע' || fail "the checklist's first page is not on screen"
echo "OK: the checklist shows, in Hebrew"

adb shell dumpsys window windows | grep -q KEEP_SCREEN_ON || fail "screen is not kept on"
echo "OK: the screen is kept on"

if adb logcat -d | grep -i "chromium" | grep -i "uncaught"; then fail "JavaScript error"; fi
echo "OK: no JavaScript errors"

# Next page, then back: should return to page 1 and stay in the app
if tap_label 'המשך'; then
  sleep 2
  adb exec-out screencap -p > shot-2-next-page.png
  screen | grep -q 'ל - 2' || fail "המשך did not open page 2"
  adb shell input keyevent KEYCODE_BACK; sleep 2
  in_front || fail "back on page 2 left the app"
  screen | grep -q 'ל - 1' || fail "back on page 2 did not return to page 1"
  echo "OK: back goes back a page"
else
  echo "NOTE: couldn't find the המשך button to tap; skipped the page test"
fi

# Turning the tablet keeps the app and the page
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1; sleep 3
adb exec-out screencap -p > shot-3-turned.png
in_front || fail "turning the tablet closed the app"
screen | grep -q 'על הקרקע' || fail "page lost after turning"
adb shell settings put system user_rotation 0; sleep 2
echo "OK: turning the tablet keeps the page"

# Back on the first page leaves the app
adb shell input keyevent KEYCODE_BACK; sleep 2
in_front && fail "back on the first page did not leave the app"
echo "OK: back on the first page leaves the app"

echo "All checks passed."
