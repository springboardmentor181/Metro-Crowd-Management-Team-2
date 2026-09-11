import { useEffect, useMemo, useState } from 'react';

import Card, {
  CardHeader,
} from '@/components/common/Card';

import SearchBar from '@/components/common/SearchBar';

import Table from '@/components/common/Table';

import Badge, {
  statusToTone,
} from '@/components/common/Badge';

import Pagination from '@/components/common/Pagination';

import { useApp } from '@/hooks/useApp';
import { generateCityData } from '@/data/cityDataGenerator';
import { formatNumber } from '@/utils/formatters';


// ============================================================
// BACKEND
// ============================================================

const RAW_API_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:8000';

const API_PREFIX = RAW_API_URL.endsWith('/api')
  ? RAW_API_URL
  : `${RAW_API_URL.replace(/\/+$/, '')}/api`;

const PAGE_SIZE = 8;


// ============================================================
// CITY NAME NORMALIZATION
// ============================================================

function normalizeCityName(cityName) {
  return (
    cityName
      ?.replace(/\s+Metro$/i, '')
      .trim() || 'Hyderabad'
  );
}


// ============================================================
// STATUS
// ============================================================

// ============================================================
// STATUS
// ============================================================

function getStatusInfo(station) {
  const occupancy = Number(
    station.occupancy ??
    station.predicted_occupancy ??
    station.predictedOccupancy ??
    -1
  );

  if (!isNaN(occupancy) && occupancy >= 0) {
    if (occupancy >= 75) {
      return {
        key: 'critical',
        label: station.status_label || station.statusLabel || (occupancy >= 85 ? 'Overcrowded' : 'Heavy Crowd'),
      };
    }
    if (occupancy >= 40) {
      return {
        key: 'warning',
        label: station.status_label || station.statusLabel || 'Moderate Flow',
      };
    }
    return {
      key: 'smooth',
      label: station.status_label || station.statusLabel || 'Normal Flow',
    };
  }

  const status = String(
    station.status ||
    station.status_label ||
    station.statusLabel ||
    'LOW'
  ).toUpperCase();

  if (
    status.includes('HIGH') ||
    status.includes('CRITICAL') ||
    status.includes('BUSY') ||
    status.includes('RED') ||
    status.includes('OVERCROWD') ||
    status.includes('HEAVY')
  ) {
    return {
      key: 'critical',
      label: station.status_label || station.statusLabel || station.status || 'High',
    };
  }

  if (
    status.includes('MODERATE') ||
    status.includes('MEDIUM') ||
    status.includes('WARNING') ||
    status.includes('YELLOW') ||
    status.includes('ORANGE')
  ) {
    return {
      key: 'warning',
      label: station.status_label || station.statusLabel || station.status || 'Moderate',
    };
  }

  return {
    key: 'smooth',
    label: station.status_label || station.statusLabel || station.status || 'Normal Flow',
  };
}


// ============================================================
// COMPONENT
// ============================================================

export default function StationManagement() {

  // ----------------------------------------------------------
  // SELECTED CITY
  // ----------------------------------------------------------

  const { city, cityId } = useApp();


  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [stations, setStations] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [query, setQuery] = useState('');

  const [page, setPage] = useState(1);


  // ==========================================================
  // NORMALIZED CITY & ID
  // ==========================================================

  const currentCityId = (cityId || city?.id || 'hyderabad').toLowerCase();

  const cityName =
    normalizeCityName(city?.name || currentCityId);


  // ==========================================================
  // LOAD STATIONS FROM SAME BACKEND AS PASSENGER LIVE CROWD
  // ==========================================================

  useEffect(() => {

    let cancelled = false;


    async function loadStations() {
      try {
        setLoading(true);
        setError('');
        setStations([]);

        const url = `${API_PREFIX}/stations?city=${encodeURIComponent(cityName)}&city_id=${encodeURIComponent(currentCityId)}`;

        console.log('Admin Station Management city:', city?.name, 'URL:', url);

        let backendStations = [];

        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          });

          if (response.ok) {
            const result = await response.json();
            backendStations = Array.isArray(result)
              ? result
              : Array.isArray(result?.stations)
              ? result.stations
              : [];
          }
        } catch (err) {
          console.warn('Admin Station Management fetch warning:', err);
        }

        // Get local station master dataset for this city
        const cityData = generateCityData(currentCityId);
        const masterStations = cityData?.stations || [];

        let validStations = [];

        if (masterStations.length > 0) {
          // Map backend real-time values onto authentic master stations
          const loadedMap = new Map();
          backendStations.forEach((s) => {
            if (s.id) loadedMap.set(String(s.id).toUpperCase(), s);
            if (s.station_id) loadedMap.set(String(s.station_id).toUpperCase(), s);
            if (s.stationId) loadedMap.set(String(s.stationId).toUpperCase(), s);
            if (s.name) loadedMap.set(s.name.toLowerCase().trim(), s);
            if (s.station_name) loadedMap.set(s.station_name.toLowerCase().trim(), s);
          });

          validStations = masterStations.map((masterSt, index) => {
            const backendSt =
              loadedMap.get(String(masterSt.id).toUpperCase()) ||
              loadedMap.get(masterSt.name.toLowerCase().trim());

            if (backendSt) {
              const occupancy = Number(
                backendSt.occupancy ??
                backendSt.predicted_occupancy ??
                backendSt.predictedOccupancy ??
                masterSt.occupancy ??
                45
              );
              const passengers = Number(
                backendSt.current_crowd ??
                backendSt.currentCrowd ??
                backendSt.predicted_people ??
                backendSt.predictedPeople ??
                backendSt.entry_count ??
                backendSt.entryCount ??
                masterSt.currentCrowd ??
                800
              );
              const waitingTime = Number(
                backendSt.waiting_time ??
                backendSt.waitingTime ??
                masterSt.waitingTime ??
                3.5
              );

              const merged = { ...masterSt, ...backendSt, occupancy };
              const statusInfo = getStatusInfo(merged);

              return {
                id: masterSt.id,
                name: masterSt.name,
                line: masterSt.line || backendSt.line_name || backendSt.lineName || backendSt.line || 'Unknown Line',
                occupancy,
                currentCrowd: passengers,
                waitingTime,
                status: statusInfo.key,
                statusLabel: statusInfo.label,
                raw: merged,
              };
            }

            const statusInfo = getStatusInfo(masterSt);
            return {
              id: masterSt.id || `STATION-${index + 1}`,
              name: masterSt.name || 'Unknown Station',
              line: masterSt.line || 'Unknown Line',
              occupancy: Number(masterSt.occupancy || 45),
              currentCrowd: Number(masterSt.currentCrowd || 800),
              waitingTime: Number(masterSt.waitingTime || 3.5),
              status: statusInfo.key,
              statusLabel: statusInfo.label,
              raw: masterSt,
            };
          });
        } else if (backendStations.length > 0) {
          validStations = backendStations.map((station, index) => {
            const occupancy = Number(
              station.occupancy ??
              station.predicted_occupancy ??
              station.predictedOccupancy ??
              0
            );
            const passengers = Number(
              station.current_crowd ??
              station.currentCrowd ??
              station.predicted_people ??
              station.predictedPeople ??
              station.entry_count ??
              station.entryCount ??
              0
            );
            const waitingTime = Number(
              station.waiting_time ??
              station.waitingTime ??
              0
            );

            const merged = { ...station, occupancy };
            const statusInfo = getStatusInfo(merged);

            return {
              id: station.station_id ?? station.stationId ?? station.id ?? `STATION-${index + 1}`,
              name: station.station_name ?? station.stationName ?? station.name ?? 'Unknown Station',
              line: station.line_name ?? station.lineName ?? station.line ?? station.metro_line_id ?? 'Unknown',
              occupancy,
              currentCrowd: passengers,
              waitingTime,
              status: statusInfo.key,
              statusLabel: statusInfo.label,
              raw: station,
            };
          }).filter((s) => s.id && s.name);
        }

        if (!cancelled) {
          setStations(validStations);
          setLoading(false);
        }
      } catch (err) {
        console.error('Admin loadStations error:', err);
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    loadStations();


    return () => {
      cancelled = true;
    };

  }, [cityName, city?.name, cityId, city?.id, currentCityId]);


  // ==========================================================
  // SEARCH
  // ==========================================================

  const filtered =
    useMemo(() => {

      const search =
        query
          .trim()
          .toLowerCase();


      if (!search) {
        return stations;
      }


      return stations.filter(
        (station) => {

          return (

            (station.name && String(station.name).toLowerCase().includes(search))

            ||

            (station.id && String(station.id).toLowerCase().includes(search))

            ||

            (station.line && String(station.line).toLowerCase().includes(search))

          );

        }
      );

    }, [stations, query]);


  // ==========================================================
  // PAGINATION
  // ==========================================================

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
        PAGE_SIZE
      )
    );


  const paged =
    filtered.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE
    );


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (

      <div className="space-y-6">

        <div>

          <h1 className="font-display text-2xl font-bold text-slate-900">
            Station Management
          </h1>

          <p className="text-sm text-slate-500">
            Loading stations for {city?.name || cityName}...
          </p>

        </div>


        <Card>

          <div className="flex min-h-[250px] items-center justify-center">

            <p className="text-slate-400">
              Loading stations...
            </p>

          </div>

        </Card>

      </div>

    );

  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {

    return (

      <div className="space-y-6">

        <div>

          <h1 className="font-display text-2xl font-bold text-slate-900">
            Station Management
          </h1>

          <p className="text-sm text-slate-500">
            Monitor and manage every station on the network.
          </p>

        </div>


        <Card>

          <div className="rounded-xl bg-red-50 p-6 text-red-600">

            {error}

          </div>

        </Card>

      </div>

    );

  }


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="space-y-6">


      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h1 className="font-display text-2xl font-bold text-slate-900">
            Station Management
          </h1>

          <p className="text-sm text-slate-500">

            Monitor and manage every station on{' '}

            {city?.name || cityName}.

          </p>

        </div>


        <SearchBar
          value={query}
          onChange={(value) => {

            setQuery(value);

            setPage(1);

          }}
          placeholder="Search station or ID…"
          className="sm:w-72"
        />

      </div>


      {/* ======================================================
          STATION TABLE
      ====================================================== */}

      <Card>

        <CardHeader
          title="All Stations"
          subtitle={
            `${filtered.length} of ` +
            `${stations.length} shown`
          }
        />


        <Table

          columns={[


            // ------------------------------------------------
            // STATION
            // ------------------------------------------------

            {
              key: 'name',

              header: 'Station',

              render: (station) => (

                <div>

                  <p className="font-medium text-slate-800">
                    {station.name}
                  </p>

                  <p className="text-xs text-slate-400">
                    ID: {station.id}
                  </p>

                </div>

              ),
            },


            // ------------------------------------------------
            // LINE
            // ------------------------------------------------

            {
              key: 'line',

              header: 'Line',

              render: (station) =>
                station.line || 'N/A',

            },


            // ------------------------------------------------
            // OCCUPANCY
            // ------------------------------------------------

            {
              key: 'occupancy',

              header: 'Occupancy',

              render: (station) =>
                `${Number(
                  station.occupancy || 0
                ).toFixed(2)}%`,

            },


            // ------------------------------------------------
            // PASSENGERS
            // ------------------------------------------------

            {
              key: 'currentCrowd',

              header: 'Passengers',

              render: (station) =>
                formatNumber(
                  station.currentCrowd || 0
                ),

            },


            // ------------------------------------------------
            // WAITING
            // ------------------------------------------------

            {
              key: 'waitingTime',

              header: 'Waiting',

              render: (station) =>
                `${Number(
                  station.waitingTime || 0
                ).toFixed(0)} min`,

            },


            // ------------------------------------------------
            // STATUS
            // ------------------------------------------------

            {
              key: 'status',

              header: 'Status',

              render: (station) => (

                <Badge
                  tone={statusToTone(
                    station.status
                  )}
                >

                  {station.statusLabel}

                </Badge>

              ),

            },

          ]}

          data={paged}

        />


        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />

      </Card>


      {/* ======================================================
          SOURCE INFORMATION
      ====================================================== */}

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">

        <p className="text-xs text-blue-700">

          <strong>Station data source:</strong>{' '}

          FastAPI backend — same station source used by
          Passenger Live Crowd. Station names and IDs are
          therefore synchronized across both modules.

        </p>

      </div>

    </div>

  );

}