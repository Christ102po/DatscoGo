import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  databaseHealth,
  getCurrentTrips,
  getPublicTransitState,
  getTripHistory,
  initPostgresTransitStore,
  replacePublicTransitState,
  upsertTrip,
} from "./postgresTransitStore";

import {
  arriveDriverTrip,
  clearOperationalData,
  createDriver,
  createRoute,
  createSchedule,
  createTerminal,
  deleteDriver,
  deleteRoute,
  deleteSchedule,
  deleteTerminal,
  getAdminTrips,
  loadData,
  publicSnapshot,
  startDriverTrip,
  updateDriver,
  updateDriverLocation,
  updateRoute,
  updateSchedule,
  updateTerminal,
} from "./datscoStore";

const app = express();
const port = Number(process.env.PORT || 3000);
const adminKey = process.env.ADMIN_KEY || "datscogo-admin-2026";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runningFromDist = path.basename(__dirname) === "dist";
const isProduction = process.env.NODE_ENV === "production" || runningFromDist;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// Public/user APIs are intentionally accessible from the Capacitor Android WebView.
// Admin mutations still require the private x-admin-key header.
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
}
app.use("/api", noStore);

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const provided = String(req.header("x-admin-key") || "");
  if (!provided || provided !== adminKey) {
    res.status(401).json({ error: "Invalid admin access key." });
    return;
  }
  next();
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      res.status(400).json({ error: message });
    });
  };
}

type SseClient = Response;
const liveClients = new Set<SseClient>();

function broadcast(type: string, payload: unknown) {
  const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of Array.from(liveClients)) {
    try {
      client.write(message);
    } catch {
      liveClients.delete(client);
    }
  }
}

async function broadcastSnapshot() {
  const data = await loadData();
  broadcast("snapshot", publicSnapshot(data));
}

// Final-UI shared transit state. These endpoints are backed by PostgreSQL so
// admin changes and driver trip updates are shared across phones/devices.
app.get(
  "/api/public-state",
  asyncRoute(async (_req, res) => {
    res.json(await getPublicTransitState());
  }),
);

app.put(
  "/api/public-state",
  asyncRoute(async (req, res) => {
    const state = await replacePublicTransitState(req.body);
    broadcast("public-state", state);
    res.json(state);
  }),
);

app.get(
  "/api/trips",
  asyncRoute(async (_req, res) => {
    res.json(await getCurrentTrips());
  }),
);

app.put(
  "/api/trips/:driverId",
  asyncRoute(async (req, res) => {
    const trip = await upsertTrip(req.params.driverId, req.body);
    broadcast("shared-trip", trip);
    res.json(trip);
  }),
);

app.get(
  "/api/trip-history",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    res.json(await getTripHistory());
  }),
);

app.get(
  "/api/datsco/snapshot",
  asyncRoute(async (_req, res) => {
    const data = await loadData();
    res.json(publicSnapshot(data));
  }),
);

app.get("/api/datsco/live", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  liveClients.add(res);

  const data = await loadData();
  res.write(`event: snapshot\ndata: ${JSON.stringify(publicSnapshot(data))}\n\n`);
  const keepAlive = setInterval(() => {
    try {
      res.write(`: keep-alive ${Date.now()}\n\n`);
    } catch {
      clearInterval(keepAlive);
      liveClients.delete(res);
    }
  }, 20_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    liveClients.delete(res);
  });
});

app.get("/api/datsco/admin/verify", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

app.get(
  "/api/datsco/admin/trips",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    res.json(await getAdminTrips());
  }),
);

app.post(
  "/api/datsco/admin/terminals",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await createTerminal(req.body);
    await broadcastSnapshot();
    res.status(201).json(item);
  }),
);

app.put(
  "/api/datsco/admin/terminals/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await updateTerminal(req.params.id, req.body);
    await broadcastSnapshot();
    res.json(item);
  }),
);

app.delete(
  "/api/datsco/admin/terminals/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await deleteTerminal(req.params.id);
    await broadcastSnapshot();
    res.status(204).end();
  }),
);

app.post(
  "/api/datsco/admin/routes",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await createRoute(req.body);
    await broadcastSnapshot();
    res.status(201).json(item);
  }),
);

app.put(
  "/api/datsco/admin/routes/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await updateRoute(req.params.id, req.body);
    await broadcastSnapshot();
    res.json(item);
  }),
);

app.delete(
  "/api/datsco/admin/routes/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await deleteRoute(req.params.id);
    await broadcastSnapshot();
    res.status(204).end();
  }),
);

app.post(
  "/api/datsco/admin/schedules",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await createSchedule(req.body);
    await broadcastSnapshot();
    res.status(201).json(item);
  }),
);

app.put(
  "/api/datsco/admin/schedules/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await updateSchedule(req.params.id, req.body);
    await broadcastSnapshot();
    res.json(item);
  }),
);

app.delete(
  "/api/datsco/admin/schedules/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await deleteSchedule(req.params.id);
    await broadcastSnapshot();
    res.status(204).end();
  }),
);

app.post(
  "/api/datsco/admin/drivers",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await createDriver(req.body);
    await broadcastSnapshot();
    res.status(201).json(item);
  }),
);

app.put(
  "/api/datsco/admin/drivers/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const item = await updateDriver(req.params.id, req.body);
    await broadcastSnapshot();
    res.json(item);
  }),
);

app.delete(
  "/api/datsco/admin/drivers/:id",
  requireAdmin,
  asyncRoute(async (req, res) => {
    await deleteDriver(req.params.id);
    await broadcastSnapshot();
    res.status(204).end();
  }),
);

app.post(
  "/api/datsco/admin/clear",
  requireAdmin,
  asyncRoute(async (_req, res) => {
    await clearOperationalData();
    await broadcastSnapshot();
    res.json({ ok: true });
  }),
);

app.post(
  "/api/datsco/driver-trip/start",
  asyncRoute(async (req, res) => {
    const result = await startDriverTrip(req.body);
    broadcast("trip-started", result);
    await broadcastSnapshot();
    res.status(201).json({ ok: true, ...result });
  }),
);

app.post(
  "/api/datsco/driver-location",
  asyncRoute(async (req, res) => {
    const result = await updateDriverLocation(req.body);
    broadcast("driver-location", result);
    res.json({ ok: true, ...result });
  }),
);

app.post(
  "/api/datsco/driver-trip/arrive",
  asyncRoute(async (req, res) => {
    const result = await arriveDriverTrip(req.body);
    broadcast("trip-arrived", result);
    await broadcastSnapshot();
    res.json({ ok: true, ...result });
  }),
);

app.get(
  "/api/health",
  asyncRoute(async (_req, res) => {
    const database = await databaseHealth();
    res.json({ ok: true, database, liveClients: liveClients.size });
  }),
);

async function start() {
  if (process.env.DATABASE_URL) {
    await initPostgresTransitStore();
    console.log("PostgreSQL transit store ready.");
  } else {
    console.warn("DATABASE_URL is not set. Shared PostgreSQL transit sync is disabled in this environment.");
  }

  if (isProduction) {
    const publicDir = path.resolve(__dirname, "public");
    app.use(express.static(publicDir, { etag: true, maxAge: "1h" }));
    app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`DatscoGo running on http://localhost:${port}`);
    if (!process.env.ADMIN_KEY) {
      console.warn("ADMIN_KEY is not set. Local default is datscogo-admin-2026. Set ADMIN_KEY before deployment.");
    }
    console.log("Shared final-UI transit data: PostgreSQL (DATABASE_URL).");
    console.log(
      process.env.DATSCO_DATA_FILE
        ? `Legacy /api/datsco store: ${process.env.DATSCO_DATA_FILE}`
        : `Legacy /api/datsco store: ${path.resolve(process.cwd(), "data", "datscogo.json")}`,
    );
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
