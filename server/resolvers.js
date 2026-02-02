import {
  unitRepository,
  soldierRepository,
  equipmentRepository,
  missionRepository,
  tacticalEventRepository,
} from "./repositories/index.js";

export const TOPICS = {
  UNIT_LOCATION_UPDATED: "UNIT_LOCATION_UPDATED",
  TACTICAL_EVENT_CREATED: "TACTICAL_EVENT_CREATED",
  DASHBOARD_STATS_UPDATED: "DASHBOARD_STATS_UPDATED",
  UNIT_CREATED: "UNIT_CREATED",
  UNIT_UPDATED: "UNIT_UPDATED",
};

const USE_DATALOADER =
  String(process.env.USE_DATALOADER ?? "true").toLowerCase() !== "false";
const DEMO_SPAM =
  String(process.env.DEMO_SPAM ?? "true").toLowerCase() === "true";

class SimplePubSub {
  constructor() {
    this.subs = new Map();
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
    equipment: async (_, { id }, ctx) => {
      await simulateDelay(2);
      if (!USE_DATALOADER) {
        return equipmentRepository.getUnitEquipment(id);
      }
      return ctx.loaders.equipmentByUnitId.load(id);
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

  Mutation: {
    updateUnitLocation: async (_, { id, location }) => {
      const unit = await unitRepository.updateUnitLocation(id, location);
      if (!unit) throw new Error(`Unit ${id} not found`);
      pubsub.publish(TOPICS.UNIT_LOCATION_UPDATED, {
        unitLocationUpdated: unit,
      });
      return unit;
    },
    // Déclencheur manuel pour l'overlay front-end
    fireAlert: async (_, { severity, description }) => {
      const event = {
        id: crypto.randomUUID(),
        type: "MILITARY",
        severity: severity || 5,
        description: description || "ALERTE MANUELLE",
        timestamp: new Date().toISOString(),
        location: { coordinates: [50, 50] },
      };
      pubsub.publish(TOPICS.TACTICAL_EVENT_CREATED, {
        tacticalEventCreated: event,
      });
      return event;
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
  },
};

if (DEMO_SPAM) {
  console.log("📡 [SIMULATEUR] Mode dispersion maximale activé");

  setInterval(async () => {
    const units = await unitRepository.getAllUnits();
    if (units.length === 0) return;

    const unit = units[Math.floor(Math.random() * units.length)];

    // On génère des mouvements qui traversent vraiment la carte
    const newLoc = {
      coordinates: [
        // On rebondit entre 0 et 100 avec une variation de +/- 15
        Math.max(
          0,
          Math.min(
            100,
            (unit.location.coordinates[0] || 50) + (Math.random() - 0.5) * 30
          )
        ),
        Math.max(
          0,
          Math.min(
            100,
            (unit.location.coordinates[1] || 50) + (Math.random() - 0.5) * 30
          )
        ),
      ],
    };

    const updated = await unitRepository.updateUnitLocation(unit.id, newLoc);
    if (updated) {
      pubsub.publish(TOPICS.UNIT_LOCATION_UPDATED, {
        unitLocationUpdated: updated,
      });
    }
  }, 1200);
}
