import { ScanResultColors } from "@/constants/theme";

export type RiskDot = "red" | "amber" | "green";

export function getScoreRiskColor(score: number): string {
  if (score >= 70) return ScanResultColors.riskGreen;
  if (score >= 40) return ScanResultColors.riskAmber;
  return ScanResultColors.riskRed;
}

export function getScoreRiskDot(score: number): RiskDot {
  if (score >= 70) return "green";
  if (score >= 40) return "amber";
  return "red";
}

export function getHealthGradeStyles(grade: string): { bg: string; text: string } {
  switch (grade) {
    case "Excellent":
    case "Good":
      return { bg: ScanResultColors.riskGreenBg, text: ScanResultColors.riskGreenText };
    case "Okay":
      return { bg: ScanResultColors.riskAmberBg, text: ScanResultColors.riskAmberText };
    case "Poor":
    case "Avoid":
    default:
      return { bg: ScanResultColors.riskRedBg, text: ScanResultColors.riskRedText };
  }
}

export function getIngredientLevelStyles(level: string): {
  dot: string;
  badgeBg: string;
  badgeText: string;
  badgeLabel: string;
} {
  switch (level) {
    case "hi":
      return {
        dot: ScanResultColors.riskRed,
        badgeBg: ScanResultColors.riskRedBg,
        badgeText: ScanResultColors.riskRedText,
        badgeLabel: "High risk",
      };
    case "med":
      return {
        dot: ScanResultColors.riskAmber,
        badgeBg: ScanResultColors.riskAmberBg,
        badgeText: ScanResultColors.riskAmberText,
        badgeLabel: "Warning",
      };
    case "ben":
      return {
        dot: ScanResultColors.riskGreen,
        badgeBg: ScanResultColors.riskGreenBg,
        badgeText: ScanResultColors.riskGreenText,
        badgeLabel: "Beneficial",
      };
    case "lo":
      return {
        dot: ScanResultColors.riskAmber,
        badgeBg: ScanResultColors.riskAmberBg,
        badgeText: ScanResultColors.riskAmberText,
        badgeLabel: "Low risk",
      };
    default:
      return {
        dot: ScanResultColors.chevron,
        badgeBg: ScanResultColors.neutralBg,
        badgeText: ScanResultColors.textSecondary,
        badgeLabel: "Neutral",
      };
  }
}

export function additivesDot(count: number): RiskDot {
  if (count >= 4) return "red";
  if (count >= 1) return "amber";
  return "green";
}

export function seedOilsDot(hasOils: boolean): RiskDot {
  return hasOils ? "red" : "green";
}

export function novaDot(level: string): RiskDot {
  if (level.includes("4")) return "red";
  if (level.includes("3")) return "amber";
  return "green";
}

export function sugarAliasDot(count: number): RiskDot {
  if (count >= 3) return "red";
  if (count >= 1) return "amber";
  return "green";
}

export function allergenDot(allergens: string[]): RiskDot {
  return allergens.length > 0 ? "amber" : "green";
}

export function packagingDot(packaging: string): RiskDot {
  const p = packaging.toLowerCase();
  if (p.includes("plastic")) return "red";
  if (p.includes("mixed") || p.includes("multi")) return "amber";
  return "green";
}

export function realFoodDot(ratio: number): RiskDot {
  if (ratio < 40) return "red";
  if (ratio <= 70) return "amber";
  return "green";
}

export function dotColorValue(dot: RiskDot): string {
  if (dot === "red") return ScanResultColors.riskRed;
  if (dot === "amber") return ScanResultColors.riskAmber;
  return ScanResultColors.riskGreen;
}

export function severityBadgeStyles(severity: string): { bg: string; text: string } {
  if (severity === "High") {
    return { bg: ScanResultColors.riskRedBg, text: ScanResultColors.riskRedText };
  }
  if (severity === "Low–Med") {
    return { bg: ScanResultColors.riskAmberBg, text: ScanResultColors.riskAmberText };
  }
  if (severity === "Low") {
    return { bg: ScanResultColors.riskGreenBg, text: ScanResultColors.riskGreenText };
  }
  return { bg: ScanResultColors.riskAmberBg, text: ScanResultColors.riskAmberText };
}
