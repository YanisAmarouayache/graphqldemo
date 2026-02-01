export const Status = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  DEPLOYED: 'DEPLOYED',
};

export const Rank = {
  PRIVATE: 'PRIVATE',
  CORPORAL: 'CORPORAL',
  SERGEANT: 'SERGEANT',
  LIEUTENANT: 'LIEUTENANT',
  CAPTAIN: 'CAPTAIN',
  MAJOR: 'MAJOR',
  COLONEL: 'COLONEL',
  GENERAL: 'GENERAL',
};

export const EquipmentType = {
  WEAPON: 'WEAPON',
  VEHICLE: 'VEHICLE',
  COMMUNICATION: 'COMMUNICATION',
  MEDICAL: 'MEDICAL',
  OPTICS: 'OPTICS',
};

export const MissionStatus = {
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const EventCategoryCode = {
  MILITARY: 'MILITARY',
  IED_EVENT: 'IED_EVENT',
  CBRN_EVENT: 'CBRN_EVENT',
  ACCIDENT: 'ACCIDENT',
  EXPLOSION: 'EXPLOSION',
};

export default {
  Status,
  Rank,
  EquipmentType,
  MissionStatus,
  EventCategoryCode,
};
