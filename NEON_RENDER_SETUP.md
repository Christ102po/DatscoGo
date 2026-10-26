# DatscoGo: only deployment files (Neon + Render)

These files are ADDED to the ROOT of your existing DatscoGo project (the folder containing package.json). You do not need to delete or replace your existing application files.

## Included
- `render.yaml` — deploys the existing Express + Vite application on Render.
- `.env.example` — optional template for connecting locally. Keep your real `.env` private.

## Neon
1. At https://console.neon.tech create a project and a PostgreSQL database named `datscogo` (or another name you prefer).
2. Click **Connect**, select the correct database and copy the entire PostgreSQL connection string (pooled connection is suitable here).
3. **Do not paste this secret into source code or commit it to GitHub.**
4. DatscoGo's existing `server/index.ts` creates its required tables when the server starts; no SQL import is required for a new database.

## Render
1. Add `render.yaml` to your project's root, commit and push the change to GitHub.
2. At https://dashboard.render.com choose **New > Blueprint**, connect the repository, and review the `datscogo` service configuration.
3. Supply these environment variables privately when prompted:
   - `DATABASE_URL` = full Neon connection URL
   - `INITIAL_ADMIN_USERNAME` = choose an admin username
   - `INITIAL_ADMIN_PASSWORD` = unique strong admin password
4. Deploy. Render sets `NODE_ENV=production` automatically according to render.yaml.
5. Open the real URL shown on your Render service page. The first deployment builds the frontend and starts the Express API connected to Neon.
6. In Neon **SQL Editor**, verify tables were created:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

## Optional local test
1. Copy `.env.example` to `.env` in the project root and fill in your own connection URL/password.
2. Ensure you're using a recent Node.js version with `--env-file` support; run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
node --env-file=.env dist/index.js
```

3. Visit http://localhost:3000.

## Android note
This patch makes the existing website/API deployable with Neon. It does NOT yet configure the independently installed Capacitor APK to point to your Render server. Its existing `/api/...` relative requests work when the frontend is served by Render, but an offline-bundled APK requires additional API URL and authentication/cookie configuration. Do not claim the APK is ready until it is separately configured and tested.

## Free-tier limitations
Render's free service may spin down when inactive; initial requests may be delayed. Free tiers are for testing rather than reliable production live GPS tracking.
