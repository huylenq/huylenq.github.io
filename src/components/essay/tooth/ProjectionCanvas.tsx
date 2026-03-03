import { useMemo, useRef } from 'react';
import { useEssayState } from '../EssayContext';
import { getToothPoints } from './toothShapes';
import {
  convexHull,
  centroid,
  projectToXY,
  projectToYZ,
  projectToXZ,
  rotateAroundZ,
  rotateAroundX,
  rotateAroundY,
  farthestHullPoints,
  restrictedEdgeHullPoints,
  minBoundingRectPoints,
  correctionAngle,
  type Point2D,
} from './geometry';

type Projection = 'xy' | 'yz' | 'xz';

const PROJECT_FN = {
  xy: projectToXY,
  yz: projectToYZ,
  xz: projectToXZ,
} as const;

const AXIS_LABEL: Record<Projection, string> = {
  xy: 'Z-axis',
  yz: 'X-axis',
  xz: 'Y-axis',
};

const CORRECTION_AXIS: Record<Projection, 'z' | 'x' | 'y'> = {
  xy: 'z',
  yz: 'x',
  xz: 'y',
};

const SVG_SIZE = 200;
const MARGIN = 20;
const VIEW = SVG_SIZE - 2 * MARGIN;

// Returns scaled points plus a toSvg mapper reusing the same transform
function scalePoints(pts: Point2D[]): {
  scaled: Point2D[];
  toSvg: (p: Point2D) => Point2D;
} {
  if (pts.length === 0) {
    const toSvg = (p: Point2D) => p;
    return { scaled: [], toSvg };
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const scale = VIEW / (Math.max(maxX - minX, maxY - minY) || 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const toSvg = (p: Point2D) => ({
    x: MARGIN + VIEW / 2 + (p.x - cx) * scale,
    y: MARGIN + VIEW / 2 - (p.y - cy) * scale, // flip Y for SVG
  });
  return { scaled: pts.map(toSvg), toSvg };
}

function refPointsForMethod(
  method: number,
  hull: Point2D[],
  center: Point2D
): { a: Point2D; b: Point2D; rect: Point2D[] | null } {
  switch (method) {
    case 1:
      return { ...restrictedEdgeHullPoints(hull, center), rect: null };
    case 2: {
      const { a, b, rect } = minBoundingRectPoints(hull);
      return { a, b, rect };
    }
    default:
      return { ...farthestHullPoints(hull, center), rect: null };
  }
}

export function ProjectionCanvas({
  projection,
  dimmed = false,
  intense = false,
  step: stepOverride,
}: {
  projection: Projection;
  dimmed?: boolean;
  intense?: boolean;
  step?: number;
}) {
  const state = useEssayState();
  const isHydrated = Object.keys(state).length > 0;

  // Cache the tooth point cloud — only regenerate when toothType changes
  const toothType = state.toothType ?? 0;
  const toothPtsRef = useRef<{ type: number; pts: ReturnType<typeof getToothPoints> } | null>(null);
  if (!toothPtsRef.current || toothPtsRef.current.type !== toothType) {
    toothPtsRef.current = { type: toothType, pts: getToothPoints(toothType) };
  }

  const { tiltZ = 0, tiltX = 0, tiltY = 0, method = 0 } = state;
  const step = stepOverride ?? state.step ?? 0;

  const { scaledPoints, hull, refA, refB, angle, rect } = useMemo(() => {
    if (!isHydrated) return { scaledPoints: [], hull: [], refA: null, refB: null, angle: 0, rect: null };

    let pts = toothPtsRef.current!.pts;

    // Apply tilts
    pts = rotateAroundZ(pts, tiltZ);
    pts = rotateAroundX(pts, tiltX);
    pts = rotateAroundY(pts, tiltY);

    // Apply sequential corrections up to current step (double Z per Chen et al.)
    if (step >= 1) {
      const hullXY = convexHull(projectToXY(pts));
      const { a, b } = refPointsForMethod(method, hullXY, centroid(hullXY));
      pts = rotateAroundZ(pts, correctionAngle(a, b, 'z'));
    }
    if (step >= 2) {
      const hullXY2 = convexHull(projectToXY(pts));
      const { a, b } = refPointsForMethod(method, hullXY2, centroid(hullXY2));
      pts = rotateAroundZ(pts, correctionAngle(a, b, 'z'));
    }
    if (step >= 3) {
      const hullYZ = convexHull(projectToYZ(pts));
      const { a, b } = refPointsForMethod(method, hullYZ, centroid(hullYZ));
      pts = rotateAroundX(pts, correctionAngle(a, b, 'x'));
    }
    if (step >= 4) {
      const hullXZ = convexHull(projectToXZ(pts));
      const { a, b } = refPointsForMethod(method, hullXZ, centroid(hullXZ));
      pts = rotateAroundY(pts, correctionAngle(a, b, 'y'));
    }

    const projected = PROJECT_FN[projection](pts);
    const hullPts = convexHull(projected);
    const ref = refPointsForMethod(method, hullPts, centroid(hullPts));
    const ang = correctionAngle(ref.a, ref.b, CORRECTION_AXIS[projection]);

    // Single scale computation — reuse toSvg for ref points and rect
    const { scaled: scaledProjected } = scalePoints(projected);
    const { scaled: scaledHull, toSvg } = scalePoints(hullPts);

    return {
      scaledPoints: scaledProjected,
      hull: scaledHull,
      refA: toSvg(ref.a),
      refB: toSvg(ref.b),
      angle: ang,
      rect: ref.rect ? ref.rect.map(toSvg) : null,
    };
  }, [isHydrated, tiltZ, tiltX, tiltY, step, method, toothType, projection]);

  if (!isHydrated) {
    return <div className="tooth-canvas" style={{ width: SVG_SIZE, height: SVG_SIZE + 28 }} />;
  }

  const hullPath = hull.length > 0
    ? `M ${hull.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
    : '';

  const rectPath = rect
    ? `M ${rect.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
    : '';

  // Ink levels: default (subtle) vs intense (stepper)
  const ink = intense
    ? { cross: 'light', dots: 'medium', hull: 'dark', hullW: 1.2, rect: 'medium', rectW: 1, ab: 'black', label: 'black', labelW: 600 }
    : { cross: 'faint', dots: 'faint', hull: 'medium', hullW: 1, rect: 'faint', rectW: 0.8, ab: 'dark', label: 'dark', labelW: 400 };

  return (
    <div className="tooth-canvas">
      <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} width={SVG_SIZE} height={SVG_SIZE}>
        {/* Axis crosshairs */}
        <line x1={MARGIN} y1={SVG_SIZE / 2} x2={SVG_SIZE - MARGIN} y2={SVG_SIZE / 2}
          stroke={`var(--ink-${ink.cross})`} strokeWidth={0.5} strokeDasharray="4 4" />
        <line x1={SVG_SIZE / 2} y1={MARGIN} x2={SVG_SIZE / 2} y2={SVG_SIZE - MARGIN}
          stroke={`var(--ink-${ink.cross})`} strokeWidth={0.5} strokeDasharray="4 4" />

        {/* Point cloud */}
        {scaledPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.2} fill={`var(--ink-${ink.dots})`} />
        ))}

        {/* Convex hull */}
        {hullPath && (
          <path d={hullPath} fill="none" stroke={`var(--ink-${ink.hull})`} strokeWidth={ink.hullW} />
        )}

        {/* Bounding rectangle overlay */}
        {rectPath && (
          <path d={rectPath} fill="none" stroke={`var(--ink-${ink.rect})`} strokeWidth={ink.rectW} strokeDasharray="3 3" />
        )}

        {/* Line AB */}
        {refA && refB && (
          <line x1={refA.x} y1={refA.y} x2={refB.x} y2={refB.y}
            stroke={`var(--ink-${ink.ab})`} strokeWidth={1.5} />
        )}

        {/* Angle arc */}
        {refA && refB && Math.abs(angle) > 0.5 && (
          <AngleArc a={refA} b={refB} angle={angle} projection={projection} intense={intense} />
        )}

        {/* Reference points A, B */}
        {refA && (
          <>
            <circle cx={refA.x} cy={refA.y} r={3.5} fill="var(--ink-black)" />
            <text x={refA.x + 6} y={refA.y - 6} fontSize={10}
              fill={`var(--ink-${ink.label})`} fontFamily="var(--font-sans)" fontWeight={ink.labelW}>A</text>
          </>
        )}
        {refB && (
          <>
            <circle cx={refB.x} cy={refB.y} r={3.5} fill="var(--ink-black)" />
            <text x={refB.x + 6} y={refB.y - 6} fontSize={10}
              fill={`var(--ink-${ink.label})`} fontFamily="var(--font-sans)" fontWeight={ink.labelW}>B</text>
          </>
        )}
      </svg>
      <div className="tooth-canvas-label">
        <span className="tooth-canvas-axis">{AXIS_LABEL[projection]}</span>
        <span className="tooth-canvas-angle">{angle.toFixed(1)}°</span>
      </div>
    </div>
  );
}

function AngleArc({
  a, b, angle, projection, intense = false,
}: {
  a: Point2D; b: Point2D; angle: number; projection: Projection; intense?: boolean;
}) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const r = 18;
  const refAngle = projection === 'xy' ? 0 : -Math.PI / 2;
  const lineAngle = Math.atan2(-(b.y - a.y), b.x - a.x); // SVG Y is flipped

  const sx = mid.x + r * Math.cos(refAngle);
  const sy = mid.y - r * Math.sin(refAngle);
  const ex = mid.x + r * Math.cos(lineAngle);
  const ey = mid.y - r * Math.sin(lineAngle);
  const largeArc = Math.abs(angle) > 180 ? 1 : 0;
  const dir = angle > 0 ? 0 : 1;

  const color = `var(--ink-${intense ? 'dark' : 'medium'})`;
  return (
    <>
      <path
        d={`M ${sx},${sy} A ${r},${r} 0 ${largeArc},${dir} ${ex},${ey}`}
        fill="none" stroke={color} strokeWidth={intense ? 1 : 0.8}
      />
      <text x={mid.x + 14} y={mid.y + 14} fontSize={9}
        fill={color} fontFamily="var(--font-sans)" fontWeight={intense ? 500 : 400}>{angle.toFixed(1)}°</text>
    </>
  );
}
