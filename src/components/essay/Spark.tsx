import { useEssayState } from './EssayContext';
import { simulate, type SprintSnapshot } from './simulate';

type MetricKey = keyof Omit<SprintSnapshot, 'sprint'>;

export function Spark({ metric }: { metric: MetricKey }) {
  const state = useEssayState();
  const isHydrated = Object.keys(state).length > 0;

  if (!isHydrated) {
    return <svg className="essay-spark" viewBox="0 0 80 20" />;
  }

  const snapshots = simulate({
    devs: state.devs,
    wip: state.wip,
    debt: state.debt,
    bugs: state.bugs,
    backlog: state.backlog,
  });

  const values = snapshots.map((s) => s[metric]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const w = 80;
  const h = 20;
  const pad = 1;
  const plotH = h - pad * 2;
  const stepX = w / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = pad + plotH - ((v - min) / range) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Area fill: same points but closed to bottom
  const areaPath =
    `M0,${(pad + plotH).toFixed(1)} ` +
    values
      .map((v, i) => {
        const x = i * stepX;
        const y = pad + plotH - ((v - min) / range) * plotH;
        return `L${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ') +
    ` L${w},${(pad + plotH).toFixed(1)} Z`;

  return (
    <svg className="essay-spark" viewBox={`0 0 ${w} ${h}`}>
      <path
        d={areaPath}
        style={{ fill: 'var(--ink-faint)', opacity: 0.25 }}
      />
      <polyline
        points={points}
        style={{
          fill: 'none',
          stroke: 'var(--ink-medium)',
          strokeWidth: 1.5,
        }}
      />
    </svg>
  );
}
