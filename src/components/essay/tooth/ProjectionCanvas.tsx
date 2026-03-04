import { useRef, useState, useEffect, useCallback } from 'react';
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
  type Point3D,
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
const ANIM_DURATION = 400;

// ── Geometry helpers ─────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Compute a toSvg mapping from a set of 2D points (unified bounding box). */
function makeToSvg(allPoints: Point2D[]): (p: Point2D) => Point2D {
  if (allPoints.length === 0) return (p) => p;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const scale = VIEW / (Math.max(maxX - minX, maxY - minY) || 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return (p: Point2D) => ({
    x: MARGIN + VIEW / 2 + (p.x - cx) * scale,
    y: MARGIN + VIEW / 2 - (p.y - cy) * scale,
  });
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

// Correction step definitions for sequential application
const CORRECTION_STEPS: {
  project: (pts: Point3D[]) => Point2D[];
  rotate: (pts: Point3D[], deg: number) => Point3D[];
  axis: 'z' | 'x' | 'y';
}[] = [
  { project: projectToXY, rotate: rotateAroundZ, axis: 'z' },
  { project: projectToXY, rotate: rotateAroundZ, axis: 'z' },
  { project: projectToYZ, rotate: rotateAroundX, axis: 'x' },
  { project: projectToXZ, rotate: rotateAroundY, axis: 'y' },
];

/**
 * Apply corrections to 3D points. Supports fractional step count for animation.
 * e.g. n=2.5 means steps 1,2 fully applied, step 3 at 50% of its correction angle.
 */
function applyCorrections(pts: Point3D[], n: number, method: number): Point3D[] {
  let result = pts;
  for (let i = 0; i < CORRECTION_STEPS.length && i < n; i++) {
    const { project, rotate, axis } = CORRECTION_STEPS[i];
    const hull = convexHull(project(result));
    const { a, b } = refPointsForMethod(method, hull, centroid(hull));
    const fullAngle = correctionAngle(a, b, axis);
    const frac = Math.min(n - i, 1);
    result = rotate(result, fullAngle * frac);
  }
  return result;
}

/** Compute raw (unscaled) layer data for a set of 3D points on a projection. */
function computeRawLayer(pts3D: Point3D[], projection: Projection, method: number) {
  const projected = PROJECT_FN[projection](pts3D);
  const hullPts = convexHull(projected);
  const ref = refPointsForMethod(method, hullPts, centroid(hullPts));
  const angle = correctionAngle(ref.a, ref.b, CORRECTION_AXIS[projection]);
  return { projected, hullPts, refA: ref.a, refB: ref.b, angle, rect: ref.rect };
}

// ── Data types ───────────────────────────────────────

type LayerData = {
  scaledPoints: Point2D[];
  hull: Point2D[];
  refA: Point2D | null;
  refB: Point2D | null;
  angle: number;
  rect: Point2D[] | null;
};

type CanvasData = LayerData & {
  ghost: LayerData | null;
};

const EMPTY_LAYER: LayerData = { scaledPoints: [], hull: [], refA: null, refB: null, angle: 0, rect: null };

// ── Component ────────────────────────────────────────

export function ProjectionCanvas({
  projection,
  intense = false,
  step: stepOverride,
  ghostStep,
  showRef = true,
  ghostOnly = false,
}: {
  projection: Projection;
  intense?: boolean;
  step?: number;
  ghostStep?: number;
  showRef?: boolean;
  ghostOnly?: boolean;
}) {
  const state = useEssayState();
  const isHydrated = Object.keys(state).length > 0;

  const toothType = state.toothType ?? 0;
  const toothPtsRef = useRef<{ type: number; pts: ReturnType<typeof getToothPoints> } | null>(null);
  if (!toothPtsRef.current || toothPtsRef.current.type !== toothType) {
    toothPtsRef.current = { type: toothType, pts: getToothPoints(toothType) };
  }

  const { tiltZ = 0, tiltX = 0, tiltY = 0, method = 0 } = state;
  const step = stepOverride ?? state.step ?? 0;

  // Compute tilted base points (shared by all layers)
  const basePts = useRef<Point3D[]>([]);
  const basePtsKey = `${toothType}-${tiltZ}-${tiltX}-${tiltY}`;
  const prevBasePtsKey = useRef('');
  if (prevBasePtsKey.current !== basePtsKey) {
    prevBasePtsKey.current = basePtsKey;
    let pts = toothPtsRef.current!.pts;
    pts = rotateAroundZ(pts, tiltZ);
    pts = rotateAroundX(pts, tiltX);
    pts = rotateAroundY(pts, tiltY);
    basePts.current = pts;
  }

  /** Compute full CanvasData from a (possibly fractional) main step. */
  const computeCanvas = useCallback((mainStep: number): CanvasData => {
    if (!isHydrated) return { ...EMPTY_LAYER, ghost: null };

    const pts = basePts.current;

    // Main layer
    const mainPts3D = applyCorrections(pts, mainStep, method);
    const mainRaw = computeRawLayer(mainPts3D, projection, method);

    // Ghost layer (always integer, no animation)
    let ghostRaw = null;
    if (ghostStep !== undefined) {
      const ghostPts3D = applyCorrections(pts, ghostStep, method);
      ghostRaw = computeRawLayer(ghostPts3D, projection, method);
    }

    // Unified scale: always include ghost + full correction to prevent
    // scale jumps when toggling between active/ghostOnly modes
    let allProjected = [...mainRaw.projected];
    if (ghostRaw) allProjected.push(...ghostRaw.projected);
    if (ghostStep !== undefined) {
      const fullCorrPts3D = applyCorrections(pts, ghostStep + 1, method);
      const fullCorrProjected = PROJECT_FN[projection](fullCorrPts3D);
      allProjected.push(...fullCorrProjected);
    }
    const toSvg = makeToSvg(allProjected);

    // Main A-B: rotate ghost's A-B by the partial correction applied so far,
    // so A-B moves rigidly with the point cloud during animation.
    const mainHull = convexHull(mainRaw.projected);
    let mainRefA: Point2D | null = null;
    let mainRefB: Point2D | null = null;
    let mainAngle = mainRaw.angle;
    let mainRect = mainRaw.rect ? mainRaw.rect.map(toSvg) : null;
    if (ghostRaw) {
      const frac = Math.min(mainStep - (ghostStep ?? 0), 1);
      const appliedDeg = ghostRaw.angle * frac;
      // Sign of 2D rotation matches the 3D rotation matrix projected:
      //   Z-axis (XY): rotateAroundZ rotates (x,y) → standard 2D rotation
      //   X-axis (YZ): rotateAroundX rotates (y,z) → projected (y,z) standard
      //   Y-axis (XZ): rotateAroundY has x'=xc+zs, z'=-xs+zc → projected (x,z) flipped sign
      // Rotate around the origin (0,0) in projection space — same pivot as the 3D rotation.
      const sign = projection === 'xz' ? -1 : 1;
      const appliedRad = sign * (appliedDeg * Math.PI) / 180;
      const rotPt = (p: Point2D): Point2D => {
        const c = Math.cos(appliedRad);
        const s = Math.sin(appliedRad);
        return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
      };
      mainRefA = toSvg(rotPt(ghostRaw.refA));
      mainRefB = toSvg(rotPt(ghostRaw.refB));
      mainAngle = ghostRaw.angle * frac;
      mainRect = ghostRaw.rect ? ghostRaw.rect.map(p => toSvg(rotPt(p))) : null;
    } else {
      mainRefA = toSvg(mainRaw.refA);
      mainRefB = toSvg(mainRaw.refB);
    }
    const main: LayerData = {
      scaledPoints: mainRaw.projected.map(toSvg),
      hull: mainHull.map(toSvg),
      refA: mainRefA,
      refB: mainRefB,
      angle: mainAngle,
      rect: mainRect,
    };

    // Scale ghost
    let ghost: LayerData | null = null;
    if (ghostRaw) {
      const ghostHull = convexHull(ghostRaw.projected);
      ghost = {
        scaledPoints: ghostRaw.projected.map(toSvg),
        hull: ghostHull.map(toSvg),
        refA: toSvg(ghostRaw.refA),
        refB: toSvg(ghostRaw.refB),
        angle: ghostRaw.angle,
        rect: ghostRaw.rect ? ghostRaw.rect.map(toSvg) : null,
      };
    }

    return { ...main, ghost };
  }, [isHydrated, method, ghostStep, projection, basePtsKey]);

  // ── Animate via fractional step ──
  const [display, setDisplay] = useState<CanvasData>(() => computeCanvas(step));
  const prevStepRef = useRef(step);
  const animRef = useRef<number>(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevStepRef.current = step;
      setDisplay(computeCanvas(step));
      return;
    }

    const fromStep = prevStepRef.current;
    const toStep = step;
    prevStepRef.current = toStep;

    // Non-animated: snap when step doesn't change (other params changed)
    if (fromStep === toStep) {
      setDisplay(computeCanvas(toStep));
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = easeOutCubic(Math.min((now - start) / ANIM_DURATION, 1));
      const fractionalStep = fromStep + (toStep - fromStep) * t;
      setDisplay(computeCanvas(fractionalStep));
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    };

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [step, computeCanvas]);

  // Snap on non-step param changes
  useEffect(() => {
    setDisplay(computeCanvas(step));
  }, [basePtsKey, method, ghostStep, projection]);

  if (!isHydrated) {
    return <div className="tooth-canvas" style={{ width: SVG_SIZE, height: SVG_SIZE + 28 }} />;
  }

  const { scaledPoints, hull, refA, refB, angle, rect, ghost } = display;

  const hullPath = hull.length > 0
    ? `M ${hull.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
    : '';

  const rectPath = rect
    ? `M ${rect.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
    : '';

  const ghostHullPath = ghost && ghost.hull.length > 0
    ? `M ${ghost.hull.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
    : '';

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

        {/* ── Ghost layer (before correction) ── */}
        {ghost && (
          <g opacity={0.7}>
            {ghost.scaledPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={1} fill="var(--ink-faint)" />
            ))}
            {ghostHullPath && (
              <path d={ghostHullPath} fill="none" stroke="var(--ink-faint)" strokeWidth={0.8} />
            )}
            {ghost.rect && (
              <path d={`M ${ghost.rect.map((p) => `${p.x},${p.y}`).join(' L ')} Z`}
                fill="none" stroke="var(--ink-faint)" strokeWidth={0.6} strokeDasharray="3 3" />
            )}
            {ghost.refA && ghost.refB && (
              <line x1={ghost.refA.x} y1={ghost.refA.y} x2={ghost.refB.x} y2={ghost.refB.y}
                stroke="var(--ink-light)" strokeWidth={1} strokeDasharray="3 2" />
            )}
          </g>
        )}

        {/* ── Ghost ref overlay (when ghostOnly, promote A-B/arc/labels from ghost) ── */}
        {ghostOnly && ghost && ghost.refA && ghost.refB && (
          <>
            <line x1={ghost.refA.x} y1={ghost.refA.y} x2={ghost.refB.x} y2={ghost.refB.y}
              stroke={`var(--ink-${ink.ab})`} strokeWidth={1.5} />
            <circle cx={ghost.refA.x} cy={ghost.refA.y} r={3.5} fill="var(--ink-black)" />
            <text x={ghost.refA.x + 6} y={ghost.refA.y - 6} fontSize={10}
              fill={`var(--ink-${ink.label})`} fontFamily="var(--font-sans)" fontWeight={ink.labelW}>A</text>
            <circle cx={ghost.refB.x} cy={ghost.refB.y} r={3.5} fill="var(--ink-black)" />
            <text x={ghost.refB.x + 6} y={ghost.refB.y - 6} fontSize={10}
              fill={`var(--ink-${ink.label})`} fontFamily="var(--font-sans)" fontWeight={ink.labelW}>B</text>
          </>
        )}

        {/* ── Main layer (after correction) ── */}
        {!ghostOnly && <>
        {scaledPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.2} fill={`var(--ink-${ink.dots})`} />
        ))}
        {hullPath && (
          <path d={hullPath} fill="none" stroke={`var(--ink-${ink.hull})`} strokeWidth={ink.hullW} />
        )}
        {rectPath && (
          <path d={rectPath} fill="none" stroke={`var(--ink-${ink.rect})`} strokeWidth={ink.rectW} strokeDasharray="3 3" />
        )}
        {showRef && refA && refB && (
          <line x1={refA.x} y1={refA.y} x2={refB.x} y2={refB.y}
            stroke={`var(--ink-${ink.ab})`} strokeWidth={1.5} />
        )}
        {showRef && refA && refB && Math.abs(angle) > 0.5 && (
          <AngleArc a={refA} b={refB} angle={angle} projection={projection} intense={intense} />
        )}
        {showRef && refA && (
          <>
            <circle cx={refA.x} cy={refA.y} r={3.5} fill="var(--ink-black)" />
            <text x={refA.x + 6} y={refA.y - 6} fontSize={10}
              fill={`var(--ink-${ink.label})`} fontFamily="var(--font-sans)" fontWeight={ink.labelW}>A</text>
          </>
        )}
        {showRef && refB && (
          <>
            <circle cx={refB.x} cy={refB.y} r={3.5} fill="var(--ink-black)" />
            <text x={refB.x + 6} y={refB.y - 6} fontSize={10}
              fill={`var(--ink-${ink.label})`} fontFamily="var(--font-sans)" fontWeight={ink.labelW}>B</text>
          </>
        )}
        </>}
      </svg>
      <div className="tooth-canvas-label" style={showRef ? undefined : { visibility: 'hidden' }}>
        <span className="tooth-canvas-axis">{AXIS_LABEL[projection]}</span>
        <span className="tooth-canvas-angle">{(ghostOnly ? 0 : angle).toFixed(1)}°</span>
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
