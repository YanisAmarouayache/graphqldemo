import { pool, query } from "../db.js";
import {
  Status,
  Rank,
  EquipmentType,
  MissionStatus,
  EventCategoryCode,
} from "../enums.js";

// Configuration for data generation
const CONFIG = {
  UNITS: Number(process.env.SEED_UNITS || 5000),
  SOLDIERS: Number(process.env.SEED_SOLDIERS || 50000),
  EQUIPMENT: Number(process.env.SEED_EQUIPMENT || 10000),
  MISSIONS: Number(process.env.SEED_MISSIONS || 2000),
  EVENTS: Number(process.env.SEED_EVENTS || 3000),
  BATCH_SIZE: 1000, // Insert in batches for performance
};

const statuses = Object.values(Status);
const ranks = Object.values(Rank);
const equipmentTypes = Object.values(EquipmentType);
const missionStatuses = Object.values(MissionStatus);
const eventTypes = Object.values(EventCategoryCode);
const specializations = [
  "Infantry",
  "Medic",
  "Engineer",
  "Communication",
  "Recon",
];
const missionTypes = ["Patrol", "Assault", "Recon", "Support", "Evacuation"];
const unitNames = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];

function generateId(prefix, index) {
  return `${prefix}-${String(index).padStart(4, "0")}`;
}

function generatePoint(baseLat = 48.8566, baseLng = 2.3522, variance = 0.5) {
  return {
    lat: baseLat + (Math.random() - 0.5) * variance,
    lng: baseLng + (Math.random() - 0.5) * variance,
  };
}

function generateSerialNumber() {
  return `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

async function seedUnits(client) {
  console.log(`Seeding ${CONFIG.UNITS} units...`);
  const units = [];

  for (let i = 1; i <= CONFIG.UNITS; i++) {
    const id = generateId("UNT", i);
    const name = `Unit ${i} - ${unitNames[(i - 1) % unitNames.length]}`;
    const status = statuses[i % statuses.length];
    const location = generatePoint();

    units.push({
      id,
      name,
      status,
      location_lat: location.lat,
      location_lng: location.lng,
    });
  }

  // Batch insert
  for (let i = 0; i < units.length; i += CONFIG.BATCH_SIZE) {
    const batch = units.slice(i, i + CONFIG.BATCH_SIZE);
    const values = batch
      .map(
        (u, idx) =>
          `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${
            idx * 5 + 4
          }, $${idx * 5 + 5})`
      )
      .join(",");

    const params = batch.flatMap((u) => [
      u.id,
      u.name,
      u.status,
      u.location_lat,
      u.location_lng,
    ]);

    await client.query(
      `
      INSERT INTO units (id, name, status, location_lat, location_lng)
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `,
      params
    );

    if ((i + CONFIG.BATCH_SIZE) % 5000 === 0 || i === 0) {
      console.log(
        `  Progress: ${Math.min(i + CONFIG.BATCH_SIZE, units.length)}/${
          units.length
        }`
      );
    }
  }

  return units;
}

async function seedSoldiers(client) {
  console.log(`Seeding ${CONFIG.SOLDIERS} soldiers...`);
  const soldiers = [];

  for (let i = 1; i <= CONFIG.SOLDIERS; i++) {
    const id = generateId("SLD", i);
    const name = `Soldier ${i}`;
    const rank = ranks[i % ranks.length];
    const status = statuses[i % statuses.length];
    const unitId = generateId("UNT", (i % CONFIG.UNITS) + 1);
    const specialization = specializations[i % specializations.length];

    soldiers.push({
      id,
      name,
      rank,
      status,
      unit_id: unitId,
      specialization,
    });
  }

  for (let i = 0; i < soldiers.length; i += CONFIG.BATCH_SIZE) {
    const batch = soldiers.slice(i, i + CONFIG.BATCH_SIZE);
    const values = batch
      .map(
        (s, idx) =>
          `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${
            idx * 6 + 4
          }, $${idx * 6 + 5}, $${idx * 6 + 6})`
      )
      .join(",");

    const params = batch.flatMap((s) => [
      s.id,
      s.name,
      s.rank,
      s.status,
      s.unit_id,
      s.specialization,
    ]);

    await client.query(
      `
      INSERT INTO soldiers (id, name, rank, status, unit_id, specialization)
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `,
      params
    );

    if ((i + CONFIG.BATCH_SIZE) % 10000 === 0 || i === 0) {
      console.log(
        `  Progress: ${Math.min(i + CONFIG.BATCH_SIZE, soldiers.length)}/${
          soldiers.length
        }`
      );
    }
  }

  return soldiers;
}

async function seedEquipment(client) {
  console.log(`Seeding ${CONFIG.EQUIPMENT} equipment...`);
  const equipment = [];

  for (let i = 1; i <= CONFIG.EQUIPMENT; i++) {
    const id = generateId("EQP", i);
    const name = `Equipment ${i}`;
    const type = equipmentTypes[i % equipmentTypes.length];
    const status = statuses[i % statuses.length];
    const serialNumber = generateSerialNumber();
    // Assign to random soldier
    const assignedTo =
      Math.random() > 0.2 ? generateId("SLD", (i % CONFIG.SOLDIERS) + 1) : null;

    equipment.push({
      id,
      name,
      type,
      status,
      serial_number: serialNumber,
      assigned_to: assignedTo,
    });
  }

  for (let i = 0; i < equipment.length; i += CONFIG.BATCH_SIZE) {
    const batch = equipment.slice(i, i + CONFIG.BATCH_SIZE);
    const values = batch
      .map(
        (e, idx) =>
          `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${
            idx * 6 + 4
          }, $${idx * 6 + 5}, $${idx * 6 + 6})`
      )
      .join(",");

    const params = batch.flatMap((e) => [
      e.id,
      e.name,
      e.type,
      e.status,
      e.serial_number,
      e.assigned_to,
    ]);

    await client.query(
      `
      INSERT INTO equipment (id, name, type, status, serial_number, assigned_to)
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `,
      params
    );

    if ((i + CONFIG.BATCH_SIZE) % 5000 === 0 || i === 0) {
      console.log(
        `  Progress: ${Math.min(i + CONFIG.BATCH_SIZE, equipment.length)}/${
          equipment.length
        }`
      );
    }
  }

  return equipment;
}

async function seedMissions(client) {
  console.log(`Seeding ${CONFIG.MISSIONS} missions...`);
  const missions = [];

  for (let i = 1; i <= CONFIG.MISSIONS; i++) {
    const id = generateId("MSN", i);
    const name = `Mission ${i} - ${
      missionTypes[(i - 1) % missionTypes.length]
    }`;
    const status = missionStatuses[i % missionStatuses.length];
    const objective = `Objective ${i}: Secure sector ${String.fromCharCode(
      65 + (i % 26)
    )}`;
    const location = generatePoint();
    const startTime = new Date(
      Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
    );
    const endTime = status === "COMPLETED" ? new Date() : null;

    missions.push({
      id,
      name,
      status,
      objective,
      location_lat: location.lat,
      location_lng: location.lng,
      start_time: startTime.toISOString(),
      end_time: endTime ? endTime.toISOString() : null,
    });
  }

  for (let i = 0; i < missions.length; i += CONFIG.BATCH_SIZE) {
    const batch = missions.slice(i, i + CONFIG.BATCH_SIZE);
    const values = batch
      .map(
        (m, idx) =>
          `($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${
            idx * 8 + 4
          }, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${
            idx * 8 + 8
          })`
      )
      .join(",");

    const params = batch.flatMap((m) => [
      m.id,
      m.name,
      m.status,
      m.objective,
      m.location_lat,
      m.location_lng,
      m.start_time,
      m.end_time,
    ]);

    await client.query(
      `
      INSERT INTO missions (id, name, status, objective, location_lat, location_lng, start_time, end_time)
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `,
      params
    );

    if ((i + CONFIG.BATCH_SIZE) % 1000 === 0 || i === 0) {
      console.log(
        `  Progress: ${Math.min(i + CONFIG.BATCH_SIZE, missions.length)}/${
          missions.length
        }`
      );
    }
  }

  // Create mission-unit relationships
  console.log("Creating mission-unit relationships...");
  const missionUnits = [];
  for (let i = 1; i <= CONFIG.MISSIONS; i++) {
    const missionId = generateId("MSN", i);
    // Each mission has 2-4 units
    const numUnits = 2 + Math.floor(Math.random() * 3);
    for (let j = 0; j < numUnits; j++) {
      const unitId = generateId("UNT", ((i + j) % CONFIG.UNITS) + 1);
      missionUnits.push({ mission_id: missionId, unit_id: unitId });
    }
  }

  for (let i = 0; i < missionUnits.length; i += CONFIG.BATCH_SIZE) {
    const batch = missionUnits.slice(i, i + CONFIG.BATCH_SIZE);
    const values = batch
      .map((mu, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`)
      .join(",");
    const params = batch.flatMap((mu) => [mu.mission_id, mu.unit_id]);

    await client.query(
      `
      INSERT INTO mission_units (mission_id, unit_id)
      VALUES ${values}
      ON CONFLICT (mission_id, unit_id) DO NOTHING
    `,
      params
    );
  }

  return missions;
}

async function seedTacticalEvents(client) {
  console.log(`Seeding ${CONFIG.EVENTS} tactical events...`);
  const events = [];

  for (let i = 1; i <= CONFIG.EVENTS; i++) {
    const id = generateId("EVT", i);
    const type = eventTypes[i % eventTypes.length];
    const location = generatePoint(48.8566, 2.3522, 3);
    const timestamp = new Date(
      Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
    );
    const severity = Math.floor(Math.random() * 5) + 1;
    const description = `Tactical event ${i} detected in sector ${String.fromCharCode(
      65 + (i % 26)
    )}`;

    events.push({
      id,
      type,
      location_lat: location.lat,
      location_lng: location.lng,
      timestamp: timestamp.toISOString(),
      severity,
      description,
    });
  }

  for (let i = 0; i < events.length; i += CONFIG.BATCH_SIZE) {
    const batch = events.slice(i, i + CONFIG.BATCH_SIZE);
    const values = batch
      .map(
        (e, idx) =>
          `($${idx * 7 + 1}, $${idx * 7 + 2}, $${idx * 7 + 3}, $${
            idx * 7 + 4
          }, $${idx * 7 + 5}, $${idx * 7 + 6}, $${idx * 7 + 7})`
      )
      .join(",");

    const params = batch.flatMap((e) => [
      e.id,
      e.type,
      e.location_lat,
      e.location_lng,
      e.timestamp,
      e.severity,
      e.description,
    ]);

    await client.query(
      `
      INSERT INTO tactical_events (id, type, location_lat, location_lng, timestamp, severity, description)
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `,
      params
    );

    if ((i + CONFIG.BATCH_SIZE) % 1000 === 0 || i === 0) {
      console.log(
        `  Progress: ${Math.min(i + CONFIG.BATCH_SIZE, events.length)}/${
          events.length
        }`
      );
    }
  }

  // Create event-unit relationships
  console.log("Creating event-unit relationships...");
  const eventUnits = [];
  for (let i = 1; i <= CONFIG.EVENTS; i++) {
    const eventId = generateId("EVT", i);
    // Each event involves 1-3 units
    const numUnits = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < numUnits; j++) {
      const unitId = generateId("UNT", ((i + j) % CONFIG.UNITS) + 1);
      eventUnits.push({ event_id: eventId, unit_id: unitId });
    }
  }

  for (let i = 0; i < eventUnits.length; i += CONFIG.BATCH_SIZE) {
    const batch = eventUnits.slice(i, i + CONFIG.BATCH_SIZE);
    const values = batch
      .map((eu, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`)
      .join(",");
    const params = batch.flatMap((eu) => [eu.event_id, eu.unit_id]);

    await client.query(
      `
      INSERT INTO tactical_event_units (event_id, unit_id)
      VALUES ${values}
      ON CONFLICT (event_id, unit_id) DO NOTHING
    `,
      params
    );
  }

  return events;
}

async function updateUnitCommanders(client) {
  console.log("Updating unit commanders...");

  // Find captains and majors to assign as commanders
  const result = await client.query(`
    SELECT s.id, s.unit_id 
    FROM soldiers s 
    WHERE s.rank IN ('CAPTAIN', 'MAJOR')
    ORDER BY s.unit_id, s.rank DESC
  `);

  const commanderMap = new Map();
  for (const row of result.rows) {
    if (!commanderMap.has(row.unit_id)) {
      commanderMap.set(row.unit_id, row.id);
    }
  }

  // Update units with commanders
  for (const [unitId, commanderId] of commanderMap) {
    await client.query(
      `
      UPDATE units SET commander_id = $1 WHERE id = $2
    `,
      [commanderId, unitId]
    );
  }

  console.log(`Updated ${commanderMap.size} units with commanders`);
}

export async function seedDatabase() {
  console.log("🌱 Starting database seeding...");
  console.log("Configuration:", CONFIG);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Clear existing data
    console.log("Clearing existing data...");
    await client.query(
      "TRUNCATE TABLE tactical_event_units, mission_units, tactical_events, missions, equipment, soldiers, units CASCADE"
    );

    // Seed in order (respecting foreign keys)
    await seedUnits(client);
    await seedSoldiers(client);
    await seedEquipment(client);
    await seedMissions(client);
    await seedTacticalEvents(client);
    await updateUnitCommanders(client);

    await client.query("COMMIT");

    console.log("✅ Database seeding completed successfully!");

    // Print stats
    const stats = await client.query("SELECT * FROM dashboard_stats");
    console.log("\n📊 Database Statistics:");
    console.log(stats.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seeding failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
