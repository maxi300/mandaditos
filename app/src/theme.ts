/** Sistema de diseño de Mandadito (mismo que el lienzo de pantallas). */
export const color = {
  brand: '#C2410C',
  brandDark: '#9A3412',
  brandTint: '#FFF1E8',
  ink: '#1C1917',
  ink2: '#44403C',
  muted: '#6F6862',
  faint: '#A8A29E',
  border: '#E7E2DC',
  line: '#F2EFEB',
  bg: '#F7F5F2',
  surface: '#FFFFFF',
  success: '#15803D',
  successTint: '#DCFCE7',
  info: '#1D4ED8',
  infoTint: '#EEF4FF',
  warn: '#B45309',
  warnTint: '#FFF7E6',
  danger: '#B91C1C',
  dangerTint: '#FEF2F2',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 } as const;

export const font = {
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.6, color: color.ink },
  h2: { fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.3, color: color.ink },
  title: { fontSize: 16, fontWeight: '700' as const, color: color.ink },
  body: { fontSize: 15, fontWeight: '500' as const, color: color.ink2 },
  small: { fontSize: 13, fontWeight: '500' as const, color: color.muted },
  tiny: { fontSize: 12, fontWeight: '600' as const, color: color.muted },
};

/** Tamaño mínimo táctil recomendado. */
export const TOUCH = 44;
