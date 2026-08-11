import { motion } from 'framer-motion';
import { CROWD_STATUS } from '@/constants';

/**
 * Renders each metro line as a horizontal schematic track with station
 * nodes, in the style of a real transit map. Clicking a station calls
 * onStationClick(station). Colors reflect live crowd status per station.
 */
export default function MetroLineDiagram({ lines, stations, onStationClick }) {
  return (
    <div className="space-y-10">
      {lines.map((line, lineIdx) => {
        const lineStations = stations.filter((s) => s.line === line.name);
        if (lineStations.length === 0) return null;
        const width = Math.max(600, lineStations.length * 110);

        return (
          <div key={line.name}>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: line.color }} />
              <p className="text-sm font-semibold text-slate-700">{line.name}</p>
              <span className="text-xs text-slate-400">{lineStations.length} stations</span>
            </div>
            <div className="overflow-x-auto pb-2">
              <svg width={width} height={110} className="block">
                <line x1={40} y1={55} x2={width - 40} y2={55} stroke={line.color} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
                {lineStations.map((station, i) => {
                  const x = 40 + (i * (width - 80)) / Math.max(1, lineStations.length - 1);
                  const status = CROWD_STATUS[station.status] || CROWD_STATUS.GREEN;
                  return (
                    <g key={station.id} onClick={() => onStationClick(station)} className="cursor-pointer">
                      <motion.circle
                        cx={x}
                        cy={55}
                        r={9}
                        fill="white"
                        stroke={status.color}
                        strokeWidth={4}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.03 * i, type: 'spring', stiffness: 260, damping: 16 }}
                      />
                      <text
                        x={x}
                        y={78}
                        textAnchor="middle"
                        className="fill-slate-600"
                        style={{ fontSize: 10, fontWeight: 500 }}
                      >
                        {station.name.length > 12 ? `${station.name.slice(0, 11)}…` : station.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
