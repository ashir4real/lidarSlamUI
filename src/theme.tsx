import { createContext, useContext } from 'react';

export type ThemeId = 'cyber' | 'crimson' | 'amber' | 'ocean' | 'mono';

export const THEMES: { id: ThemeId; name: string; swatch: string }[] = [
  { id: 'cyber',   name: 'Cyber',   swatch: 'rgb(45,212,191)' },
  { id: 'crimson', name: 'Crimson', swatch: 'rgb(248,113,113)' },
  { id: 'amber',   name: 'Amber',   swatch: 'rgb(251,191,36)' },
  { id: 'ocean',   name: 'Ocean',   swatch: 'rgb(96,165,250)' },
  { id: 'mono',    name: 'Mono',    swatch: 'rgb(229,231,235)' },
];

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  cyan: string;
  blue: string;
  purple: string;
  amber: string;
  red: string;
  emerald: string;
}

const FALLBACK: ThemeColors = {
  bgPrimary: '10 14 26',
  bgSecondary: '17 24 39',
  bgTertiary: '26 34 52',
  cyan: '45 212 191',
  blue: '59 130 246',
  purple: '139 92 246',
  amber: '245 158 11',
  red: '239 68 68',
  emerald: '16 185 129',
};

/** Read the current CSS variables → usable "R G B" strings. Safe on server. */
export function getThemeColors(): ThemeColors {
  if (typeof window === 'undefined') return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const g = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
  return {
    bgPrimary: g('--bg-primary', FALLBACK.bgPrimary),
    bgSecondary: g('--bg-secondary', FALLBACK.bgSecondary),
    bgTertiary: g('--bg-tertiary', FALLBACK.bgTertiary),
    cyan: g('--neon-cyan', FALLBACK.cyan),
    blue: g('--neon-blue', FALLBACK.blue),
    purple: g('--neon-purple', FALLBACK.purple),
    amber: g('--neon-amber', FALLBACK.amber),
    red: g('--neon-red', FALLBACK.red),
    emerald: g('--neon-emerald', FALLBACK.emerald),
  };
}

export const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}>({ theme: 'cyber', setTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);