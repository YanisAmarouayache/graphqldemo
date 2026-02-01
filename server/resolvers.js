// server/resolvers.js (ESM) — FULL FILE

import {
  mockUnits,
  mockSoldiers,
  mockEquipment,
  mockMissions,
  mockTacticalEvents,
  getUnitById,
  getSoldierById,
  getEquipmentById,
  getMissionById,
  getTacticalEventById,
  getSoldiersByUnitId,
  getEquipmentBySoldierId,
  simulateRealtimeUpdate,
} from './data.js';

// Topics (importés par server/index.js aussi)
export const TOPICS = {
  UNIT_LOCATION_UPDATED: 'UNIT_LOCATION_UPDATED',
  TACTICAL_EVENT_CREATED: 'TACTICAL_EVENT_CREATED',
  DASHBOARD_STATS_UPDATED: 'DASHBOARD_STATS_UPDATED',
  UNIT_CREATED: 'UNIT_CREATED',
  UNIT_UPDATED: 'UNIT_UPDATED',
};

// Toggle for demo (N+1 vs DataLoader batching)
const USE_DATALOADER = String(process.env.USE_DATALOADER ?? 'true').toLowerCase() !== 'false';

// WOW mode: par défaut pas de spam; active avec DEMO_SPAM=true
const DEMO_SPAM = String(process.env.DEMO_SPAM ?? 'false').toLowerCase() === 'true';

// Apollo: Subscription.subscribe doit retourner un AsyncIterator. [web:21]
class SimplePubSub {
  constructor() {
    this.subs = new Map(); // topic -> callbacks[]
  }

  publish(topic, payload) {
    const callbacks = this.subs.get(topic) || [];
    for (const cb of callbacks) cb(payload);
  }

  subscribe(topic, cb) {
    if (!this.subs.has(topic)) this.subs.set(topic, []);
    this.subs.get(topic).push(cb);

    return () => {
      const callbacks = this.subs.get(topic) || [];
      const idx = callbacks.indexOf(cb);
      if (idx >= 0) callbacks.splice(idx, 1);
    };
  }

  asyncIterator(topic) {
    const queue = [];
    let notify = null;

    const wait = () =>
      new Promise((resolve) => {
        notify = resolve;
      });

    const unsubscribe = this.subscribe(topic, (payload) => {
      queue.push(payload);
      if (notify) {
        const n = notify;
        notify = null;
        n();
      }
    });

    return (async function* () {
      try {
        while (true) {
          if (queue.length === 0) await wait();
          yield queue.shift();
        }
      } finally {
        unsubscribe();
      }
    })();
  }
}

export const pubsub = new SimplePubSub();

// Simulate network delay
const simulateDelay = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

export const resolvers = {
  Query: {
    units: async (_, { filter, first = 10, after }) => {
      await simulateDelay(5);

      let filteredUnits = mockUnits;

      if (filter?.status) filteredUnits = filteredUnits.filter((u) => u.status === filter.status);
      if (filter?.search) {
        const search = filter.search.toLowerCase();
        filteredUnits = filteredUnits.filter((u) => u.name.toLowerCase().includes(search));
      }

      const startIndex = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const endIndex = startIndex + first;
      const paginatedUnits = filteredUnits.slice(startIndex, endIndex);

      return {
        edges: paginatedUnits.map((unit, index) => ({
          node: unit,
          cursor: Buffer.from(String(startIndex + index + 1)).toString('base64'),
        })),
        pageInfo: {
          hasNextPage: endIndex < filteredUnits.length,
          endCursor: Buffer.from(String(endIndex)).toString('base64'),
          totalCount: filteredUnits.length,
        },
      };
    },

    unit: async (_, { id }) => {
      await simulateDelay(2);
      return getUnitById(id) || null;
    },

    allUnits: async () => {
      await simulateDelay(10);
      return mockUnits;
    },

    soldiers: async (_, { unitId }) => {
      await simulateDelay(5);
      if (unitId) return getSoldiersByUnitId(unitId);
      return mockSoldiers;
    },

    soldier: async (_, { id }) => {
      await simulateDelay(2);
      return getSoldierById(id) || null;
    },

    equipment: async (_, { id }) => {
      await simulateDelay(2);
      return getEquipmentById(id) || null;
    },

    allEquipment: async () => {
      await simulateDelay(10);
      return mockEquipment;
    },

    equipmentByType: async (_, { type }) => {
      await simulateDelay(5);
      return mockEquipment.filter((e) => e.type === type);
    },

    missions: async (_, { status }) => {
      await simulateDelay(10);
      if (status) return mockMissions.filter((m) => m.status === status);
      return mockMissions;
    },

    mission: async (_, { id }) => {
      await simulateDelay(2);
      return getMissionById(id) || null;
    },

    tacticalEvents: async (_, { severity }) => {
      await simulateDelay(10);
      if (severity !== undefined) return mockTacticalEvents.filter((e) => e.severity >= severity);
      return mockTacticalEvents;
    },

    tacticalEvent: async (_, { id }) => {
      await simulateDelay(2);
      return getTacticalEventById(id) || null;
    },

    dashboardStats: async () => {
      await simulateDelay(10);

      return {
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
      };
    },
  },

  Unit: {
    soldiers: async (unit, _, ctx) => {
      if (!USE_DATALOADER) {
        ctx.counters.unitSoldiersCalls++;
        await simulateDelay(2);
        return getSoldiersByUnitId(unit.id);
      }
      return ctx.loaders.soldiersByUnitId.load(unit.id);
    },

    equipment: async (unit, _, ctx) => {
      const soldiers = await resolvers.Unit.soldiers(unit, _, ctx);

      if (!USE_DATALOADER) {
        const out = [];
        for (const s of soldiers) {
          ctx.counters.soldierEquipmentCalls++;
          await simulateDelay(1);
          out.push(...getEquipmentBySoldierId(s.id));
        }
        return out;
      }

      const lists = await Promise.all(soldiers.map((s) => ctx.loaders.equipmentBySoldierId.load(s.id)));
      return lists.flat();
    },
  },

  Soldier: {
    equipment: async (soldier, _, ctx) => {
      if (!USE_DATALOADER) {
        ctx.counters.soldierEquipmentCalls++;
        await simulateDelay(1);
        return getEquipmentBySoldierId(soldier.id);
      }
      return ctx.loaders.equipmentBySoldierId.load(soldier.id);
    },
  },

  Mutation: {
    createUnit: async (_, { input }) => {
      await simulateDelay(50);

      const newUnit = {
        id: `UNT-${String(mockUnits.length + 1).padStart(4, '0')}`,
        name: input.name,
        status: input.status,
        location: input.location,
        commander: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockUnits.push(newUnit);

      pubsub.publish(TOPICS.UNIT_CREATED, { unitCreated: newUnit });
      return { unit: newUnit };
    },

    updateUnit: async (_, { input }) => {
      await simulateDelay(30);

      const unit = getUnitById(input.id);
      if (!unit) throw new Error(`Unit with id ${input.id} not found`);

      if (input.name) unit.name = input.name;
      if (input.status) unit.status = input.status;
      if (input.location) unit.location = input.location;
      unit.updatedAt = new Date().toISOString();

      pubsub.publish(TOPICS.UNIT_UPDATED, { unitUpdated: unit });
      return { unit };
    },

    updateUnitLocation: async (_, { id, location }) => {
      await simulateDelay(10);

      const unit = getUnitById(id);
      if (!unit) throw new Error(`Unit with id ${id} not found`);

      unit.location = location;
      unit.updatedAt = new Date().toISOString();

      pubsub.publish(TOPICS.UNIT_LOCATION_UPDATED, { unitLocationUpdated: unit });
      return unit;
    },
  },

  Subscription: {
    unitLocationUpdated: {
      subscribe: () => pubsub.asyncIterator(TOPICS.UNIT_LOCATION_UPDATED),
    },

    tacticalEventCreated: {
      subscribe: () => pubsub.asyncIterator(TOPICS.TACTICAL_EVENT_CREATED),
    },

    dashboardStatsUpdated: {
      subscribe: () => pubsub.asyncIterator(TOPICS.DASHBOARD_STATS_UPDATED),
    },

    unitUpdated: {
      subscribe: () => pubsub.asyncIterator(TOPICS.UNIT_UPDATED),
    },
  },
};

// --------------------
// Simulateurs (désactivés par défaut)
// --------------------
if (DEMO_SPAM) {
  console.log('[DEMO_SPAM] enabled: auto-publishing subscription events');

  // unitLocationUpdated auto
  setInterval(() => {
    const update = simulateRealtimeUpdate?.();
    if (!update) return;

    const unit = getUnitById(update.unitId);
    if (!unit) return;

    pubsub.publish(TOPICS.UNIT_LOCATION_UPDATED, { unitLocationUpdated: unit });
  }, 1000);

  // tacticalEventCreated auto (fait tourner la liste existante)
  let tacticalIdx = 0;
  setInterval(() => {
    if (mockTacticalEvents.length === 0) return;
    const ev = mockTacticalEvents[tacticalIdx % mockTacticalEvents.length];
    tacticalIdx++;

    pubsub.publish(TOPICS.TACTICAL_EVENT_CREATED, { tacticalEventCreated: ev });
  }, 5000);

  // dashboardStatsUpdated auto
  setInterval(() => {
    const equipmentStatus = {
      operational: mockEquipment.filter((e) => e.status === 'ACTIVE').length,
      maintenance: mockEquipment.filter((e) => e.status === 'MAINTENANCE').length,
      deployed: mockEquipment.filter((e) => e.status === 'DEPLOYED').length,
    };

    pubsub.publish(TOPICS.DASHBOARD_STATS_UPDATED, {
      dashboardStatsUpdated: {
        totalUnits: mockUnits.length,
        activeUnits: mockUnits.filter((u) => u.status === 'ACTIVE').length,
        totalSoldiers: mockSoldiers.length,
        activeMissions: mockMissions.filter((m) => m.status === 'IN_PROGRESS').length,
        recentEvents: mockTacticalEvents.filter((e) => {
          const eventDate = new Date(e.timestamp);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return eventDate > dayAgo;
        }).length,
        equipmentStatus,
      },
    });
  }, 3000);
}
