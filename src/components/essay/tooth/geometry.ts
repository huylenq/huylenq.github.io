export type Point2D = { x: number; y: number };
export type Point3D = { x: number; y: number; z: number };

// Andrew's monotone chain — O(n log n)
export function convexHull(points: Point2D[]): Point2D[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 1) return pts;

  const cross = (o: Point2D, a: Point2D, b: Point2D) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point2D[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }

  const upper: Point2D[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0)
      upper.pop();
    upper.push(pts[i]);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Projections — drop one axis
export function projectToXY(pts: Point3D[]): Point2D[] {
  return pts.map((p) => ({ x: p.x, y: p.y }));
}
export function projectToYZ(pts: Point3D[]): Point2D[] {
  return pts.map((p) => ({ x: p.y, y: p.z }));
}
export function projectToXZ(pts: Point3D[]): Point2D[] {
  return pts.map((p) => ({ x: p.x, y: p.z }));
}

// Rotations — standard matrices, angle in degrees
const rad = (deg: number) => (deg * Math.PI) / 180;

export function rotateAroundZ(pts: Point3D[], angleDeg: number): Point3D[] {
  const c = Math.cos(rad(angleDeg));
  const s = Math.sin(rad(angleDeg));
  return pts.map((p) => ({
    x: p.x * c - p.y * s,
    y: p.x * s + p.y * c,
    z: p.z,
  }));
}

export function rotateAroundX(pts: Point3D[], angleDeg: number): Point3D[] {
  const c = Math.cos(rad(angleDeg));
  const s = Math.sin(rad(angleDeg));
  return pts.map((p) => ({
    x: p.x,
    y: p.y * c - p.z * s,
    z: p.y * s + p.z * c,
  }));
}

export function rotateAroundY(pts: Point3D[], angleDeg: number): Point3D[] {
  const c = Math.cos(rad(angleDeg));
  const s = Math.sin(rad(angleDeg));
  return pts.map((p) => ({
    x: p.x * c + p.z * s,
    y: p.y,
    z: -p.x * s + p.z * c,
  }));
}

export function centroid(pts: Point2D[]): Point2D {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Classify hull points into quadrants relative to center, pick farthest in each
function quadrantFarthest(hull: Point2D[], center: Point2D): Point2D[] {
  const buckets: (Point2D | null)[] = [null, null, null, null];
  const dists = [0, 0, 0, 0];

  for (const p of hull) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const q = dx >= 0 ? (dy >= 0 ? 0 : 3) : dy >= 0 ? 1 : 2;
    const d = dist(p, center);
    if (d > dists[q]) {
      dists[q] = d;
      buckets[q] = p;
    }
  }
  return buckets.filter((p): p is Point2D => p !== null);
}

// Method 1: farthest hull points — pick two from opposing quadrants
export function farthestHullPoints(
  hull: Point2D[],
  center: Point2D
): { a: Point2D; b: Point2D } {
  const far = quadrantFarthest(hull, center);
  if (far.length < 2) return { a: hull[0], b: hull[hull.length - 1] };

  let maxDist = 0;
  let best = { a: far[0], b: far[1] };
  for (let i = 0; i < far.length; i++) {
    for (let j = i + 1; j < far.length; j++) {
      const d = dist(far[i], far[j]);
      if (d > maxDist) {
        maxDist = d;
        best = { a: far[i], b: far[j] };
      }
    }
  }
  return best;
}

// Method 2: restricted edge hull points — dual-axis thresholds, axis-aligned selection
export function restrictedEdgeHullPoints(
  hull: Point2D[],
  center: Point2D
): { a: Point2D; b: Point2D } {
  // Per-quadrant max extent along each axis (D_X, D_Y)
  const maxDx = [0, 0, 0, 0];
  const maxDy = [0, 0, 0, 0];
  for (const p of hull) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const q = dx >= 0 ? (dy >= 0 ? 0 : 3) : dy >= 0 ? 1 : 2;
    maxDx[q] = Math.max(maxDx[q], Math.abs(dx));
    maxDy[q] = Math.max(maxDy[q], Math.abs(dy));
  }

  // Filter by BOTH |dx| > 0.5*D_X AND |dy| > 0.5*D_Y,
  // then per-quadrant pick most axis-aligned (smallest min(|dx|,|dy|))
  const picks: (Point2D | null)[] = [null, null, null, null];
  const pickScores = [Infinity, Infinity, Infinity, Infinity];

  for (const p of hull) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const q = dx >= 0 ? (dy >= 0 ? 0 : 3) : dy >= 0 ? 1 : 2;

    if (Math.abs(dx) <= 0.5 * maxDx[q] || Math.abs(dy) <= 0.5 * maxDy[q]) continue;

    const score = Math.min(Math.abs(dx), Math.abs(dy));
    if (score < pickScores[q]) {
      pickScores[q] = score;
      picks[q] = p;
    }
  }

  const candidates = picks.filter((p): p is Point2D => p !== null);
  if (candidates.length < 2) return farthestHullPoints(hull, center);

  let maxD = 0;
  let best = { a: candidates[0], b: candidates[1] };
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const d = dist(candidates[i], candidates[j]);
      if (d > maxD) {
        maxD = d;
        best = { a: candidates[i], b: candidates[j] };
      }
    }
  }
  return best;
}

// Method 3: minimum bounding rectangle orientation
export function minBoundingRectPoints(
  hull: Point2D[]
): { a: Point2D; b: Point2D; rect: Point2D[] } {
  let minArea = Infinity;
  let bestAngle = 0;

  // Rotating calipers: test edge orientations
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const angle = Math.atan2(hull[j].y - hull[i].y, hull[j].x - hull[i].x);
    const c = Math.cos(-angle);
    const s = Math.sin(-angle);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of hull) {
      const rx = p.x * c - p.y * s;
      const ry = p.x * s + p.y * c;
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx);
      minY = Math.min(minY, ry);
      maxY = Math.max(maxY, ry);
    }

    const area = (maxX - minX) * (maxY - minY);
    if (area < minArea) {
      minArea = area;
      bestAngle = angle;
    }
  }

  // Build the rectangle at bestAngle
  const c = Math.cos(-bestAngle);
  const s = Math.sin(-bestAngle);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of hull) {
    const rx = p.x * c - p.y * s;
    const ry = p.x * s + p.y * c;
    minX = Math.min(minX, rx);
    maxX = Math.max(maxX, rx);
    minY = Math.min(minY, ry);
    maxY = Math.max(maxY, ry);
  }

  const rc = Math.cos(bestAngle);
  const rs = Math.sin(bestAngle);
  const unrot = (rx: number, ry: number): Point2D => ({
    x: rx * rc - ry * rs,
    y: rx * rs + ry * rc,
  });

  const rect = [
    unrot(minX, minY),
    unrot(maxX, minY),
    unrot(maxX, maxY),
    unrot(minX, maxY),
  ];

  // A,B are midpoints of the SHORT edges (which point along the long axis direction)
  const d1 = dist(rect[0], rect[1]);
  const d2 = dist(rect[1], rect[2]);

  let a: Point2D, b: Point2D;
  if (d1 >= d2) {
    // d1 is the long edge → short edges are 1-2 and 3-0
    a = { x: (rect[1].x + rect[2].x) / 2, y: (rect[1].y + rect[2].y) / 2 };
    b = { x: (rect[3].x + rect[0].x) / 2, y: (rect[3].y + rect[0].y) / 2 };
  } else {
    // d2 is the long edge → short edges are 0-1 and 2-3
    a = { x: (rect[0].x + rect[1].x) / 2, y: (rect[0].y + rect[1].y) / 2 };
    b = { x: (rect[2].x + rect[3].x) / 2, y: (rect[2].y + rect[3].y) / 2 };
  }

  return { a, b, rect };
}

// Returns the rotation (in degrees) to apply around the given axis to correct alignment.
// Each axis has a specific sign convention matching its rotation matrix:
//   'z' — align AB with horizontal in XY projection
//   'x' — align AB with vertical in YZ projection (sign-flipped due to rotation matrix)
//   'y' — align AB with vertical in XZ projection
export function correctionAngle(a: Point2D, b: Point2D, axis: 'z' | 'x' | 'y'): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let angle: number;
  if (axis === 'z') {
    angle = -(Math.atan2(dy, dx) * 180) / Math.PI;
  } else if (axis === 'x') {
    angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  } else {
    angle = -(Math.atan2(dx, dy) * 180) / Math.PI;
  }
  // Normalize to [-90, 90]: AB direction is arbitrary, we want minimum rotation
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}
