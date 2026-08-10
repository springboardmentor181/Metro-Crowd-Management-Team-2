import { createContext, useCallback, useState } from 'react';
import {
  ROLE_STORAGE_KEY,
  CITY_STORAGE_KEY,
  STATION_STORAGE_KEY,
  EMPLOYEE_ID_STORAGE_KEY,
  EMPLOYEE_ROLE_STORAGE_KEY,
} from '@/constants';
import { getCityById } from '@/data/cities';

export const AppContext = createContext(null);

function readStoredStation() {
  try {
    const raw = localStorage.getItem(STATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }) {
  const [role, setRoleState] = useState(() => localStorage.getItem(ROLE_STORAGE_KEY) || null);
  const [cityId, setCityIdState] = useState(() => localStorage.getItem(CITY_STORAGE_KEY) || null);
  const [station, setStationState] = useState(readStoredStation);
  const [employeeId, setEmployeeIdState] = useState(() => localStorage.getItem(EMPLOYEE_ID_STORAGE_KEY) || null);
  const [employeeRole, setEmployeeRoleState] = useState(() => localStorage.getItem(EMPLOYEE_ROLE_STORAGE_KEY) || null);

  const setRole = useCallback((nextRole) => {
    setRoleState(nextRole);
    localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
  }, []);

  const setCityId = useCallback((nextCityId) => {
    setCityIdState(nextCityId);
    localStorage.setItem(CITY_STORAGE_KEY, nextCityId);
  }, []);

  /** Assigned metro station for administrators — an object like { id, name, line }. */
  const setStation = useCallback((nextStation) => {
    setStationState(nextStation);
    if (nextStation) {
      localStorage.setItem(STATION_STORAGE_KEY, JSON.stringify(nextStation));
    } else {
      localStorage.removeItem(STATION_STORAGE_KEY);
    }
  }, []);

  /** Set once the admin OTP flow succeeds — used on the Admin Profile page. */
  const setEmployeeId = useCallback((nextEmployeeId) => {
    setEmployeeIdState(nextEmployeeId);
    localStorage.setItem(EMPLOYEE_ID_STORAGE_KEY, nextEmployeeId);
  }, []);

  /** Employee's role/designation, captured during admin verification. */
  const setEmployeeRole = useCallback((nextEmployeeRole) => {
    setEmployeeRoleState(nextEmployeeRole);
    localStorage.setItem(EMPLOYEE_ROLE_STORAGE_KEY, nextEmployeeRole);
  }, []);

  /** Fully resets role + city + station + employee details, e.g. when signing out. */
  const resetSelection = useCallback(() => {
    setRoleState(null);
    setCityIdState(null);
    setStationState(null);
    setEmployeeIdState(null);
    setEmployeeRoleState(null);
    localStorage.removeItem(ROLE_STORAGE_KEY);
    localStorage.removeItem(CITY_STORAGE_KEY);
    localStorage.removeItem(STATION_STORAGE_KEY);
    localStorage.removeItem(EMPLOYEE_ID_STORAGE_KEY);
    localStorage.removeItem(EMPLOYEE_ROLE_STORAGE_KEY);
  }, []);

  /** Used by passenger "Change City" — keeps role, clears city so the picker reopens. */
  const clearCity = useCallback(() => {
    setCityIdState(null);
    localStorage.removeItem(CITY_STORAGE_KEY);
  }, []);

  const city = cityId ? getCityById(cityId) : null;

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        cityId,
        city,
        setCityId,
        station,
        setStation,
        employeeId,
        setEmployeeId,
        employeeRole,
        setEmployeeRole,
        resetSelection,
        clearCity,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
