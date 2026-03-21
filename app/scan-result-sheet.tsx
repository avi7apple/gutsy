import React from "react";
import { Alert, Dimensions, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";
import type { OnboardingProfile } from "@/lib/onboarding-storage";
import type { AlternativeProduct } from "@/lib/product-alternatives";
import type { ScanResult } from "@/types/scan";

const { width: screenWidth } = Dimensions.get("window");

interface ScanResultSheetProps {
  variant: "page" | "sheet";
  result: ScanResult;
  profile: OnboardingProfile | null;
  onDismiss: () => void;
  onContinue: () => void;
  saved: boolean;
  saving: boolean;
  savedScanId: string | null;
  loggedAsEaten: boolean;
  onLogAsEaten: () => void;
  onScanAgain: () => void;
  fromOnboarding: boolean;
  savedAlternatives: AlternativeProduct[] | null;
}

export function ScanResultSheet({
  variant,
  result,
  profile,
  onDismiss,
  onContinue,
  saved,
  saving,
  savedScanId,
  loggedAsEaten,
  onLogAsEaten,
  onScanAgain,
  fromOnboarding,
  savedAlternatives,
}: ScanResultSheetProps) {
  const insets = useSafeAreaInsets();

  const handleSave = () => {
    // Implementation for saving scan result
    onContinue();
  };

  const handleShare = () => {
    // Implementation for sharing results
    Alert.alert("Share", "Share functionality coming soon!");
  };

  const handleAlternatives = () => {
    if (savedAlternatives && savedAlternatives.length > 0) {
      Alert.alert("Alternatives", `Found ${savedAlternatives.length} alternatives`);
    } else {
      Alert.alert("No Alternatives", "No alternatives available for this item");
    }
  };

  return (
    <View style={[styles.container, variant === "page" && { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{result.food_name}</Text>
          {result.product_name && (
            <Text style={styles.subtitle}>{result.product_name}</Text>
          )}
        </View>

        {/* Gut Score */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>Gut Score</Text>
          <Text style={styles.scoreValue}>{result.gut_score || 50}</Text>
          <Text style={styles.scoreDescription}>Overall gut health impact</Text>
        </View>

        {/* Individual Scores */}
        <View style={styles.scoresContainer}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Bloat</Text>
            <Text style={styles.scoreValue}>{result.bloat_score}/10</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Skin</Text>
            <Text style={styles.scoreValue}>{result.skin_score}/10</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Energy</Text>
            <Text style={styles.scoreValue}>{result.energy_score}/10</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Digestion</Text>
            <Text style={styles.scoreValue}>{result.digestion_score}/10</Text>
          </View>
        </View>

        {/* Analysis Summary */}
        {result.analysis.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.sectionContent}>{result.analysis.summary}</Text>
          </View>
        )}

        {/* Tips */}
        {result.analysis.tips && result.analysis.tips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tips</Text>
            {result.analysis.tips.map((tip, index) => (
              <Text key={index} style={styles.tipItem}>
                • {tip}
              </Text>
            ))}
          </View>
        )}

        {/* Nutrition */}
        {Object.keys(result.nutrition).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition</Text>
            <View style={styles.nutritionGrid}>
              {result.nutrition.calories !== undefined && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{result.nutrition.calories}</Text>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                </View>
              )}
              {result.nutrition.protein_g !== undefined && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{result.nutrition.protein_g}g</Text>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                </View>
              )}
              {result.nutrition.carbs_g !== undefined && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{result.nutrition.carbs_g}g</Text>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                </View>
              )}
              {result.nutrition.fat_g !== undefined && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{result.nutrition.fat_g}g</Text>
                  <Text style={styles.nutritionLabel}>Fat</Text>
                </View>
              )}
              {result.nutrition.fiber_g !== undefined && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{result.nutrition.fiber_g}g</Text>
                  <Text style={styles.nutritionLabel}>Fiber</Text>
                </View>
              )}
              {result.nutrition.sugar_g !== undefined && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{result.nutrition.sugar_g}g</Text>
                  <Text style={styles.nutritionLabel}>Sugar</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Ingredients */}
        {result.ingredients && result.ingredients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {result.ingredients.map((ingredient, index) => (
              <Text key={index} style={styles.ingredientItem}>
                • {ingredient}
              </Text>
            ))}
          </View>
        )}

        {/* Alternatives */}
        {savedAlternatives && savedAlternatives.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Better Alternatives</Text>
            {savedAlternatives.map((alt, index) => (
              <View key={index} style={styles.alternativeItem}>
                <Text style={styles.alternativeName}>{alt.product.name}</Text>
                <Text style={styles.alternativeScore}>Gut Score: {alt.scores.gut_score}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bottom padding for scroll */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom }]}>
        {!fromOnboarding && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onScanAgain}>
            <Text style={styles.secondaryButtonText}>Scan Again</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>
            {fromOnboarding ? "Continue" : saved ? "Saved" : "Save Result"}
          </Text>
        </TouchableOpacity>

        {saved && !loggedAsEaten && (
          <TouchableOpacity style={styles.tertiaryButton} onPress={onLogAsEaten}>
            <Text style={styles.tertiaryButtonText}>Log as Eaten</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  scoreCard: {
    margin: 20,
    padding: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    alignItems: "center",
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: Colors.primary,
    marginVertical: 8,
  },
  scoreDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  scoresContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 20,
  },
  scoreItem: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  scoreLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  section: {
    margin: 20,
    padding: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  tipItem: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 24,
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  nutritionItem: {
    width: "33%",
    alignItems: "center",
    marginBottom: 16,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.primary,
  },
  nutritionLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  ingredientItem: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 24,
  },
  alternativeItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  alternativeName: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.text,
  },
  alternativeScore: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  bottomPadding: {
    height: 120,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  tertiaryButton: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  tertiaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
});
