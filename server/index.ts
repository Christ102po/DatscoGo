import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { mkdir, readFile, writeFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDirectory = process.env.DATSCO_DATA_DIR || path.resolve(process.cwd(), "data");
const publicStatePath = path.join(dataDirectory, "datscogo-public-state-v2.json");
const tripsPath = path.join(dataDirectory, "datscogo-trips-v2.json");

type JsonObject = Record<string, unknown>;

async function ensureDataDirectory() {
  await mkdir(dataDirectory, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await ensureDataDirectory();
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "1mb" }));

  // Security hardening headers middleware
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' https://*.openstreetmap.org https://cdnjs.cloudflare.com https://images.unsplash.com https://*.tile.openstreetmap.org https://www.google.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data: https: http:; connect-src 'self' https://*.openstreetmap.org https://router.project-osrm.org;"
    );
    next();
  });

  // Shared public transit configuration. This lets route/schedule/terminal edits
  // and announcements made by an administrator reach other devices using the
  // same hosted DatscoGo instance.
  app.get("/api/public-state", async (_req, res) => {
    const state = await readJson<JsonObject>(publicStatePath, {});
    res.setHeader("Cache-Control", "no-store");
    res.json(state);
  });

  app.put("/api/public-state", async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ ok: false, error: "Invalid public transit state." });
    }
    await writeJson(publicStatePath, body);
    res.json({ ok: true });
  });

  // Live vehicle positions are saved separately so a driver's frequent GPS
  // updates never overwrite route edits or announcements from the admin.
  app.get("/api/trips", async (_req, res) => {
    const trips = await readJson<unknown[]>(tripsPath, []);
    res.setHeader("Cache-Control", "no-store");
    res.json(Array.isArray(trips) ? trips : []);
  });

  app.put("/api/trips/:driverId", async (req, res) => {
    const driverId = String(req.params.driverId || "").trim();
    const trip = req.body;
    if (!driverId || !trip || typeof trip !== "object" || Array.isArray(trip) || String(trip.driverId || "") !== driverId) {
      return res.status(400).json({ ok: false, error: "Invalid live trip update." });
    }

    const trips = await readJson<JsonObject[]>(tripsPath, []);
    const nextTrips = [
      ...trips.filter((item) => String(item.driverId || "") !== driverId),
      trip as JsonObject,
    ];
    await writeJson(tripsPath, nextTrips);
    res.json({ ok: true });
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = Number(process.env.PORT) || 3000;

server.listen(port, "0.0.0.0", () => {
  console.log(`DatscoGo running on port ${port}`);
});
}

startServer().catch(console.error);
