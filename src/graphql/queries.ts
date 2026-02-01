import { gql } from '@apollo/client';

// Unit Queries
export const GET_UNITS = gql`
  query GetUnits($filter: UnitFilter, $first: Int, $after: String) {
    units(filter: $filter, first: $first, after: $after) {
      edges {
        node {
          id
          name
          status
          location {
            coordinates
          }
          soldiers {
            id
            name
            rank
          }
          equipment {
            id
            name
            type
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
        totalCount
      }
    }
  }
`;

export const GET_UNIT = gql`
  query GetUnit($id: ID!) {
    unit(id: $id) {
      id
      name
      status
      location {
        coordinates
      }
      soldiers {
        id
        name
        rank
        status
        specialization
        equipment {
          id
          name
          type
          serialNumber
        }
      }
      equipment {
        id
        name
        type
        status
        serialNumber
      }
      commander {
        id
        name
        rank
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_ALL_UNITS = gql`
  query GetAllUnits {
    allUnits {
      id
      name
      status
      location {
        coordinates
      }
      soldiers {
        id
        name
      }
      equipment {
        id
        name
      }
    }
  }
`;

// Soldier Queries
export const GET_SOLDIERS = gql`
  query GetSoldiers($unitId: ID) {
    soldiers(unitId: $unitId) {
      id
      name
      rank
      status
      unitId
      specialization
      equipment {
        id
        name
        type
      }
    }
  }
`;

export const GET_SOLDIER = gql`
  query GetSoldier($id: ID!) {
    soldier(id: $id) {
      id
      name
      rank
      status
      unitId
      specialization
      equipment {
        id
        name
        type
        serialNumber
      }
    }
  }
`;

// Equipment Queries
export const GET_EQUIPMENT = gql`
  query GetEquipment($id: ID!) {
    equipment(id: $id) {
      id
      name
      type
      status
      serialNumber
      assignedTo
    }
  }
`;

export const GET_ALL_EQUIPMENT = gql`
  query GetAllEquipment {
    allEquipment {
      id
      name
      type
      status
      serialNumber
      assignedTo
    }
  }
`;

export const GET_EQUIPMENT_BY_TYPE = gql`
  query GetEquipmentByType($type: EquipmentType!) {
    equipmentByType(type: $type) {
      id
      name
      type
      status
      serialNumber
    }
  }
`;

// Mission Queries
export const GET_MISSIONS = gql`
  query GetMissions($status: MissionStatus) {
    missions(status: $status) {
      id
      name
      status
      objective
      location {
        coordinates
      }
      units {
        id
        name
        status
      }
      startTime
      endTime
    }
  }
`;

export const GET_MISSION = gql`
  query GetMission($id: ID!) {
    mission(id: $id) {
      id
      name
      status
      objective
      location {
        coordinates
      }
      units {
        id
        name
        status
        soldiers {
          id
          name
          rank
        }
      }
      startTime
      endTime
    }
  }
`;

// Tactical Event Queries
export const GET_TACTICAL_EVENTS = gql`
  query GetTacticalEvents($severity: Int) {
    tacticalEvents(severity: $severity) {
      id
      type
      location {
        coordinates
      }
      timestamp
      severity
      description
      involvedUnits
    }
  }
`;

export const GET_TACTICAL_EVENT = gql`
  query GetTacticalEvent($id: ID!) {
    tacticalEvent(id: $id) {
      id
      type
      location {
        coordinates
      }
      timestamp
      severity
      description
      involvedUnits
    }
  }
`;

// Dashboard Query
export const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats {
    dashboardStats {
      totalUnits
      activeUnits
      totalSoldiers
      activeMissions
      recentEvents
      equipmentStatus {
        operational
        maintenance
        deployed
      }
    }
  }
`;

// Complex Dashboard Query (multiple resources)
export const GET_DASHBOARD_FULL = gql`
  query GetDashboardFull {
    dashboardStats {
      totalUnits
      activeUnits
      totalSoldiers
      activeMissions
      recentEvents
      equipmentStatus {
        operational
        maintenance
        deployed
      }
    }
    units(first: 5) {
      edges {
        node {
          id
          name
          status
          soldiers {
            id
            name
            rank
          }
        }
      }
    }
    missions(status: IN_PROGRESS) {
      id
      name
      objective
      units {
        id
        name
      }
    }
    tacticalEvents {
      id
      type
      severity
      description
    }
  }
`;

// Mutations
export const CREATE_UNIT = gql`
  mutation CreateUnit($input: CreateUnitInput!) {
    createUnit(input: $input) {
      unit {
        id
        name
        status
        location {
          coordinates
        }
        createdAt
      }
    }
  }
`;

export const UPDATE_UNIT = gql`
  mutation UpdateUnit($input: UpdateUnitInput!) {
    updateUnit(input: $input) {
      unit {
        id
        name
        status
        location {
          coordinates
        }
        updatedAt
      }
    }
  }
`;

export const UPDATE_UNIT_LOCATION = gql`
  mutation UpdateUnitLocation($id: ID!, $location: PointInput!) {
    updateUnitLocation(id: $id, location: $location) {
      id
      name
      location {
        coordinates
      }
      updatedAt
    }
  }
`;

// Subscriptions
export const UNIT_UPDATED = gql`
  subscription UnitUpdated($id: ID!) {
    unitUpdated(id: $id) {
      id
      name
      status
      location {
        coordinates
      }
      updatedAt
    }
  }
`;

export const UNIT_LOCATION_UPDATED = gql`
  subscription UnitLocationUpdated {
    unitLocationUpdated {
      id
      name
      location {
        coordinates
      }
      updatedAt
    }
  }
`;

export const TACTICAL_EVENT_CREATED = gql`
  subscription TacticalEventCreated {
    tacticalEventCreated {
      id
      type
      location {
        coordinates
      }
      timestamp
      severity
      description
    }
  }
`;

export const DASHBOARD_STATS_UPDATED = gql`
  subscription DashboardStatsUpdated {
    dashboardStatsUpdated {
      totalUnits
      activeUnits
      totalSoldiers
      activeMissions
      recentEvents
      equipmentStatus {
        operational
        maintenance
        deployed
      }
    }
  }
`;
