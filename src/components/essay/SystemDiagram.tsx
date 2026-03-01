import { useRef, type PointerEvent } from 'react';
import { useEssayState, useEssayVar } from './EssayContext';

const W = 680;
const H = 300;

// Stock box dimensions
const BOX_W = 100;
const BOX_H = 60;

// Positions for stock boxes (centers)
const POS = {
  backlog: { x: 80, y: 70 },
  wip: { x: 300, y: 70 },
  done: { x: 520, y: 70 },
  bugs: { x: 200, y: 220 },
  debt: { x: 420, y: 220 },
} as const;

export function SystemDiagram() {
  const state = useEssayState();
  const isHydrated = Object.keys(state).length > 0;

  if (!isHydrated) {
    return (
      <div className="essay-diagram">
        <svg viewBox={`0 0 ${W} ${H}`} />
      </div>
    );
  }

  const { devs, wip, debt, bugs, backlog } = state;
  const perDev = wip / Math.max(1, devs);
  const switchLoss = Math.min(0.8, Math.max(0, (perDev - 2) * 0.2));
  const debtLoss = Math.min(0.9, debt * 0.05);
  const baseVel = devs * 3;
  const velocity = Math.max(0, baseVel * (1 - switchLoss) * (1 - debtLoss));
  const bugGen = wip * 0.05 * (1 + debt * 0.15);
  const bugFix = Math.min(bugs, velocity * 0.4);
  const shipped = Math.min(wip, velocity - bugFix);
  const pull = Math.min(backlog, devs * 2);
  const debtAccrual = perDev > 3 ? 0.5 : 0;

  // Compute a "done" total for display (not in state, just illustrative)
  const done = shipped;

  return (
    <div className="essay-diagram">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {/* Flow arrows (behind boxes) */}
        <FlowArrow
          from={POS.backlog}
          to={POS.wip}
          rate={pull}
          maxRate={20}
          label={`pull ${pull.toFixed(0)}`}
        />
        <FlowArrow
          from={POS.wip}
          to={POS.done}
          rate={shipped}
          maxRate={20}
          label={`ship ${shipped.toFixed(1)}`}
        />
        {/* WIP → Bugs (downward) */}
        <FlowArrow
          from={{ x: POS.wip.x - 20, y: POS.wip.y + BOX_H / 2 }}
          to={{ x: POS.bugs.x + 20, y: POS.bugs.y - BOX_H / 2 }}
          rate={bugGen}
          maxRate={10}
          label={`+${bugGen.toFixed(1)} bugs`}
          curved
          labelOffset={{ dx: -40, dy: -10 }}
        />
        {/* Bugs → WIP (upward, bug fixes consume velocity) */}
        <FlowArrow
          from={{ x: POS.bugs.x + 40, y: POS.bugs.y - BOX_H / 2 }}
          to={{ x: POS.wip.x + 10, y: POS.wip.y + BOX_H / 2 }}
          rate={bugFix}
          maxRate={10}
          label={`fix ${bugFix.toFixed(1)}`}
          curved
          dashed
          labelOffset={{ dx: 45, dy: 10 }}
        />
        {/* WIP → Debt (high WIP accrues debt) */}
        <FlowArrow
          from={{ x: POS.wip.x + 30, y: POS.wip.y + BOX_H / 2 }}
          to={{ x: POS.debt.x - 30, y: POS.debt.y - BOX_H / 2 }}
          rate={debtAccrual}
          maxRate={1}
          label={debtAccrual > 0 ? '+0.5 debt' : ''}
          curved
          labelOffset={{ dx: 20, dy: 0 }}
        />

        {/* Stock boxes */}
        <StockBox
          pos={POS.backlog}
          label="Backlog"
          name="backlog"
          value={backlog}
          max={100}
          min={0}
          step={5}
        />
        <StockBox
          pos={POS.wip}
          label="WIP"
          name="wip"
          value={wip}
          max={30}
          min={1}
          step={1}
        />
        <StockBox
          pos={POS.done}
          label="Done"
          value={done}
          max={20}
          readOnly
        />
        <StockBox
          pos={POS.bugs}
          label="Bugs"
          name="bugs"
          value={bugs}
          max={20}
          min={0}
          step={1}
        />
        <StockBox
          pos={POS.debt}
          label="Debt"
          name="debt"
          value={debt}
          max={18}
          min={0}
          step={1}
        />
      </svg>
    </div>
  );
}

// ── StockBox ──────────────────────────────────────────────────────

function StockBox({
  pos,
  label,
  name,
  value,
  max,
  min = 0,
  step = 1,
  readOnly = false,
}: {
  pos: { x: number; y: number };
  label: string;
  name?: string;
  value: number;
  max: number;
  min?: number;
  step?: number;
  readOnly?: boolean;
}) {
  const x = pos.x - BOX_W / 2;
  const y = pos.y - BOX_H / 2;
  const fillHeight = Math.min(1, Math.max(0, value / max)) * (BOX_H - 4);

  return (
    <g>
      {/* Box outline */}
      <rect
        x={x}
        y={y}
        width={BOX_W}
        height={BOX_H}
        rx={3}
        style={{
          fill: 'var(--paper)',
          stroke: 'var(--ink-medium)',
          strokeWidth: 1.5,
        }}
      />
      {/* Fill level */}
      <rect
        x={x + 2}
        y={y + BOX_H - 2 - fillHeight}
        width={BOX_W - 4}
        height={fillHeight}
        rx={2}
        style={{ fill: 'var(--ink-faint)', opacity: 0.3 }}
      />
      {/* Label */}
      <text
        x={pos.x}
        y={y - 6}
        style={{
          fill: 'var(--ink-medium)',
          fontSize: 10,
          fontFamily: 'var(--font-sans)',
          textAnchor: 'middle',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </text>
      {/* Value — scrubbable if not readOnly */}
      {readOnly ? (
        <text
          x={pos.x}
          y={pos.y + 5}
          style={{
            fill: 'var(--ink-dark)',
            fontSize: 18,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            textAnchor: 'middle',
          }}
        >
          {value % 1 === 0 ? value : value.toFixed(1)}
        </text>
      ) : (
        <ScrubValue
          cx={pos.x}
          cy={pos.y + 5}
          name={name!}
          min={min}
          max={max}
          step={step}
        />
      )}
    </g>
  );
}

// ── ScrubValue ────────────────────────────────────────────────────
// Duplicates Var.tsx pointer-drag pattern (scope discipline: no extraction)

function ScrubValue({
  cx,
  cy,
  name,
  min,
  max,
  step,
}: {
  cx: number;
  cy: number;
  name: string;
  min: number;
  max: number;
  step: number;
}) {
  const [value, setValue] = useEssayVar(name);
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const pxPerStep = Math.max(1, 200 / ((max - min) / step));

  const onPointerDown = (e: PointerEvent<SVGTextElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, startValue: value };
    (e.target as SVGTextElement).setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
  };

  const onPointerMove = (e: PointerEvent<SVGTextElement>) => {
    if (!dragRef.current) return;
    // Negative because screen Y goes down but "up = increase"
    const dy = -(e.clientY - dragRef.current.startY);
    const steps = Math.round(dy / pxPerStep);
    let next = dragRef.current.startValue + steps * step;
    next = Math.max(min, Math.min(max, next));
    setValue(next);
  };

  const onPointerUp = () => {
    dragRef.current = null;
    document.body.style.userSelect = '';
  };

  const textW = String(value).length * 10;

  return (
    <g
      className="essay-diagram-scrub"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ touchAction: 'none' }}
    >
      {/* Invisible hit area for easier touch targeting */}
      <rect
        x={cx - textW / 2 - 6}
        y={cy - 16}
        width={textW + 12}
        height={28}
        style={{ fill: 'transparent' }}
      />
      <text
        x={cx}
        y={cy}
        style={{
          fill: 'var(--ink-dark)',
          fontSize: 18,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          textAnchor: 'middle',
          cursor: 'ns-resize',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {value}
      </text>
      <line
        x1={cx - textW / 2}
        y1={cy + 6}
        x2={cx + textW / 2}
        y2={cy + 6}
        style={{
          stroke: 'var(--ink-medium)',
          strokeWidth: 0.5,
          strokeDasharray: '4,2',
        }}
      />
    </g>
  );
}

// ── FlowArrow ─────────────────────────────────────────────────────

function FlowArrow({
  from,
  to,
  rate,
  maxRate,
  label,
  curved = false,
  dashed = false,
  labelOffset = { dx: 0, dy: 0 },
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  rate: number;
  maxRate: number;
  label: string;
  curved?: boolean;
  dashed?: boolean;
  labelOffset?: { dx: number; dy: number };
}) {
  const norm = Math.min(1, Math.max(0.05, rate / maxRate));
  const thickness = 1 + norm * 3;
  // Animation speed: faster flow = shorter dash period
  const dashLen = 8;
  const animDur = Math.max(0.3, 2 - norm * 1.5);

  let pathD: string;
  let midX: number;
  let midY: number;

  if (curved) {
    // Quadratic bezier
    midX = (from.x + to.x) / 2;
    midY = (from.y + to.y) / 2;
    const cpX = midX + (from.y < to.y ? -40 : 40);
    const cpY = midY;
    pathD = `M${from.x},${from.y} Q${cpX},${cpY} ${to.x},${to.y}`;
  } else {
    // Straight with slight offset for box edges
    const fx = from.x + BOX_W / 2;
    const tx = to.x - BOX_W / 2;
    pathD = `M${fx},${from.y} L${tx},${to.y}`;
    midX = (fx + tx) / 2;
    midY = (from.y + to.y) / 2;
  }

  if (rate <= 0 && !label) return null;

  return (
    <g>
      <path
        d={pathD}
        className="essay-flow-arrow"
        style={{
          fill: 'none',
          stroke: 'var(--ink-light)',
          strokeWidth: thickness,
          strokeDasharray: dashed ? `${dashLen},${dashLen}` : `${dashLen},4`,
          animationDuration: `${animDur}s`,
          opacity: rate <= 0 ? 0.2 : 0.6 + norm * 0.4,
        }}
      />
      {/* Arrowhead */}
      <circle
        cx={to.x + (curved ? 0 : -BOX_W / 2 + 3)}
        cy={to.y}
        r={2 + norm * 2}
        style={{ fill: 'var(--ink-light)', opacity: rate <= 0 ? 0.2 : 0.6 }}
      />
      {/* Label */}
      {label && (
        <text
          x={midX + labelOffset.dx}
          y={midY - 6 + labelOffset.dy}
          style={{
            fill: 'var(--ink-medium)',
            fontSize: 8.5,
            fontFamily: 'var(--font-sans)',
            textAnchor: 'middle',
          }}
        >
          {label}
        </text>
      )}
    </g>
  );
}
