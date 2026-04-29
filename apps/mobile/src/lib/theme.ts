import type { MarkerColor } from '@map-app/shared';

export const COLORS = {
  brand: '#ed7332',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  bg: '#f3f4f6',
  card: '#ffffff',
  danger: '#dc2626',
} as const;

export const MARKER_COLOR_HEX: Record<MarkerColor, string> = {
  blue: '#2563eb',
  orange: '#f97316',
  yellow: '#eab308',
  red: '#dc2626',
};

export const MARKER_COLOR_LABEL: Record<MarkerColor, string> = {
  blue: 'Needs scheduled',
  orange: 'Mixed',
  yellow: 'In progress',
  red: 'Complete',
};
