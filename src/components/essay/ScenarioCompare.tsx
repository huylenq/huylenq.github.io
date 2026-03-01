import { useEssayState } from './EssayContext';
import { simulate, type SimParams, type SprintSnapshot } from './simulate';

const MINI_W = 280;
const MINI_H = 140;
const PAD = { top: 18, right: 10, bottom: 20, left: 32 };
const PLOT_W = MINI_W - PAD.left - PAD.right;
const PLOT_H = MINI_H - PAD.top - PAD.bottom;

const SERIES = [
  { key: 'shipped', dash: 'none', ink: 'var(--ink-black)' },
  { key: 'bugs', dash: '6,3', ink: 'var(--ink-medium)' },
  { key: 'wip', dash: '2,3', ink: 'var(--ink-light)' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

export function ScenarioCompare({
  overrides,
  labels = ['Current', 'Modified'],
}: {
  overrides: Partial<SimParams>;
  labels?: [string, string];
}) {
  const state = useEssayState();
  const isHydrated = Object.keys(state).length > 0;

  if (!isHydrated) {
    return <div className="essay-scenario" />;
  }

  const baseParams: SimParams = {
    devs: state.devs,
    wip: state.wip,
    debt: state.debt,
    bugs: state.bugs,
    backlog: state.backlog,
  };
  const modParams: SimParams = { ...baseParams, ...overrides };

  const baseSim = simulate(baseParams);
  const modSim = simulate(modParams);

  // Shared Y max across both scenarios for fair comparison
  let yMax = 1;
  for (const snapshots of [baseSim, modSim]) {
    for (const s of snapshots) {
      for (const { key } of SERIES) {
        if (s[key] > yMax) yMax = s[key];
      }
    }
  }
  yMax = niceMax(yMax);

  return (
    <div className="essay-scenario">
      <MiniChart snapshots={baseSim} label={labels[0]} yMax={yMax} />
      <MiniChart snapshots={modSim} label={labels[1]} yMax={yMax} />
    </div>
  );
}

function MiniChart({
  snapshots,
  label,
  yMax,
}: {
  snapshots: SprintSnapshot[];
  label: string;
  yMax: number;
}) {
  const n = snapshots.length;
  const xScale = (i: number) => PAD.left + (i / (n - 1)) * PLOT_W;
  const yScale = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;

  const totalShipped = snapshots[snapshots.length - 1].totalShipped;

  return (
    <div className="essay-scenario-panel">
      <span className="essay-scenario-label">{label}</span>
      <svg viewBox={`0 0 ${MINI_W} ${MINI_H}`}>
        {/* Y grid — 2 lines */}
        {[0, yMax / 2, yMax].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={yScale(tick)}
              x2={MINI_W - PAD.right}
              y2={yScale(tick)}
              style={{ stroke: 'var(--ink-faint)', strokeWidth: 0.5, opacity: 0.3 }}
            />
            <text
              x={PAD.left - 4}
              y={yScale(tick) + 3}
              style={{
                fill: 'var(--ink-light)',
                fontSize: 8,
                fontFamily: 'var(--font-sans)',
                textAnchor: 'end',
              }}
            >
              {tick % 1 === 0 ? tick : tick.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Series */}
        {SERIES.map(({ key, dash, ink }) => {
          const pts = snapshots
            .map(
              (s, i) =>
                `${xScale(i).toFixed(1)},${yScale(s[key as SeriesKey]).toFixed(1)}`
            )
            .join(' ');
          return (
            <polyline
              key={key}
              points={pts}
              style={{
                fill: 'none',
                stroke: ink,
                strokeWidth: 1.2,
                strokeDasharray: dash,
              }}
            />
          );
        })}

        {/* Total shipped annotation */}
        <text
          x={MINI_W - PAD.right}
          y={PAD.top + 10}
          style={{
            fill: 'var(--ink-dark)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            textAnchor: 'end',
            fontWeight: 600,
          }}
        >
          {totalShipped.toFixed(0)} pts
        </text>
      </svg>
    </div>
  );
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  if (v <= 20) return 20;
  if (v <= 50) return 50;
  return Math.ceil(v / 10) * 10;
}
