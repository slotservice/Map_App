# `@map-app/mobile` — Worker App (Android + iOS)

React Native + Expo (bare workflow) + TypeScript. Replaces the legacy `app_1119.apk`.

**Status:** Not yet scaffolded. Phase 1 week 2.

Screens (planned, mirroring the legacy flow per [REBUILD_PLAN §7](../../docs/REBUILD_PLAN.md#7-app-flow)):

* Splash → Sign In
* Maps list (drawer: Maps / Profile / Change Password / Log out — no "Gas Lids")
* Map view (Google Maps + colour-coded markers)
* Store detail (modal)
* Add Photos (Before / After columns + Tag Alert link + Property View link; **Save** vs **Save & Next** distinction fixes legacy bug L3)
* Tag Alert sub-screen
* Property View (Phase 2)
* Check & Verification (signature canvas + general comments → fixes L2 by including in export)

Stack notes:

* `react-native-maps` for the map.
* `react-native-signature-canvas` for the signature.
* `expo-image-picker` + `expo-camera` for photo input.
* `expo-secure-store` (Keychain / Keystore) for refresh-token storage —
  legacy app stored the password in plaintext SharedPreferences (APK-3
  in `docs/legacy/manifest_summary.md`); the rebuild does not.
* `@tanstack/react-query` for API state.
* `zustand` for app state.
* Photo upload via direct presigned R2 URLs with a local SQLite outbox
  for offline tolerance.

Distribution: Expo EAS → Google Play internal track + Apple TestFlight → public release.
