import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";

import express from "express";
import http from "http";
import cors from "cors";
import { performance } from "node:perf_hooks";

import DataLoader from "dataloader";

import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import { makeExecutableSchema } from "@graphql-tools/schema";

import { typeDefs } from "./schema.js";
import { resolvers, pubsub, TOPICS } from "./resolvers.js";

import { testConnection } from "./db.js";
import {
  unitRepository,
  soldierRepository,
  equipmentRepository,
  missionRepository,
  tacticalEventRepository,
} from "./repositories/index.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --------------------
// HARD-CODED SETTINGS
// --------------------
const REST_LATENCY_MS = Number(process.env.REST_LATENCY_MS || 40);
const REST_CPU_MS = Number(process.env.REST_CPU_MS || 0);
const USE_DATALOADER =
  String(process.env.USE_DATALOADER ?? "true").toLowerCase() !== "false";
// --------------------

const burnCpu = (ms) => {
  if (!ms || ms <= 0) return;
  const end = performance.now() + ms;
  while (performance.now() < end) {}
};

async function startServer() {
  // Test database connection first
  console.log("🔌 Testing database connection...");
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error(
      "❌ Failed to connect to database. Please check your configuration."
    );
    console.error("Make sure PostgreSQL is running and the database exists.");
    process.exit(1);
  }

  const app = express();
  const httpServer = http.createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // WS server (graphql-ws) [web:21]
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/subscriptions",
  });
  const serverCleanup = useServer({ schema }, wsServer);

  const logGraphqlPlugin = {
    async requestDidStart() {
      const start = Date.now();
      let operationName = "anonymous";
      return {
        async didResolveOperation(ctx) {
          operationName = ctx.operationName || operationName;
        },
        async willSendResponse(ctx) {
          const ms = Date.now() - start;
          const bytes = JSON.stringify(ctx.response).length;
          console.log(
            `graphql op=${operationName} ms=${ms} bytes=${bytes} dataloader=${USE_DATALOADER}`
          );
        },
      };
    },
  };

  const server = new ApolloServer({
    schema,
    introspection: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
      logGraphqlPlugin,
    ],
  });

  await server.start();

  // CORS
  const allowed = new Set([
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
  ]);

  const corsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      cb(null, allowed.has(origin));
    },
    credentials: true,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  // REST latency + logging
  app.use("/api", async (req, res, next) => {
    const start = Date.now();

    if (REST_LATENCY_MS > 0) await sleep(REST_LATENCY_MS);
    if (REST_CPU_MS > 0) burnCpu(REST_CPU_MS);

    res.on("finish", () => {
      const ms = Date.now() - start;
      const bytes = Number(res.getHeader("content-length") ?? 0);
      console.log(
        `rest ${req.method} ${req.originalUrl} ms=${ms} bytes=${bytes}`
      );
    });

    next();
  });

  // GraphQL endpoint
  app.use(
    "/graphql",
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const loaders = USE_DATALOADER
          ? {
              soldiersByUnitId: new DataLoader(async (unitIds) => {
                const map = await soldierRepository.getSoldiersByUnitIds(
                  unitIds
                );
                return unitIds.map((id) => map.get(id) ?? []);
              }),
              equipmentBySoldierId: new DataLoader(async (soldierIds) => {
                const map = await equipmentRepository.getEquipmentBySoldierIds(
                  soldierIds
                );
                return soldierIds.map((id) => map.get(id) ?? []);
              }),
              unitsById: new DataLoader(async (unitIds) => {
                const map = await unitRepository.getUnitsByIds(unitIds);
                return unitIds.map((id) => map.get(id) ?? null);
              }),
              equipmentByUnitId: new DataLoader(async (unitIds) => {
                const map = await equipmentRepository.getEquipmentByUnitIds(
                  unitIds
                );
                return unitIds.map((id) => map.get(id) || []);
              }),
            }
          : null;

        return {
          token: req.headers.authorization,
          loaders,
          counters: { unitSoldiersCalls: 0, soldierEquipmentCalls: 0 },
        };
      },
    })
  );

  // Health
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  });

  // WOW: fire alert endpoint (POST)
  app.post("/api/demo/fire-alert", express.json(), async (req, res) => {
    const severity = Number(req.body?.severity ?? 5);

    const event = await tacticalEventRepository.createTacticalEvent({
      type: "EXPLOSION",
      severity,
      description: `🔥 FIRE ALERT (manual) severity=${severity}`,
      location: {
        coordinates: [
          48.8566 + Math.random() * 0.05,
          2.3522 + Math.random() * 0.05,
        ],
      },
    });

    console.log(
      "FIRE_ALERT publish ->",
      TOPICS.TACTICAL_EVENT_CREATED,
      event.id
    );
    pubsub.publish(TOPICS.TACTICAL_EVENT_CREATED, {
      tacticalEventCreated: event,
    });

    res.json({ ok: true, event });
  });

  // REST endpoints - PostgreSQL version
  app.get("/api/units", async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const units = await unitRepository.getAllUnits();
    res.json(units.slice(0, limit));
  });

  app.get("/api/units/:id", async (req, res) => {
    const unit = await unitRepository.getUnitById(req.params.id);
    if (!unit) return res.status(404).json({ error: "Unit not found" });
    res.json(unit);
  });

  app.get("/api/units/:id/soldiers", async (req, res) => {
    const soldiers = await soldierRepository.getSoldiersByUnitId(req.params.id);
    res.json(soldiers);
  });

  app.get("/api/units/:id/equipment", async (req, res) => {
    const equipment = await equipmentRepository.getUnitEquipment(req.params.id);
    res.json(equipment);
  });

  app.get("/api/dashboard/stats", async (req, res) => {
    const stats = await unitRepository.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/missions", async (req, res) => {
    const status = req.query.status;
    let missions;
    if (status) {
      missions = await missionRepository.getMissionsByStatus(status);
    } else {
      missions = await missionRepository.getAllMissions();
    }
    res.json(missions);
  });

  app.get("/api/missions/:id", async (req, res) => {
    const mission = await missionRepository.getMissionById(req.params.id);
    if (!mission) return res.status(404).json({ error: "Mission not found" });
    res.json(mission);
  });

  app.get("/api/soldiers", async (req, res) => {
    const soldiers = await soldierRepository.getAllSoldiers();
    res.json(soldiers);
  });

  app.get("/api/soldiers/:id", async (req, res) => {
    const soldier = await soldierRepository.getSoldierById(req.params.id);
    if (!soldier) return res.status(404).json({ error: "Soldier not found" });
    res.json(soldier);
  });

  app.get("/api/equipment", async (req, res) => {
    const equipment = await equipmentRepository.getAllEquipment();
    res.json(equipment);
  });

  app.get("/api/equipment/:id", async (req, res) => {
    const item = await equipmentRepository.getEquipmentById(req.params.id);
    if (!item) return res.status(404).json({ error: "Equipment not found" });
    res.json(item);
  });

  app.get("/api/tactical-events", async (req, res) => {
    const severity = req.query.severity
      ? parseInt(req.query.severity)
      : undefined;
    let events;
    if (severity !== undefined) {
      events = await tacticalEventRepository.getTacticalEventsBySeverity(
        severity
      );
    } else {
      events = await tacticalEventRepository.getAllTacticalEvents();
    }
    res.json(events);
  });

  const PORT = process.env.PORT || 4000;
  await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));

  console.log(`
🚀 GraphQL (HTTP): http://localhost:${PORT}/graphql
📡 GraphQL (WS):   ws://localhost:${PORT}/subscriptions
📡 REST:           http://localhost:${PORT}/api
❤️  Health:        http://localhost:${PORT}/health
🗄️  Database:      PostgreSQL (connected)
`);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
