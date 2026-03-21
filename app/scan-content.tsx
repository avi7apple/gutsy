import { Colors } from "@/constants/theme";
import { getOnboardingProfile, type OnboardingProfile } from "@/lib/onboarding-storage";
import { getPendingScanResult } from "@/lib/scan-result-store";
import type { ScanResult } from "@/types/scan";
import { Ionicons } from "@expo/vector-icons";
import { Camera, CameraView } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Dimensions, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScanResultSheet } from "./scan-result-sheet";

const { width: screenWidth } = Dimensions.get("window");

interface ScanScreenContentProps {
  variant: "app" | "onboarding";
  previousTab?: string;
}

export function ScanScreenContent({ variant, previousTab }: ScanScreenContentProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [currentScanResult, setCurrentScanResult] = useState<ScanResult | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);
  const [loggedAsEaten, setLoggedAsEaten] = useState(false);
  const [savedAlternatives, setSavedAlternatives] = useState<any[] | null>(null);
  
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };

    getCameraPermissions();
    loadProfile();
    checkPendingResult();
  }, []);

  const loadProfile = async () => {
    try {
      const profileData = await getOnboardingProfile();
      setProfile(profileData);
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const checkPendingResult = async () => {
    try {
      const pending = await getPendingScanResult();
      if (pending) {
        setCurrentScanResult(pending);
        setShowResult(true);
        setScanned(true);
        // getPendingScanResult() already clears the pending result
      }
    } catch (error) {
      console.error("Error checking pending result:", error);
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    try {
      // For now, create a mock result - in the real app this would call the scan analysis
      const mockResult: ScanResult = {
        scan_type: "barcode",
        food_name: "Scanned Product",
        barcode: data,
        gut_score: 75,
        bloat_score: 6,
        skin_score: 8,
        energy_score: 7,
        digestion_score: 8.5,
        nutrition: {
          calories: 200,
          protein_g: 10,
          carbs_g: 30,
          fat_g: 8,
          fiber_g: 5,
          sugar_g: 12,
          sodium_mg: 300,
          saturated_fat_g: 3,
        },
        ingredients: ["Ingredient 1", "Ingredient 2", "Ingredient 3"],
        identified_foods: ["Scanned Product"],
        analysis: {
          summary: "This is a scanned product with moderate nutritional value.",
          tips: ["Consider portion size", "Balance with vegetables"],
          serving_size_display: "100g",
        },
      };

      setCurrentScanResult(mockResult);
      setShowResult(true);
    } catch (error) {
      console.error("Error processing scan:", error);
      Alert.alert("Error", "Failed to process scan. Please try again.");
      setScanned(false);
    }
  };

  const handleDismiss = () => {
    setShowResult(false);
    setCurrentScanResult(null);
    setScanned(false);
    setSaved(false);
    setSavedScanId(null);
    setLoggedAsEaten(false);
    setSavedAlternatives(null);
  };

  const handleContinue = () => {
    if (variant === "onboarding") {
      router.push("/onboarding/analyze-first");
    } else {
      handleDismiss();
    }
  };

  const handleScanAgain = () => {
    handleDismiss();
  };

  const handleLogAsEaten = async () => {
    if (!currentScanResult || loggedAsEaten) return;
    
    // Implementation for logging as eaten would go here
    setLoggedAsEaten(true);
  };

  const handleSave = async () => {
    if (!currentScanResult || saving || saved) return;
    
    setSaving(true);
    try {
      // Implementation for saving scan would go here
      setSaved(true);
      setSavedScanId(Date.now().toString()); // Use timestamp as ID
    } catch (error) {
      console.error("Error saving scan:", error);
      Alert.alert("Error", "Failed to save scan.");
    } finally {
      setSaving(false);
    }
  };

  const toggleFlash = () => {
    setFlashEnabled(!flashEnabled);
  };

  if (hasPermission === null) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.message}>No access to camera</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.buttonText}>Go to Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showResult && currentScanResult) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScanResultSheet
          variant="page"
          result={currentScanResult}
          profile={profile}
          onDismiss={handleDismiss}
          onContinue={handleContinue}
          saved={saved}
          saving={saving}
          savedScanId={savedScanId}
          loggedAsEaten={loggedAsEaten}
          onLogAsEaten={handleLogAsEaten}
          onScanAgain={handleScanAgain}
          fromOnboarding={variant === "onboarding"}
          savedAlternatives={savedAlternatives}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (variant === "onboarding") {
              router.back();
            } else {
              if (previousTab === "index") {
                router.push("/(tabs)/");
              } else {
                router.back();
              }
            }
          }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        
        <Text style={styles.title}>
          {variant === "onboarding" ? "Scan a Product" : "Scan"}
        </Text>
        
        <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
          <Ionicons 
            name={flashEnabled ? "flash" : "flash-off"} 
            size={24} 
            color={Colors.text} 
          />
        </TouchableOpacity>
      </View>

      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        enableTorch={flashEnabled}
      />

      {/* Scanner Overlay */}
      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={styles.scanCorner} />
          <View style={[styles.scanCorner, styles.topRight]} />
          <View style={[styles.scanCorner, styles.bottomLeft]} />
          <View style={[styles.scanCorner, styles.bottomRight]} />
        </View>
        
        <Text style={styles.scanText}>
          Position barcode within the frame
        </Text>
        
        <Text style={styles.subText}>
          Scanning will happen automatically
        </Text>
      </View>

      {/* Manual Input Option */}
      <View style={styles.manualInputContainer}>
        <TouchableOpacity style={styles.manualInputButton}>
          <Ionicons name="keypad-outline" size={20} color={Colors.primary} />
          <Text style={styles.manualInputText}>Enter Code Manually</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
  },
  flashButton: {
    padding: 8,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: 250,
    height: 250,
    position: "relative",
  },
  scanCorner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.primary,
    top: 0,
    left: 0,
  },
  topRight: {
    top: 0,
    left: "auto",
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    top: "auto",
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
  },
  bottomRight: {
    top: "auto",
    bottom: 0,
    left: "auto",
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanText: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.text,
    marginTop: 40,
    textAlign: "center",
  },
  subText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  manualInputContainer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  manualInputButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  manualInputText: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.primary,
  },
  message: {
    fontSize: 16,
    color: Colors.text,
    textAlign: "center",
    margin: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    margin: 20,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default function ScanScreen() {
  const { previousTab } = useLocalSearchParams<{ previousTab?: string }>();
  return (
    <ScanScreenContent
      variant="app"
      previousTab={previousTab ?? "index"}
    />
  );
}
