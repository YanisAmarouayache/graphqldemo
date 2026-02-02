import {
  unitRepository,
  soldierRepository,
  equipmentRepository,
  missionRepository,
  tacticalEventRepository,
} from "./repositories/index.js";

// Topics (importés par server/index.js aussi)
export const TOPICS = {
  UNIT_LOCATION_UPDATED: "UNIT_LOCATION_UPDATED",
  TACTICAL_EVENT_CREATED: "TACTICAL_EVENT_CREATED",
  DASHBOARD_STATS_UPDATED: "DASHBOARD_STATS_UPDATED",
  UNIT_CREATED: "UNIT_CREATED",
  UNIT_UPDATED: "UNIT_UPDATED",
};

// Toggle for demo (N+1 vs DataLoader batching)
const USE_DATALOADER =
  String(process.env.USE_DATALOADER ?? "true").toLowerCase() !== "false";

// WOW mode: par défaut pas de spam; active avec DEMO_SPAM=true
const DEMO_SPAM =
  String(process.env.DEMO_SPAM ?? "false").toLowerCase() === "true";

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

// Simulate network delay (optional, for demo purposes)
const simulateDelay = (ms = 0) => {
  if (ms === 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const resolvers = {
  Query: {
    units: async (_, { filter, first = 10, after }) => {
      await simulateDelay(5);
      return unitRepository.getUnits(filter || {}, first, after);
    },

    unit: async (_, { id }) => {
      await simulateDelay(2);
      return unitRepository.getUnitById(id);
    },

    allUnits: async () => {
      await simulateDelay(10);
      return unitRepository.getAllUnits();
    },

    soldiers: async (_, { unitId }) => {
      await simulateDelay(5);
      if (unitId) return soldierRepository.getSoldiersByUnitId(unitId);
      return soldierRepository.getAllSoldiers();
    },

    soldier: async (_, { id }) => {
      await simulateDelay(2);
      return soldierRepository.getSoldierById(id);
    },

    equipment: async (_, { id }) => {
      await simulateDelay(2);
      return equipmentRepository.getEquipmentById(id);
    },

    allEquipment: async () => {
      await simulateDelay(10);
      return equipmentRepository.getAllEquipment();
    },

    equipmentByType: async (_, { type }) => {
      await simulateDelay(5);
      return equipmentRepository.getEquipmentByType(type);
    },

    missions: async (_, { status }) => {
      await simulateDelay(10);
      if (status) return missionRepository.getMissionsByStatus(status);
      return missionRepository.getAllMissions();
    },

    mission: async (_, { id }) => {
      await simulateDelay(2);
      return missionRepository.getMissionById(id);
    },

    tacticalEvents: async (_, { severity }) => {
      await simulateDelay(10);
      if (severity !== undefined)
        return tacticalEventRepository.getTacticalEventsBySeverity(severity);
      return tacticalEventRepository.getAllTacticalEvents();
    },

    tacticalEvent: async (_, { id }) => {
      await simulateDelay(2);
      return tacticalEventRepository.getTacticalEventById(id);
    },

    dashboardStats: async () => {
      await simulateDelay(10);
      return unitRepository.getDashboardStats();
    },
  },

  Unit: {
    soldiers: async (unit, _, ctx) => {
      if (!USE_DATALOADER) {
        ctx.counters.unitSoldiersCalls++;
        await simulateDelay(2);
        return soldierRepository.getSoldiersByUnitId(unit.id);
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
          out.push(
            ...(await equipmentRepository.getEquipmentBySoldierId(s.id))
          );
        }
        return out;
      }

      const lists = await Promise.all(
        soldiers.map((s) => ctx.loaders.equipmentBySoldierId.load(s.id))
      );
      return lists.flat();
    },

    commander: async (unit) => {
      if (!unit.commander) return null;
      // If commander is just an ID object, fetch full details
      if (unit.commander.id && !unit.commander.name) {
        return soldierRepository.getSoldierById(unit.commander.id);
      }
      return unit.commander;
    },
  },

  Soldier: {
    equipment: async (soldier, _, ctx) => {
      if (!USE_DATALOADER) {
        ctx.counters.soldierEquipmentCalls++;
        await simulateDelay(1);
        return equipmentRepository.getEquipmentBySoldierId(soldier.id);
      }
      return ctx.loaders.equipmentBySoldierId.load(soldier.id);
    },
  },

  Mission: {
    units: async (mission) => {
      return missionRepository.getMissionUnits(mission.id);
    },
  },

  TacticalEvent: {
    involvedUnits: async (event) => {
      return tacticalEventRepository.getInvolvedUnitIds(event.id);
    },
  },

  Mutation: {
    createUnit: async (_, { input }) => {
      await simulateDelay(50);

      const unit = await unitRepository.createUnit(input);

      pubsub.publish(TOPICS.UNIT_CREATED, { unitCreated: unit });
      return { unit };
    },

    updateUnit: async (_, { input }) => {
      await simulateDelay(30);

      const unit = await unitRepository.updateUnit(input.id, input);
      if (!unit) throw new Error(`Unit with id ${input.id} not found`);

      pubsub.publish(TOPICS.UNIT_UPDATED, { unitUpdated: unit });
      return { unit };
    },

    updateUnitLocation: async (_, { id, location }) => {
      await simulateDelay(10);

      const unit = await unitRepository.updateUnitLocation(id, location);
      if (!unit) throw new Error(`Unit with id ${id} not found`);

      pubsub.publish(TOPICS.UNIT_LOCATION_UPDATED, {
        unitLocationUpdated: unit,
      });
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
  console.log("[DEMO_SPAM] enabled: auto-publishing subscription events");

  // unitLocationUpdated auto
  setInterval(async () => {
    const units = await unitRepository.getAllUnits();
    if (units.length === 0) return;

    const randomUnit = units[Math.floor(Math.random() * units.length)];
    if (!randomUnit) return;

    // Update location slightly
    const newLocation = {
      coordinates: [
        randomUnit.location.coordinates[0] + (Math.random() - 0.5) * 0.01,
        randomUnit.location.coordinates[1] + (Math.random() - 0.5) * 0.01,
      ],
    };

    const updatedUnit = await unitRepository.updateUnitLocation(
      randomUnit.id,
      newLocation
    );
    if (updatedUnit) {
      pubsub.publish(TOPICS.UNIT_LOCATION_UPDATED, {
        unitLocationUpdated: updatedUnit,
      });
    }
  }, 1000);

  // tacticalEventCreated auto
  let tacticalIdx = 0;
  setInterval(async () => {
    const events = await tacticalEventRepository.getAllTacticalEvents();
    if (events.length === 0) return;

    const ev = events[tacticalIdx % events.length];
    tacticalIdx++;

    pubsub.publish(TOPICS.TACTICAL_EVENT_CREATED, { tacticalEventCreated: ev });
  }, 5000);

  // dashboardStatsUpdated auto
  setInterval(async () => {
    const stats = await unitRepository.getDashboardStats();
    pubsub.publish(TOPICS.DASHBOARD_STATS_UPDATED, {
      dashboardStatsUpdated: stats,
    });
  }, 3000);
}
