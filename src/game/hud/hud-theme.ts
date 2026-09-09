import { StyleSheet } from 'react-native';

/** Shared HUD palette, in the darker Warcraft-console register. */
export const HudColors = {
  panel: 'rgba(12,14,18,0.86)',
  panelSolid: '#12151a',
  border: '#2b3038',
  borderStrong: '#3d454f',
  text: '#e6eaee',
  textDim: '#8f97a1',
  textFaint: '#69707a',
  gold: '#f0c674',
  wood: '#9fd07a',
  pakkun: '#8fb8e8',
  danger: '#e8623c',
  good: '#5fd08a',
  accent: '#e8623c',
} as const;

export const GRADE_COLORS: Record<string, string> = {
  normal: '#c9d1d9',
  magic: '#4aa3ff',
  rare: '#9d5cff',
  unique: '#ff5cf0',
  legend: '#ff3b3b',
  hidden: '#22e0e0',
  jinchuriki: '#ffd23b',
  bijuu: '#ffe27a',
  elite: '#7bffb0',
  limit: '#ff8a3b',
  epic: '#3bff7a',
  infinity: '#ff7ac2',
  creation: '#ffffff',
  special: '#ffe27a',
  ruin: '#8a2be2',
};

export const hudStyles = StyleSheet.create({
  panel: {
    backgroundColor: HudColors.panel,
    borderWidth: 1,
    borderColor: HudColors.border,
    borderRadius: 8,
  },
  label: { color: HudColors.textFaint, fontSize: 10, letterSpacing: 1 },
  value: { color: HudColors.text, fontSize: 14, fontWeight: '700' },
});
