import { BorderRadius, Colors, Fonts, Spacing } from "@/constants/theme";
import type { DetectedIngredient, PortionAdjustment } from "@/types/scan";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MealConfirmationScreenProps {
  detectedIngredients: DetectedIngredient[];
  portionAdjustments: PortionAdjustment[];
  onConfirm: (confirmations: Record<string, boolean>, adjustedPortions: Record<string, number>, customIngredients?: Array<{name: string, grams: number}>) => void;
  onCancel: () => void;
  imageUrl?: string;
}

export function MealConfirmationScreen({
  detectedIngredients,
  portionAdjustments,
  onConfirm,
  onCancel,
  imageUrl,
}: MealConfirmationScreenProps) {
  const insets = useSafeAreaInsets();
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [adjustedPortions, setAdjustedPortions] = useState<Record<string, number>>({});
  const [customIngredients, setCustomIngredients] = useState<Array<{name: string, grams: number}>>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientGrams, setNewIngredientGrams] = useState('');
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize confirmations based on confidence
  React.useEffect(() => {
    const initialConfirmations: Record<string, boolean> = {};
    detectedIngredients.forEach((ingredient) => {
      initialConfirmations[ingredient.name] = ingredient.confidence >= 0.75;
    });
    setConfirmations(initialConfirmations);

    // Initialize adjusted portions
    const initialPortions: Record<string, number> = {};
    portionAdjustments.forEach((adjustment) => {
      initialPortions[adjustment.ingredientName] = adjustment.currentGrams;
    });
    setAdjustedPortions(initialPortions);
  }, [detectedIngredients, portionAdjustments]);

  const handleToggleConfirmation = (ingredientName: string) => {
    setConfirmations(prev => ({
      ...prev,
      [ingredientName]: !prev[ingredientName],
    }));
  };

  const handlePortionAdjust = (ingredientName: string, newGrams: number) => {
    setAdjustedPortions(prev => ({
      ...prev,
      [ingredientName]: newGrams,
    }));
  };

  const handleAddCustomIngredient = () => {
    if (newIngredientName.trim() && newIngredientGrams.trim()) {
      const grams = parseInt(newIngredientGrams);
      if (!isNaN(grams) && grams > 0) {
        setCustomIngredients(prev => [...prev, { name: newIngredientName.trim(), grams }]);
        setNewIngredientName('');
        setNewIngredientGrams('');
        setShowAddIngredient(false);
      }
    }
  };

  const handleRemoveCustomIngredient = (index: number) => {
    setCustomIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleCustomGramsChange = (index: number, newGrams: string) => {
    const grams = parseInt(newGrams);
    if (!isNaN(grams) && grams > 0) {
      setCustomIngredients(prev => 
        prev.map((ingredient, i) => 
          i === index ? { ...ingredient, grams } : ingredient
        )
      );
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Add custom ingredients to the confirmations and portions
      const allConfirmations = { ...confirmations };
      const allPortions = { ...adjustedPortions };
      
      customIngredients.forEach(ingredient => {
        allConfirmations[ingredient.name] = true;
        allPortions[ingredient.name] = ingredient.grams;
      });
      
      await onConfirm(allConfirmations, allPortions, customIngredients);
    } finally {
      setLoading(false);
    }
  };

  const confirmedCount = Object.values(confirmations).filter(Boolean).length + customIngredients.length;
  const totalIngredients = detectedIngredients.length + customIngredients.length;
  const canProceed = confirmedCount >= 2; // Minimum 2 ingredients for meal

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.dragHandleWrap}>
        <View style={styles.dragHandle} />
      </View>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Meal</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: Spacing.xl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.mealImage} />
            <View style={styles.imageOverlay}>
              <Text style={styles.imageText}>AI detected {detectedIngredients.length} ingredients</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detected Ingredients</Text>
          <Text style={styles.sectionSubtitle}>
            Confirm ingredients you want to include in your meal analysis
          </Text>

          {detectedIngredients.map((ingredient) => {
            const adjustment = portionAdjustments.find(a => a.ingredientName === ingredient.name);
            const isConfirmed = confirmations[ingredient.name];
            const currentGrams = adjustedPortions[ingredient.name] || adjustment?.currentGrams || 100;

            return (
              <TouchableOpacity
                key={ingredient.name}
                activeOpacity={0.88}
                onPress={() => handleToggleConfirmation(ingredient.name)}
                style={[
                  styles.ingredientCard,
                  isConfirmed && styles.ingredientCardActive,
                ]}
              >
                <View style={styles.ingredientHeader}>
                  <TouchableOpacity
                    style={[
                      styles.confirmationCheckbox,
                      isConfirmed && styles.confirmationCheckboxChecked,
                    ]}
                    onPress={() => handleToggleConfirmation(ingredient.name)}
                  >
                    {isConfirmed && (
                      <Ionicons name="checkmark" size={16} color={Colors.background} />
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.ingredientInfo}>
                    <Text style={[
                      styles.ingredientName,
                      !isConfirmed && styles.ingredientNameDisabled,
                    ]}>
                      {ingredient.name}
                    </Text>
                    <View style={styles.ingredientMeta}>
                      <Text style={styles.cookingState}>
                        {ingredient.state}
                        {ingredient.cookingMethod && ` • ${ingredient.cookingMethod}`}
                      </Text>
                      {ingredient.confidence < 0.75 && (
                        <Text style={styles.confidenceWarning}>
                          Please confirm this ingredient
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {isConfirmed && adjustment && (
                  <View style={styles.portionDetails}>
                      <Text style={styles.portionLabel}>Portion Size (grams)</Text>
                      <View style={styles.portionInputContainer}>
                        <TextInput
                          style={styles.portionInput}
                          value={currentGrams.toString()}
                          onChangeText={(text) => {
                            const grams = parseInt(text);
                            if (!isNaN(grams) && grams > 0) {
                              handlePortionAdjust(ingredient.name, grams);
                            }
                          }}
                          keyboardType="numeric"
                          placeholder="Enter grams"
                        />
                        <Text style={styles.gramsUnit}>g</Text>
                      </View>
                    </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Ingredients Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Add Ingredients</Text>
            <TouchableOpacity
              style={styles.addIngredientButton}
              onPress={() => setShowAddIngredient(!showAddIngredient)}
            >
              <Ionicons name={showAddIngredient ? "remove" : "add"} size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          
          {showAddIngredient && (
            <View style={styles.addIngredientForm}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.ingredientNameInput}
                  value={newIngredientName}
                  onChangeText={setNewIngredientName}
                  placeholder="Ingredient name"
                  placeholderTextColor={Colors.textSecondary}
                  autoFocus={true}
                />
                <TouchableOpacity
                  style={styles.closeFormButton}
                  onPress={() => setShowAddIngredient(false)}
                >
                  <Ionicons name="close" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.gramInputRow}>
                <TextInput
                  style={styles.gramInput}
                  value={newIngredientGrams}
                  onChangeText={setNewIngredientGrams}
                  placeholder="Grams"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.addButton, (!newIngredientName.trim() || !newIngredientGrams.trim()) && styles.addButtonDisabled]}
                  onPress={handleAddCustomIngredient}
                  disabled={!newIngredientName.trim() || !newIngredientGrams.trim()}
                >
                  <Ionicons name="add" size={16} color={Colors.backgroundWhite} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {customIngredients.map((ingredient, index) => (
            <View key={index} style={styles.customIngredientCard}>
              <View style={styles.customIngredientHeader}>
                <Text style={styles.customIngredientName}>{ingredient.name}</Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveCustomIngredient(index)}
                >
                  <Ionicons name="close" size={16} color={Colors.warning} />
                </TouchableOpacity>
              </View>
              <View style={styles.customGramInputContainer}>
                <TextInput
                  style={styles.customGramInput}
                  value={ingredient.grams.toString()}
                  onChangeText={(text: string) => handleCustomGramsChange(index, text)}
                  keyboardType="numeric"
                />
                <Text style={styles.customGramUnit}>g</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Meal Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Confirmed ingredients:</Text>
            <Text style={styles.summaryValue}>{confirmedCount} of {totalIngredients}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total estimated weight:</Text>
            <Text style={styles.summaryValue}>
              {Object.entries(adjustedPortions)
                .filter(([name]) => confirmations[name])
                .reduce((sum, [, grams]) => sum + grams, 0) +
                customIngredients.reduce((sum, ingredient) => sum + ingredient.grams, 0)}g
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!canProceed || loading) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!canProceed || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.backgroundWhite} />
          ) : (
            <Text style={styles.confirmButtonText}>Log Meal</Text>
          )}
        </TouchableOpacity>
        
        {!canProceed && (
          <Text style={styles.warningText}>
            Please confirm at least 2 ingredients to proceed
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    maxHeight: '100%', // Ensure it doesn't exceed parent height
  },
  dragHandleWrap: {
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  cancelButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    fontFamily: Fonts.body,
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  contentContainer: {
    paddingBottom: Spacing.md,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  mealImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: Spacing.sm,
  },
  imageText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Fonts.body,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
    fontFamily: Fonts.body,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontFamily: Fonts.body,
  },
  ingredientCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  ingredientCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  ingredientHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  confirmationCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  confirmationCheckboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
    fontFamily: Fonts.body,
  },
  ingredientNameDisabled: {
    opacity: 0.5,
  },
  ingredientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cookingState: {
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
    fontFamily: Fonts.body,
  },
  confidenceWarning: {
    fontSize: 12,
    color: Colors.warning,
    marginLeft: Spacing.sm,
    fontFamily: Fonts.body,
  },
  portionAdjustment: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  portionDetails: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  portionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.xs,
    fontFamily: Fonts.body,
  },
  portionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  portionInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  portionInput: {
    width: 80,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    fontFamily: Fonts.body,
  },
  gramsUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
    fontFamily: Fonts.body,
  },
  portionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portionValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginHorizontal: Spacing.lg,
  },
  portionGrams: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    fontFamily: Fonts.body,
  },
  portionUnit: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 2,
    fontFamily: Fonts.body,
  },
  visualReasoning: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  visualReasoningText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: Fonts.body,
    marginBottom: 2,
  },
  visualMethod: {
    fontSize: 10,
    color: Colors.primary,
    textAlign: 'center',
    fontFamily: Fonts.body,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    fontFamily: Fonts.body,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Fonts.body,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    fontFamily: Fonts.body,
  },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.border,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.background,
    fontFamily: Fonts.body,
  },
  warningText: {
    fontSize: 12,
    color: Colors.warning,
    textAlign: 'center',
    fontFamily: Fonts.body,
  },
  // Add ingredient styles
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  addIngredientButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIngredientForm: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  closeFormButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  gramInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: 16,
    color: Colors.text,
    fontFamily: Fonts.body,
  },
  gramInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  gramInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: 16,
    color: Colors.text,
    fontFamily: Fonts.body,
    marginRight: Spacing.sm,
  },
  gramUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
    fontFamily: Fonts.body,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  addButtonDisabled: {
    backgroundColor: Colors.border,
  },
  addButtonText: {
    color: Colors.backgroundWhite,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.body,
  },
  customIngredientCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  customIngredientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  customIngredientName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    fontFamily: Fonts.body,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customGramInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customGramInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: 16,
    color: Colors.text,
    fontFamily: Fonts.body,
    marginRight: Spacing.xs,
    textAlign: 'center',
  },
  customGramUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
    fontFamily: Fonts.body,
  },
});

