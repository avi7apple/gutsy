import { FadeIn, ScanResultSkeleton } from "@/components/SkeletonCard";
import { Colors } from "@/constants/theme";
import { rf, rs } from "@/lib/hooks/use-responsive";
import { getOnboardingProfile, type OnboardingProfile } from "@/lib/onboarding-storage";
import type { AlternativeProduct } from "@/lib/product-alternatives";
import { getPendingScanResult } from "@/lib/scan-result-store";
import { updateUserStreak } from "@/lib/streak-calculator";
import { supabase } from "@/lib/supabase";
import type { ScanResult } from "@/types/scan";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ScanResultSheet } from "./scan-result-sheet";

/** Normalize analysis from DB: parse JSON if needed, preserve all keys so the scan result page shows the same forecast, key insights, and "what you can do now" as the original scan (single source of truth). */
function normalizeAnalysis(raw: unknown): ScanResult["analysis"] {
  if (raw == null) return { summary: "", tips: [] };
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { summary: "", tips: [] };
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return { summary: "", tips: [] };
  const a = raw as Record<string, unknown>;
  // Ensure nested AI content is objects (in case DB returned stringified JSON)
  const goalPrediction = a.goalPrediction;
  const parsedGoalPrediction =
    goalPrediction != null && typeof goalPrediction === "object" && !Array.isArray(goalPrediction)
      ? goalPrediction
      : typeof goalPrediction === "string"
        ? (() => {
            try {
              const p = JSON.parse(goalPrediction);
              return p && typeof p === "object" ? p : undefined;
            } catch {
              return undefined;
            }
          })()
        : undefined;
  const personalizedInsights = a.personalizedInsights;
  const parsedInsights =
    Array.isArray(personalizedInsights)
      ? personalizedInsights
      : typeof personalizedInsights === "string"
        ? (() => {
            try {
              const p = JSON.parse(personalizedInsights);
              return Array.isArray(p) ? p : [];
            } catch {
              return undefined;
            }
          })()
        : undefined;
  const ingredientAnalysisRaw = a.ingredientAnalysis;
  const parsedIngredientAnalysis =
    ingredientAnalysisRaw != null && typeof ingredientAnalysisRaw === "object" && !Array.isArray(ingredientAnalysisRaw)
      ? ingredientAnalysisRaw
      : typeof ingredientAnalysisRaw === "string"
        ? (() => {
            try {
              const p = JSON.parse(ingredientAnalysisRaw);
              return p && typeof p === "object" && Array.isArray(p.items) ? p : undefined;
            } catch {
              return undefined;
            }
          })()
        : undefined;
  return {
    ...a,
    summary: typeof a.summary === "string" ? a.summary : "",
    tips: Array.isArray(a.tips) ? a.tips : [],
    ...(parsedGoalPrediction != null ? { goalPrediction: parsedGoalPrediction } : {}),
    ...(parsedInsights != null ? { personalizedInsights: parsedInsights } : {}),
    ...(parsedIngredientAnalysis != null ? { ingredientAnalysis: parsedIngredientAnalysis } : {}),
    serving_size_display: typeof a.serving_size_display === "string" ? a.serving_size_display : undefined,
    servings_per_container: typeof a.servings_per_container === "number" ? a.servings_per_container : undefined,
  } as ScanResult["analysis"];
}

/** Normalize nutrition from DB. */
function normalizeNutrition(raw: unknown): ScanResult["nutrition"] {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as object;
    } catch {
      return {};
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as ScanResult["nutrition"];
}

function normalizeIngredientAnalysis(raw: unknown): ScanResult["analysis"]["ingredientAnalysis"] | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const parsed = raw as {
    items?: Array<{ displayName?: unknown; impact?: unknown; whyMatters?: unknown }>;
    redCount?: unknown;
    yellowCount?: unknown;
    greenCount?: unknown;
  };
  if (!Array.isArray(parsed.items)) return undefined;
  return {
    items: parsed.items
      .filter((it) => it && typeof it === "object")
      .map((it) => ({
        displayName: typeof it.displayName === "string" ? it.displayName : "Unknown",
        impact:
          it.impact === "negative" || it.impact === "moderate" || it.impact === "positive"
            ? it.impact
            : "moderate",
        whyMatters: typeof it.whyMatters === "string" ? it.whyMatters : "Relevant to gut health.",
      })),
    redCount: typeof parsed.redCount === "number" ? parsed.redCount : 0,
    yellowCount: typeof parsed.yellowCount === "number" ? parsed.yellowCount : 0,
    greenCount: typeof parsed.greenCount === "number" ? parsed.greenCount : 0,
  };
}

/** Normalize saved alternatives from DB (product + scores + whyBetter). */
function normalizeAlternatives(raw: unknown): AlternativeProduct[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is AlternativeProduct => {
    if (!item || typeof item !== "object") return false;
    const o = item as Record<string, unknown>;
    return (
      o.product != null &&
      typeof o.product === "object" &&
      o.scores != null &&
      typeof o.scores === "object"
    );
  }) as AlternativeProduct[];
}

export default function ScanResultScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [loggedAsEaten, setLoggedAsEaten] = useState(false);
  const [savedAlternatives, setSavedAlternatives] = useState<AlternativeProduct[] | null>(null);

  useEffect(() => {
    loadScanResult();
    getOnboardingProfile().then(setProfile);
  }, [params.id]);

  async function loadScanResult() {
    setLoading(true);
    try {
      if (params.id) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("meal_scans")
          .select("*")
          .eq("id", params.id)
          .eq("user_id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          const analysis = normalizeAnalysis(data.analysis);
          const ingredientAnalysis =
            analysis.ingredientAnalysis ?? normalizeIngredientAnalysis(data.ingredient_analysis);
          const analysisWithIngredient = ingredientAnalysis
            ? { ...analysis, ingredientAnalysis }
            : analysis;
          const nutrition = normalizeNutrition(data.nutrition);
          const analysisAny = analysisWithIngredient as unknown as Record<string, unknown>;
          const manufacturer = (typeof analysisAny?.manufacturer === "string" ? analysisAny.manufacturer : null) ?? null;
          const ingredients = Array.isArray(analysisAny?.ingredients) ? analysisAny.ingredients as string[] : [];
          const gutFromAnalysis = typeof analysisAny?.gut_score === "number" ? analysisAny.gut_score : undefined;
          const scanResult: ScanResult = {
            scan_type: data.scan_type as "photo" | "barcode" | "manual",
            food_name: data.food_name,
            product_name: data.product_name ?? undefined,
            identified_foods: Array.isArray(data.identified_foods) ? data.identified_foods : [],
            bloat_score: typeof data.bloat_score === "number" ? data.bloat_score : 50,
            skin_score: typeof data.skin_score === "number" ? data.skin_score : 5,
            energy_score: typeof data.energy_score === "number" ? data.energy_score : 5,
            digestion_score: typeof data.digestion_score === "number" ? data.digestion_score : 5,
            gut_score: typeof data.gut_score === "number" ? data.gut_score : gutFromAnalysis ?? (typeof data.bloat_score === "number" ? data.bloat_score : 50),
            analysis: analysisWithIngredient,
            nutrition,
            image_url: data.image_url ?? null,
            barcode: data.barcode ?? null,
            manufacturer: manufacturer ?? undefined,
            ingredients: ingredients.length > 0 ? ingredients : undefined,
          };
          setResult(scanResult);
          setSaved(true);
          setLoggedAsEaten(data.logged_as_eaten === true);
          setSavedAlternatives(normalizeAlternatives(data.alternatives));
        }
      } else {
        const pending = getPendingScanResult();
        setResult(pending);
        setSavedAlternatives(null);
      }
    } catch (err) {
      console.error("Error loading scan result:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogAsEaten() {
    if (!params.id || saving || loggedAsEaten) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("meal_scans")
        .update({ logged_as_eaten: true })
        .eq("id", params.id)
        .eq("user_id", user.id);
      
      // Invalidate queries to update home page recent scans and history page
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      queryClient.invalidateQueries({ queryKey: ["scansForDay", todayKey] });
      queryClient.invalidateQueries({ queryKey: ["scansForDay"] }); // Invalidate all date keys
      queryClient.invalidateQueries({ queryKey: ["allScans"] });
      queryClient.invalidateQueries({ queryKey: ["recentScans"] });
      queryClient.invalidateQueries({ queryKey: ["weekData"] });
      queryClient.invalidateQueries({ queryKey: ["gutScore"] });
      
      // Force immediate refetch of user stats for streak update
      queryClient.invalidateQueries({ queryKey: ["userStats"] });
      queryClient.refetchQueries({ queryKey: ["userStats"] });
      
      // Update user streak after logging as eaten
      await updateUserStreak(user.id);
      
      // Force another refetch after updating streak
      queryClient.refetchQueries({ queryKey: ["userStats"] });
      queryClient.refetchQueries({ queryKey: ["weekData"] });
      queryClient.refetchQueries({ queryKey: ["gutScore"] });
      
      setLoggedAsEaten(true);
    } catch (e) {
      console.warn("Log as eaten error", e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ScanResultSkeleton />;
  }

  if (!result) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No scan result found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FadeIn visible={true} style={{ flex: 1 }}>
      <ScanResultSheet
        variant="page"
        result={result}
        profile={profile}
        onDismiss={() => router.back()}
        onContinue={() => {}}
        saved={saved}
        saving={saving}
        savedScanId={params.id || null}
        loggedAsEaten={loggedAsEaten}
        onLogAsEaten={handleLogAsEaten}
        onScanAgain={() => router.push("/(tabs)/scan")}
        fromOnboarding={false}
        savedAlternatives={savedAlternatives}
      />
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    padding: 24,
  },
  message: {
    marginTop: rs(12),
    fontSize: rf(16),
    color: Colors.textSecondary,
  },
  backBtn: {
    marginTop: rs(16),
    paddingVertical: rs(12),
    paddingHorizontal: rs(24),
  },
  backBtnText: {
    fontSize: rf(16),
    color: Colors.primary,
    fontWeight: "600",
  },
});
