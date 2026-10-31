export function blanketHeight(x, z) {
  const chest = Math.exp(-((x - 4.7) ** 2 / 8 + (z + 5.3) ** 2 / 14)) * 1.8;
  const legs =
    (Math.exp(-((x - 3.7) ** 2) / 0.8) + Math.exp(-((x - 5.7) ** 2) / 0.8)) *
    Math.exp(-((z - 0.8) ** 2) / 18) *
    0.6;
  const edge = Math.max(0, Math.abs(x - 4.7) - 4.9) * 2.4;
  return 3.51 + chest + legs - edge + Math.sin(x * 3 + z * 1.2) * 0.12;
}

export const SOFT_MATERIALS = new Set(['cloth', 'sheet', 'sofa', 'rug', 'skin']);
