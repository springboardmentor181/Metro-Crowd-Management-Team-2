export const ROUTES = {
  LOGIN: '/login',
  SELECT_ROLE: '/select-role',
  SELECT_CITY: '/select-city',

  PASSENGER: {
    ROOT: '/passenger',
    DASHBOARD: '/passenger/dashboard',
    JOURNEY_PLANNER: '/passenger/journey-planner',
    LIVE_CROWD: '/passenger/live-crowd',
    METRO_MAP: '/passenger/metro-map',
    AI_SUGGESTIONS: '/passenger/ai-suggestions',
    EMERGENCY_HELP: '/passenger/emergency-help',
    ABOUT: '/passenger/about',
  },

  ADMIN: {
    ROOT: '/admin',
    DASHBOARD: '/admin/dashboard',
    ANALYTICS: '/admin/analytics',
    LIVE_MONITORING: '/admin/live-monitoring',
    STATIONS: '/admin/stations',
    SCHEDULING: '/admin/scheduling',
    AI_PREDICTION: '/admin/ai-prediction',
    REPORTS: '/admin/reports',
    USERS: '/admin/users',
  },
};

export const ROLES = {
  PASSENGER: 'passenger',
  ADMIN: 'administrator',
};

export const AUTH_STORAGE_KEY = 'metroflow_auth';
export const ROLE_STORAGE_KEY = 'metroflow_role';
export const CITY_STORAGE_KEY = 'metroflow_city';

export const APP_NAME = 'MetroFlow';
export const APP_TAGLINE = 'Smart Metro Management System';

export const CROWD_STATUS = {
  GREEN: { key: 'GREEN', label: 'Smooth', color: '#17b26a' },
  YELLOW: { key: 'YELLOW', label: 'Moderate', color: '#f7c948' },
  ORANGE: { key: 'ORANGE', label: 'Busy', color: '#f79009' },
  RED: { key: 'RED', label: 'Overcrowded', color: '#f04438' },
};

export function occupancyToStatus(occupancy) {
  if (occupancy >= 90) return CROWD_STATUS.RED;
  if (occupancy >= 70) return CROWD_STATUS.ORANGE;
  if (occupancy >= 45) return CROWD_STATUS.YELLOW;
  return CROWD_STATUS.GREEN;
}
