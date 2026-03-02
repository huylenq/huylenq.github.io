import type { Point3D } from './geometry';

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ShapeParams = {
  crownRadiusX: number;
  crownRadiusZ: number;
  crownHeight: number;
  rootLength: number;
  rootTaper: number;
  slices: number;
  pointsPerSlice: number;
  jitter: number;
};

function generateTooth(params: ShapeParams, seed: number): Point3D[] {
  const rand = mulberry32(seed);
  const points: Point3D[] = [];
  const { crownRadiusX, crownRadiusZ, crownHeight, rootLength, rootTaper, slices, pointsPerSlice, jitter } = params;
  const totalHeight = crownHeight + rootLength;

  for (let i = 0; i < slices; i++) {
    const t = i / (slices - 1); // 0 = root tip, 1 = crown top
    const y = -rootLength + t * totalHeight;

    let rx: number, rz: number;
    if (t < rootLength / totalHeight) {
      // Root section: taper from narrow tip to full width at crown base
      const rootT = t / (rootLength / totalHeight);
      rx = crownRadiusX * rootTaper + (crownRadiusX - crownRadiusX * rootTaper) * rootT;
      rz = crownRadiusZ * rootTaper + (crownRadiusZ - crownRadiusZ * rootTaper) * rootT;
    } else {
      // Crown section: slight barrel shape
      const crownT = (t - rootLength / totalHeight) / (crownHeight / totalHeight);
      const barrel = 1 + 0.1 * Math.sin(crownT * Math.PI);
      rx = crownRadiusX * barrel;
      rz = crownRadiusZ * barrel;
    }

    for (let j = 0; j < pointsPerSlice; j++) {
      const angle = (j / pointsPerSlice) * Math.PI * 2;
      const jx = (rand() - 0.5) * jitter;
      const jy = (rand() - 0.5) * jitter;
      const jz = (rand() - 0.5) * jitter * 0.5;
      // Long axis along Z (root-to-crown), cross-section in X-Y plane
      points.push({
        x: Math.cos(angle) * rx + jx,
        y: Math.sin(angle) * rz + jy,
        z: y + jz,
      });
    }
  }

  return points;
}

export function incisor(seed = 42): Point3D[] {
  return generateTooth(
    {
      crownRadiusX: 4.0, // wide buccolingually
      crownRadiusZ: 1.8, // narrow mesiodistally
      crownHeight: 8,
      rootLength: 12,
      rootTaper: 0.15,
      slices: 20,
      pointsPerSlice: 14,
      jitter: 0.6,
    },
    seed
  );
}

export function premolar(seed = 137): Point3D[] {
  return generateTooth(
    {
      crownRadiusX: 3.5,
      crownRadiusZ: 3.0,
      crownHeight: 7,
      rootLength: 13,
      rootTaper: 0.12,
      slices: 20,
      pointsPerSlice: 14,
      jitter: 0.5,
    },
    seed
  );
}

export function molar(seed = 271): Point3D[] {
  return generateTooth(
    {
      crownRadiusX: 5.0,
      crownRadiusZ: 4.5,
      crownHeight: 6,
      rootLength: 10,
      rootTaper: 0.2,
      slices: 22,
      pointsPerSlice: 16,
      jitter: 0.7,
    },
    seed
  );
}

export const TOOTH_TYPES = ['Incisor', 'Premolar', 'Molar'] as const;

export function getToothPoints(typeIndex: number, seed?: number): Point3D[] {
  switch (typeIndex) {
    case 0: return incisor(seed);
    case 1: return premolar(seed);
    case 2: return molar(seed);
    default: return incisor(seed);
  }
}
