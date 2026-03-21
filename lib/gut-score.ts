import type { OnboardingProfile } from "./onboarding-storage";
import type { ScoreBucketId } from "@/constants/theme";

const MAX_RAW = 15;

/** Map stored answer labels to point values (0–3). Uses normalized matching for minor wording differences. */
function labelToPoints(questionId: string, label: string | null): number {
  if (label == null || label.trim() === "") return 1;

  const normalized = label.toLowerCase().trim();

  switch (questionId) {
    case "skin": {
      if (normalized.includes("breakouts") || normalized.includes("redness") || normalized.includes("inflammation")) return 0;
      if (normalized.includes("uneven") || normalized.includes("dullness")) return 1;
      if (normalized.includes("occasionally dry") || normalized.includes("oily patches")) return 2;
      if (normalized.includes("clear") && normalized.includes("healthy")) return 3;
      return 1;
    }
    case "bloating": {
      if (normalized.includes("almost every meal")) return 0;
      if (normalized.includes("several times a week")) return 1;
      if (normalized.includes("few times a month")) return 2;
      if (normalized.includes("rarely") || normalized.includes("never")) return 3;
      return 1;
    }
    case "digestion": {
      if (normalized.startsWith("irregular")) return 0;
      if (normalized.startsWith("sluggish")) return 1;
      if (normalized.includes("usually fine") || normalized.includes("occasional off day")) return 2;
      if (normalized.includes("smooth") && normalized.includes("regular")) return 3;
      return 1;
    }
    case "energy": {
      if (normalized.includes("brain fog") || normalized.includes("fatigue") || normalized.includes("mood swings")) return 0;
      if (normalized.includes("energy crashes")) return 1;
      if (normalized.includes("pretty steady") || normalized.includes("occasional dips")) return 2;
      if (normalized.includes("consistently energized") || normalized.includes("clear-headed")) return 3;
      return 1;
    }
    case "packaged": {
      if (normalized.includes("multiple times a day")) return 0;
      if (normalized.includes("once or twice a day")) return 1;
      if (normalized.includes("few times a week")) return 2;
      if (normalized.includes("rarely")) return 3;
      return 1;
    }
    default:
      return 1;
  }
}

/** Build answers object from onboarding profile and return point values. */
export function getAnswerPoints(profile: OnboardingProfile): { skin: number; bloating: number; digestion: number; energy: number; packaged: number } {
  return {
    skin: labelToPoints("skin", profile.skinFeel),
    bloating: labelToPoints("bloating", profile.bloating),
    digestion: labelToPoints("digestion", profile.digestion),
    energy: labelToPoints("energy", profile.energyMood),
    packaged: labelToPoints("packaged", profile.processedFood),
  };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Compute main gut score (22–94). Returns 50 for invalid/NaN. */
export function calculateGutScore(profile: OnboardingProfile): number {
  const points = getAnswerPoints(profile);
  const rawScore = points.skin + points.bloating + points.digestion + points.energy + points.packaged;
  const gutScore = Math.round(22 + (rawScore / MAX_RAW) * 72);
  const result = clamp(gutScore, 22, 94);
  if (Number.isNaN(result) || result === undefined) return 50;
  return result;
}

/** Sub-scores for breakdown bars. Call once on mount and store in state. */
export function calculateSubScores(gutScore: number): { skin: number; bloating: number; digestion: number; energy: number } {
  return {
    skin: clamp(gutScore + randomInt(-12, 10), 15, 99),
    bloating: clamp(gutScore + randomInt(-10, 12), 15, 99),
    digestion: clamp(gutScore + randomInt(-8, 8), 15, 99),
    energy: clamp(gutScore + randomInt(-12, 10), 15, 99),
  };
}

export type ScoreProfile = {
  bucket: ScoreBucketId;
  pillLabel: string;
  headline: string;
  body: string;
  ctaLabel: string;
  caption: string;
};

export function getScoreProfile(gutScore: number): ScoreProfile {
  const safe = Number.isFinite(gutScore) ? gutScore : 50;

  if (safe <= 45)
    return {
      bucket: "needs_attention",
      pillLabel: "Needs Attention",
      headline: "Your gut is sending you SOS signals.",
      body:
        "Your answers point to a disrupted gut microbiome: the kind that quietly drives skin issues, energy crashes, bloating, and low mood. The good news? It responds quickly to what you eat. You know where to start.",
      ctaLabel: "I need to fix this →",
      caption: "Your gut can start recovering within days.",
    };

  if (safe <= 65)
    return {
      bucket: "imbalanced",
      pillLabel: "Imbalanced",
      headline: "Your gut is working, but it's struggling.",
      body:
        "You're not in crisis, but your gut health is fragile. A few hidden ingredients in your daily foods are likely holding it back. That shows up in your skin, focus, and how you feel after every meal.",
      ctaLabel: "Help me fix the gaps →",
      caption: "Small changes create faster results than you'd expect.",
    };

  if (safe <= 80)
    return {
      bucket: "good_foundation",
      pillLabel: "Good Foundation",
      headline: "Your gut is in decent shape. Protect it.",
      body:
        "You've built solid habits, but processed food ingredients sneak in more than most people realize. One hidden additive can quietly erode what you've built over time. This is where knowing what's in your food becomes your edge.",
      ctaLabel: "Help me maintain this →",
      caption: "Stay consistent and your score will keep climbing.",
    };

  return {
    bucket: "thriving",
    pillLabel: "Thriving",
    headline: "Your gut health is exceptional. Guard it.",
    body:
      "You're in the top tier. Even the healthiest guts are vulnerable to hidden ingredients in packaged foods. Stay informed and stay ahead. This level of health doesn't maintain itself on its own.",
    ctaLabel: "Help me stay at the top →",
    caption: "You're already ahead. Keep the lead.",
  };
}
