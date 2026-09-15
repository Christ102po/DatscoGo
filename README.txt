DatscoGo - RESTORE ORIGINAL UI

Purpose
-------
This patch restores the exact DatscoGo frontend UI from your own Git history,
from immediately before the Admin Road Routing + Live GPS patch changed it.

It restores only these UI-facing files when they existed before the patch:
- client/src/App.tsx
- client/src/main.tsx
- client/src/index.css
- client/src/pages/UserDashboard.tsx
- client/src/pages/AdminDashboard.tsx
- client/src/pages/DriverDashboard.tsx
- client/src/components/DatscoMap.tsx

It DOES NOT roll back:
- server/datscoStore.ts
- server/index.ts
- data/datscogo.json
- client/src/lib/api.ts
- client/src/lib/routing.ts
- client/src/types/datsco.ts
- your DatscoGo sidebar
- vite.config.ts / PWA setup

How to use
----------
1. Extract this ZIP.
2. Copy RESTORE_ORIGINAL_UI.ps1 into your DatscoGo project root.
3. Open PowerShell in that project folder.
4. Run:

   Set-ExecutionPolicy -Scope Process Bypass
   .\RESTORE_ORIGINAL_UI.ps1

5. Then check:

   git status
   npm run build

6. If correct:

   git add .
   git commit -m "Restore original DatscoGo UI"
   git push origin main

The script creates a backup-ui-before-restore-* folder before changing anything.
