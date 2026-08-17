# MetroFlow — AI Platform for Crowd Management and Scheduling

A production-ready **frontend-only** React application for an AI-powered metro
operations console: crowd monitoring, train scheduling, AI predictions,
analytics, reports, and alerts — all backed by realistic mock data and
structured to plug into a real backend later with minimal changes.

## Tech stack

- React 18 + Vite
- Tailwind CSS (dark/light mode via class strategy)
- React Router DOM v6 (protected routes)
- React Hook Form + Zod (validation)
- Axios (pre-wired API client)
- Framer Motion (page/element animation)
- Recharts (all charts)
- React Leaflet (station map)
- React Toastify (notifications)
- Lucide React (icons)
- React Context API (auth + theme state)

## Getting started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Demo login

The app seeds one account into `localStorage` on first run:

- **Email:** `admin@metroflow.app`
- **Password:** `MetroFlow@123`

Or use **Register** to create a new account — it's stored locally the same way.

## Project structure

```
src/
├── assets/            # Static assets
├── components/
│   ├── common/         # Button, Input, Card, Modal, Drawer, Table, etc.
│   ├── layout/          # Sidebar, Navbar, Footer
│   ├── auth/             # ProtectedRoute, PublicOnlyRoute
│   ├── dashboard/        # StatCard, AlertsPanel, AIRecommendationCard...
│   └── charts/           # Recharts + Leaflet wrappers
├── layouts/            # DashboardLayout, AuthLayout
├── pages/              # One folder per module, route-aligned
├── hooks/              # useAuth, useTheme, useLocalStorage, useDisclosure
├── context/            # AuthContext, ThemeContext
├── services/           # api.js (axios), authService.js (mock backend)
├── routes/             # AppRoutes.jsx — all route definitions
├── data/               # Mock JSON-like datasets (stations, trains, etc.)
├── utils/               # cn.js, formatters.js
├── constants/           # ROUTES, roles, storage keys
└── styles/              # Tailwind entry + custom utility classes
```

## Connecting a real backend later

Every piece of mock data lives in `src/data/*.js` and every mock "API call"
lives in `src/services/*.js`. To go live:

1. Set `VITE_API_BASE_URL` in a `.env` file (see `.env.example`).
2. Replace the bodies of functions in `src/services/authService.js` with
   calls through `src/services/api.js` (the axios instance already attaches
   the auth token to every request).
3. Add sibling service files (e.g. `stationService.js`, `trainService.js`)
   that call your real endpoints, and swap the static imports from
   `src/data/*.js` in each page for calls to those services (e.g. inside a
   `useEffect` + `useState`, or React Query if you add it later).

No component, layout, or route needs to change — they all consume data
through the same shape already.

## Notes

- Auth is intentionally mocked with `localStorage` — good enough to
  demonstrate full login/register/forgot/reset flows without a backend.
- "Export to PDF/Excel" buttons in Reports are UI-only placeholders, as
  requested — wire them to real export endpoints when available.
- The Leaflet map uses public OpenStreetMap tiles, no API key required.
