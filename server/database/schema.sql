-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS mission_units CASCADE;
DROP TABLE IF EXISTS tactical_event_units CASCADE;
DROP TABLE IF EXISTS tactical_events CASCADE;
DROP TABLE IF EXISTS missions CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS soldiers CASCADE;
DROP TABLE IF EXISTS units CASCADE;

-- Enums
CREATE TYPE status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DEPLOYED');
CREATE TYPE rank_enum AS ENUM ('PRIVATE', 'CORPORAL', 'SERGEANT', 'LIEUTENANT', 'CAPTAIN', 'MAJOR', 'COLONEL', 'GENERAL');
CREATE TYPE equipment_type_enum AS ENUM ('WEAPON', 'VEHICLE', 'COMMUNICATION', 'MEDICAL', 'OPTICS');
CREATE TYPE mission_status_enum AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE event_category_enum AS ENUM ('MILITARY', 'IED_EVENT', 'CBRN_EVENT', 'ACCIDENT', 'EXPLOSION');

-- Units table
CREATE TABLE units (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status status_enum NOT NULL DEFAULT 'ACTIVE',
    location_lat DECIMAL(10, 8) NOT NULL,
    location_lng DECIMAL(11, 8) NOT NULL,
    commander_id VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Soldiers table
CREATE TABLE soldiers (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rank rank_enum NOT NULL DEFAULT 'PRIVATE',
    status status_enum NOT NULL DEFAULT 'ACTIVE',
    unit_id VARCHAR(20) NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    specialization VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for commander after soldiers table exists
ALTER TABLE units ADD CONSTRAINT fk_commander 
    FOREIGN KEY (commander_id) REFERENCES soldiers(id) ON DELETE SET NULL;

-- Equipment table
CREATE TABLE equipment (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type equipment_type_enum NOT NULL,
    status status_enum NOT NULL DEFAULT 'ACTIVE',
    serial_number VARCHAR(50) UNIQUE NOT NULL,
    assigned_to VARCHAR(20) REFERENCES soldiers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Missions table
CREATE TABLE missions (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status mission_status_enum NOT NULL DEFAULT 'PLANNED',
    objective TEXT NOT NULL,
    location_lat DECIMAL(10, 8) NOT NULL,
    location_lng DECIMAL(11, 8) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for missions and units (many-to-many)
CREATE TABLE mission_units (
    mission_id VARCHAR(20) NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    unit_id VARCHAR(20) NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (mission_id, unit_id)
);

-- Tactical events table
CREATE TABLE tactical_events (
    id VARCHAR(20) PRIMARY KEY,
    type event_category_enum NOT NULL,
    location_lat DECIMAL(10, 8) NOT NULL,
    location_lng DECIMAL(11, 8) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for tactical events and involved units
CREATE TABLE tactical_event_units (
    event_id VARCHAR(20) NOT NULL REFERENCES tactical_events(id) ON DELETE CASCADE,
    unit_id VARCHAR(20) NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (event_id, unit_id)
);

-- Indexes for performance
CREATE INDEX idx_soldiers_unit_id ON soldiers(unit_id);
CREATE INDEX idx_equipment_assigned_to ON equipment(assigned_to);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_soldiers_status ON soldiers(status);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_start_time ON missions(start_time);
CREATE INDEX idx_tactical_events_timestamp ON tactical_events(timestamp);
CREATE INDEX idx_tactical_events_severity ON tactical_events(severity);
CREATE INDEX idx_tactical_event_units_unit_id ON tactical_event_units(unit_id);
CREATE INDEX idx_mission_units_unit_id ON mission_units(unit_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_soldiers_updated_at BEFORE UPDATE ON soldiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON missions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW unit_stats AS
SELECT 
    u.id,
    u.name,
    u.status,
    COUNT(DISTINCT s.id) as soldier_count,
    COUNT(DISTINCT e.id) as equipment_count
FROM units u
LEFT JOIN soldiers s ON u.id = s.unit_id
LEFT JOIN equipment e ON s.id = e.assigned_to
GROUP BY u.id, u.name, u.status;

CREATE VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM units) as total_units,
    (SELECT COUNT(*) FROM units WHERE status = 'ACTIVE') as active_units,
    (SELECT COUNT(*) FROM soldiers) as total_soldiers,
    (SELECT COUNT(*) FROM missions WHERE status = 'IN_PROGRESS') as active_missions,
    (SELECT COUNT(*) FROM tactical_events WHERE timestamp > NOW() - INTERVAL '24 hours') as recent_events,
    (SELECT COUNT(*) FROM equipment WHERE status = 'ACTIVE') as operational_equipment,
    (SELECT COUNT(*) FROM equipment WHERE status = 'MAINTENANCE') as maintenance_equipment,
    (SELECT COUNT(*) FROM equipment WHERE status = 'DEPLOYED') as deployed_equipment;
