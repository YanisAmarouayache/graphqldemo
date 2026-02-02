import { query } from "../db.js";

export class MissionRepository {
  // Get all missions
  async getAllMissions() {
    const result = await query(`
      SELECT m.*,
        json_build_object('coordinates', ARRAY[m.location_lat, m.location_lng]) as location
      FROM missions m
      ORDER BY m.id
    `);
    return result.rows.map((row) => this.mapMissionFromDB(row));
  }

  // Get missions by status
  async getMissionsByStatus(status) {
    const result = await query(
      `
      SELECT m.*,
        json_build_object('coordinates', ARRAY[m.location_lat, m.location_lng]) as location
      FROM missions m
      WHERE m.status = $1
      ORDER BY m.id
    `,
      [status]
    );

    return result.rows.map((row) => this.mapMissionFromDB(row));
  }

  // Get mission by ID
  async getMissionById(id) {
    const result = await query(
      `
      SELECT m.*,
        json_build_object('coordinates', ARRAY[m.location_lat, m.location_lng]) as location
      FROM missions m
      WHERE m.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.mapMissionFromDB(result.rows[0]);
  }

  // Get units for a mission
  async getMissionUnits(missionId) {
    const result = await query(
      `
      SELECT u.*,
        json_build_object('coordinates', ARRAY[u.location_lat, u.location_lng]) as location
      FROM units u
      JOIN mission_units mu ON u.id = mu.unit_id
      WHERE mu.mission_id = $1
      ORDER BY u.id
    `,
      [missionId]
    );

    return result.rows.map((row) => this.mapUnitFromDB(row));
  }

  // Mapping functions
  mapMissionFromDB(row) {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      objective: row.objective,
      location: row.location || {
        coordinates: [
          parseFloat(row.location_lat),
          parseFloat(row.location_lng),
        ],
      },
      startTime: row.start_time,
      endTime: row.end_time,
    };
  }

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
}

export default new MissionRepository();
