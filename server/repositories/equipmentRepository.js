import { query } from "../db.js";

export class EquipmentRepository {
  // Get all equipment
  async getAllEquipment() {
    const result = await query(`
      SELECT e.*
      FROM equipment e
      ORDER BY e.id
    `);
    return result.rows.map((row) => this.mapEquipmentFromDB(row));
  }

  // Get equipment by ID
  async getEquipmentById(id) {
    const result = await query(
      `
      SELECT e.*
      FROM equipment e
      WHERE e.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.mapEquipmentFromDB(result.rows[0]);
  }

  // Get equipment by type
  async getEquipmentByType(type) {
    const result = await query(
      `
      SELECT e.*
      FROM equipment e
      WHERE e.type = $1
      ORDER BY e.id
    `,
      [type]
    );

    return result.rows.map((row) => this.mapEquipmentFromDB(row));
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

  // Get unit equipment (through soldiers)
  async getUnitEquipment(unitId) {
    const result = await query(
      `
      SELECT e.*
      FROM equipment e
      JOIN soldiers s ON e.assigned_to = s.id
      WHERE s.unit_id = $1
      ORDER BY e.id
    `,
      [unitId]
    );

    return result.rows.map((row) => this.mapEquipmentFromDB(row));
  }

  async getEquipmentByUnitIds(unitIds) {
    if (unitIds.length === 0) return new Map();

    // We JOIN with soldiers to find which unit the equipment belongs to
    const result = await query(
      `
      SELECT e.*, s.unit_id
      FROM equipment e
      JOIN soldiers s ON e.assigned_to = s.id
      WHERE s.unit_id = ANY($1)
      ORDER BY e.id
      `,
      [unitIds]
    );

    // Grouping results by unit_id
    const map = new Map();
    unitIds.forEach((id) => map.set(id, []));

    result.rows.forEach((row) => {
      const unitId = row.unit_id;
      // We reuse the existing mapper
      map.get(unitId).push(this.mapEquipmentFromDB(row));
    });

    return map;
  }

  // Mapping function
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

export default new EquipmentRepository();
