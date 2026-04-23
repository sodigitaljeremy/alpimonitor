/**
 * SVG margins reserved around the plotting area. Chosen so a 4-tick
 * y-axis with 2-digit labels fits on the left, and the x-axis has room
 * for "HH:mm" labels without clipping.
 */
export const MARGIN = { top: 16, right: 16, bottom: 28, left: 44 } as const;

/**
 * Container width below which the x-axis switches to a sparser tick
 * cadence so labels do not collide on mobile.
 */
export const NARROW_BREAKPOINT = 420;

/**
 * Tick count hints passed to d3-scale. d3 treats them as suggestions —
 * the actual tick count is a "pretty" value close to this.
 */
export const NARROW_X_TICKS = 3;
export const DESKTOP_X_TICKS = 6;

/**
 * Height-from-width policy. The chart sizes itself so its height scales
 * with the container width at this ratio, then is clamped between a
 * minimum (enough vertical room for the series) and a maximum (so the
 * chart does not eat the drawer on a very wide viewport).
 */
export const ASPECT_RATIO_WIDTH_MULTIPLIER = 0.45;
export const HEIGHT_MIN = 180;
export const HEIGHT_MAX = 280;
