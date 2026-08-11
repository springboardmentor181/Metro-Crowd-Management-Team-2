import { createContext, useCallback, useState } from 'react';
import { ROLE_STORAGE_KEY, CITY_STORAGE_KEY } from '@/constants';
import { getCityById } from '@/data/cities';

export const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [role, setRoleState] = useState(() => localStorage.getItem(ROLE_STORAGE_KEY) || null);
  const [cityId, setCityIdState] = useState(() => localStorage.getItem(CITY_STORAGE_KEY) || null);

  const setRole = useCallback((nextRole) => {
    setRoleState(nextRole);
    localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
  }, []);

  const setCityId = useCallback((nextCityId) => {
    setCityIdState(nextCityId);
    localStorage.setItem(CITY_STORAGE_KEY, nextCityId);
  }, []);

  /** Fully resets role + city, e.g. when signing out. */
  const resetSelection = useCallback(() => {
    setRoleState(null);
    setCityIdState(null);
    localStorage.removeItem(ROLE_STORAGE_KEY);
    localStorage.removeItem(CITY_STORAGE_KEY);
  }, []);

  /** Used by "Change City" — keeps role, clears city so the picker reopens. */
  const clearCity = useCallback(() => {
    setCityIdState(null);
    localStorage.removeItem(CITY_STORAGE_KEY);
  }, []);

  const city = cityId ? getCityById(cityId) : null;

  return (
    <AppContext.Provider
      value={{ role, setRole, cityId, city, setCityId, resetSelection, clearCity }}
    >
      {children}
    </AppContext.Provider>
  );
}
