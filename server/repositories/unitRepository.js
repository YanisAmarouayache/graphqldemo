import { query, withTransaction } from "../db.js";

export class UnitRepository {
  // Get all units with pagination and filtering
  async getUnits(filter = {}, first = 10, after = null) {
    let whereClause = "";
    const params = [];
    let paramIndex = 1;

    if (filter.status) {
      whereClause += ` WHERE status = $${paramIndex}`;
      params.push(filter.status);
      paramIndex++;
    }

    if (filter.search) {
      whereClause += whereClause ? " AND" : " WHERE";
      whereClause += ` LOWER(name) LIKE LOWER($${paramIndex})`;
      params.push(`%${filter.search}%`);
      paramIndex++;
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM units${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].total);

    // Get paginated results
    const startIndex = after
      ? parseInt(Buffer.from(after, "base64").toString())
      : 0;
    const limit = first;
    const offset = startIndex;

    const dataParams = [...params, limit, offset];
    const dataResult = await query(
      `
      SELECT u.*, 
        json_build_object('coordinates', ARRAY[u.location_lat, u.location_lng]) as location
      FROM units u
      ${whereClause}
      ORDER BY u.id
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
      dataParams
    );

    return {
      edges: dataResult.rows.map((unit, index) => ({
        node: this.mapUnitFromDB(unit),
        cursor: Buffer.from(String(startIndex + index + 1)).toString("base64"),
      })),
      pageInfo: {
        hasNextPage: startIndex + limit < totalCount,
        endCursor: Buffer.from(String(startIndex + limit)).toString("base64"),
        totalCount,
      },
    };
  }

  // Get all units (for allUnits query)
  async getAllUnits() {
    const result = await query(`
      SELECT u.*, 
        json_build_object('coordinates', ARRAY[u.location_lat, u.location_lng]) as location
      FROM units u
      ORDER BY u.id
    `);
    return result.rows.map((row) => this.mapUnitFromDB(row));
  }

  // Get unit by ID
  async getUnitById(id) {
    const result = await query(
      `
      SELECT u.*, 
        json_build_object('coordinates', ARRAY[u.location_lat, u.location_lng]) as location
      FROM units u
      WHERE u.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.mapUnitFromDB(result.rows[0]);
  }

  // Get multiple units by IDs (for DataLoader)
  async getUnitsByIds(ids) {
    if (ids.length === 0) return new Map();

    const result = await query(
      `
      SELECT u.*, 
        json_build_object('coordinates', ARRAY[u.location_lat, u.location_lng]) as location
      FROM units u
      WHERE u.id = ANY($1)
    `,
      [ids]
    );

    const unitMap = new Map();
    for (const row of result.rows) {
      unitMap.set(row.id, this.mapUnitFromDB(row));
    }
    return unitMap;
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

  // Get soldiers by multiple unit IDs (for DataLoader batching)
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

    const soldiersMap = new Map();
    for (const unitId of unitIds) {
      soldiersMap.set(unitId, []);
    }

    for (const row of result.rows) {
      const soldiers = soldiersMap.get(row.unit_id) || [];
      soldiers.push(this.mapSoldierFromDB(row));
      soldiersMap.set(row.unit_id, soldiers);
    }

    return soldiersMap;
  }

  // Get equipment by soldier IDs (for DataLoader batching)
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

  // Create new unit
  async createUnit(input) {
    const id = `UNT-${String(await this.getNextUnitNumber()).padStart(4, "0")}`;

    const result = await query(
      `
      INSERT INTO units (id, name, status, location_lat, location_lng)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *, json_build_object('coordinates', ARRAY[location_lat, location_lng]) as location
    `,
      [
        id,
        input.name,
        input.status,
        input.location.coordinates[0],
        input.location.coordinates[1],
      ]
    );

    return this.mapUnitFromDB(result.rows[0]);
  }

  // Update unit
  async updateUnit(id, input) {
    const updates = [];
    const params = [id];
    let paramIndex = 2;

    if (input.name) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }

    if (input.status) {
      updates.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;
    }

    if (input.location) {
      updates.push(`location_lat = $${paramIndex}`);
      updates.push(`location_lng = $${paramIndex + 1}`);
      params.push(input.location.coordinates[0], input.location.coordinates[1]);
      paramIndex += 2;
    }

    if (updates.length === 0) {
      return this.getUnitById(id);
    }

    const result = await query(
      `
      UPDATE units 
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = $1
      RETURNING *, json_build_object('coordinates', ARRAY[location_lat, location_lng]) as location
    `,
      params
    );

    if (result.rows.length === 0) return null;
    return this.mapUnitFromDB(result.rows[0]);
  }

  // Update unit location
  async updateUnitLocation(id, location) {
    const result = await query(
      `
      UPDATE units 
      SET location_lat = $2, location_lng = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *, json_build_object('coordinates', ARRAY[location_lat, location_lng]) as location
    `,
      [id, location.coordinates[0], location.coordinates[1]]
    );

    if (result.rows.length === 0) return null;
    return this.mapUnitFromDB(result.rows[0]);
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

  // Get dashboard stats
  async getDashboardStats() {
    const result = await query("SELECT * FROM dashboard_stats");
    const stats = result.rows[0];

    return {
      totalUnits: parseInt(stats.total_units),
      activeUnits: parseInt(stats.active_units),
      totalSoldiers: parseInt(stats.total_soldiers),
      activeMissions: parseInt(stats.active_missions),
      recentEvents: parseInt(stats.recent_events),
      equipmentStatus: {
        operational: parseInt(stats.operational_equipment),
        maintenance: parseInt(stats.maintenance_equipment),
        deployed: parseInt(stats.deployed_equipment),
      },
    };
  }

  // Helper to get next unit number
  async getNextUnitNumber() {
    const result = await query(`
      SELECT COUNT(*) as count FROM units
    `);
    return parseInt(result.rows[0].count) + 1;
  }

  // Mapping functions
  mapUnitFromDB(row) {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      location: row.location || {
        coordinates: [
          parseFloat(row.location_lat),
          parseFloat(row.location_lng),
        ],
      },
      commander: row.commander_id ? { id: row.commander_id } : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

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

export default new UnitRepository();
