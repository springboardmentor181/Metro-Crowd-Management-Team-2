import { useMemo } from "react";
import { useApp } from "@/hooks/useApp";
import { generateCityData } from "@/data/cityDataGenerator";

/** Returns the full generated dataset for the currently selected city. */
export function useCityData() {
  const { cityId } = useApp();
  return useMemo(() => (cityId ? generateCityData(cityId) : null), [cityId]);
}
