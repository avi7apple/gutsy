import { BREAKPOINTS, getBreakpointName, type BreakpointName } from "@/lib/design/breakpoints";
import { useEffect, useState } from "react";
import { Dimensions, PixelRatio, type ScaledSize } from "react-native";

/**
 * Centralized Responsive Design System for Gutsy
 *
 * Breakpoints:
 * - Large (>430px width): iPhone 14/15 Pro Max — 1.0x (design baseline)
 * - Medium (376–430px): iPhone 14/15 Pro, iPhone 12/13 — proportional scaling
 * - Small (≤375px): iPhone 11, iPhone SE — aggressive scaling
 *
 * Usage:
 *   import { rs, rf, rw, rh } from "@/lib/hooks/use-responsive";
 *   style={{ padding: rs(24), fontSize: rf(16) }}
 */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Design baseline: iPhone 14 Pro Max (430pt width)
const BASE_WIDTH = 430;
const BASE_HEIGHT = 932;

// Breakpoints from the centralized design tokens
const SMALL_BREAKPOINT = BREAKPOINTS.small;
const MEDIUM_BREAKPOINT = BREAKPOINTS.medium;
const LARGE_BREAKPOINT = BREAKPOINTS.large;

/**
 * Get the scale factor based on screen width.
 * Large (>430): 1.0
 * Medium (376-430): proportional between 0.9 and 1.0
 * Small (≤375): proportional between 0.78 and 0.9
 */
function getScaleFactor(): number {
  if (SCREEN_WIDTH >= LARGE_BREAKPOINT) return 1;
  if (SCREEN_WIDTH > MEDIUM_BREAKPOINT) {
    // Large phones (391-430) interpolate between 0.95 → 1.0
    const ratio = (SCREEN_WIDTH - MEDIUM_BREAKPOINT) / (LARGE_BREAKPOINT - MEDIUM_BREAKPOINT);
    return 0.95 + ratio * 0.05;
  }
  if (SCREEN_WIDTH > SMALL_BREAKPOINT) {
    // Medium phones (376-390) interpolate between 0.9 → 0.95
    const ratio = (SCREEN_WIDTH - SMALL_BREAKPOINT) / (MEDIUM_BREAKPOINT - SMALL_BREAKPOINT);
    return 0.9 + ratio * 0.05;
  }
  // Small screens: scale more aggressively based on actual width
  const ratio = SCREEN_WIDTH / SMALL_BREAKPOINT;
  return 0.78 + ratio * 0.12;
}

const SCALE_FACTOR = getScaleFactor();

/**
 * Font scale factor — slightly less aggressive than spacing to preserve readability.
 */
function getFontScaleFactor(): number {
  if (SCREEN_WIDTH >= LARGE_BREAKPOINT) return 1;
  if (SCREEN_WIDTH > MEDIUM_BREAKPOINT) {
    const ratio = (SCREEN_WIDTH - MEDIUM_BREAKPOINT) / (LARGE_BREAKPOINT - MEDIUM_BREAKPOINT);
    return 0.94 + ratio * 0.06;
  }
  if (SCREEN_WIDTH > SMALL_BREAKPOINT) {
    const ratio = (SCREEN_WIDTH - SMALL_BREAKPOINT) / (MEDIUM_BREAKPOINT - SMALL_BREAKPOINT);
    return 0.9 + ratio * 0.04;
  }
  const ratio = SCREEN_WIDTH / SMALL_BREAKPOINT;
  return 0.82 + ratio * 0.1;
}

const FONT_SCALE_FACTOR = getFontScaleFactor();

/**
 * rs (responsive size) — Scale a fixed pixel value proportionally.
 * On large screens returns the exact input value.
 * On medium/small screens returns a scaled-down value.
 */
export function rs(size: number): number {
  if (SCREEN_WIDTH >= LARGE_BREAKPOINT) return size;
  return Math.round(size * SCALE_FACTOR);
}

/**
 * rf (responsive font) — Scale a font size proportionally.
 * Less aggressive than rs() to maintain readability.
 * Respects device font scale via PixelRatio.
 */
export function rf(size: number): number {
  if (SCREEN_WIDTH >= LARGE_BREAKPOINT) return size;
  const scaled = size * FONT_SCALE_FACTOR;
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}

/**
 * rw (responsive width) — Calculate a percentage of screen width.
 */
export function rw(percentage: number): number {
  return Math.round((SCREEN_WIDTH * percentage) / 100);
}

/**
 * rh (responsive height) — Calculate a percentage of screen height.
 */
export function rh(percentage: number): number {
  return Math.round((SCREEN_HEIGHT * percentage) / 100);
}

/**
 * rsMin (responsive size with minimum) — Scale with a floor value.
 * Ensures elements never shrink below a minimum (e.g., touch targets).
 */
export function rsMin(size: number, min: number): number {
  return Math.max(rs(size), min);
}

/**
 * Screen size category for conditional logic.
 */
export type ScreenSize = BreakpointName;

export function getScreenSize(): ScreenSize {
  return getBreakpointName(SCREEN_WIDTH);
}

export const screenSize = getScreenSize();
export const isSmallScreen = screenSize === "small";
export const isMediumScreen = screenSize === "medium";
export const isLargeScreen = screenSize === "large" || screenSize === "tablet";

/**
 * Hook variant that updates when orientation/viewport changes.
 */
export function useBreakpoint(): BreakpointName {
  const [breakpoint, setBreakpoint] = useState<BreakpointName>(getBreakpointName(SCREEN_WIDTH));

  useEffect(() => {
    const handler = ({ window }: { window: ScaledSize }) => {
      setBreakpoint(getBreakpointName(window.width));
    };

    const subscription = Dimensions.addEventListener("change", handler);
    return () => subscription.remove();
  }, []);

  return breakpoint;
}

/** Raw screen dimensions for advanced use cases */
export const screen = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  scaleFactor: SCALE_FACTOR,
  fontScaleFactor: FONT_SCALE_FACTOR,
};
