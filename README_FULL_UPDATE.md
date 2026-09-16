# DatscoGo Full Live Sync + Trip Tracking Update

This package implements the requested behavior without intentionally changing the DatscoGo visual theme. The included page files keep the same Tailwind/card/map styling of the latest DatscoGo patch available to this chat and add only the controls/data needed for the new behavior.

## What is included

- Admin create/edit/delete changes are broadcast immediately with Server-Sent Events (SSE).
- Every client also refreshes the shared snapshot every 30 seconds as a reconnect/fallback.
- No Git push is needed when Admin changes normal data. A push/deploy is only needed when source code changes.
- Routes now support named `places` (barangays/stops/passing places) so the user search can be generated from Admin route data instead of hard-coded suggestions.
- `Start Departure` creates a real trip session and exposes the Datsco to users.
- Live GPS updates are attached to that active trip.
- Clicking a Datsco shows driver/trip/route/origin/destination/times and estimated road distance from the passenger.
- Clicking a Datsco also draws the Datsco's road route.
- Clearing the Where to? search returns the map to the passenger's current GPS location.
- Searching a route place focuses it on the map and lists the route(s) and currently active Datsco trips that can serve it.
- `Mark as Arrived` records the driver's actual current GPS coordinate. It never teleports the driver marker to the terminal.
- Admin driver view contains permanent trip history with start/final coordinates and timestamps.
- Android uses Capacitor background geolocation plus `CapacitorHttp` so location updates can continue while the app is backgrounded/locked and HTTP is not dependent on the throttled WebView.

## Important data persistence on Render

All devices share the same Render backend immediately, but the JSON file must live on persistent storage if you want data to survive service restarts/deploys.

Set these Render environment variables:

```text
ADMIN_KEY=choose-a-private-key
DATSCO_DATA_FILE=/data/datscogo.json
```

Mount your Render persistent disk/volume at `/data` (or change `DATSCO_DATA_FILE` to match your chosen mount path).

## Android / Capacitor environment

For the website, `VITE_API_BASE_URL` can stay blank when frontend + Express are served by the same Render service.

For the Android APK, set your actual Render HTTPS URL before building:

```text
VITE_API_BASE_URL=https://YOUR-REAL-DATSCOGO-DOMAIN.onrender.com
```

The included PowerShell installer adds:

- `@capacitor-community/background-geolocation` `^1.2.26`
- matching-major `@capacitor/local-notifications`
- Android foreground/background location permissions
- Android notification permission
- `android.useLegacyBridge = true` when it can safely patch `capacitor.config.ts`

After applying:

```powershell
pnpm install
pnpm run build
pnpm exec cap sync android
pnpm exec cap open android
```

If your project uses npm instead of pnpm, use the equivalent `npm install`, `npm run build`, `npx cap sync android`, and `npx cap open android` commands.

## Apply

1. Extract this update folder.
2. Put it somewhere outside your DatscoGo project.
3. Open PowerShell in your **DatscoGo project root** (where `package.json` exists).
4. Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\PATH\TO\DatscoGo-Full-LiveSync-TripTracking-Update\APPLY_DATSCOGO_FULL_UPDATE.ps1"
```

The installer creates a timestamped backup before replacing files.

## Current-UI warning

The exact GitHub `main` could not be fetched from this environment. The full page replacements in this package are based on the newest DatscoGo source patch available in the user's saved project files. If the local GitHub checkout has newer visual components (for example a newer `SearchCard.tsx`, `DriverLocationMap.tsx`, or `TransitContext.tsx`), keep those UI files and merge the provided API/tracking handlers instead of replacing the newer visual files. The server/API/types/background tracking code is designed to be reusable with that newer UI.

## Android limitation

Background GPS can continue while the Android app is minimized or the phone is locked after the trip was started while the app was visible. Android can still stop tracking after an explicit **Force stop**, revoked location permission, disabled GPS, or aggressive OEM battery restrictions. `Mark as Arrived` always stops DatscoGo's active background watcher after the final real GPS point is saved.
