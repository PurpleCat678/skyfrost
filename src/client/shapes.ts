// Plane silhouettes in a 56x48 box, nose pointing right. Used for the
// in-game sprites and for the SVGs on the plane picker.

type Pt = { x: number; y: number };

export const SHAPES: Record<string, Pt[]> = {
  // Diamond wings, twin tails.
  f22: [
    { x: 52, y: 24 },
    { x: 30, y: 19 },
    { x: 22, y: 4 },
    { x: 14, y: 4 },
    { x: 16, y: 18 },
    { x: 4, y: 14 },
    { x: 6, y: 24 },
    { x: 4, y: 34 },
    { x: 16, y: 30 },
    { x: 14, y: 44 },
    { x: 22, y: 44 },
    { x: 30, y: 29 },
  ],
  // Longer nose, wider swept wings, and wing-root extensions.
  su57: [
    { x: 55, y: 24 },
    { x: 40, y: 21 },
    { x: 32, y: 17 },
    { x: 20, y: 2 },
    { x: 12, y: 3 },
    { x: 14, y: 17 },
    { x: 2, y: 12 },
    { x: 5, y: 21 },
    { x: 3, y: 24 },
    { x: 5, y: 27 },
    { x: 2, y: 36 },
    { x: 14, y: 31 },
    { x: 12, y: 45 },
    { x: 20, y: 46 },
    { x: 32, y: 31 },
    { x: 40, y: 27 },
  ],
};

export const COCKPITS: Record<string, { x: number; y: number }> = {
  f22: { x: 38, y: 24 },
  su57: { x: 44, y: 24 },
};

export function shapeSvg(planeId: string, color: string): string {
  const pts = SHAPES[planeId].map((p) => `${p.x},${p.y}`).join(' ');
  const c = COCKPITS[planeId];
  // Rotated so the nose points up on the picker.
  return `<svg viewBox="0 0 56 48" width="112" height="96" style="transform: rotate(-90deg)">
    <polygon points="${pts}" fill="${color}"/>
    <ellipse cx="${c.x}" cy="${c.y}" rx="5" ry="2.5" fill="#1b2a3a"/>
  </svg>`;
}
