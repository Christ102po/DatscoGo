DatscoGo PostgreSQL Migration - Phase 1

This patch preserves the current UI and adds PostgreSQL persistence for the final UI's shared operational data:
- routes and route waypoints/fares
- terminals
- schedules
- announcements
- contact details
- driver trip current state
- driver trip history
- GPS location history samples

It also changes Mark as arrived so the driver's real current GPS position is stored instead of snapping the marker to the destination terminal.

Render requirement:
- DATABASE_URL must already be set to the Render PostgreSQL Internal Database URL.

The server creates the required tables automatically on startup.

After replacing the files, run:
  corepack pnpm run check
  corepack pnpm run build

Do not push/deploy until both commands succeed.

Phase 2 after this passes:
- move admin/driver accounts and authentication from localStorage to PostgreSQL
- wire native Capacitor background tracking into the final DriverDashboard
- expose full trip history in the existing Admin UI without redesigning it
- retire the legacy JSON datscoStore endpoints after the final UI no longer depends on them
