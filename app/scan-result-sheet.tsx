import { ProductScanResultScreen } from "@/components/scan-result/ProductScanResultScreen";
import { ScanResultColors } from "@/constants/theme";
import type { AlternativeProduct } from "@/lib/product-alternatives";
import { getProductInsightFromScan } from "@/lib/scan-result/map-legacy-scan";
import { mapAlternativeProducts } from "@/lib/scan-result/map-alternatives";
import type { OnboardingProfile } from "@/lib/onboarding-storage";
import { supabase } from "@/lib/supabase";
import type { ProductAlternative } from "@/types/product-scan";
import type { ScanResult } from "@/types/scan";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { ScanResultSheetLegacy } from "./scan-result-sheet-legacy";
import { ScanResultSheetChrome } from "@/components/scan-result/ScanResultSheetChrome";

export interface ScanResultSheetProps {
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
  alternativesLoading?: boolean;
  sheetHeightAnim?: Animated.Value;
  onSheetStateChange?: (fullScreen: boolean) => void;
}

function isProductScan(result: ScanResult): boolean {
  return !result.isMeal;
}

export function ScanResultSheet(props: ScanResultSheetProps) {
  if (!isProductScan(props.result)) {
    return <ScanResultSheetLegacy {...props} />;
  }
  return <ProductScanResultSheet {...props} />;
}

function ProductScanResultSheet({
  variant,
  result,
  onDismiss,
  onScanAgain,
  saved,
  savedScanId,
  savedAlternatives,
  alternativesLoading,
  sheetHeightAnim,
  onSheetStateChange,
  saving: parentSaving,
}: ScanResultSheetProps) {
  const router = useRouter();
  const { height: windowHeight } = Dimensions.get("window");
  const collapsedHeight = Math.max(200, windowHeight * 0.25);
  const fullHeight = windowHeight;

  const [sheetFullScreen, setSheetFullScreen] = useState(variant === "page");
  const [saving, setSaving] = useState(false);
  const [savedFavorite, setSavedFavorite] = useState(saved);
  const [sharing, setSharing] = useState(false);

  const internalAnim = useRef(new Animated.Value(variant === "page" ? fullHeight : collapsedHeight)).current;
  const heightAnim = sheetHeightAnim ?? internalAnim;

  const expandSheet = useCallback(() => {
    setSheetFullScreen(true);
    onSheetStateChange?.(true);
    Animated.spring(heightAnim, {
      toValue: fullHeight,
      useNativeDriver: false,
      friction: 9,
    }).start();
  }, [fullHeight, heightAnim, onSheetStateChange]);

  const collapseSheet = useCallback(() => {
    if (variant === "page") return;
    setSheetFullScreen(false);
    onSheetStateChange?.(false);
    Animated.spring(heightAnim, {
      toValue: collapsedHeight,
      useNativeDriver: false,
      friction: 9,
    }).start();
  }, [collapsedHeight, heightAnim, onSheetStateChange, variant]);

  useEffect(() => {
    if (variant === "sheet") {
      heightAnim.setValue(collapsedHeight);
      setSheetFullScreen(false);
      onSheetStateChange?.(false);
    }
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => variant === "sheet" && Math.abs(g.dy) > 8,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40) expandSheet();
        else if (g.dy > 40) collapseSheet();
      },
    }),
  ).current;

  const handleSave = useCallback(async () => {
    if (!savedScanId || savedFavorite) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("meal_scans")
        .update({ is_favorite: true })
        .eq("id", savedScanId)
        .eq("user_id", user.id);
      setSavedFavorite(true);
    } finally {
      setSaving(false);
    }
  }, [savedScanId, savedFavorite]);

  const handleShare = useCallback(async (shareRef: React.RefObject<View | null>) => {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(shareRef, { format: "png", quality: 0.95 });
      await Share.share({
        url: Platform.OS === "ios" ? uri : uri,
        message: Platform.OS === "android" ? "My Gutsy health report" : undefined,
      });
    } catch {
      /* user cancelled */
    } finally {
      setSharing(false);
    }
  }, []);

  const handleSelectAlternative = useCallback(
    (alt: ProductAlternative) => {
      if (alt.barcode) {
        onDismiss();
        router.push({ pathname: "/(tabs)/scan", params: { barcode: alt.barcode } });
      }
    },
    [onDismiss, router],
  );

  const insight = getProductInsightFromScan(result, savedAlternatives);
  if (savedAlternatives?.length && insight.alternatives.length === 0) {
    insight.alternatives = mapAlternativeProducts(savedAlternatives);
  }

  const content = (
    <ProductScanResultScreen
      result={result}
      savedAlternatives={savedAlternatives}
      alternativesLoading={alternativesLoading}
      scrollEnabled={variant === "page" || sheetFullScreen}
      sheetFullScreen={sheetFullScreen}
      onDismiss={onDismiss}
      onExpand={variant === "sheet" ? expandSheet : undefined}
      onScanAgain={onScanAgain}
      onSave={handleSave}
      onShare={handleShare}
      onSelectAlternative={handleSelectAlternative}
      saving={saving || parentSaving}
      saved={savedFavorite}
      sharing={sharing}
    />
  );

  if (variant === "page") {
    return <View style={styles.page}>{content}</View>;
  }

  return (
    <View style={styles.sheetRoot}>
      <ScanResultSheetChrome
        panHandlers={panResponder.panHandlers}
        onPress={() => {
          if (sheetFullScreen) collapseSheet();
          else expandSheet();
        }}
      />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: ScanResultColors.background },
  sheetRoot: { flex: 1, backgroundColor: ScanResultColors.background },
});
