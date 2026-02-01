import { Status, Rank, EquipmentType, EventCategoryCode } from './enums.js';

// --------- Helpers
const generateId = (prefix, index) => `${prefix}-${String(index).padStart(4, '0')}`;

const generatePoint = (baseLat, baseLng, variance = 0.5) => ({
  coordinates: [
    baseLat + (Math.random() - 0.5) * variance,
    baseLng + (Math.random() - 0.5) * variance,
  ],
});

const ranks = Object.values(Rank);
const statuses = Object.values(Status);
const equipmentTypes = Object.values(EquipmentType);
const eventTypes = Object.values(EventCategoryCode);

// Big volumes (override with env if needed)
const N_EQUIPMENT = Number(process.env.N_EQUIPMENT ?? 10_000);
const N_SOLDIERS = Number(process.env.N_SOLDIERS ?? 50_000);
const N_UNITS = Number(process.env.N_UNITS ?? 5_000);
const N_MISSIONS = Number(process.env.N_MISSIONS ?? 2_000);
const N_EVENTS = Number(process.env.N_EVENTS ?? 3_000);

// --------- Equipment
export const mockEquipment = Array.from({ length: N_EQUIPMENT }, (_, i) => ({
  id: generateId('EQP', i + 1),
  name: `Equipment ${i + 1}`,
  type: equipmentTypes[i % equipmentTypes.length],
  status: statuses[i % statuses.length],
  serialNumber: `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
  assignedTo: null,
}));

const equipmentById = new Map(mockEquipment.map((e) => [e.id, e]));

// --------- Soldiers
export const mockSoldiers = Array.from({ length: N_SOLDIERS }, (_, i) => {
  const eqId1 = mockEquipment[i % N_EQUIPMENT]?.id;
  const eqId2 = mockEquipment[(i + 100) % N_EQUIPMENT]?.id;

  const equipment = [];
  if (eqId1) equipment.push(equipmentById.get(eqId1));
  if (eqId2) equipment.push(equipmentById.get(eqId2));

  const unitIndex = (i % N_UNITS) + 1;

  const soldier = {
    id: generateId('SLD', i + 1),
    name: `Soldier ${i + 1}`,
    rank: ranks[i % ranks.length],
    status: statuses[i % statuses.length],
    unitId: generateId('UNT', unitIndex),
    specialization: ['Infantry', 'Medic', 'Engineer', 'Communication', 'Recon'][i % 5],
    equipment: equipment.filter(Boolean),
  };

  // assign equipment (no extra pass)
  for (const eq of soldier.equipment) {
    if (eq) eq.assignedTo = soldier.id;
  }

  return soldier;
});

const soldiersById = new Map(mockSoldiers.map((s) => [s.id, s]));

// Group soldiers by unitId
const soldiersByUnitId = new Map();
for (const s of mockSoldiers) {
  const arr = soldiersByUnitId.get(s.unitId);
  if (arr) arr.push(s);
  else soldiersByUnitId.set(s.unitId, [s]);
}

// Group equipment by soldierId (from soldier.equipment references)
const equipmentBySoldierId = new Map();
for (const s of mockSoldiers) {
  equipmentBySoldierId.set(s.id, s.equipment ?? []);
}

// --------- Units (NOTE: units are "light"; relationships resolved in GraphQL field resolvers)
export const mockUnits = Array.from({ length: N_UNITS }, (_, i) => {
  const unitId = generateId('UNT', i + 1);
  const unitSoldiers = soldiersByUnitId.get(unitId) ?? [];

  return {
    id: unitId,
    name: `Unit ${i + 1} - ${['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'][i % 5]}`,
    status: statuses[i % statuses.length],
    location: generatePoint(48.8566, 2.3522, 2),
    commander: unitSoldiers.find((s) => s.rank === Rank.CAPTAIN || s.rank === Rank.MAJOR) || null,
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
});

const unitsById = new Map(mockUnits.map((u) => [u.id, u]));

// --------- Missions
export const mockMissions = Array.from({ length: N_MISSIONS }, (_, i) => ({
  id: generateId('MSN', i + 1),
  name: `Mission ${i + 1} - ${['Patrol', 'Assault', 'Recon', 'Support', 'Evacuation'][i % 5]}`,
  status: ['PLANNED', 'IN_PROGRESS', 'COMPLETED'][i % 3],
  units: [mockUnits[i % N_UNITS], mockUnits[(i + 1) % N_UNITS], mockUnits[(i + 2) % N_UNITS]].filter(Boolean),
  objective: `Objective ${i + 1}: Secure sector ${String.fromCharCode(65 + (i % 26))}`,
  location: generatePoint(48.8566, 2.3522, 1),
  startTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  endTime: i % 3 === 2 ? new Date().toISOString() : null,
}));

const missionsById = new Map(mockMissions.map((m) => [m.id, m]));

// --------- Tactical events
export const mockTacticalEvents = Array.from({ length: N_EVENTS }, (_, i) => ({
  id: generateId('EVT', i + 1),
  type: eventTypes[i % eventTypes.length],
  location: generatePoint(48.8566, 2.3522, 3),
  timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  severity: Math.floor(Math.random() * 5) + 1,
  description: `Tactical event ${i + 1} detected in sector ${String.fromCharCode(65 + (i % 26))}`,
  involvedUnits: [
    generateId('UNT', (i % N_UNITS) + 1),
    generateId('UNT', ((i + 1) % N_UNITS) + 1),
  ],
}));

const eventsById = new Map(mockTacticalEvents.map((e) => [e.id, e]));

// --------- Single lookups (fast)
export const getUnitById = (id) => unitsById.get(id);
export const getUnitsByIds = (ids) => {
  const map = new Map();
  for (const id of ids) map.set(id, unitsById.get(id) ?? null);
  return map;
};

export const getSoldierById = (id) => soldiersById.get(id);
export const getEquipmentById = (id) => equipmentById.get(id);
export const getMissionById = (id) => missionsById.get(id);
export const getTacticalEventById = (id) => eventsById.get(id);

// --------- Batch helpers for DataLoader
export const getSoldiersByUnitId = (unitId) => soldiersByUnitId.get(unitId) ?? [];
export const getSoldiersByUnitIds = (unitIds) => {
  const map = new Map();
  for (const id of unitIds) map.set(id, soldiersByUnitId.get(id) ?? []);
  return map;
};

export const getEquipmentBySoldierId = (soldierId) => equipmentBySoldierId.get(soldierId) ?? [];
export const getEquipmentBySoldierIds = (soldierIds) => {
  const map = new Map();
  for (const id of soldierIds) map.set(id, equipmentBySoldierId.get(id) ?? []);
  return map;
};

// Simulate realtime update
export const simulateRealtimeUpdate = () => {
  if (Math.random() > 0.7) {
    const unit = mockUnits[Math.floor(Math.random() * mockUnits.length)];
    if (unit) {
      unit.location = generatePoint(unit.location.coordinates[0], unit.location.coordinates[1], 0.01);
      unit.updatedAt = new Date().toISOString();
      return { unitId: unit.id, location: unit.location };
    }
  }
  return null;
};
