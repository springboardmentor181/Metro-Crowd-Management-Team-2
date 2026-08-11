# MetroFlow — Smart Metro Management System

A premium, enterprise-grade frontend for a metro management platform, built
frontend-only with realistic mock data structured for an easy backend swap
later.

## Flow

```
Login → Continue As (Passenger / Administrator) → Select Metro City → Dashboard
```

- Role and selected city persist to `localStorage` and drive every page —
  switching city via the navbar's "Change City" button regenerates all data.
- Auth is mocked with `localStorage`. Demo login:
  **demo@metroflow.app** / **MetroFlow@123**

## Tech stack

React 18 + Vite · Tailwind CSS · React Router DOM v6 · Framer Motion ·
Recharts · React Hook Form + Zod · React Toastify · Lucide React · Context API

## Getting started

```bash
npm install
npm run dev
```

## Project structure

```
src/
├── components/
│   ├── common/       # Button, Input, Card, Modal, Table, Badge, CountUp...
│   ├── passenger/     # Sidebar, Navbar, MetroLineDiagram, StationDetailModal
│   ├── admin/          # Sidebar, Navbar
│   ├── modals/          # HighCrowdAlert, ChangeCityModal
│   ├── charts/           # Recharts wrappers (area/bar/line/donut), ProgressBar
│   └── auth/              # Route guards (RequireAuth, RequireRoleAndCity...)
├── layouts/             # PassengerLayout, AdminLayout
├── pages/
│   ├── auth/             # Login, RoleSelect, CitySelect
│   ├── passenger/         # Dashboard, JourneyPlanner, LiveCrowd, MetroMap...
│   └── admin/              # Dashboard, Analytics, LiveMonitoring, Stations...
├── context/              # AuthContext, AppContext (role + city)
├── services/              # authService.js (mock backend)
├── data/                   # cities.js (10 city metadata) + cityDataGenerator.js
├── hooks/                   # useAuth, useApp, useCityData, useDisclosure
├── routes/                   # AppRoutes.jsx
├── constants/                 # ROUTES, ROLES, crowd status helpers
└── utils/                      # cn.js, formatters.js (incl. seeded RNG)
```

## Mock data model

`src/data/cities.js` holds static metadata for 10 metro cities (station
count, line count, daily passengers). `src/data/cityDataGenerator.js`
deterministically generates a full dataset per city — stations, trains,
hourly/weekly/monthly ridership, risk rankings, alerts, and an AI
prediction block — seeded off the city id, cached per city, and instantly
swapped whenever the selected city changes.

## Connecting a real backend later

Swap the body of `src/services/authService.js` for real HTTP calls, and add
sibling services (e.g. `stationService.js`) that fetch from your backend
instead of calling `generateCityData()`. Pages consume data through
`useCityData()` / `useApp()`, so no component needs to change — only the
hook's data source does.

## Notes

- No Notifications or Settings entries in either sidebar, per spec — alerts
  surface as an auto-dismissing "High Crowd Alert" popup instead.
- The Metro Map is a schematic SVG line diagram (like a real transit map)
  rather than a geographic map, so it works identically for all 10 cities
  without needing real station coordinates.
- Report export buttons are UI-only placeholders, as requested.
