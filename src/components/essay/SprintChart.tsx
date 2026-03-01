import { useEssayState } from './EssayContext';
import { simulate } from './simulate';

const SERIES = [
  { key: 'shipped', label: 'Shipped', dash: 'none', ink: 'var(--ink-black)' },
  { key: 'bugs', label: 'Bugs', dash: '6,3', ink: 'var(--ink-medium)' },
  { key: 'wip', label: 'WIP', dash: '2,3', ink: 'var(--ink-light)' },
  { key: 'debt', label: 'Debt', dash: '8,3,2,3', ink: 'var(--ink-faint)' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

const W = 600;
const H = 240;
const PAD = { top: 20, right: 20, bottom: 30, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export function SprintChart() {
  const state = useEssayState();
  const isHydrated = Object.keys(state).length > 0;

  if (!isHydrated) {
    return (
      <div className="essay-chart">
        <svg viewBox={`0 0 ${W} ${H}`} />
      </div>
    );
  }

  const snapshots = simulate({
    devs: state.devs,
    wip: state.wip,
    debt: state.debt,
    bugs: state.bugs,
    backlog: state.backlog,
  });

  const n = snapshots.length;

  // Compute shared Y max across all series
  let yMax = 1;
  for (const s of snapshots) {
    for (const { key } of SERIES) {
      if (s[key] > yMax) yMax = s[key];
    }
  }
  // Round up to a nice number
  yMax = niceMax(yMax);

  const xScale = (i: number) => PAD.left + (i / (n - 1)) * PLOT_W;
  const yScale = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;

  // Y-axis grid: 4 lines
  const yTicks = [0, 1, 2, 3, 4].map((i) => (yMax / 4) * i);

  return (
    <div className="essay-chart">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={yScale(tick)}
              x2={W - PAD.right}
              y2={yScale(tick)}
              style={{ stroke: 'var(--ink-faint)', strokeWidth: 0.5, opacity: 0.4 }}
            />
            <text
              x={PAD.left - 6}
              y={yScale(tick) + 3}
              style={{
                fill: 'var(--ink-light)',
                fontSize: 9,
                fontFamily: 'var(--font-sans)',
                textAnchor: 'end',
              }}
            >
              {tick % 1 === 0 ? tick : tick.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X-axis labels: every 5 sprints */}
        {snapshots.map(
          (s, i) =>
            i % 5 === 0 && (
              <text
                key={i}
                x={xScale(i)}
                y={H - 6}
                style={{
                  fill: 'var(--ink-light)',
                  fontSize: 9,
                  fontFamily: 'var(--font-sans)',
                  textAnchor: 'middle',
                }}
              >
                S{s.sprint + 1}
              </text>
            )
        )}

        {/* Data series */}
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
                strokeWidth: 1.5,
                strokeDasharray: dash,
              }}
            />
          );
        })}

        {/* Legend */}
        {SERIES.map(({ key, label, dash, ink }, i) => {
          const lx = PAD.left + i * 120;
          const ly = 12;
          return (
            <g key={key}>
              <line
                x1={lx}
                y1={ly}
                x2={lx + 20}
                y2={ly}
                style={{ stroke: ink, strokeWidth: 1.5, strokeDasharray: dash }}
              />
              <text
                x={lx + 25}
                y={ly + 3}
                style={{
                  fill: ink,
                  fontSize: 9,
                  fontFamily: 'var(--font-sans)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Round up to a "nice" max for axis readability */
function niceMax(v: number): number {
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  if (v <= 20) return 20;
  if (v <= 50) return 50;
  return Math.ceil(v / 10) * 10;
}
