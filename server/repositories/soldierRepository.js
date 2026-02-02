import { query } from "../db.js";

export class SoldierRepository {
  // Get all soldiers
  async getAllSoldiers() {
    const result = await query(`
      SELECT s.*
      FROM soldiers s
      ORDER BY s.id
    `);
    return result.rows.map((row) => this.mapSoldierFromDB(row));
  }

  // Get soldiers by unit ID
  async getSoldiersByUnitId(unitId) {
    const result = await query(
      `
      SELECT s.*
      FROM soldiers s
      WHERE s.unit_id = $1
      ORDER BY s.id
    `,
      [unitId]
    );

    return result.rows.map((row) => this.mapSoldierFromDB(row));
  }

  // Get soldier by ID
  async getSoldierById(id) {
    const result = await query(
      `
      SELECT s.*
      FROM soldiers s
      WHERE s.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.mapSoldierFromDB(result.rows[0]);
  }

  // Get multiple soldiers by IDs (for DataLoader)
  async getSoldiersByIds(ids) {
    if (ids.length === 0) return new Map();

    const result = await query(
      `
      SELECT s.*
      FROM soldiers s
      WHERE s.id = ANY($1)
    `,
      [ids]
    );

    const soldierMap = new Map();
    for (const row of result.rows) {
      soldierMap.set(row.id, this.mapSoldierFromDB(row));
    }
    return soldierMap;
  }

  // Get equipment by soldier ID
  async getEquipmentBySoldierId(soldierId) {
    const result = await query(
      `
      SELECT e.*
      FROM equipment e
      WHERE e.assigned_to = $1
      ORDER BY e.id
    `,
      [soldierId]
    );

    return result.rows.map((row) => this.mapEquipmentFromDB(row));
  }

  // Get equipment by multiple soldier IDs (for DataLoader batching)
  async getEquipmentBySoldierIds(soldierIds) {
    if (soldierIds.length === 0) return new Map();

    const result = await query(
      `
      SELECT e.*
      FROM equipment e
      WHERE e.assigned_to = ANY($1)
      ORDER BY e.id
    `,
      [soldierIds]
    );

    const equipmentMap = new Map();
    for (const soldierId of soldierIds) {
      equipmentMap.set(soldierId, []);
    }

    for (const row of result.rows) {
      const equipment = equipmentMap.get(row.assigned_to) || [];
      equipment.push(this.mapEquipmentFromDB(row));
      equipmentMap.set(row.assigned_to, equipment);
    }

    return equipmentMap;
  }

  async getSoldiersByUnitIds(unitIds) {
    if (unitIds.length === 0) return new Map();

    const result = await query(
      `
    SELECT s.*
    FROM soldiers s
    WHERE s.unit_id = ANY($1)
    ORDER BY s.id
    `,
      [unitIds]
    );

    const map = new Map();
    for (const unitId of unitIds) {
      map.set(unitId, []);
    }

    for (const row of result.rows) {
      map.get(row.unit_id).push(this.mapSoldierFromDB(row));
    }

    return map;
  }

  // Mapping functions
  mapSoldierFromDB(row) {
    return {
      id: row.id,
      name: row.name,
      rank: row.rank,
      status: row.status,
      unitId: row.unit_id,
      specialization: row.specialization,
    };
  }

  mapEquipmentFromDB(row) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      serialNumber: row.serial_number,
      assignedTo: row.assigned_to,
    };
  }
}

export default new SoldierRepository();
