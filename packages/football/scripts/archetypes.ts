/** Stat archetypes per position: multipliers applied to the overall rating. Shared by dataset generators. */
export const OUTFIELD_KEYS = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as const;
export const GK_KEYS = ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'] as const;

export const WEIGHTS: Record<string, number[]> = {
  ST: [0.96, 1.04, 0.82, 0.96, 0.42, 0.92],
  LW: [1.06, 0.92, 0.9, 1.04, 0.42, 0.78],
  RW: [1.06, 0.92, 0.9, 1.04, 0.42, 0.78],
  CAM: [0.9, 0.93, 1.02, 1.03, 0.55, 0.78],
  CM: [0.86, 0.85, 1.0, 0.96, 0.86, 0.9],
  CDM: [0.8, 0.74, 0.92, 0.86, 1.01, 0.98],
  LM: [1.02, 0.86, 0.95, 1.0, 0.6, 0.8],
  RM: [1.02, 0.86, 0.95, 1.0, 0.6, 0.8],
  CB: [0.8, 0.52, 0.74, 0.72, 1.04, 1.01],
  LB: [1.0, 0.64, 0.86, 0.88, 0.94, 0.86],
  RB: [1.0, 0.64, 0.86, 0.88, 0.94, 0.86],
};
export const GK_WEIGHTS = [1.0, 0.98, 0.84, 1.02, 0.58, 0.99];
