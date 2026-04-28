# Legacy APK — Manifest Summary

_Source: `legacy/apk/app_1119.apk`_
_SHA-256: `6226d599179914cfb8af865b056b12797757b9031a370c0e07b86c46ec663be7`_
_Size: 9,692,910 bytes (9.69 MB) — Last-Modified 2020-11-19_

## Identity

| Field | Value |
|---|---|
| Package | `com.crush.mapstore` |
| App label | "Map Store" |
| Version code / name | `1` / `1.0` |
| Build type | **`debug`** ⚠ — see security findings |
| Compile SDK | 29 (Android 10) |
| Build code style | Kotlin (with embedded Volley + AndroidX libraries) |

## Permissions

* `INTERNET`
* `ACCESS_NETWORK_STATE`
* `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` (for the map view)
* `CAMERA` (with autofocus feature) — for before/after photo capture
* `READ_EXTERNAL_STORAGE` + `WRITE_EXTERNAL_STORAGE` — gallery picker
* `requestLegacyExternalStorage="true"` — pre-scoped-storage; deprecated, **must move to scoped storage in the rebuild** (Android 11+ requires it)

## Hardware features

* `android.hardware.camera` (required)
* `android.hardware.camera.autofocus`
* OpenGL ES 2.0+ (required, for Google Maps)

## Activities

| Activity | Role |
|---|---|
| `ui.SplashActivity` | Launcher; checks token; routes to Sign-in or Main |
| `ui.login.SigninActivity` | Email + password login |
| `ui.MainActivity` | Maps list with side-drawer (Maps / Profile / Change Password / Gas Lids / Log out) |
| `ui.map.MapActivity` | Map view + store-detail modal + add-photos + check-and-verification |
| `ui.common.camera.CameraActivity` | Built-in camera UI for before/after capture |
| `ui.map.GalleryDetailActivity` | Photo viewer (vendor / completed-store review) |

## Third-party services

* **Google Maps SDK for Android** — API key in `strings.xml`:
  `AIzaSyBRHSCoVJd93D5Xt72JsPSzuaLeFyY9qHs` ⚠ leaked in APK; **rotate before release**.
* **Google Play Services** (location).
* **Volley** (HTTP client) with a **custom `NuckSSLCerts`** that disables SSL validation. ⚠ critical — replace with system trust store.

## Storage layout (legacy `SharedPreferences`)

The app stores user state in a `SharedPreferences` named `app`:

```
api_token       string   (set on login, cleared on logout)
userId          string
username        string
userEmail       string
userPassword    string   ⚠ stored locally in plaintext for auto-login
userType        int      (1=client, 4=worker)
userPhone       string
userAddress     string
userState       string
userZip         string
language        int
```

**⚠ The legacy app stores the worker's password in `SharedPreferences`
in plaintext** to support silent re-login. The new app must drop this
pattern and instead use a refresh-token in encrypted storage (Android
Keystore / iOS Keychain).

## App-side enums (`AppConst.kt`)

```
ERR_OK              = 0
TASK_STATUS_NEW     = 0
TASK_STATUS_PENDING = 1
TASK_STATUS_COMPLETE= 2
USER_CLIENT         = 1
USER_WORKER         = 4
JAVA_RENDER         = false   // unused branch; legacy JS-rendered fallback
```

## UI string corpus (selected, full list in `apktool-out/res/values/strings.xml`)

The new RN app should re-use these labels for muscle-memory parity:

* `app_name` = "Map Store" (we may rename to "Full Circle FM" in the new app, per client direction Phase 2)
* `add_photo` = "Add Photos"
* `before` / `after` / `add_more` = "Before" / "After" / "+ Add More"
* `complete` = "Complete"
* `completed_stores` = "Completed Stores"
* `change_password` = "Change Password"
* `check_values` = "Check and Verification"
* `comment` = "Comments"
* `dialog_logout` = "Are you sure to log out?"
* `dont_have_account` = "Don't have an account?"

(There is also a `tag_alert` and `tank_lid_screen_id` string in the same
file — these are the small-print links visible at the top right of the
Add Photos screen in `appscreen/Screenshot_6.png`.)

## Key dependencies (from decompiled imports)

* `androidx.appcompat`, `androidx.constraintlayout`, `androidx.cardview` (UI)
* `com.android.volley` (HTTP)
* `com.google.android.gms:play-services-maps`
* `com.google.android.gms:play-services-location`
* `org.json` (built-in)
* `kotlin-stdlib`

No analytics SDK, no crash-reporter — the new build adds Sentry.

## Decompile artefacts on disk

```
legacy/
  apk/app_1119.apk                — original APK (frozen reference)
  apktool-out/                    — apktool output: AndroidManifest.xml,
                                    res/, smali/, original/, unknown/
  jadx-out/sources/com/crush/mapstore/    — readable Java/Kotlin
  tools/apktool.jar               — apktool 2.9.3
  tools/jadx/                     — jadx 1.5.0
  api_surface.md                  — endpoint contract (this dir)
  manifest_summary.md             — this file
  laravel-discovery/              — public-route discovery against
                                    crushtheworld.com
```

To re-run any of the decompile steps:

```bash
cd "d:/Freelancer-Project/Andrew/Matt G/legacy"
java -jar tools/apktool.jar d -f -o apktool-out apk/app_1119.apk
./tools/jadx/bin/jadx -d jadx-out --no-res apk/app_1119.apk
```

## Security findings (from APK side, complementing `api_surface.md`)

| # | Finding | Severity | Fix |
|---|---|---|---|
| APK-1 | Build distributed as `debug` (verbose logging, `android:debuggable="true"`) | High | Build new app as release for store distribution |
| APK-2 | SSL certificate validation disabled at the HTTP client (`NuckSSLCerts.nuke()`) | Critical | Use system trust store; consider cert pinning Phase 2 |
| APK-3 | Worker password stored in plaintext SharedPreferences | High | Refresh-token in Android Keystore / iOS Keychain |
| APK-4 | Google Maps API key embedded in plaintext in `strings.xml` | Medium | Rotate key, restrict by package signature + bundle ID |
| APK-5 | `requestLegacyExternalStorage="true"` — pre-scoped-storage | Medium | Move to MediaStore / scoped storage (required on Play Store) |
| APK-6 | No HTTPS pinning, no root detection, no jailbreak detection | Low (out of scope Phase 1) | Defer — not commercially critical for this app's threat model |

These complement the L1–L9 legacy-system bugs in `PROJECT_STATUS.md §3.3`
and the live-API findings in `legacy/api_surface.md`.
