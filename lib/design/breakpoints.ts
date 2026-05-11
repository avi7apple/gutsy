/**
 * Shared breakpoint definitions so components can make consistent layout decisions.
 * Values align with the physical device widths in points/pixels we design against.
 */
export const BREAKPOINTS = {
  small: 375,
  medium: 390,
  large: 430,
  tablet: 768, // placeholder for future tablet optimizations
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

type BreakpointRange = {
  name: BreakpointName;
  min: number;
  max: number;
};

export const BREAKPOINT_RANGES: BreakpointRange[] = [
  { name: "small", min: 0, max: BREAKPOINTS.small },
  { name: "medium", min: BREAKPOINTS.small + 1, max: BREAKPOINTS.medium },
  { name: "large", min: BREAKPOINTS.medium + 1, max: BREAKPOINTS.large },
  { name: "tablet", min: BREAKPOINTS.large + 1, max: Number.POSITIVE_INFINITY },
];

/**
 * Resolve which breakpoint a given width belongs to.
 */
export function getBreakpointName(width: number): BreakpointName {
  const range = BREAKPOINT_RANGES.find(({ min, max }) => width >= min && width <= max);
  return range?.name ?? "large";
}

/**
 * Utility helpers for conditional logic without duplicating math in components.
 */
export function isBreakpointOrSmaller(name: BreakpointName, width: number): boolean {
  const target = BREAKPOINT_RANGES.find((range) => range.name === name);
  if (!target) return false;
  return width <= target.max;
}

export function isBreakpointOrLarger(name: BreakpointName, width: number): boolean {
  const target = BREAKPOINT_RANGES.find((range) => range.name === name);
  if (!target) return false;
  return width >= target.min;
}
