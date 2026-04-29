# `@map-app/mobile` — Worker App

Expo (bare-workflow-friendly) + React Native + TypeScript. Replaces the
legacy `app_1119.apk`.

## Quickstart

```bash
# from repo root, with the API running on :3001
cp apps/mobile/.env.example apps/mobile/.env
pnpm install
pnpm --filter @map-app/mobile start    # opens Expo dev tools
```

Use the worker seed account from `apps/api/prisma/seed.ts`:

| Email | Password |
|---|---|
| `worker@fullcirclefm.local` | `password123` |

> **Network gotcha:** Android emulator can't reach `localhost`; the
> default `EXPO_PUBLIC_API_URL` is `http://10.0.2.2:3001` (the
> emulator's loopback). For physical-device testing, replace with your
> dev machine's LAN IP.

## Layout

```
src/
├── lib/
│   ├── api.ts             ky instance with auth header
│   ├── secure-storage.ts  expo-secure-store wrappers (refresh token in Keychain/Keystore)
│   └── auth.ts            Zustand store
├── navigation/
│   ├── RootNavigator.tsx  SignIn → Drawer → modal stack for store flow
│   └── DrawerNavigator.tsx Maps / Profile / Change Password
└── screens/
    ├── SignInScreen.tsx
    ├── MapsScreen.tsx          ← live wired to GET /maps
    ├── MapViewScreen.tsx       ← stub, week 2: Google Maps + markers
    ├── StoreDetailScreen.tsx   ← stub, week 2
    ├── AddPhotosScreen.tsx     ← stub, week 2 (fixes legacy L3)
    ├── TagAlertScreen.tsx      ← stub, week 3
    ├── CheckSignScreen.tsx     ← stub, week 2 (fixes legacy L2)
    ├── ProfileScreen.tsx       ← live read; edit week 2
    └── ChangePasswordScreen.tsx ← live wired to POST /auth/change-password
```

## Implemented now

* Login → secure-store-persisted tokens.
* Maps list (live API).
* Profile (read).
* Change Password (live).
* Navigation graph stitched end-to-end (modal Add Photos → Tag Alert / Property View links → Check & Verification).

## Stubs (per milestone)

* Map view + markers — week 2
* Store detail / counts / tasks — week 2
* Photo flow + signature — week 2
* Tag alerts — week 3

## Distribution

EAS profiles in `eas.json`:

* `development` — internal dev client.
* `preview` — internal QA distribution.
* `production` — Play Store + TestFlight (Phase 3).
