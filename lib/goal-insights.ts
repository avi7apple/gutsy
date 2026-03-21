/**
 * Logic for generating goal-specific insights and predictions
 */

import type { ScanResult } from "@/types/scan";
import type { OnboardingProfile } from "@/lib/onboarding-storage";

export interface GoalPrediction {
  forecast: Array<{ time: string; risk: string; description: string }>;
  improvements: Array<{ action: string; newScore: string; impact: string }>;
  premiumTeaser?: string;
  cta?: string;
}

export interface PersonalizedInsight {
  type: "trigger" | "quick_win" | "pattern" | "great_choice" | "warning";
  title: string;
  detail: string;
  tip?: string;
  stat?: string;
  swap?: { from: string; to: string; scoreChange: string };
  progress?: { current: number; total: number; unlock?: string };
  cta?: string;
}

/**
 * Generate goal-specific prediction and insights
 */
export function generateGoalPrediction(
  result: ScanResult,
  profile: OnboardingProfile | null
): GoalPrediction | null {
  if (!profile?.goal) return null;

  const goal = profile.goal;
  const hour = new Date().getHours();
  const isEvening = hour >= 19;
  const isLateNight = hour >= 21;

  // Get goal-specific score
  let goalScore = 5;
  let goalMetric = "";
  if (goal === "Clear skin") {
    goalScore = result.skin_score;
    goalMetric = "SKIN IMPACT FORECAST";
  } else if (goal === "More energy") {
    goalScore = result.energy_score;
    goalMetric = "ENERGY IMPACT FORECAST";
  } else if (goal === "Better digestion") {
    goalScore = result.digestion_score;
    goalMetric = "DIGESTION IMPACT FORECAST";
  } else if (goal === "Reduce bloating") {
    goalScore = typeof result.bloat_score === "number" && result.bloat_score <= 10 ? result.bloat_score : (10 - Math.round((result.bloat_score ?? 50) / 10));
    goalMetric = "BLOAT IMPACT FORECAST";
  } else {
    return null;
  }

  const forecast: Array<{ time: string; risk: string; description: string }> = [];
  const improvements: Array<{ action: string; newScore: string; impact: string }> = [];
  const currentGut = Math.min(100, Math.max(0, result.gut_score ?? 50));
  const impactWithGut = (subScoreDelta: number, outcome: string) =>
    `If you do this, your gut score can improve to about ${Math.min(100, Math.round(currentGut + subScoreDelta * 3))}/100. ${outcome}`;
  const impactNoScore = (outcome: string) => `If you do this, ${outcome.charAt(0).toLowerCase() + outcome.slice(1)}`;

  // Generate forecast based on score quality
  if (goalScore > 7) {
    // Good product - reinforce positive choice
    if (goal === "Clear skin") {
      forecast.push({
        time: "Tomorrow morning",
        risk: "🟢 Low breakout risk",
        description: "Your skin should remain clear",
      });
      forecast.push({
        time: "Next 3 days",
        risk: "🟢 Continued clarity",
        description: "Keep choosing products like this",
      });
    } else if (goal === "More energy") {
      forecast.push({
        time: "Next 2-4 hours",
        risk: "🟢 Sustained energy boost",
        description: "You'll feel energized",
      });
      forecast.push({
        time: "Tomorrow",
        risk: "🟢 Good morning energy",
        description: "Wake up feeling refreshed",
      });
    } else if (goal === "Better digestion") {
      forecast.push({
        time: "Next 4-6 hours",
        risk: "🟢 Smooth digestion",
        description: "Minimal discomfort expected",
      });
      forecast.push({
        time: "Tomorrow",
        risk: "🟢 Regular patterns",
        description: "Your gut will thank you",
      });
    } else if (goal === "Reduce bloating") {
      forecast.push({
        time: "Next 2-4 hours",
        risk: "🟢 Low bloating risk",
        description: "You should feel comfortable",
      });
      forecast.push({
        time: "Tomorrow morning",
        risk: "🟢 Flat stomach likely",
        description: "Wake up feeling light",
      });
    }
  } else if (goalScore >= 5) {
    // Moderate product - show quick wins
    if (goal === "Clear skin") {
      forecast.push({
        time: "Tomorrow morning",
        risk: "🟡 Possible minor breakouts",
        description: "Some inflammation may appear",
      });
      forecast.push({
        time: "Next 3 days",
        risk: "🟡 Moderate impact",
        description: "Effects should be manageable",
      });
    } else if (goal === "More energy") {
      forecast.push({
        time: "Next 2-4 hours",
        risk: "🟡 Moderate energy levels",
        description: "May experience slight dip",
      });
      forecast.push({
        time: "Tomorrow",
        risk: "🟡 Normal morning energy",
        description: "Should recover quickly",
      });
    } else if (goal === "Better digestion") {
      forecast.push({
        time: "Next 4-6 hours",
        risk: "🟡 Some discomfort possible",
        description: "May feel slightly off",
      });
      forecast.push({
        time: "Tomorrow",
        risk: "🟡 Back to normal",
        description: "Should resolve quickly",
      });
    } else if (goal === "Reduce bloating") {
      forecast.push({
        time: "Next 2-4 hours",
        risk: "🟡 Moderate bloating risk",
        description: "Some water retention possible",
      });
      forecast.push({
        time: "Tomorrow morning",
        risk: "🟡 Slight puffiness",
        description: "Should subside by afternoon",
      });
    }
  } else {
    // Bad product - show warnings
    if (goal === "Clear skin") {
      forecast.push({
        time: "Tomorrow morning",
        risk: "🔴 Likely breakout risk",
        description: "Inflammation expected",
      });
      forecast.push({
        time: "Next 3 days",
        risk: "🔴 Continued impact",
        description: "Breakouts may persist",
      });
    } else if (goal === "More energy") {
      forecast.push({
        time: "Next 2-4 hours",
        risk: "🔴 Energy crash likely",
        description: "You may feel drained",
      });
      forecast.push({
        time: "Tomorrow",
        risk: "🔴 Low morning energy",
        description: "May struggle to wake up",
      });
    } else if (goal === "Better digestion") {
      forecast.push({
        time: "Next 4-6 hours",
        risk: "🔴 Digestive discomfort",
        description: "May experience issues",
      });
      forecast.push({
        time: "Tomorrow",
        risk: "🔴 Continued problems",
        description: "May take time to recover",
      });
    } else if (goal === "Reduce bloating") {
      forecast.push({
        time: "Next 2-4 hours",
        risk: "🔴 High bloating risk",
        description: "Significant water retention",
      });
      forecast.push({
        time: "Tomorrow morning",
        risk: "🔴 Puffy appearance",
        description: "Bloating may persist",
      });
    }
  }

  // Generate improvement tips based on goal and product content
  const identifiedFoods = result.identified_foods || [];
  const hasDairy = identifiedFoods.some((f) => /dairy|cheese|milk|yogurt|cream/i.test(f));
  const hasHighSugar = (result.nutrition?.sugar_g || 0) > 20;
  const hasHighSodium = (result.nutrition?.sodium_mg || 0) > 400;
  const hasProcessedFoods = identifiedFoods.some((f) => /processed|packaged|fried|fast food/i.test(f));

  if (goal === "Clear skin") {
    if (hasDairy) {
      improvements.push({
        action: "Skip the cheese/dairy",
        newScore: `${Math.min(10, goalScore + 2)}/10`,
        impact: impactWithGut(2, "skin score improves and inflammation risk drops."),
      });
    }
    if (hasHighSugar) {
      improvements.push({
        action: "Reduce sugar content",
        newScore: `${Math.min(10, goalScore + 1)}/10`,
        impact: impactWithGut(1, "less inflammation and clearer skin over time."),
      });
    }
    improvements.push({
      action: "Add extra veggies (vitamin C)",
      newScore: "",
      impact: impactNoScore("vitamin C supports skin repair and clarity."),
    });
  } else if (goal === "More energy") {
    if (isEvening && hasHighSugar) {
      improvements.push({
        action: "Eat earlier (before 7pm)",
        newScore: `${Math.min(10, goalScore + 1)}/10`,
        impact: impactWithGut(1, "better sleep and more stable energy tomorrow."),
      });
    }
    if (hasProcessedFoods) {
      improvements.push({
        action: "Choose whole foods",
        newScore: `${Math.min(10, goalScore + 2)}/10`,
        impact: impactWithGut(2, "sustained energy release and fewer crashes."),
      });
    }
    improvements.push({
      action: "Add protein",
      newScore: "",
      impact: impactNoScore("protein helps stabilize blood sugar and energy."),
    });
  } else if (goal === "Better digestion") {
    const fiber = result.nutrition?.fiber_g || 0;
    if (fiber < 5) {
      improvements.push({
        action: "Add fiber-rich foods",
        newScore: `${Math.min(10, goalScore + 2)}/10`,
        impact: impactWithGut(2, "fiber improves gut motility and comfort."),
      });
    }
    if (hasDairy && profile.trigger?.toLowerCase().includes("dairy")) {
      improvements.push({
        action: "Skip dairy (your trigger)",
        newScore: `${Math.min(10, goalScore + 3)}/10`,
        impact: impactWithGut(3, "avoiding your trigger can significantly reduce discomfort."),
      });
    }
    improvements.push({
      action: "Eat slower, chew well",
      newScore: "",
      impact: impactNoScore("thorough chewing eases digestion and reduces bloating."),
    });
  } else if (goal === "Reduce bloating") {
    if (hasHighSodium) {
      improvements.push({
        action: "Reduce sodium",
        newScore: `${Math.min(10, goalScore + 2)}/10`,
        impact: impactWithGut(2, "less water retention and a lighter feel."),
      });
    }
    if (isLateNight) {
      improvements.push({
        action: "Eat earlier next time",
        newScore: `${Math.min(10, goalScore + 1)}/10`,
        impact: impactWithGut(1, "better digestion timing and less next-day puffiness."),
      });
    }
    improvements.push({
      action: "Drink extra water",
      newScore: "",
      impact: impactNoScore("water helps flush excess sodium and reduces bloating."),
    });
  }

  // Add default tips if none generated
  if (improvements.length === 0) {
    improvements.push({
      action: "Portion control",
      newScore: "",
      impact: impactNoScore("moderate portions support gut health and comfort."),
    });
  }

  return {
    forecast,
    improvements: improvements.slice(0, 3),
    premiumTeaser: `🔒 Premium users see day-by-day ${goal.toLowerCase()} predictions`,
    cta: "See exactly how to improve this →",
  };
}

/**
 * Generate 3 personalized insights based on product, profile, and user state
 */
export function generatePersonalizedInsights(
  result: ScanResult,
  profile: OnboardingProfile | null,
  scanCount: number = 1,
  isPremium: boolean = false
): PersonalizedInsight[] {
  const insights: PersonalizedInsight[] = [];
  const identifiedFoods = result.identified_foods || [];
  const triggerLabel = profile?.trigger || "";
  const goal = profile?.goal || "";
  const hour = new Date().getHours();
  const isEvening = hour >= 19;
  const isLateNight = hour >= 21;
  const hasHighSodium = (result.nutrition?.sodium_mg || 0) > 400;
  const hasHighSugar = (result.nutrition?.sugar_g || 0) > 20;

  // Check for trigger foods
  const triggersDetected =
    triggerLabel &&
    identifiedFoods.some((f) => f.toLowerCase().includes(triggerLabel.toLowerCase().split(/[/,]/)[0]?.trim() ?? ""));

  // INSIGHT 1: Personalization proof or trigger alert
  if (triggersDetected && triggerLabel) {
    insights.push({
      type: "trigger",
      title: "⚠️ TRIGGER ALERT",
      detail: `This contains ${triggerLabel.toUpperCase()}, your #1 sensitivity. What typically happens: Bloating in 2-4 hours. ${goal === "Clear skin" ? "Skin breakouts in 24-48 hours. " : ""}Energy crash after 30 mins.`,
      tip: "See trigger-free alternatives →",
      cta: "See alternatives →",
    });
  } else if (result.bloat_score > 60 && triggerLabel) {
    const gutScore = result.gut_score ?? Math.round((result.skin_score * 10 + result.bloat_score + result.digestion_score * 10 + result.energy_score * 10) / 4);
    insights.push({
      type: "trigger",
      title: "1️⃣ YOUR BIGGEST TRIGGER",
      detail: `Based on your sensitivity to ${triggerLabel}, this product has a ${Math.round(100 - gutScore)}% gut impact risk`,
      tip: `Why: ${triggerLabel} + high sodium = water retention for you specifically`,
      stat: `83% of users with ${triggerLabel} sensitivity report bloating from products like this`,
    });
  } else if (result.bloat_score < 40 && goal) {
    insights.push({
      type: "great_choice",
      title: "1️⃣ GREAT CHOICE! ⭐",
      detail: `This product aligns perfectly with your ${goal.toLowerCase()} goal. Keep choosing products like this and you'll see results in 7-10 days`,
      tip: "Save this as a favorite →",
    });
  } else if (hasHighSodium && result.bloat_score > 50) {
    insights.push({
      type: "warning",
      title: "1️⃣ HIGH SODIUM ALERT",
      detail: `This product contains ${result.nutrition?.sodium_mg || 0}mg sodium, ${hasHighSodium ? "way above" : "above"} your ideal range.`,
      tip: "High sodium + late timing = morning bloat risk",
      stat: "Users with your profile report 2x higher bloat risk from high-sodium evening snacks",
    });
  } else if (hasHighSodium) {
    insights.push({
      type: "warning",
      title: "High sodium",
      detail: `This product has ${result.nutrition?.sodium_mg || 0}mg sodium per serving, which can contribute to water retention and bloating.`,
      tip: "Pair with plenty of water and lower-sodium options at your next meal.",
    });
  } else if (hasHighSugar) {
    insights.push({
      type: "warning",
      title: "Sugar content",
      detail: `This product has ${result.nutrition?.sugar_g || 0}g sugar, which may cause energy spikes and crashes.`,
      tip: "Consider having it with protein or fiber to slow absorption.",
    });
  }

  // Second insight: only real, product-based content (no "unlock pattern" / "scan more" placeholders)
  if (hasHighSodium && !insights.some((i) => i.detail?.includes("sodium"))) {
    insights.push({
      type: "warning",
      title: "Sodium note",
      detail: `${result.nutrition?.sodium_mg || 0}mg sodium per serving, above the typical 400mg threshold for a single snack.`,
      tip: "Balance with lower-sodium foods later in the day.",
    });
  } else if (result.bloat_score > 55 && result.nutrition?.fiber_g != null && result.nutrition.fiber_g < 3) {
    insights.push({
      type: "quick_win",
      title: "Low fiber",
      detail: `This product has ${result.nutrition.fiber_g}g fiber. Low-fiber snacks can leave you less satisfied and may affect digestion.`,
      tip: "Add vegetables or fruit to your next meal to boost fiber.",
    });
  }

  // Third insight: only real, product-based content (no "log this product" / "build your pattern" placeholder)
  if (isLateNight && (hasHighSodium || result.bloat_score > 50)) {
    insights.push({
      type: "warning",
      title: "Timing",
      detail: `Eating this late (${hour}:00) with ${hasHighSodium ? "high sodium" : "these ingredients"} can increase next-day bloating for many people.`,
      tip: "Try similar snacks earlier in the day when possible.",
    });
  } else if (hasHighSugar && (goal === "More energy" || result.energy_score != null)) {
    insights.push({
      type: "warning",
      title: "Energy impact",
      detail: `With ${result.nutrition?.sugar_g || 0}g sugar, this may give a short energy boost followed by a dip.`,
      tip: "Pair with protein or have a smaller portion to smooth the effect.",
    });
  }

  return insights.slice(0, 3);
}
