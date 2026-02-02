import gql from "graphql-tag";

export const typeDefs = gql`
  scalar Time
  scalar Date
  scalar GeoJSON

  enum Status {
    ACTIVE
    INACTIVE
    MAINTENANCE
    DEPLOYED
  }

  enum Rank {
    PRIVATE
    CORPORAL
    SERGEANT
    LIEUTENANT
    CAPTAIN
    MAJOR
    COLONEL
    GENERAL
  }

  enum EquipmentType {
    WEAPON
    VEHICLE
    COMMUNICATION
    MEDICAL
    OPTICS
  }

  enum MissionStatus {
    PLANNED
    IN_PROGRESS
    COMPLETED
    CANCELLED
  }

  enum EventCategoryCode {
    MILITARY
    IED_EVENT
    CBRN_EVENT
    ACCIDENT
    EXPLOSION
    MANUAL_ALERT # Ajouté pour correspondre au type de votre mutation
  }

  type Point {
    coordinates: [Float!]!
  }

  type Unit {
    id: ID!
    name: String!
    status: Status!
    location: Point!
    soldiers: [Soldier!]!
    equipment: [Equipment!]!
    commander: Soldier
    createdAt: Time!
    updatedAt: Time!
  }

  type Soldier {
    id: ID!
    name: String!
    rank: Rank!
    status: Status!
    unitId: ID!
    specialization: String
    equipment: [Equipment!]!
  }

  type Equipment {
    id: ID!
    name: String!
    type: EquipmentType!
    status: Status!
    serialNumber: String!
    assignedTo: ID
  }

  type Mission {
    id: ID!
    name: String!
    status: MissionStatus!
    units: [Unit!]!
    objective: String!
    location: Point!
    startTime: Time!
    endTime: Time
  }

  type TacticalEvent {
    id: ID!
    type: String! # Changé en String pour accepter "MANUAL_ALERT" plus facilement
    location: Point # Optionnel pour les alertes manuelles globales
    timestamp: Time!
    severity: Int!
    description: String!
    involvedUnits: [ID!]
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
    totalCount: Int!
  }

  type UnitConnection {
    edges: [UnitEdge!]!
    pageInfo: PageInfo!
  }

  type UnitEdge {
    node: Unit!
    cursor: String!
  }

  input UnitFilter {
    status: Status
    search: String
  }

  input PointInput {
    coordinates: [Float!]!
  }

  input CreateUnitInput {
    name: String!
    status: Status!
    location: PointInput!
  }

  input UpdateUnitInput {
    id: ID!
    name: String
    status: Status
    location: PointInput
  }

  type CreateUnitPayload {
    unit: Unit!
  }

  type UpdateUnitPayload {
    unit: Unit!
  }

  type DashboardStats {
    totalUnits: Int!
    activeUnits: Int!
    totalSoldiers: Int!
    activeMissions: Int!
    recentEvents: Int!
    equipmentStatus: EquipmentStatusStats!
  }

  type EquipmentStatusStats {
    operational: Int!
    maintenance: Int!
    deployed: Int!
  }

  type Query {
    units(filter: UnitFilter, first: Int, after: String): UnitConnection!
    unit(id: ID!): Unit
    allUnits: [Unit!]!
    soldiers(unitId: ID): [Soldier!]!
    soldier(id: ID!): Soldier
    equipment(id: ID!): Equipment
    allEquipment: [Equipment!]!
    equipmentByType(type: EquipmentType!): [Equipment!]!
    missions(status: MissionStatus): [Mission!]!
    mission(id: ID!): Mission
    tacticalEvents(severity: Int): [TacticalEvent!]!
    tacticalEvent(id: ID!): TacticalEvent
    dashboardStats: DashboardStats!
  }

  type Mutation {
    createUnit(input: CreateUnitInput!): CreateUnitPayload!
    updateUnit(input: UpdateUnitInput!): UpdateUnitPayload!
    updateUnitLocation(id: ID!, location: PointInput!): Unit!

    # --- LA LIGNE MANQUANTE ---
    fireAlert(severity: Int, description: String): TacticalEvent!
  }

  type Subscription {
    unitUpdated(id: ID!): Unit!
    unitLocationUpdated: Unit!
    tacticalEventCreated: TacticalEvent!
    dashboardStatsUpdated: DashboardStats!
  }
`;
