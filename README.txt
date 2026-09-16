DatscoGo TypeScript error fixes

Replace the matching files in your existing DatscoGo-main project using the same folder paths.
No UI/CSS/layout files were changed.

After replacing, from C:\DatscoGo\DatscoGo-main run:

Remove-Item .\node_modules\typescript\tsbuildinfo -ErrorAction SilentlyContinue
corepack pnpm run check

This patch addresses the 8 errors shown on 2026-09-17:
- adds fetchRoadRoute compatibility helper using existing OSRM routing
- avoids iterator/spread constructs that were producing TS2802 diagnostics
- preserves typed route points so RouteMapPicker no longer gets implicit-any result
