# DatscoGo PostgreSQL shared storage

This build keeps the existing DatscoGo UI unchanged and replaces Render-local JSON persistence with PostgreSQL via `DATABASE_URL`.

Shared PostgreSQL data:
- routes, schedules, terminals, announcements and contact details
- driver/admin account records used by the existing app authentication flow
- live driver trip/location records

The server automatically creates these tables on startup:
- `datscogo_app_state`
- `datscogo_live_trips`

No manual SQL import is required for an empty database. The frontend continues polling the shared API every 2.5 seconds, so changes made by an admin are retrieved by other devices without a Git push or redeploy.

A Git push/redeploy is only required when application source code changes.
