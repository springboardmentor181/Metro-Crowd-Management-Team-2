const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const LINE_PALETTE = [
  { name: 'Blue Line', color: '#2f5df0' },
  { name: 'Red Line', color: '#f04438' },
  { name: 'Green Line', color: '#17b26a' },
  { name: 'Purple Line', color: '#7c5cff' },
  { name: 'Yellow Line', color: '#f7c948' },
  { name: 'Orange Line', color: '#f98407' },
];

function linesFor(count) {
  return LINE_PALETTE.slice(0, count);
}

export const cities = [
  {
    id: 'delhi',
    name: 'Delhi Metro',
    state: 'Delhi',
    stations: 38,
    linesCount: 4,
    dailyPassengers: 6500000,
    lines: linesFor(4),
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad Metro',
    state: 'Telangana',
    stations: 57,
    linesCount: 3,
    dailyPassengers: 480000,
    lines: linesFor(3),
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru Metro',
    state: 'Karnataka',
    stations: 45,
    linesCount: 2,
    dailyPassengers: 820000,
    lines: linesFor(2),
  },
  {
    id: 'mumbai',
    name: 'Mumbai Metro',
    state: 'Maharashtra',
    stations: 32,
    linesCount: 3,
    dailyPassengers: 1250000,
    lines: linesFor(3),
  },
  {
    id: 'chennai',
    name: 'Chennai Metro',
    state: 'Tamil Nadu',
    stations: 40,
    linesCount: 2,
    dailyPassengers: 510000,
    lines: linesFor(2),
  },
  {
    id: 'kolkata',
    name: 'Kolkata Metro',
    state: 'West Bengal',
    stations: 30,
    linesCount: 3,
    dailyPassengers: 690000,
    lines: linesFor(3),
  },
  {
    id: 'lucknow',
    name: 'Lucknow Metro',
    state: 'Uttar Pradesh',
    stations: 21,
    linesCount: 1,
    dailyPassengers: 120000,
    lines: linesFor(1),
  },
  {
    id: 'jaipur',
    name: 'Jaipur Metro',
    state: 'Rajasthan',
    stations: 11,
    linesCount: 1,
    dailyPassengers: 60000,
    lines: linesFor(1),
  },
  {
    id: 'kochi',
    name: 'Kochi Metro',
    state: 'Kerala',
    stations: 25,
    linesCount: 1,
    dailyPassengers: 110000,
    lines: linesFor(1),
  },
  {
    id: 'pune',
    name: 'Pune Metro',
    state: 'Maharashtra',
    stations: 30,
    linesCount: 2,
    dailyPassengers: 230000,
    lines: linesFor(2),
  },
];

export const getCityById = (id) => cities.find((c) => c.id === id);

/** Optional helper to fetch dynamic city list from FastAPI */
export async function fetchCitiesFromBackend() {
  try {
    const res = await fetch(`${API_BASE_URL}/cities`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('FastAPI backend offline for cities list, using static list');
  }
  return cities;
}
