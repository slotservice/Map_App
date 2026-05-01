#!/usr/bin/env bash
# Build a debug APK for the Full Circle FM mobile app on a Linux host
# with constrained RAM (<= 8 GB). Tested on the Tomas VPS (Ubuntu).
#
# Prereqs (one-time setup on the host):
#   apt-get install -y openjdk-17-jdk-headless unzip imagemagick
#   mkdir -p /opt/android-sdk/cmdline-tools && cd $_
#   curl -sSL -o cmdline-tools.zip 'https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip'
#   unzip -q cmdline-tools.zip && mv cmdline-tools latest && rm cmdline-tools.zip
#   export ANDROID_HOME=/opt/android-sdk
#   export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
#   yes | sdkmanager --licenses
#   sdkmanager 'platform-tools' 'platforms;android-34' 'build-tools;34.0.0'
#   # add 8G swap if RAM <= 8 GB:
#   fallocate -l 8G /swapfile && chmod 600 /swapfile && mkswap /swapfile
#   swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
#
# Per-build:
#   apps/mobile/.env must exist with at minimum:
#     EXPO_PUBLIC_API_URL=<url-clients-will-hit>
#     GOOGLE_MAPS_ANDROID_KEY=<key>          (or empty for blank-tile demo)
#   Output: apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk

set -e
cd "$(dirname "$0")/.."

if [ -z "${ANDROID_HOME:-}" ]; then
  export ANDROID_HOME=/opt/android-sdk
fi
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

if [ ! -f apps/mobile/.env ]; then
  echo "✗ apps/mobile/.env missing — copy .env.example and fill in" >&2
  exit 1
fi

# Workspace install: skip postinstall scripts (react-native-screens'
# `bob build` postinstall fails on hosts without it on PATH).
pnpm install --ignore-scripts

# Generate android/ from app.config.ts. --clean ensures Maps key changes
# in .env land in AndroidManifest.xml meta-data.
( cd apps/mobile && npx expo prebuild --platform android --no-install --clean )

# Append low-memory gradle overrides — apps/mobile/android/ is in
# .gitignore (regenerated each prebuild), so we re-apply each run.
# Default 2g heap was OOM-killed on the 8 GB Tomas VPS.
cat >> apps/mobile/android/gradle.properties <<'GRADLEEOF'

# === LOW-MEMORY OVERRIDES (infra/build-mobile-apk.sh) ===
org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8
org.gradle.parallel=false
org.gradle.daemon=false
kotlin.daemon.jvm.options=-Xmx1024m
GRADLEEOF

# --no-daemon: prevents lingering JVMs piling up on retry.
( cd apps/mobile/android && ./gradlew --no-daemon assembleDebug )

APK="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "✗ build finished but APK missing at $APK" >&2
  exit 1
fi

ls -lh "$APK"
echo "✓ APK built: $APK"
