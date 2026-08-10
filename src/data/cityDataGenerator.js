import { seededRandom } from '@/utils/formatters';
import { occupancyToStatus } from '@/constants';
import { getCityById } from '@/data/cities';

// Generic, non-place-specific name parts used to build believable station
// names for the demo without claiming to represent real, specific stations.
const NAME_PREFIX = [
  'Central', 'North', 'South', 'East', 'West', 'New', 'Old', 'Model', 'Green',
  'Lake', 'Hill', 'River', 'Garden', 'Civic', 'Metro', 'Palace', 'Fort',
  'University', 'Tech', 'Industrial', 'Sports', 'Heritage', 'Junction', 'Royal',
];
const NAME_SUFFIX = [
  'Nagar', 'Chowk', 'Circle', 'Square', 'Park', 'Colony', 'Cross', 'Terminal',
  'Gate', 'Junction', 'Enclave', 'Vihar', 'Bazaar', 'Road', 'Gardens', 'Hub',
];

// Caps the number of individually-generated station records per city so the
// UI stays fast and readable — the city's *official* stationsCount stat
// (shown on the city selection card) is unaffected by this cap.
const MAX_GENERATED_STATIONS = 24;

function buildStationName(rand, index) {
  const prefix = NAME_PREFIX[Math.floor(rand() * NAME_PREFIX.length)];
  const suffix = NAME_SUFFIX[Math.floor(rand() * NAME_SUFFIX.length)];
  return `${prefix} ${suffix}`;
}

const cache = new Map();

/**
 * Generates a full, internally-consistent mock dataset for a given city id.
 * Cached per city so repeated calls (across pages) return the same objects.
 */
export function generateCityData(cityId) {
  if (cache.has(cityId)) return cache.get(cityId);

  const city = getCityById(cityId);
  if (!city) return null;

  const rand = seededRandom(cityId);
  const stationCount = Math.min(city.stations, MAX_GENERATED_STATIONS);
  const usedNames = new Set();

  const stations = Array.from({ length: stationCount }).map((_, i) => {
    let name = buildStationName(rand, i);
    let attempts = 0;
    while (usedNames.has(name) && attempts < 5) {
      name = buildStationName(rand, i);
      attempts++;
    }
    usedNames.add(name);

    const line = city.lines[Math.floor(rand() * city.lines.length)];
    const occupancy = Math.round(15 + rand() * 85);
    const status = occupancyToStatus(occupancy);
    const waitingTime = Math.round(2 + rand() * 10);
    const currentCrowd = Math.round((occupancy / 100) * 1800);

    return {
      id: `${cityId.toUpperCase()}-STN-${String(i + 1).padStart(2, '0')}`,
      name,
      line: line.name,
      lineColor: line.color,
      occupancy,
      currentCrowd,
      waitingTime,
      status: status.key,
      statusLabel: status.label,
      statusColor: status.color,
      peakHours: rand() > 0.5 ? '08:00 – 10:00' : '17:30 – 19:30',
      lineIndex: city.lines.findIndex((l) => l.name === line.name),
      positionInLine: i % 8,
    };
  });

  const trains = city.lines.flatMap((line, lineIdx) =>
    Array.from({ length: 4 }).map((_, i) => {
      const load = Math.round(200 + rand() * 1400);
      const capacity = 1800;
      const statusRoll = rand();
      const status = statusRoll > 0.85 ? 'Delayed' : statusRoll > 0.78 ? 'Maintenance' : 'Running';
      const lineStations = stations.filter((s) => s.line === line.name);
      const current = lineStations[Math.floor(rand() * lineStations.length)]?.name || `${line.name} Terminal`;
      const next = lineStations[Math.floor(rand() * lineStations.length)]?.name || `${line.name} Terminal`;

      return {
        id: `${cityId.toUpperCase()}-TRN-${lineIdx + 1}${i + 1}`,
        line: line.name,
        lineColor: line.color,
        status,
        currentStation: current,
        nextStation: next,
        load: status === 'Maintenance' ? 0 : load,
        capacity,
        delayMin: status === 'Delayed' ? Math.round(3 + rand() * 8) : 0,
        platform: `P${(i % 2) + 1}`,
        frequencyMin: Math.round(4 + rand() * 5),
      };
    })
  );

  const hourlyFlow = [
    '05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00',
    '13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00',
  ].map((hour, i) => {
    // Rough bimodal commuter curve (AM + PM peaks)
    const shapeAM = Math.exp(-Math.pow(i - 3, 2) / 6);
    const shapePM = Math.exp(-Math.pow(i - 13, 2) / 8);
    const base = (shapeAM * 0.6 + shapePM * 0.75 + 0.08) * (city.dailyPassengers / 11);
    const noise = 0.85 + rand() * 0.3;
    const entries = Math.round(base * noise);
    const exits = Math.round(base * (0.7 + rand() * 0.5));
    return { hour, entries, exits };
  });

  const weekly = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
    const weekendBoost = i >= 5 ? 0.75 : 1;
    const noise = 0.9 + rand() * 0.2;
    return { day, riders: Math.round(city.dailyPassengers * weekendBoost * noise) };
  });

  const monthly = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((month) => {
    const noise = 0.92 + rand() * 0.18;
    return { month, riders: Number(((city.dailyPassengers * 28 * noise) / 1_000_000).toFixed(1)) };
  });

  const riskStations = [...stations]
    .sort((a, b) => b.occupancy - a.occupancy)
    .slice(0, 8)
    .map((s) => ({
      ...s,
      risk: s.occupancy >= 90 ? 'Critical' : s.occupancy >= 70 ? 'High' : s.occupancy >= 45 ? 'Medium' : 'Low',
    }));

  const alerts = riskStations.slice(0, 3).map((s, i) => ({
    id: `${cityId}-alert-${i}`,
    severity: s.occupancy >= 90 ? 'critical' : 'warning',
    title: `${s.occupancy >= 90 ? 'Overcrowding' : 'Rising demand'} — ${s.name}`,
    message: `${s.name} is at ${s.occupancy}% occupancy with an estimated ${s.waitingTime} minute wait.`,
    station: s.name,
    time: new Date(Date.now() - i * 12 * 60000).toISOString(),
    read: i > 0,
  }));

  const aiPrediction = {
    peakStation: riskStations[0]?.name || stations[0]?.name,
    futureCrowd: hourlyFlow.map((h) => ({
      hour: h.hour,
      predicted: Math.round(h.entries * (1.05 + rand() * 0.15)),
    })),
    suggestedFrequency: `${Math.max(3, Math.round(6 - rand() * 2))} min`,
    confidence: Math.round(78 + rand() * 18),
    congestionTrend: rand() > 0.5 ? 'rising' : 'stable',
  };

  const users = [
    { id: `${cityId}-usr-1`, name: 'Ananya Sharma', role: 'Passenger', email: 'ananya.sharma@example.com', status: 'Active' },
    { id: `${cityId}-usr-2`, name: 'Rohit Verma', role: 'Passenger', email: 'rohit.verma@example.com', status: 'Active' },
    { id: `${cityId}-usr-3`, name: 'Fatima Sheikh', role: 'Operator', email: 'fatima.sheikh@example.com', status: 'Active' },
    { id: `${cityId}-usr-4`, name: 'Karthik Iyer', role: 'Operator', email: 'karthik.iyer@example.com', status: 'Suspended' },
    { id: `${cityId}-usr-5`, name: 'Priya Nair', role: 'Administrator', email: 'priya.nair@example.com', status: 'Active' },
    { id: `${cityId}-usr-6`, name: 'Arjun Mehta', role: 'Administrator', email: 'arjun.mehta@example.com', status: 'Active' },
  ];

  const data = {
    city,
    stations,
    trains,
    hourlyFlow,
    weekly,
    monthly,
    riskStations,
    alerts,
    aiPrediction,
    users,
  };

  cache.set(cityId, data);
  return data;
}

export function clearCityDataCache() {
  cache.clear();
}
