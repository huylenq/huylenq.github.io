import { useMemo } from 'react';
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

// Which axis each projection's correction angle aligns to
const AXIS_LABEL: Record<Projection, string> = {
  xy: 'Z-axis',
  yz: 'X-axis',
  xz: 'Y-axis',
};

const METHOD_NAMES = ['Farthest hull', 'Restricted edge', 'Bounding rect'];

const SVG_SIZE = 200;
const MARGIN = 20;
const VIEW = SVG_SIZE - 2 * MARGIN;

function scalePoints(pts: Point2D[]): { scaled: Point2D[]; scale: number; cx: number; cy: number } {
  if (pts.length === 0) return { scaled: [], scale: 1, cx: SVG_SIZE / 2, cy: SVG_SIZE / 2 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = VIEW / Math.max(rangeX, rangeY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scaled = pts.map((p) => ({
    x: MARGIN + VIEW / 2 + (p.x - cx) * scale,
    y: MARGIN + VIEW / 2 - (p.y - cy) * scale, // flip Y for SVG
  }));
  return { scaled, scale, cx, cy };
}

export function ProjectionCanvas({
  projection,
  dimmed = false,
}: {
  projection: Projection;
  dimmed?: boolean;
}) {
  const state = useEssayState();
  const isHydrated = Object.keys(state).length > 0;

  const { scaledPoints, hull, refA, refB, angle, rect, methodName } = useMemo(() => {
    if (!isHydrated) return { scaledPoints: [], hull: [], refA: null, refB: null, angle: 0, rect: null, methodName: '' };

    const tiltZ = state.tiltZ ?? 0;
    const tiltX = state.tiltX ?? 0;
    const tiltY = state.tiltY ?? 0;
    const step = state.step ?? 0;
    const method = state.method ?? 0;
    const toothType = state.toothType ?? 0;

    let pts = getToothPoints(toothType);

    // Apply the tilts
    pts = rotateAroundZ(pts, tiltZ);
    pts = rotateAroundX(pts, tiltX);
    pts = rotateAroundY(pts, tiltY);

    // Apply corrections up to current step
    if (step >= 1) {
      const xy = projectToXY(pts);
      const hullXY = convexHull(xy);
      const cXY = centroid(hullXY);
      const { a, b } = getRefPoints(method, hullXY, cXY);
      const angleZ = correctionAngle(a, b, 'z');
      pts = rotateAroundZ(pts, angleZ);
    }
    if (step >= 2) {
      const yz = projectToYZ(pts);
      const hullYZ = convexHull(yz);
      const cYZ = centroid(hullYZ);
      const { a, b } = getRefPoints(method, hullYZ, cYZ);
      const angleX = correctionAngle(a, b, 'x');
      pts = rotateAroundX(pts, angleX);
    }
    if (step >= 3) {
      const xz = projectToXZ(pts);
      const hullXZ = convexHull(xz);
      const cXZ = centroid(hullXZ);
      const { a, b } = getRefPoints(method, hullXZ, cXZ);
      const angleY = correctionAngle(a, b, 'y');
      pts = rotateAroundY(pts, angleY);
    }

    // Project for this canvas's plane
    const projected = PROJECT_FN[projection](pts);
    const hullPts = convexHull(projected);
    const center = centroid(hullPts);
    const ref = getRefPointsWithRect(method, hullPts, center);
    const axisMap = { xy: 'z', yz: 'x', xz: 'y' } as const;
    const ang = correctionAngle(ref.a, ref.b, axisMap[projection]);

    const { scaled: scaledProjected } = scalePoints(projected);
    const { scaled: scaledHull } = scalePoints(hullPts);

    // Scale ref points using same transform
    const allForScale = [...projected];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of allForScale) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = VIEW / Math.max(rangeX, rangeY);
    const cxAll = (minX + maxX) / 2;
    const cyAll = (minY + maxY) / 2;
    const toSvg = (p: Point2D) => ({
      x: MARGIN + VIEW / 2 + (p.x - cxAll) * scale,
      y: MARGIN + VIEW / 2 - (p.y - cyAll) * scale,
    });

    const sA = toSvg(ref.a);
    const sB = toSvg(ref.b);
    const sRect = ref.rect ? ref.rect.map(toSvg) : null;

    return {
      scaledPoints: scaledProjected,
      hull: scaledHull,
      refA: sA,
      refB: sB,
      angle: ang,
      rect: sRect,
      methodName: METHOD_NAMES[method] ?? '',
    };
  }, [isHydrated, state, projection]);

  if (!isHydrated) {
    return <div className="tooth-canvas" style={{ width: SVG_SIZE, height: SVG_SIZE + 28 }} />;
  }

  const hullPath = hull.length > 0
    ? `M ${hull.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
    : '';

  const rectPath = rect
    ? `M ${rect.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
    : '';

  return (
    <div className="tooth-canvas" style={{ opacity: dimmed ? 0.35 : 1, transition: 'opacity 0.3s' }}>
      <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} width={SVG_SIZE} height={SVG_SIZE}>
        {/* Axis crosshairs */}
        <line x1={MARGIN} y1={SVG_SIZE / 2} x2={SVG_SIZE - MARGIN} y2={SVG_SIZE / 2}
          stroke="var(--ink-light)" strokeWidth={0.5} strokeDasharray="4 4" />
        <line x1={SVG_SIZE / 2} y1={MARGIN} x2={SVG_SIZE / 2} y2={SVG_SIZE - MARGIN}
          stroke="var(--ink-light)" strokeWidth={0.5} strokeDasharray="4 4" />

        {/* Point cloud */}
        {scaledPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.2} fill="var(--ink-medium)" />
        ))}

        {/* Convex hull */}
        {hullPath && (
          <path d={hullPath} fill="none" stroke="var(--ink-dark)" strokeWidth={1.2} />
        )}

        {/* Bounding rectangle overlay */}
        {rectPath && (
          <path d={rectPath} fill="none" stroke="var(--ink-medium)" strokeWidth={1} strokeDasharray="3 3" />
        )}

        {/* Line AB */}
        {refA && refB && (
          <line x1={refA.x} y1={refA.y} x2={refB.x} y2={refB.y}
            stroke="var(--ink-black)" strokeWidth={1.5} />
        )}

        {/* Angle arc */}
        {refA && refB && Math.abs(angle) > 0.5 && (
          <AngleArc a={refA} b={refB} angle={angle} projection={projection} />
        )}

        {/* Reference points A, B */}
        {refA && (
          <>
            <circle cx={refA.x} cy={refA.y} r={3.5} fill="var(--ink-black)" />
            <text x={refA.x + 6} y={refA.y - 6} fontSize={10} fill="var(--ink-black)"
              fontFamily="var(--font-sans)" fontWeight={600}>A</text>
          </>
        )}
        {refB && (
          <>
            <circle cx={refB.x} cy={refB.y} r={3.5} fill="var(--ink-black)" />
            <text x={refB.x + 6} y={refB.y - 6} fontSize={10} fill="var(--ink-dark)"
              fontFamily="var(--font-sans)">B</text>
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

function AngleArc({ a, b, angle, projection }: { a: Point2D; b: Point2D; angle: number; projection: Projection }) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const r = 18;

  // Reference direction: horizontal for xy, vertical for yz/xz
  const refAngle = projection === 'xy' ? 0 : -Math.PI / 2;
  const lineAngle = Math.atan2(-(b.y - a.y), b.x - a.x); // SVG Y is flipped

  const startAngle = refAngle;
  const endAngle = lineAngle;

  const sx = mid.x + r * Math.cos(startAngle);
  const sy = mid.y - r * Math.sin(startAngle);
  const ex = mid.x + r * Math.cos(endAngle);
  const ey = mid.y - r * Math.sin(endAngle);

  const sweep = Math.abs(angle) <= 180 ? 0 : 1;
  const largeArc = Math.abs(angle) > 180 ? 1 : 0;
  const dir = angle > 0 ? 0 : 1;

  return (
    <>
      <path
        d={`M ${sx},${sy} A ${r},${r} 0 ${largeArc},${dir} ${ex},${ey}`}
        fill="none" stroke="var(--ink-medium)" strokeWidth={0.8}
      />
      <text x={mid.x + 14} y={mid.y + 14} fontSize={9} fill="var(--ink-medium)"
        fontFamily="var(--font-sans)">{angle.toFixed(1)}°</text>
    </>
  );
}

function getRefPoints(method: number, hull: Point2D[], center: Point2D) {
  switch (method) {
    case 1: return restrictedEdgeHullPoints(hull, center);
    case 2: {
      const { a, b } = minBoundingRectPoints(hull);
      return { a, b };
    }
    default: return farthestHullPoints(hull, center);
  }
}

function getRefPointsWithRect(method: number, hull: Point2D[], center: Point2D) {
  switch (method) {
    case 1: return { ...restrictedEdgeHullPoints(hull, center), rect: null as Point2D[] | null };
    case 2: {
      const result = minBoundingRectPoints(hull);
      return { a: result.a, b: result.b, rect: result.rect };
    }
    default: return { ...farthestHullPoints(hull, center), rect: null as Point2D[] | null };
  }
}
