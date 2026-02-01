// server/index.js (ESM) — FULL FILE
// HTTP GraphQL: http://localhost:4000/graphql
// WS Subscriptions: ws://localhost:4000/subscriptions

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';

import express from 'express';
import http from 'http';
import cors from 'cors';
import { performance } from 'node:perf_hooks';

import DataLoader from 'dataloader';

import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { typeDefs } from './schema.js';
import { resolvers, pubsub, TOPICS } from './resolvers.js';

import {
  mockUnits,
  mockSoldiers,
  mockEquipment,
  mockMissions,
  mockTacticalEvents,
  getUnitById,
  getUnitsByIds,
  getSoldiersByUnitId,
  getSoldiersByUnitIds,
  getEquipmentBySoldierIds,
  getMissionById,
} from './data.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --------------------
// HARD-CODED SETTINGS
// --------------------
const REST_LATENCY_MS = 80;
const REST_CPU_MS = 0;
const USE_DATALOADER = true;
// --------------------

const burnCpu = (ms) => {
  if (!ms || ms <= 0) return;
  const end = performance.now() + ms;
  while (performance.now() < end) {}
};

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // WS server (graphql-ws) [web:21]
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/subscriptions',
  });
  const serverCleanup = useServer({ schema }, wsServer);

  const logGraphqlPlugin = {
    async requestDidStart() {
      const start = Date.now();
      let operationName = 'anonymous';
      return {
        async didResolveOperation(ctx) {
          operationName = ctx.operationName || operationName;
        },
        async willSendResponse(ctx) {
          const ms = Date.now() - start;
          const bytes = JSON.stringify(ctx.response).length;
          console.log(`graphql op=${operationName} ms=${ms} bytes=${bytes} dataloader=${USE_DATALOADER}`);
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
  const allowed = new Set(['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']);

  const corsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      cb(null, allowed.has(origin));
    },
    credentials: true,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // REST latency + logging
  app.use('/api', async (req, res, next) => {
    const start = Date.now();

    if (REST_LATENCY_MS > 0) await sleep(REST_LATENCY_MS);
    if (REST_CPU_MS > 0) burnCpu(REST_CPU_MS);

    res.on('finish', () => {
      const ms = Date.now() - start;
      const bytes = Number(res.getHeader('content-length') ?? 0);
      console.log(`rest ${req.method} ${req.originalUrl} ms=${ms} bytes=${bytes}`);
    });

    next();
  });

  // GraphQL endpoint
  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const loaders = USE_DATALOADER
          ? {
              soldiersByUnitId: new DataLoader(async (unitIds) => {
                const map = getSoldiersByUnitIds(unitIds);
                return unitIds.map((id) => map.get(id) ?? []);
              }),
              equipmentBySoldierId: new DataLoader(async (soldierIds) => {
                const map = getEquipmentBySoldierIds(soldierIds);
                return soldierIds.map((id) => map.get(id) ?? []);
              }),
              unitsById: new DataLoader(async (unitIds) => {
                const map = getUnitsByIds(unitIds);
                return unitIds.map((id) => map.get(id) ?? null);
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
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // WOW: fire alert endpoint (POST)
  app.post('/api/demo/fire-alert', express.json(), (req, res) => {
    const severity = Number(req.body?.severity ?? 5);

    const event = {
      id: `EVT-${Date.now()}`,
      type: 'EXPLOSION',
      location: { coordinates: [48.8566 + Math.random() * 0.05, 2.3522 + Math.random() * 0.05] },
      timestamp: new Date().toISOString(),
      severity,
      description: `🔥 FIRE ALERT (manual) severity=${severity}`,
      involvedUnits: [],
    };

    console.log('FIRE_ALERT publish ->', TOPICS.TACTICAL_EVENT_CREATED, event.id);
    pubsub.publish(TOPICS.TACTICAL_EVENT_CREATED, { tacticalEventCreated: event });

    mockTacticalEvents.unshift(event);

    res.json({ ok: true, event });
  });

  // REST endpoints existants
  app.get('/api/units', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    res.json(mockUnits.slice(0, limit));
  });

  app.get('/api/units/:id', (req, res) => {
    const unit = getUnitById(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    res.json(unit);
  });

  app.get('/api/units/:id/soldiers', (req, res) => {
    res.json(getSoldiersByUnitId(req.params.id));
  });

  app.get('/api/units/:id/equipment', (req, res) => {
    const soldiers = getSoldiersByUnitId(req.params.id);
    const equipment = [];
    for (const s of soldiers) {
      for (const eq of s.equipment ?? []) equipment.push(eq);
    }
    res.json(equipment);
  });

  app.get('/api/dashboard/stats', (req, res) => {
    res.json({
      totalUnits: mockUnits.length,
      activeUnits: mockUnits.filter((u) => u.status === 'ACTIVE').length,
      totalSoldiers: mockSoldiers.length,
      activeMissions: mockMissions.filter((m) => m.status === 'IN_PROGRESS').length,
      recentEvents: mockTacticalEvents.filter((e) => {
        const eventDate = new Date(e.timestamp);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return eventDate > dayAgo;
      }).length,
      equipmentStatus: {
        operational: mockEquipment.filter((e) => e.status === 'ACTIVE').length,
        maintenance: mockEquipment.filter((e) => e.status === 'MAINTENANCE').length,
        deployed: mockEquipment.filter((e) => e.status === 'DEPLOYED').length,
      },
    });
  });

  app.get('/api/missions', (req, res) => {
    const status = req.query.status;
    let missions = mockMissions;
    if (status) missions = missions.filter((m) => m.status === status);
    res.json(missions);
  });

  app.get('/api/missions/:id', (req, res) => {
    const mission = getMissionById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    res.json(mission);
  });

  const PORT = process.env.PORT || 4000;
  await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));

  console.log(`
🚀 GraphQL (HTTP): http://localhost:${PORT}/graphql
📡 GraphQL (WS):   ws://localhost:${PORT}/subscriptions
📡 REST:           http://localhost:${PORT}/api
❤️  Health:        http://localhost:${PORT}/health
`);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
