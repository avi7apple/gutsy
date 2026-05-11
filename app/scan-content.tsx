import { MealConfirmationScreen } from "@/components/MealConfirmationScreen";
import { Colors } from "@/constants/theme";
import { analyzeScan, ProductNotFoundError } from "@/lib/analyze-scan";
import { rf, rs, useBreakpoint } from "@/lib/hooks/use-responsive";
import { getOnboardingProfile, type OnboardingProfile } from "@/lib/onboarding-storage";
import {
  getLearnedPortionPriorsForCurrentUser,
  getVisualPortionPriorsForCurrentUser,
  recordPortionCorrectionsForCurrentUser,
  recordVisualPortionCorrectionsForCurrentUser,
} from "@/lib/portion-learning";
import { getAlternatives, serializeAlternativesForStorage, type AlternativeProduct } from "@/lib/product-alternatives";
import { getPendingScanResult } from "@/lib/scan-result-store";
import { updateUserStreak } from "@/lib/streak-calculator";
import { supabase } from "@/lib/supabase";
import type {
  CameraCaptureMetadata,
  MealComponent,
  PortionAdjustment,
  PortionLearningPrior,
  ScanResult,
  VisualPortionPrior,
} from "@/types/scan";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CameraView } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Dimensions,
  Easing,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScanResultSheet } from "./scan-result-sheet";

type ScanMode = "barcode" | "photo";
type ScanState = "idle" | "detecting" | "analyzing" | "processing" | "complete" | "error";
type ErrorType = "camera_permission" | "product_not_found" | "network_error" | "analysis_error" | "barcode_damaged" | "multiple_items";

interface ScanScreenContentProps {
  variant: "app" | "onboarding";
  previousTab?: string;
}

const PHOTO_FRAME_SIZE = 280;
const BARCODE_FRAME_WIDTH = 320;
const BARCODE_FRAME_HEIGHT = 120;
const BARCODE_FRAME_VERTICAL_OFFSET = -78;
const PHOTO_FRAME_VERTICAL_OFFSET = -140;
const SCAN_TARGET_TOLERANCE = 4;
const BARCODE_MIN_SCAN_QUALITY = 0.22;
const BARCODE_FAST_SCAN_QUALITY = 0.32;
const BARCODE_MOVEMENT_TOLERANCE = 40;
const FALLBACK_SHEET_HEIGHT = 720;
const MIN_VISIBLE_SHEET_HEIGHT = 420;

export function ScanScreenContent({ variant, previousTab }: ScanScreenContentProps) {
  const queryClient = useQueryClient();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>("barcode");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanned, setScanned] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isActivelyScanning, setIsActivelyScanning] = useState(false);
  const [detectionQuality, setDetectionQuality] = useState<number>(0);
  const [scanGuidance, setScanGuidance] = useState<string>("");
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStageMessage, setAnalysisStageMessage] = useState("Analyzing photo");
  const [lookupPhase, setLookupPhase] = useState<'searching' | 'off' | 'secondary' | 'notfound'>('searching');
  const flashEnabled = false;
  const [showResult, setShowResult] = useState(false);
  const [sheetFullScreen, setSheetFullScreen] = useState(false);
  const [currentScanResult, setCurrentScanResult] = useState<ScanResult | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);
  const [loggedAsEaten, setLoggedAsEaten] = useState(false);
  const [savedAlternatives, setSavedAlternatives] = useState<AlternativeProduct[] | null>(null);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [showMealConfirmation, setShowMealConfirmation] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | undefined>(undefined);
  const [capturedPhotoMetadata, setCapturedPhotoMetadata] = useState<CameraCaptureMetadata | undefined>(undefined);
  const [learnedPortionPriors, setLearnedPortionPriors] = useState<PortionLearningPrior[]>([]);
  const [visualPortionPriors, setVisualPortionPriors] = useState<VisualPortionPrior[]>([]);
  
  const breakpoint = useBreakpoint();
  const isSmallScreen = breakpoint === "small";
  const isCompactScreen = breakpoint === "small" || breakpoint === "medium";

  const cameraRef = useRef<CameraView>(null);
  const isProcessingScanRef = useRef(false);
  const scanningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBarcodeCenterRef = useRef<{ x: number; y: number } | null>(null);
  const showResultRef = useRef(false);
  const sheetFullScreenRef = useRef(false);
  const savedScanIdRef = useRef<string | null>(null);
  const alternativesRequestIdRef = useRef(0);
  const persistInFlightRef = useRef(false);
  const pendingPersistRef = useRef<{ result: ScanResult; alternatives?: AlternativeProduct[] } | null>(null);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = Dimensions.get("window");
  const safeWindowHeight = Number.isFinite(windowHeight) && windowHeight > 0 ? windowHeight : FALLBACK_SHEET_HEIGHT;
  const collapsedSheetHeight = Math.max(MIN_VISIBLE_SHEET_HEIGHT, safeWindowHeight * 0.84);
  const fullScreenHeight = Math.max(MIN_VISIBLE_SHEET_HEIGHT, safeWindowHeight);
  const sheetHeightAnim = useRef(new Animated.Value(collapsedSheetHeight)).current;
  const scanLineProgress = useRef(new Animated.Value(0)).current;
  const detectionPulse = useRef(new Animated.Value(1)).current;
  const qualityIndicator = useRef(new Animated.Value(0)).current;

  const frameMetrics = useMemo(() => {
    const sizeScale = isSmallScreen ? 0.88 : 1;
    const offsetScale = isSmallScreen ? 0.85 : 1;
    return {
      photoSize: rs(PHOTO_FRAME_SIZE * sizeScale),
      barcodeWidth: rs(BARCODE_FRAME_WIDTH * sizeScale),
      barcodeHeight: rs(BARCODE_FRAME_HEIGHT * sizeScale),
      barcodeOffset: rs(BARCODE_FRAME_VERTICAL_OFFSET * offsetScale),
      photoOffset: rs(PHOTO_FRAME_VERTICAL_OFFSET * offsetScale),
    };
  }, [isSmallScreen]);

  const ensureCameraPermission = useCallback(async () => {
    try {
      const { status: currentStatus } = await Camera.getCameraPermissionsAsync();
      if (currentStatus === "granted") {
        setHasPermission(true);
      } else {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === "granted");
      }
    } catch (error) {
      console.error("[Scan] Camera permission error:", error);
      setHasPermission(false);
    }
  }, []);

  const scanLineTranslate = scanLineProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (scanMode === "barcode" ? frameMetrics.barcodeHeight : frameMetrics.photoSize) - 4],
  });

  // Premium feedback functions (simplified for compatibility)
  const triggerHapticFeedback = useCallback(async (type: "light" | "medium" | "heavy" | "success" | "error") => {
    try {
      // Import haptics dynamically to avoid import issues
      const Haptics = await import("expo-haptics");
      switch (type) {
        case "light":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case "medium":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case "heavy":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case "success":
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case "error":
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    } catch (error) {
      // Silently fail if haptics not available
      console.log("Haptic feedback not available:", error);
    }
  }, []);

  const updateScanGuidance = useCallback((quality: number, mode: ScanMode) => {
    if (mode === "barcode") {
      if (quality < 0.25) {
        setScanGuidance("Move a little closer. We'll scan as soon as the barcode is visible");
      } else if (quality < BARCODE_MIN_SCAN_QUALITY) {
        setScanGuidance("Hold steady and keep barcode in view");
      } else {
        setScanGuidance("Barcode locked — analyzing...");
      }
    } else {
      if (quality < 0.3) {
        setScanGuidance("Improve lighting for better results");
      } else if (quality < 0.6) {
        setScanGuidance("Good - hold steady for capture");
      } else {
        setScanGuidance("Ready to capture!");
      }
    }
  }, []);

  const animateDetectionPulse = useCallback(() => {
    detectionPulse.setValue(1);
    Animated.sequence([
      Animated.timing(detectionPulse, {
        toValue: 1.2,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(detectionPulse, {
        toValue: 1,
        duration: 800,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [detectionPulse]);

  const animateQualityIndicator = useCallback((quality: number) => {
    Animated.timing(qualityIndicator, {
      toValue: quality,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [qualityIndicator]);

  const getFrameCenter = useCallback((mode: ScanMode) => {
    const { width, height } = Dimensions.get("window");
    const frameWidth = mode === "barcode" ? frameMetrics.barcodeWidth : frameMetrics.photoSize;
    const frameHeight = mode === "barcode" ? frameMetrics.barcodeHeight : frameMetrics.photoSize;
    const offset = mode === "barcode" ? frameMetrics.barcodeOffset : frameMetrics.photoOffset;
    const frameTop = height / 2 + offset - frameHeight / 2;
    const frameLeft = (width - frameWidth) / 2;

    return {
      left: frameLeft,
      right: frameLeft + frameWidth,
      top: frameTop,
      bottom: frameTop + frameHeight,
    };
  }, [frameMetrics.barcodeHeight, frameMetrics.barcodeOffset, frameMetrics.barcodeWidth, frameMetrics.photoOffset, frameMetrics.photoSize]);

  // Helper functions
  const calculateDetectionQuality = useCallback((scanEvent: any): number => {
    const bounds = scanEvent.bounds;
    if (!bounds?.size) return 0.3;
    
    const { width, height } = bounds.size;
    const frameArea = frameMetrics.barcodeWidth * frameMetrics.barcodeHeight;
    const barcodeArea = width * height;
    
    // Quality based on how much of frame the barcode occupies
    const sizeQuality = Math.min(barcodeArea / frameArea, 1);
    
    // Position quality - center is better
    const center = getScanCenterPoint(scanEvent);
    if (!center) return sizeQuality * 0.5;
    
    const frame = getFrameCenter("barcode");
    const frameCenterX = (frame.left + frame.right) / 2;
    const frameCenterY = (frame.top + frame.bottom) / 2;
    
    const distanceX = Math.abs(center.x - frameCenterX) / (frame.right - frame.left);
    const distanceY = Math.abs(center.y - frameCenterY) / (frame.bottom - frame.top);
    const positionQuality = Math.max(0, 1 - (distanceX + distanceY) / 2);
    
    return (sizeQuality * 0.6 + positionQuality * 0.4);
  }, [frameMetrics.barcodeHeight, frameMetrics.barcodeWidth, getFrameCenter]);

  const resetScanState = useCallback(() => {
    setScanned(false);
    setIsActivelyScanning(false);
    setIsAnalyzing(false);
    setScanState("idle");
    setDetectionQuality(0);
    setScanGuidance("");
    setErrorType(null);
    setAnalysisProgress(0);
    setAnalysisStageMessage("Analyzing photo");
    setLookupPhase('searching');
    isProcessingScanRef.current = false;
    if (scanningTimeoutRef.current) {
      clearTimeout(scanningTimeoutRef.current);
      scanningTimeoutRef.current = null;
    }
    lastBarcodeCenterRef.current = null;
  }, []);

  const buildPhotoErrorMessage = useCallback((error: unknown) => {
    const msg = error instanceof Error ? error.message.toLowerCase() : "";
    if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch")) {
      return {
        type: "network_error" as ErrorType,
        title: "Connection Issue",
        body: "We couldn't reach the analysis service. Check your connection and try again.",
      };
    }
    if (msg.includes("capture") || msg.includes("camera")) {
      return {
        type: "analysis_error" as ErrorType,
        title: "Capture Failed",
        body: "Couldn't capture a clear image. Hold steady and try again.",
      };
    }
    return {
      type: "analysis_error" as ErrorType,
      title: "Photo Analysis Error",
      body: "We couldn't complete this scan. Please retake the photo once and keep the full meal in frame.",
    };
  }, []);

  const shouldOpenMealConfirmation = useCallback((result: ScanResult) => {
    return !!result.isMeal;
  }, []);

  const extractCameraMetadata = useCallback((photo: {
    width?: number;
    height?: number;
    exif?: Record<string, unknown>;
  }): CameraCaptureMetadata => {
    const exif = photo.exif ?? {};
    const readNumber = (keys: string[]): number | undefined => {
      for (const key of keys) {
        const value = exif[key];
        if (typeof value === "number" && isFinite(value)) return value;
        if (typeof value === "string") {
          const n = Number(value);
          if (isFinite(n)) return n;
        }
      }
      return undefined;
    };

    const depthMeters = readNumber(["SubjectDistance", "subjectDistance", "Distance", "distance"]);
    const focalLength = readNumber(["FocalLength", "focalLength", "FocalLenIn35mmFilm"]);
    const zoomRatio = readNumber(["DigitalZoomRatio", "digitalZoomRatio", "ZoomRatio"]);

    return {
      width: typeof photo.width === "number" ? photo.width : undefined,
      height: typeof photo.height === "number" ? photo.height : undefined,
      focalLengthMm: focalLength,
      digitalZoomRatio: zoomRatio,
      subjectDistanceM: depthMeters,
      hasDepthData: typeof depthMeters === "number" && depthMeters > 0,
    };
  }, []);

  const uploadCapturedPhotoToStorage = useCallback(async (photoUri: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const response = await fetch(photoUri);
      const blob = await response.blob();
      const ext = (photoUri.split(".").pop() || "jpg").split("?")[0] || "jpg";
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const contentType = blob.type || "image/jpeg";

      const bucketCandidates = ["scan-images", "meal-photos"];
      for (const bucket of bucketCandidates) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, blob, { contentType, upsert: false });

        if (!uploadError) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
          return {
            image_url: data.publicUrl,
            image_storage_path: `${bucket}/${filePath}`,
          };
        }
      }

      return null;
    } catch (error) {
      console.warn("[scan] Failed to upload captured photo:", error);
      return null;
    }
  }, []);

  const persistScanResult = useCallback(async (result: ScanResult, alternatives?: AlternativeProduct[]) => {
    if (persistInFlightRef.current) {
      pendingPersistRef.current = { result, alternatives };
      return;
    }
    persistInFlightRef.current = true;
    pendingPersistRef.current = null;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const payload: Record<string, unknown> = {
        scan_type: result.scan_type,
        food_name: result.food_name || result.product_name || "Scanned item",
        product_name: result.product_name ?? result.food_name ?? null,
        identified_foods: Array.isArray(result.identified_foods) ? result.identified_foods : [],
        barcode: result.barcode ?? null,
        image_url: result.image_url ?? null,
        image_storage_path: result.image_storage_path ?? null,
        gut_score: typeof result.gut_score === "number" ? Math.round(result.gut_score) : null,
        bloat_score: typeof result.bloat_score === "number" ? result.bloat_score : null,
        skin_score: typeof result.skin_score === "number" ? result.skin_score : null,
        energy_score: typeof result.energy_score === "number" ? result.energy_score : null,
        digestion_score: typeof result.digestion_score === "number" ? result.digestion_score : null,
        analysis: {
          ...result.analysis,
          manufacturer: result.manufacturer,
          ingredients: result.ingredients,
          gut_score: result.gut_score,
        },
        ingredient_analysis: result.analysis.ingredientAnalysis ?? null,
        nutrition: result.nutrition ?? {},
        ai_confidence: typeof result.ai_confidence === "number" ? result.ai_confidence : null,
      };

      if (alternatives !== undefined) {
        payload.alternatives = serializeAlternativesForStorage(alternatives);
      }

      if (savedScanIdRef.current) {
        const { data, error } = await supabase
          .from("meal_scans")
          .update(payload)
          .eq("id", savedScanIdRef.current)
          .eq("user_id", user.id)
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) {
          savedScanIdRef.current = data.id;
          setSavedScanId(data.id);
        }
        
        // Invalidate queries to update home page recent scans and history page
        queryClient.invalidateQueries({ queryKey: ["scansForDay"] });
        queryClient.invalidateQueries({ queryKey: ["allScans"] });
        queryClient.invalidateQueries({ queryKey: ["recentScans"] });
      } else {
        const { data, error } = await supabase
          .from("meal_scans")
          .insert({ ...payload, user_id: user.id, logged_as_eaten: false })
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) {
          savedScanIdRef.current = data.id;
          setSavedScanId(data.id);
        }
      }

      // Invalidate queries to update home page recent scans and history page
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      queryClient.invalidateQueries({ queryKey: ["scansForDay", todayKey] });
      queryClient.invalidateQueries({ queryKey: ["scansForDay"] }); // Invalidate all date keys
      queryClient.invalidateQueries({ queryKey: ["allScans"] });
      queryClient.invalidateQueries({ queryKey: ["recentScans"] });
      
      // Force immediate refetch of user stats for streak update
      queryClient.invalidateQueries({ queryKey: ["userStats"] });
      queryClient.refetchQueries({ queryKey: ["userStats"] });

      // Update user streak after successful scan save
      await updateUserStreak(user.id);
      
      // Force another refetch after updating streak
      queryClient.refetchQueries({ queryKey: ["userStats"] });

      setSaved(true);
    } catch (error) {
      console.warn("[scan] Failed to persist scan result:", error);
    } finally {
      setSaving(false);
      persistInFlightRef.current = false;

      const pending = pendingPersistRef.current;
      pendingPersistRef.current = null;
      if (pending) {
        const { result: pendingResult, alternatives: pendingAlternatives } = pending;
        void persistScanResult(pendingResult, pendingAlternatives);
      }
    }
  }, [queryClient]);

  const loadAlternativesForResult = useCallback(async (result: ScanResult) => {
    const requestId = alternativesRequestIdRef.current + 1;
    alternativesRequestIdRef.current = requestId;

    setAlternativesLoading(true);
    setSavedAlternatives(null);

    try {
      const alternatives = await getAlternatives(result, profile, { maxCount: 6 });
      if (alternativesRequestIdRef.current !== requestId) return;

      setSavedAlternatives(alternatives);
      if (alternatives.length > 0) {
        void persistScanResult(result, alternatives);
      }
    } catch (error) {
      if (alternativesRequestIdRef.current !== requestId) return;
      console.warn("[scan] Failed to load alternatives:", error);
      setSavedAlternatives([]);
    } finally {
      if (alternativesRequestIdRef.current === requestId) {
        setAlternativesLoading(false);
      }
    }
  }, [persistScanResult, profile]);

  const presentScanResult = useCallback((result: ScanResult) => {
    setCurrentScanResult(result);
    setShowMealConfirmation(false);
    setSheetFullScreen(true);
    const targetHeight = Number.isFinite(fullScreenHeight) && fullScreenHeight > 0 ? fullScreenHeight : FALLBACK_SHEET_HEIGHT;
    sheetHeightAnim.setValue(targetHeight);
    setShowResult(false);
    requestAnimationFrame(() => {
      setShowResult(true);
    });
  }, [fullScreenHeight, sheetHeightAnim]);

  const applyMealConfirmation = useCallback(
    (
      baseResult: ScanResult,
      confirmations: Record<string, boolean>,
      adjustedPortions: Record<string, number>,
      customIngredients?: { name: string; grams: number }[]
    ): ScanResult => {
      const normalizedConfirmations: Record<string, boolean> = { ...confirmations };
      const custom = customIngredients ?? [];

      for (const ingredient of custom) {
        normalizedConfirmations[ingredient.name] = true;
      }

      const filteredComponents: MealComponent[] = (baseResult.mealComponents ?? [])
        .filter((component) => normalizedConfirmations[component.ingredient.name] !== false)
        .map((component) => {
          const grams = adjustedPortions[component.ingredient.name] ?? component.portion.estimatedGrams;
          return {
            ...component,
            ingredient: {
              ...component.ingredient,
              estimatedGrams: grams,
            },
            portion: {
              ...component.portion,
              estimatedGrams: grams,
            },
          };
        });

      const adjustedPortionAdjustments: PortionAdjustment[] = (baseResult.portionAdjustments ?? [])
        .filter((portion) => normalizedConfirmations[portion.ingredientName] !== false)
        .map((portion) => {
          const grams = adjustedPortions[portion.ingredientName] ?? portion.currentGrams;
          return {
            ...portion,
            currentGrams: grams,
            suggestedGrams: grams,
          };
        });

      const customNames = custom.map((item) => item.name);
      const confirmedFromComponents = filteredComponents.map((component) => component.ingredient.name);

      return {
        ...baseResult,
        mealComponents: filteredComponents,
        portionAdjustments: adjustedPortionAdjustments,
        ingredientConfirmations: normalizedConfirmations,
        identified_foods: [...confirmedFromComponents, ...customNames],
      };
    },
    []
  );

  const handleMealConfirmationConfirm = useCallback(
    async (
      confirmations: Record<string, boolean>,
      adjustedPortions: Record<string, number>,
      customIngredients?: { name: string; grams: number }[]
    ) => {
      if (!currentScanResult) {
        setShowMealConfirmation(false);
        return;
      }

      const components = currentScanResult.mealComponents ?? [];
      const portionAdjustments = currentScanResult.portionAdjustments ?? [];
      const imageDimensions =
        capturedPhotoMetadata?.width && capturedPhotoMetadata?.height
          ? { width: capturedPhotoMetadata.width, height: capturedPhotoMetadata.height }
          : undefined;

      if (currentScanResult.isMeal && portionAdjustments.length > 0) {
        const corrections = portionAdjustments.map((portion) => {
          const component = components.find((c) => c.ingredient.name === portion.ingredientName);
          const corrected = adjustedPortions[portion.ingredientName] ?? portion.currentGrams;
          const predicted = portion.suggestedGrams ?? portion.currentGrams;
          const confirmed = confirmations[portion.ingredientName] !== false;
          return {
            ingredientName: portion.ingredientName,
            predictedGrams: predicted,
            correctedGrams: corrected,
            confirmed,
            boundingBox: component?.ingredient.boundingBox,
            itemCount: component?.ingredient.itemCount,
            imageDimensions,
          };
        });

        await Promise.all([
          recordPortionCorrectionsForCurrentUser(corrections),
          recordVisualPortionCorrectionsForCurrentUser(corrections),
        ]);
      }

      const finalized = applyMealConfirmation(
        currentScanResult,
        confirmations,
        adjustedPortions,
        customIngredients
      );
      setCurrentScanResult(finalized);
      setShowMealConfirmation(false);
      setShowResult(true);
      setScanState("complete");
      void loadAlternativesForResult(finalized);
      void persistScanResult(finalized);
    },
    [
      applyMealConfirmation,
      capturedPhotoMetadata?.height,
      capturedPhotoMetadata?.width,
      currentScanResult,
      loadAlternativesForResult,
      persistScanResult,
    ]
  );

  const handleMealConfirmationCancel = useCallback(() => {
    setShowMealConfirmation(false);
    resetScanState();
  }, [resetScanState]);

  useEffect(() => {
    showResultRef.current = showResult;
  }, [showResult]);

  useEffect(() => {
    sheetFullScreenRef.current = sheetFullScreen;
  }, [sheetFullScreen]);

  useEffect(() => {
    savedScanIdRef.current = savedScanId;
  }, [savedScanId]);

  useEffect(() => {
    const shouldAnimateScanLine = scanMode === "barcode" && isActivelyScanning && !scanned && !isAnalyzing && !showResult;
    if (!shouldAnimateScanLine) {
      scanLineProgress.stopAnimation();
      scanLineProgress.setValue(0);
      return;
    }

    scanLineProgress.setValue(0);
    const loopAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineProgress, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineProgress, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.linear),
          useNativeDriver: true,
        }),
      ])
    );

    loopAnimation.start();

    return () => {
      loopAnimation.stop();
    };
  }, [scanMode, showResult, scanned, isAnalyzing, isActivelyScanning, scanLineProgress]);

  const getScanCenterPoint = (scanEvent: {
    bounds?: {
      origin?: { x: number; y: number };
      size?: { width: number; height: number };
    };
    cornerPoints?: { x: number; y: number }[];
  }) => {
    const bounds = scanEvent.bounds;
    if (bounds?.origin && bounds?.size) {
      return {
        x: bounds.origin.x + bounds.size.width / 2,
        y: bounds.origin.y + bounds.size.height / 2,
      };
    }

    const points = scanEvent.cornerPoints;
    if (points && points.length > 0) {
      const total = points.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 }
      );
      return { x: total.x / points.length, y: total.y / points.length };
    }

    return null;
  };

  const isInsideScanTarget = (scanEvent: {
    bounds?: {
      origin?: { x: number; y: number };
      size?: { width: number; height: number };
    };
    cornerPoints?: { x: number; y: number }[];
  }) => {
    const center = getScanCenterPoint(scanEvent);
    if (!center) return false;

    const frame = getFrameCenter("barcode");
    return (
      center.x >= frame.left + SCAN_TARGET_TOLERANCE &&
      center.x <= frame.right - SCAN_TARGET_TOLERANCE &&
      center.y >= frame.top + SCAN_TARGET_TOLERANCE &&
      center.y <= frame.bottom - SCAN_TARGET_TOLERANCE
    );
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      void ensureCameraPermission();

      if (showResultRef.current && currentScanResult) {
        const targetHeight = Number.isFinite(fullScreenHeight) && fullScreenHeight > 0 ? fullScreenHeight : FALLBACK_SHEET_HEIGHT;
        sheetHeightAnim.setValue(targetHeight);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [currentScanResult, ensureCameraPermission, fullScreenHeight, sheetHeightAnim]);

  const loadProfile = useCallback(async () => {
    try {
      const [profileData, learnedPriors, visualPriors] = await Promise.all([
        getOnboardingProfile(),
        getLearnedPortionPriorsForCurrentUser(),
        getVisualPortionPriorsForCurrentUser(),
      ]);
      setProfile(profileData);
      setLearnedPortionPriors(learnedPriors);
      setVisualPortionPriors(visualPriors);
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  }, []);

  const checkPendingResult = useCallback(async () => {
    try {
      const pending = await getPendingScanResult();
      if (pending) {
        setCurrentScanResult(pending);
        setSheetFullScreen(true);
        const targetHeight = Number.isFinite(fullScreenHeight) && fullScreenHeight > 0 ? fullScreenHeight : FALLBACK_SHEET_HEIGHT;
        sheetHeightAnim.setValue(targetHeight);
        setShowResult(false);
        requestAnimationFrame(() => {
          setShowResult(true);
        });
        setScanned(true);
        // getPendingScanResult() already clears the pending result
      }
    } catch (error) {
      console.error("Error checking pending result:", error);
    }
  }, [fullScreenHeight, sheetHeightAnim]);

  useEffect(() => {
    ensureCameraPermission();
    void loadProfile();
    void checkPendingResult();
  }, [checkPendingResult, ensureCameraPermission, loadProfile]);

  const handleBarCodeScanned = async (scanEvent: {
    type: string;
    data: string;
    bounds?: {
      origin?: { x: number; y: number };
      size?: { width: number; height: number };
    };
    cornerPoints?: { x: number; y: number }[];
  }) => {
    if (scanMode !== "barcode" || scanned || isAnalyzing || isProcessingScanRef.current) return;

    const beginBarcodeAnalysis = async (barcodeData: string) => {
      isProcessingScanRef.current = true;
      setIsActivelyScanning(false);
      setScanState("analyzing");
      triggerHapticFeedback("heavy");
      
      setScanned(true);
      setIsAnalyzing(true);
      setAnalysisProgress(25);
      setLookupPhase('searching'); // Immediate feedback
      
      try {
        const result = await analyzeScan(
          {
            scan_type: "barcode",
            barcode: barcodeData,
          },
          profile,
          (quickResult) => {
            setAnalysisProgress(100);
            setLookupPhase('searching');
            // Only update current result, don't present yet - wait for full analysis
            setCurrentScanResult(quickResult);
          }
        );
        
        setAnalysisProgress(100);
        setScanState("complete");
        triggerHapticFeedback("success");
        presentScanResult(result);
        void loadAlternativesForResult(result);
        void persistScanResult(result);
      } catch (error) {
        setLookupPhase('notfound');
        if (error instanceof ProductNotFoundError) {
          setErrorType("product_not_found");
          setScanState("error");
          triggerHapticFeedback("error");
          Alert.alert(
            "Product Not Found", 
            "This product isn't in our database yet. Try scanning a different product or use Photo mode instead.",
            [{ text: "OK", onPress: () => resetScanState() }]
          );
        } else {
          setErrorType("analysis_error");
          setScanState("error");
          triggerHapticFeedback("error");
          Alert.alert(
            "Scan Error", 
            "Unable to process the scan. Please check the barcode and try again.",
            [{ text: "OK", onPress: () => resetScanState() }]
          );
        }
        setScanned(false);
        setIsActivelyScanning(false);
      } finally {
        setIsAnalyzing(false);
        isProcessingScanRef.current = false;
      }
    };

    // Calculate detection quality based on barcode size and position
    const baseQuality = calculateDetectionQuality(scanEvent);

    const center = getScanCenterPoint(scanEvent);
    let movementAdjustedQuality = baseQuality;
    if (center && lastBarcodeCenterRef.current) {
      const dx = center.x - lastBarcodeCenterRef.current.x;
      const dy = center.y - lastBarcodeCenterRef.current.y;
      const movement = Math.sqrt(dx * dx + dy * dy);
      const movementFactor = movement <= BARCODE_MOVEMENT_TOLERANCE
        ? 1
        : Math.max(0.65, 1 - (movement - BARCODE_MOVEMENT_TOLERANCE) / 220);
      movementAdjustedQuality = baseQuality * movementFactor;
    }
    if (center) {
      lastBarcodeCenterRef.current = center;
    }
    const quality = Math.max(0, Math.min(1, movementAdjustedQuality));

    setDetectionQuality(quality);
    animateQualityIndicator(quality);
    
    // Set actively scanning when barcode is detected in frame
    setIsActivelyScanning(true);
    setScanState("detecting");
    
    // Trigger haptic feedback for detection
    if (quality > 0.56) {
      triggerHapticFeedback("medium");
      animateDetectionPulse();
    }
    
    // Clear existing timeout and set a new one to reset after 2 seconds
    if (scanningTimeoutRef.current) {
      clearTimeout(scanningTimeoutRef.current);
    }
    scanningTimeoutRef.current = setTimeout(() => {
      setIsActivelyScanning(false);
      setScanState("idle");
      setScanGuidance("");
      lastBarcodeCenterRef.current = null;
    }, 1200);

    const insideTarget = isInsideScanTarget(scanEvent);
    if (!insideTarget && quality < BARCODE_MIN_SCAN_QUALITY) {
      updateScanGuidance(quality * 0.8, "barcode");
      return;
    }

    updateScanGuidance(quality, "barcode");
    if (quality >= BARCODE_FAST_SCAN_QUALITY || quality >= BARCODE_MIN_SCAN_QUALITY) {
      await beginBarcodeAnalysis(scanEvent.data);
    }
  };

  const handleCapturePhoto = async () => {
    if (scanMode !== "photo" || scanned || isAnalyzing || isProcessingScanRef.current) return;

    try {
      isProcessingScanRef.current = true;
      setScanState("analyzing");
      setScanned(true);
      setIsAnalyzing(true);
      setScanGuidance("Analyzing your meal ingredients and portions...");
      setAnalysisProgress(8);
      setAnalysisStageMessage("Preparing capture");

      const photo = await cameraRef.current?.takePictureAsync({
        base64: true,
        quality: 0.8,
        exif: true,
      });

      if (!photo?.base64) {
        throw new Error("Unable to capture photo");
      }

      setCapturedPhotoUri(photo.uri);
      const metadata = extractCameraMetadata(photo);
      setCapturedPhotoMetadata(metadata);
      
      setAnalysisProgress(16);
      setAnalysisStageMessage("Detecting ingredients");

      const result = await analyzeScan(
        {
          scan_type: "photo",
          image_base64: photo.base64,
          image_url: photo.uri,
          cameraMetadata: metadata,
          learnedPortionPriors,
          visualPortionPriors,
          mealDetection: {
            enableMealDetection: true,
          },
        },
        profile,
        undefined,
        (update) => {
          setAnalysisProgress(Math.max(10, Math.min(96, Math.round(update.progress))));
          setAnalysisStageMessage(update.message);
          setScanGuidance(update.message);
        }
      );

      let finalResult: ScanResult = result;
      if (result.isMeal) {
        const uploaded = await uploadCapturedPhotoToStorage(photo.uri);
        finalResult = {
          ...result,
          image_url: uploaded?.image_url ?? result.image_url ?? photo.uri,
          image_storage_path: uploaded?.image_storage_path ?? result.image_storage_path,
        };
      } else if (!result.image_url) {
        finalResult = {
          ...result,
          image_url: photo.uri,
        };
      }
      
      setAnalysisProgress(100);
      setAnalysisStageMessage("Finalizing result");

      setCurrentScanResult(finalResult);
      if (shouldOpenMealConfirmation(finalResult)) {
        setShowMealConfirmation(true);
        setShowResult(false);
        setScanState("processing");
        void persistScanResult(finalResult);
      } else {
        presentScanResult(finalResult);
        setScanState("complete");
        void loadAlternativesForResult(finalResult);
        void persistScanResult(finalResult);
      }
    } catch (error) {
      const photoError = buildPhotoErrorMessage(error);
      setErrorType(photoError.type);
      setScanState("error");
      setScanGuidance("Retake once and keep the full meal centered.");
      Alert.alert(
        photoError.title,
        photoError.body,
        [{ text: "OK", onPress: () => resetScanState() }]
      );
      setScanned(false);
      setIsActivelyScanning(false);
    } finally {
      setIsAnalyzing(false);
      isProcessingScanRef.current = false;
    }
  };

  const handleScanModeChange = (mode: ScanMode) => {
    if (isAnalyzing || mode === scanMode) return;
    setScanMode(mode);
    setScanned(false);
    setIsActivelyScanning(false);
    lastBarcodeCenterRef.current = null;
    setCapturedPhotoUri(undefined);
    setShowMealConfirmation(false);
    setScanGuidance(
      mode === "photo"
        ? "Center your meal in frame. We'll detect ingredients and estimate portions."
        : ""
    );
    if (scanningTimeoutRef.current) {
      clearTimeout(scanningTimeoutRef.current);
      scanningTimeoutRef.current = null;
    }
  };

  const handleDismiss = () => {
    setShowResult(false);
    setCurrentScanResult(null);
    setScanned(false);
    setSaved(false);
    setSavedScanId(null);
    savedScanIdRef.current = null;
    setLoggedAsEaten(false);
    setSavedAlternatives(null);
    setAlternativesLoading(false);
    setIsAnalyzing(false);
    setIsActivelyScanning(false);
    setSheetFullScreen(false);
    setShowMealConfirmation(false);
    setCapturedPhotoUri(undefined);
    setCapturedPhotoMetadata(undefined);
    // Reset premium state
    setScanState("idle");
    setDetectionQuality(0);
    setScanGuidance("");
    setErrorType(null);
    setAnalysisProgress(0);
    setAnalysisStageMessage("Analyzing photo");
    isProcessingScanRef.current = false;
    if (scanningTimeoutRef.current) {
      clearTimeout(scanningTimeoutRef.current);
      scanningTimeoutRef.current = null;
    }
    lastBarcodeCenterRef.current = null;
    alternativesRequestIdRef.current += 1;
    sheetHeightAnim.setValue(collapsedSheetHeight);
  };

  const navigateToPostScanOnboardingFlow = useCallback(() => {
    router.push("/try-free");
  }, [router]);

  const handleSkipOnboardingScan = useCallback(() => {
    if (variant !== "onboarding") return;
    navigateToPostScanOnboardingFlow();
  }, [navigateToPostScanOnboardingFlow, variant]);

  const handleContinue = () => {
    if (variant === "onboarding") {
      // Dismiss the modal first, then navigate after a short delay
      // so expo-router can push from the correct navigation context.
      setShowResult(false);
      setTimeout(() => {
        navigateToPostScanOnboardingFlow();
      }, 100);
    } else {
      handleDismiss();
    }
  };

  const handleScanAgain = () => {
    handleDismiss();
  };

  const handleLogAsEaten = async () => {
    if (!currentScanResult || saving || loggedAsEaten) return;

    if (!savedScanIdRef.current) {
      await persistScanResult(currentScanResult);
    }

    const scanId = savedScanIdRef.current;
    if (!scanId) return;

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("meal_scans")
        .update({ logged_as_eaten: true })
        .eq("id", scanId)
        .eq("user_id", user.id);

      if (error) throw error;
      
      // Invalidate queries to update home page recent scans and history page
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      queryClient.invalidateQueries({ queryKey: ["scansForDay", todayKey] });
      queryClient.invalidateQueries({ queryKey: ["scansForDay"] }); // Invalidate all date keys
      queryClient.invalidateQueries({ queryKey: ["allScans"] });
      queryClient.invalidateQueries({ queryKey: ["recentScans"] });
      queryClient.invalidateQueries({ queryKey: ["weekData"] });
      // IMPORTANT: only invalidate gutScore when the user explicitly logs a meal
      // as eaten. Scans alone must never change the home page scores.
      queryClient.invalidateQueries({ queryKey: ["gutScore"] });
      queryClient.refetchQueries({ queryKey: ["gutScore"] });

      // Force immediate refetch of user stats for streak update
      queryClient.invalidateQueries({ queryKey: ["userStats"] });
      queryClient.refetchQueries({ queryKey: ["userStats"] });
      
      // Update user streak after logging as eaten
      await updateUserStreak(user.id);
      
      // Force another refetch after updating streak
      queryClient.refetchQueries({ queryKey: ["userStats"] });
      
      setLoggedAsEaten(true);
    } catch (error) {
      console.warn("[scan] Failed to mark scan as eaten:", error);
    } finally {
      setSaving(false);
    }
  };

  
  if (hasPermission === null) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.loadingMessage}>Loading camera...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.loadingMessage}>No access to camera</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.buttonText}>Go to Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  
  return (
    <View style={styles.container}>
      {/* Full screen camera */}
      <CameraView
        ref={cameraRef}
        style={styles.fullCamera}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
        }}
        onBarcodeScanned={scanned || isAnalyzing || scanMode !== "barcode" ? undefined : handleBarCodeScanned}
        enableTorch={flashEnabled}
      />

      {/* Top overlay with title and subtitle */}
      <View
        style={[
          styles.topOverlay,
          isCompactScreen ? styles.topOverlayCompact : undefined,
          isSmallScreen ? styles.topOverlayTight : undefined,
          { paddingTop: insets.top + rs(isSmallScreen ? 8 : 12) },
        ]}
      >
        <View style={[styles.titleContainer, isSmallScreen ? styles.titleContainerTight : undefined]}>
          <Text style={[styles.mainTitle, isSmallScreen ? styles.mainTitleTight : undefined]}>Scan a product</Text>
          <Text style={[styles.mainSubtitle, isSmallScreen ? styles.mainSubtitleTight : undefined]}>
            {scanState === "analyzing" 
              ? "Analyzing product..." 
              : scanState === "detecting"
                ? scanGuidance || "Barcode detected!"
                : scanState === "processing"
                  ? "Review detected ingredients and portions"
                : scanMode === "barcode" 
                  ? "Point camera at barcode to scan instantly" 
                  : "Position product or meal within the frame"
            }
          </Text>
          {errorType && scanState === "error" ? (
            <Text style={styles.errorHintText}>
              {errorType === "network_error"
                ? "Network issue detected. Retry when connected."
                : errorType === "product_not_found"
                  ? "Product not found in our database."
                  : "Scan failed. Please retake once."}
            </Text>
          ) : null}
          
          {/* Analysis progress */}
          {scanState === "analyzing" && scanMode === "photo" && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Analysis Progress</Text>
              <Text style={styles.progressLabel}>{analysisStageMessage}</Text>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.max(0, Math.min(100, analysisProgress))}%`
                    }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{analysisProgress}%</Text>
            </View>
          )}
        </View>
        
        {/* Mode toggle */}
        <View style={[styles.modeSwitch, isSmallScreen ? styles.modeSwitchTight : undefined]}>
          {([
            { id: "barcode", label: "Barcode" },
            { id: "photo", label: "Photo" },
          ] as const).map((mode) => {
            const active = scanMode === mode.id;
            return (
              <TouchableOpacity
                key={mode.id}
                style={[
                  styles.modeButton,
                  isSmallScreen ? styles.modeButtonTight : undefined,
                  active && styles.modeButtonActive,
                ]}
                onPress={() => handleScanModeChange(mode.id)}
                activeOpacity={0.85}
                disabled={isAnalyzing}
              >
                <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{mode.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {variant === "onboarding" ? (
          <TouchableOpacity
            style={[styles.skipButton, isSmallScreen ? styles.skipButtonTight : undefined]}
            onPress={handleSkipOnboardingScan}
            activeOpacity={0.85}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={[styles.closeButton, { top: insets.top + rs(isSmallScreen ? 8 : 12) }]} onPress={() => {
          if (variant === "onboarding") {
            router.back();
          } else {
            if (previousTab === "index") {
              router.push("/(tabs)");
            } else {
              router.back();
            }
          }
        }}>
          <View style={styles.closeButtonBackground}>
            <Ionicons name="close" size={24} color={Colors.backgroundWhite} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Center scanning frame */}
      <View
        style={[
          styles.centerOverlay,
          scanMode === "barcode" ? styles.centerOverlayBarcode : styles.centerOverlayPhoto,
          scanMode === "barcode"
            ? { marginTop: frameMetrics.barcodeOffset }
            : { marginTop: frameMetrics.photoOffset },
        ]}
      >
        <Animated.View
          style={[
            scanMode === "barcode" ? styles.barcodeScanFrame : styles.scanFrame,
            scanMode === "barcode"
              ? { width: frameMetrics.barcodeWidth, height: frameMetrics.barcodeHeight }
              : { width: frameMetrics.photoSize, height: frameMetrics.photoSize },
          ]}
        >
          {scanMode === "barcode" && isActivelyScanning && !showResult && !scanned && !isAnalyzing ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scanLine,
                { transform: [{ translateY: scanLineTranslate }] },
              ]}
            />
          ) : null}
          
          {/* Premium animated corners */}
          <Animated.View 
            style={[
              styles.cornerOutline, 
              styles.topLeftCorner,
              scanState === "detecting" && {
                transform: [{ scale: detectionPulse }],
                borderColor: detectionQuality > 0.7 ? Colors.success : 
                             detectionQuality > 0.4 ? Colors.warning : Colors.error,
                borderWidth: 4,
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.cornerOutline, 
              styles.topRightCorner,
              scanState === "detecting" && {
                transform: [{ scale: detectionPulse }],
                borderColor: detectionQuality > 0.7 ? Colors.success : 
                             detectionQuality > 0.4 ? Colors.warning : Colors.error,
                borderWidth: 4,
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.cornerOutline, 
              styles.bottomLeftCorner,
              scanState === "detecting" && {
                transform: [{ scale: detectionPulse }],
                borderColor: detectionQuality > 0.7 ? Colors.success : 
                             detectionQuality > 0.4 ? Colors.warning : Colors.error,
                borderWidth: 4,
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.cornerOutline, 
              styles.bottomRightCorner,
              scanState === "detecting" && {
                transform: [{ scale: detectionPulse }],
                borderColor: detectionQuality > 0.7 ? Colors.success : 
                             detectionQuality > 0.4 ? Colors.warning : Colors.error,
                borderWidth: 4,
              }
            ]} 
          />
        </Animated.View>
        
        {scanMode === "barcode" && (
          <View>
            <Text style={[styles.scanInstruction, isSmallScreen ? styles.scanInstructionTight : undefined]}>
              {scanGuidance || "Position barcode within the frame"}
            </Text>
            {isAnalyzing && (
              <View style={styles.lookupFeedbackCard}>
                <Text style={styles.lookupFeedbackText}>
                  {lookupPhase === 'searching' && "Looking up product..."}
                  {lookupPhase === 'off' && "Checking Open Food Facts..."}
                  {lookupPhase === 'secondary' && "Trying other databases..."}
                  {lookupPhase === 'notfound' && "Product not found"}
                </Text>
              </View>
            )}
          </View>
        )}

        {scanMode === "photo" && !isAnalyzing && !showMealConfirmation && (
          <View style={[styles.photoGuidanceCard, isSmallScreen ? styles.photoGuidanceCardTight : undefined]}>
            <Text style={styles.photoGuidanceTitle}>Photo Tips</Text>
            <Text style={[styles.photoGuidanceText, isSmallScreen ? styles.photoGuidanceTextTight : undefined]}>
              {"Keep the full meal in frame and avoid blur for best ingredient detection."}
            </Text>
          </View>
        )}
      </View>

      
      {scanMode === "photo" ? (
        <View style={[styles.captureContainer, isSmallScreen ? styles.captureContainerTight : undefined]}>
          <TouchableOpacity
            style={[styles.captureButton, isAnalyzing && styles.captureButtonDisabled]}
            onPress={handleCapturePhoto}
            disabled={isAnalyzing || showMealConfirmation}
          >
            <Ionicons name={isAnalyzing ? "time-outline" : "camera-outline"} size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={showMealConfirmation && !!currentScanResult}
        animationType="slide"
        transparent
        onRequestClose={handleMealConfirmationCancel}
      >
        <View style={styles.resultModalRoot}>
          <Pressable style={styles.resultBackdrop} onPress={handleMealConfirmationCancel} />
          <View style={[styles.resultSheetWrap, styles.mealConfirmationWrap]}>
            {currentScanResult ? (
              <MealConfirmationScreen
                detectedIngredients={(currentScanResult.mealComponents ?? []).map((component) => component.ingredient)}
                portionAdjustments={currentScanResult.portionAdjustments ?? []}
                onConfirm={handleMealConfirmationConfirm}
                onCancel={handleMealConfirmationCancel}
                imageUrl={capturedPhotoUri}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showResult && !!currentScanResult}
        animationType="slide"
        transparent
        onRequestClose={handleDismiss}
      >
        <View style={styles.resultModalRoot}>
          <Pressable style={styles.resultBackdrop} onPress={handleDismiss} />

          <Animated.View 
            style={[styles.resultSheetWrap, { height: sheetHeightAnim, minHeight: MIN_VISIBLE_SHEET_HEIGHT }]}
          >
            {currentScanResult && (
              <ScanResultSheet
                variant="sheet"
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
                alternativesLoading={alternativesLoading}
                sheetHeightAnim={sheetHeightAnim}
                onSheetStateChange={(fullScreen) => {
                  setSheetFullScreen(fullScreen);
                }}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    backgroundColor: "#000000", // Black background to match camera view
    justifyContent: "center",
    alignItems: "center",
  },
  fullCamera: {
    flex: 1,
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: rs(20),
    alignItems: "center",
    zIndex: 5,
  },
  topOverlayCompact: {
    paddingHorizontal: rs(16),
  },
  topOverlayTight: {
    paddingHorizontal: rs(12),
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: rs(16),
  },
  titleContainerTight: {
    marginBottom: rs(12),
  },
  mainTitle: {
    fontSize: rf(24),
    fontWeight: "600",
    color: Colors.backgroundWhite,
    textAlign: "center",
  },
  mainTitleTight: {
    fontSize: rf(21),
    lineHeight: rf(26),
  },
  mainSubtitle: {
    fontSize: rf(14),
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginTop: rs(4),
  },
  mainSubtitleTight: {
    fontSize: rf(13),
    lineHeight: rf(18),
  },
  errorHintText: {
    marginTop: rs(6),
    fontSize: rf(12),
    color: "#FFD6D6",
    textAlign: "center",
  },
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 3,
    borderRadius: rs(22),
  },
  modeSwitchTight: {
    padding: 2,
  },
  modeButton: {
    minWidth: rs(92),
    paddingVertical: rs(10),
    paddingHorizontal: rs(16),
    borderRadius: rs(18),
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonTight: {
    minWidth: rs(78),
    paddingVertical: rs(8),
    paddingHorizontal: rs(12),
  },
  modeButtonActive: {
    backgroundColor: Colors.backgroundWhite,
  },
  modeButtonText: {
    fontSize: rf(14),
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  modeButtonTextActive: {
    color: Colors.text,
  },
  skipButton: {
    marginTop: rs(12),
    paddingHorizontal: rs(18),
    paddingVertical: rs(8),
    borderRadius: rs(18),
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    alignSelf: "center",
  },
  skipButtonTight: {
    marginTop: rs(8),
    paddingHorizontal: rs(14),
    paddingVertical: rs(6),
  },
  skipButtonText: {
    fontSize: rf(14),
    fontWeight: "600",
    color: Colors.backgroundWhite,
  },
  closeButton: {
    position: "absolute",
    right: rs(20),
    padding: rs(8),
  },
  closeButtonBackground: {
    width: rs(40),
    height: rs(40),
    borderRadius: rs(20),
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerOverlay: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centerOverlayPhoto: {
  },
  centerOverlayBarcode: {
  },
  scanFrame: {
    position: "relative",
    borderRadius: rs(16),
  },
  barcodeScanFrame: {
    position: "relative",
    borderRadius: rs(16),
  },
  scanLine: {
    position: "absolute",
    left: "5%",
    right: "5%",
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  cornerOutline: {
    position: "absolute",
    width: rs(24),
    height: rs(24),
    borderColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 3,
  },
  topLeftCorner: {
    top: -1,
    left: -1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  topRightCorner: {
    top: -1,
    right: -1,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  bottomLeftCorner: {
    bottom: -1,
    left: -1,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  bottomRightCorner: {
    bottom: -1,
    right: -1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  scanInstruction: {
    fontSize: rf(16),
    color: Colors.backgroundWhite,
    marginTop: rs(24),
    textAlign: "center",
  },
  scanInstructionTight: {
    fontSize: rf(14),
    marginTop: rs(16),
    paddingHorizontal: rs(16),
  },
  // Premium UI styles
  qualityIndicatorContainer: {
    marginTop: 12,
    alignItems: "center",
  },
  qualityLabel: {
    fontSize: rf(12),
    color: "rgba(255,255,255,0.8)",
    marginBottom: rs(4),
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  qualityBar: {
    width: rs(200),
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  qualityFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressContainer: {
    marginTop: 12,
    alignItems: "center",
  },
  progressLabel: {
    fontSize: rf(12),
    color: "rgba(255,255,255,0.8)",
    marginBottom: rs(4),
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  progressBar: {
    width: rs(200),
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  progressText: {
    fontSize: rf(12),
    color: Colors.backgroundWhite,
    marginTop: rs(4),
    fontWeight: "600",
  },
  photoGuidanceCard: {
    marginTop: rs(16),
    backgroundColor: "rgba(0,0,0,0.45)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: rs(12),
    paddingHorizontal: rs(14),
    paddingVertical: rs(10),
    maxWidth: rs(320),
    width: "90%",
    alignSelf: "center",
  },
  photoGuidanceCardTight: {
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
    width: "100%",
  },
  lookupFeedbackCard: {
    marginTop: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderColor: "rgba(255,255,255,0.3)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  lookupFeedbackText: {
    fontSize: rf(13),
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
    textAlign: "center",
  },
  photoGuidanceTitle: {
    color: Colors.backgroundWhite,
    fontSize: rf(12),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: rs(4),
  },
  photoGuidanceText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: rf(13),
    lineHeight: rf(18),
    textAlign: "center",
  },
  photoGuidanceTextTight: {
    fontSize: rf(12),
    lineHeight: rf(16),
  },
  captureContainer: {
    position: "absolute",
    bottom: rs(40),
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureContainerTight: {
    bottom: rs(28),
  },
  captureButton: {
    width: rs(72),
    height: rs(72),
    borderRadius: rs(36),
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: Colors.backgroundWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  message: {
    fontSize: rf(16),
    color: Colors.text,
    textAlign: "center",
    margin: rs(20),
  },
  loadingMessage: {
    fontSize: rf(16),
    color: "#FFFFFF", // White text for black background
    textAlign: "center",
    margin: rs(20),
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: rs(20),
    paddingVertical: rs(12),
    borderRadius: rs(8),
    margin: rs(20),
  },
  buttonText: {
    color: "white",
    fontSize: rf(16),
    fontWeight: "500",
    textAlign: "center",
  },
  resultModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  resultBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  resultSheetWrap: {
    borderTopLeftRadius: rs(28),
    borderTopRightRadius: rs(28),
    overflow: "hidden",
    backgroundColor: Colors.background,
  },
  mealConfirmationWrap: {
    height: "88%",
    maxHeight: "88%",
  },
  sheetDragHandleZone: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: rs(14),
    paddingBottom: rs(12),
    minHeight: rs(38),
    backgroundColor: Colors.background,
  },
  sheetDragHandle: {
    width: rs(52),
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.border,
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
