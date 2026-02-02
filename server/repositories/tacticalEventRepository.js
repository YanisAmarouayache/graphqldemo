import { query } from "../db.js";

export class TacticalEventRepository {
  // Get all tactical events
  async getAllTacticalEvents() {
    const result = await query(`
      SELECT te.*,
        json_build_object('coordinates', ARRAY[te.location_lat, te.location_lng]) as location
      FROM tactical_events te
      ORDER BY te.timestamp DESC
    `);
    return result.rows.map((row) => this.mapTacticalEventFromDB(row));
  }

  // Get tactical events by minimum severity
  async getTacticalEventsBySeverity(minSeverity) {
    const result = await query(
      `
      SELECT te.*,
        json_build_object('coordinates', ARRAY[te.location_lat, te.location_lng]) as location
      FROM tactical_events te
      WHERE te.severity >= $1
      ORDER BY te.timestamp DESC
    `,
      [minSeverity]
    );

    return result.rows.map((row) => this.mapTacticalEventFromDB(row));
  }

  // Get tactical event by ID
  async getTacticalEventById(id) {
    const result = await query(
      `
      SELECT te.*,
        json_build_object('coordinates', ARRAY[te.location_lat, te.location_lng]) as location
      FROM tactical_events te
      WHERE te.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.mapTacticalEventFromDB(result.rows[0]);
  }

  // Get involved unit IDs for an event
  async getInvolvedUnitIds(eventId) {
    const result = await query(
      `
      SELECT unit_id
      FROM tactical_event_units
      WHERE event_id = $1
      ORDER BY unit_id
    `,
      [eventId]
    );

    return result.rows.map((row) => row.unit_id);
  }

  // Create new tactical event
  async createTacticalEvent(input) {
    const id = `EVT-${Date.now()}`;

    const result = await query(
      `
      INSERT INTO tactical_events (id, type, location_lat, location_lng, timestamp, severity, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *, json_build_object('coordinates', ARRAY[location_lat, location_lng]) as location
    `,
      [
        id,
        input.type || "EXPLOSION",
        input.location?.coordinates?.[0] || 48.8566 + Math.random() * 0.05,
        input.location?.coordinates?.[1] || 2.3522 + Math.random() * 0.05,
        new Date().toISOString(),
        input.severity || 5,
        input.description || `Tactical event detected`,
      ]
    );

    return this.mapTacticalEventFromDB(result.rows[0]);
  }

  // Mapping function
  mapTacticalEventFromDB(row) {
    return {
      id: row.id,
      type: row.type,
      location: row.location || {
        coordinates: [
          parseFloat(row.location_lat),
          parseFloat(row.location_lng),
        ],
      },
      timestamp: row.timestamp,
      severity: row.severity,
      description: row.description,
      involvedUnits: [], // Will be populated separately
    };
  }
}

export default new TacticalEventRepository();
